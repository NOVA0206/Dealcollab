import { auth } from '@/auth';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

function formatSize(min: number | string | null, max: number | string | null): string | null {
  if (!min && !max) return null;
  const minVal = min ? Number(min) : null;
  const maxVal = max ? Number(max) : null;
  if (minVal && maxVal && minVal !== maxVal) return `₹${minVal}–${maxVal} Cr`;
  return `₹${maxVal || minVal} Cr`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    const { data: dbUser, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (userErr || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const type = req.nextUrl.searchParams.get('type') || 'all'; // outbound, inbound, or all

    let query = supabase.from('eois').select(`
      id,
      deal_id,
      match_id,
      sender_id,
      receiver_id,
      status,
      created_at,
      sender:users!sender_id(name, email, phone, firm_name, role),
      receiver:users!receiver_id(name, email, phone, firm_name, role),
      deal:proposals!deal_id(intent, sectors, deal_size_min_cr, deal_size_max_cr, normalised_text),
      match:proposal_matches!match_id(
        id,
        matched_proposal:proposals!matched_proposal_id(
          id,
          intent,
          sectors,
          geographies,
          deal_size_min_cr,
          deal_size_max_cr,
          normalised_text,
          advisor_name,
          contact_phone
        )
      )
    `);

    if (type === 'outbound') {
      query = query.eq('sender_id', dbUser.id);
    } else if (type === 'inbound') {
      query = query.eq('receiver_id', dbUser.id);
    } else {
      query = query.or(`sender_id.eq.${dbUser.id},receiver_id.eq.${dbUser.id}`);
    }

    const { data: eois, error: eoiErr } = await query.order('created_at', { ascending: false });
    if (eoiErr) throw eoiErr;

    // Filter sensitive info if not approved
    const safeEois = eois.map(eoi => {
      const isSender = eoi.sender_id === dbUser.id;
      const isApproved = eoi.status === 'approved';

      // If we are sender, hide receiver identity unless approved
      if (isSender && !isApproved && eoi.receiver) {
        eoi.receiver = { name: "Confidential Counterparty" } as unknown as typeof eoi.receiver;
      }
      // If we are receiver, hide sender identity unless approved
      if (!isSender && !isApproved && eoi.sender) {
        eoi.sender = { name: "Confidential Counterparty" } as unknown as typeof eoi.sender;
      }

      // Extract match and matched proposal safely handling arrays
      const matchArray = eoi.match as unknown;
      const matchObj = Array.isArray(matchArray) ? (matchArray[0] as Record<string, unknown>) : (matchArray as Record<string, unknown>);
      const matchedProposalArray = matchObj?.matched_proposal;
      const matchedProposal = Array.isArray(matchedProposalArray) ? (matchedProposalArray[0] as Record<string, unknown>) : (matchedProposalArray as Record<string, unknown>);

      // Map proposals to deal format expected by frontend
      const rawDeal = isSender ? matchedProposal : (eoi.deal as unknown as Record<string, unknown>);
      const mappedDeal = rawDeal ? {
        title: rawDeal.normalised_text ? (String(rawDeal.normalised_text).slice(0, 60).trim() + (String(rawDeal.normalised_text).length > 60 ? '...' : '')) : 'Confidential Mandate',
        sector: Array.isArray(rawDeal.sectors) ? String(rawDeal.sectors[0]) : 'N/A',
        size: formatSize(rawDeal.deal_size_min_cr as number | null, rawDeal.deal_size_max_cr as number | null) || 'N/A'
      } : null;

      // Handle null/missing receiver details for seed proposals when we are the sender
      let mappedReceiver = eoi.receiver;
      if (isSender && !eoi.receiver) {
        mappedReceiver = {
          name: isApproved ? (String(matchedProposal?.advisor_name || "Confidential Advisor")) : "Confidential Counterparty",
          email: isApproved ? "unlocked@dealcollab.in" : "",
          phone: isApproved ? (String(matchedProposal?.contact_phone || "")) : "",
          firm_name: isApproved ? "DealCollab Network" : "",
          role: "Advisor"
        } as unknown as typeof eoi.receiver;
      }

      return {
        ...eoi,
        receiver: mappedReceiver,
        deal: mappedDeal
      };
    });

    return NextResponse.json(safeEois);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🔥 GET /api/eois ERROR:", error);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { dealId, matchId, receiverId, metadata } = body;

    if (!dealId) return NextResponse.json({ error: 'dealId is required' }, { status: 400 });

    // Server-side validation of required EOI fields
    if (metadata) {
      const required = ['fullName', 'companyName', 'designation', 'email', 'phone', 'investmentInterest'];
      const missing = required.filter(f => !metadata[f]?.trim?.());
      if (missing.length > 0) {
        return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
      }
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    const { data: dbUser } = await supabase.from('users').select('id').eq('email', session.user.email).single();
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: eoi, error: eoiErr } = await supabase
      .from('eois')
      .insert([{
        deal_id: dealId,
        match_id: matchId,
        sender_id: dbUser.id,
        receiver_id: receiverId,
        status: 'sent',
        metadata: metadata || {},
      }])
      .select()
      .single();

    if (eoiErr) throw eoiErr;

    // Trigger Notification for Receiver if exists
    if (receiverId) {
      await supabase.from('notifications').insert([{
        user_id: receiverId,
        type: 'EOI_RECEIVED',
        message: 'You have received a new Expression of Interest.',
        is_read: 'false'
      }]);
    }

    return NextResponse.json(eoi);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🔥 POST /api/eois ERROR:", error);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

const TOKEN_COST = 50;

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, status } = body; // status: 'approved' | 'declined'

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    const { data: dbUser } = await supabase.from('users').select('id').eq('email', session.user.email).single();
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Ensure user is the receiver and fetch token_deducted flag
    const { data: existingEoi, error: fetchErr } = await supabase
      .from('eois')
      .select('receiver_id, sender_id, token_deducted')
      .eq('id', id)
      .single();

    if (fetchErr || !existingEoi) throw new Error("EOI not found");
    if (existingEoi.receiver_id !== dbUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: eoi, error: eoiErr } = await supabase
      .from('eois')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (eoiErr) throw eoiErr;

    // Token deduction — only when approving and not already deducted
    if (status === 'approved' && !existingEoi.token_deducted) {
      try {
        // Atomic lock: update token_deducted only if still false (race condition guard)
        const { data: lockResult } = await supabase
          .from('eois')
          .update({ token_deducted: true, token_deducted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('token_deducted', false)
          .select('id')
          .single();

        if (lockResult) {
          // We hold the lock — proceed with deduction from sender's balance
          const { data: senderUser } = await supabase
            .from('users')
            .select('id, tokens')
            .eq('id', existingEoi.sender_id)
            .single();

          if (senderUser && (senderUser.tokens ?? 0) >= TOKEN_COST) {
            const newBalance = (senderUser.tokens ?? 0) - TOKEN_COST;
            await supabase
              .from('users')
              .update({ tokens: newBalance })
              .eq('id', senderUser.id);

            await supabase.from('token_transactions').insert([{
              user_id: senderUser.id,
              type: 'debit',
              action: 'EOI Approved — Connection with Deal',
              amount: -TOKEN_COST,
              balance_after: newBalance,
            }]);

            // Notify sender of deduction
            await supabase.from('notifications').insert([{
              user_id: existingEoi.sender_id,
              type: 'TOKENS_DEDUCTED',
              message: `Your EOI was approved. ${TOKEN_COST} tokens have been deducted from your account.`,
              is_read: 'false'
            }]);
          } else {
            // Insufficient tokens — still approved but log
            console.warn(`[EOI APPROVE] Sender ${existingEoi.sender_id} has insufficient tokens for deduction.`);
          }
        }
      } catch (tokenErr) {
        // Token deduction failure must not block the approval response
        console.error("🔥 Token deduction on EOI approval failed:", tokenErr);
      }
    }

    // Notify Sender of approval/decline
    await supabase.from('notifications').insert([{
      user_id: existingEoi.sender_id,
      type: `EOI_${status.toUpperCase()}`,
      message: `Your Expression of Interest was ${status}.`,
      is_read: 'false'
    }]);

    return NextResponse.json(eoi);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🔥 PATCH /api/eois ERROR:", error);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id param' }, { status: 400 });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase client failed to initialize");

    const { data: dbUser } = await supabase.from('users').select('id').eq('email', session.user.email).single();
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Fetch EOI to verify ownership
    const { data: existingEoi, error: fetchErr } = await supabase
      .from('eois')
      .select('sender_id, receiver_id')
      .eq('id', id)
      .single();

    if (fetchErr || !existingEoi) {
      return NextResponse.json({ error: 'EOI not found' }, { status: 404 });
    }

    if (existingEoi.sender_id !== dbUser.id && existingEoi.receiver_id !== dbUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the EOI
    const { error: deleteErr } = await supabase
      .from('eois')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("🔥 DELETE /api/eois ERROR:", error);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
