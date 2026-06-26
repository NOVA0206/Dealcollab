import { auth } from '@/auth';
import { buildCanonicalText, ProposalInput } from '@/lib/matchmakingEngine';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const VALID_INTENTS = new Set([
  'BUY_SIDE', 'SELL_SIDE', 'FUNDRAISING', 'DEBT', 'STRATEGIC_PARTNERSHIP',
]);

// ─── Simple CSV parser (handles quoted fields) ────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }
  return rows;
}

// ─── Embed text via OpenAI ────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error('Supabase client failed to initialize');

    const { data: dbUser, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (userErr || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are supported. Please export your Excel file as CSV.' },
        { status: 400 },
      );
    }

    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row.' }, { status: 400 });
    }

    // Normalize headers
    const rawHeaders = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    const headerIndex = (names: string[]): number => {
      for (const name of names) {
        const idx = rawHeaders.indexOf(name);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const col = {
      intent: headerIndex(['intent']),
      sectors: headerIndex(['sectors', 'sector']),
      geographies: headerIndex(['geographies', 'geography', 'geo']),
      description: headerIndex(['description', 'raw_text', 'text', 'mandate_text', 'details']),
      deal_size_min: headerIndex(['deal_size_min', 'size_min', 'deal_size_min_cr']),
      deal_size_max: headerIndex(['deal_size_max', 'size_max', 'deal_size_max_cr']),
      revenue_min: headerIndex(['revenue_min', 'rev_min', 'revenue_min_cr']),
      revenue_max: headerIndex(['revenue_max', 'rev_max', 'revenue_max_cr']),
      deal_structure: headerIndex(['deal_structure', 'structure']),
      advisor_name: headerIndex(['advisor_name', 'advisor']),
      contact_phone: headerIndex(['contact_phone', 'phone']),
    };

    if (col.intent === -1 || col.sectors === -1 || col.description === -1) {
      return NextResponse.json(
        {
          error: 'CSV must include columns: intent, sectors, description. Optional: geographies, deal_size_min, deal_size_max, revenue_min, revenue_max, deal_structure, advisor_name, contact_phone',
        },
        { status: 400 },
      );
    }

    const dataRows = rows.slice(1);
    let inserted = 0;
    let embedded = 0;
    const skipped: { row: number; reason: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-indexed, offset by header

      const get = (idx: number) => (idx !== -1 && idx < row.length ? row[idx] : '');

      const intentRaw = get(col.intent).toUpperCase().trim();
      const description = get(col.description).trim();
      const sectorsRaw = get(col.sectors).trim();

      // Validation
      if (!VALID_INTENTS.has(intentRaw)) {
        skipped.push({ row: rowNum, reason: `Invalid intent: "${intentRaw}". Must be one of: ${[...VALID_INTENTS].join(', ')}` });
        continue;
      }
      if (!description || description.length < 10) {
        skipped.push({ row: rowNum, reason: 'Description is required (min 10 characters).' });
        continue;
      }
      if (!sectorsRaw) {
        skipped.push({ row: rowNum, reason: 'Sectors field is required.' });
        continue;
      }

      const sectors = sectorsRaw.split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const geographies = get(col.geographies).split(/[,;|]/).map((g) => g.trim()).filter(Boolean);
      const dealSizeMin = get(col.deal_size_min) ? parseFloat(get(col.deal_size_min)) : null;
      const dealSizeMax = get(col.deal_size_max) ? parseFloat(get(col.deal_size_max)) : null;
      const revenueMin = get(col.revenue_min) ? parseFloat(get(col.revenue_min)) : null;
      const revenueMax = get(col.revenue_max) ? parseFloat(get(col.revenue_max)) : null;
      const dealStructure = get(col.deal_structure) || null;
      const advisorName = get(col.advisor_name) || null;
      const contactPhone = get(col.contact_phone) || null;

      try {
        // Insert mandate (legacy table — parallel write for backward compat)
        const { data: mandate, error: mandateErr } = await supabase
          .from('mandates')
          .insert({
            user_id: dbUser.id,
            raw_text: description,
            intent: intentRaw,
            sectors,
            geographies,
            deal_size_min_cr: dealSizeMin,
            deal_size_max_cr: dealSizeMax,
            revenue_min_cr: revenueMin,
            revenue_max_cr: revenueMax,
            deal_structure: dealStructure,
            status: 'ACTIVE',
            source: 'bulk_upload',
          })
          .select('id')
          .single();

        if (mandateErr || !mandate) {
          skipped.push({ row: rowNum, reason: `DB insert failed: ${mandateErr?.message ?? 'unknown'}` });
          continue;
        }

        // Build canonical text for embedding
        const proposalInput: ProposalInput = {
          mandateId: mandate.id,
          userId: dbUser.id,
          intent: intentRaw,
          raw_text: description,
          sector: sectors[0] ?? null,
          sub_sector: null,
          geography: geographies[0] ?? null,
          deal_size: dealSizeMin != null ? `${dealSizeMin}` : null,
          revenue: revenueMin != null ? `${revenueMin}` : null,
          structure: dealStructure,
          intent_focus: null,
          industry_data: {},
          special_conditions: [],
          deal_size_min: dealSizeMin != null ? `${dealSizeMin}` : null,
          deal_size_max: dealSizeMax != null ? `${dealSizeMax}` : null,
          revenue_min: revenueMin != null ? `${revenueMin}` : null,
          revenue_max: revenueMax != null ? `${revenueMax}` : null,
        };
        const canonicalText = buildCanonicalText(proposalInput);

        // Insert proposal
        const { data: proposal, error: propErr } = await supabase
          .from('proposals')
          .insert({
            user_id: dbUser.id,
            mandate_id: mandate.id,
            raw_text: description,
            normalised_text: canonicalText,
            intent: intentRaw,
            sectors,
            geographies,
            deal_size_min_cr: dealSizeMin,
            deal_size_max_cr: dealSizeMax,
            revenue_min_cr: revenueMin,
            revenue_max_cr: revenueMax,
            deal_structure: dealStructure,
            advisor_name: advisorName,
            contact_phone: contactPhone,
            special_conditions: [],
            quality_score: 60,
            quality_tier: 2,
            status: 'ACTIVE',
            source: 'bulk_upload',
            embedding_status: 'PENDING',
            metadata: {},
          })
          .select('id')
          .single();

        if (propErr || !proposal) {
          skipped.push({ row: rowNum, reason: `Proposal insert failed: ${propErr?.message ?? 'unknown'}` });
          continue;
        }

        inserted++;

        // Generate and store embedding
        const embedding = await embedText(canonicalText);
        const { error: embErr } = await supabase.rpc('update_proposal_embedding', {
          proposal_id: proposal.id,
          embedding_vector: embedding,
        });

        if (embErr) {
          console.error(`[BULK_UPLOAD] Embedding store failed for row ${rowNum}:`, embErr);
          // Not fatal — Search Matches will regenerate if needed
        } else {
          await supabase
            .from('proposals')
            .update({ embedding_status: 'DONE' })
            .eq('id', proposal.id);
          embedded++;
        }
      } catch (rowErr) {
        skipped.push({ row: rowNum, reason: rowErr instanceof Error ? rowErr.message : String(rowErr) });
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      embedded,
      skipped,
      total: dataRows.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[BULK_UPLOAD] Error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
