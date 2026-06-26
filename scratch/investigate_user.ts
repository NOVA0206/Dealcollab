/**
 * Investigation script: Trace backend-pushed mandates for a specific user.
 * READ-ONLY — no writes, no deletes, no updates.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TARGET_USER_ID = '6fa06d21-c203-4935-a6c0-dc248638f241';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function section(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function sub(title: string) {
  console.log(`\n── ${title} ──`);
}

async function main() {
  console.log('DealCollab — User Mandate Investigation Report');
  console.log(`Target User ID: ${TARGET_USER_ID}`);
  console.log(`Generated: ${new Date().toISOString()}`);

  // ─── 1. User Verification ─────────────────────────────────────────────────
  section('1. USER VERIFICATION');

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, name, email, phone, is_phone_verified, profile_completion, role, firm_name, source, created_at')
    .eq('id', TARGET_USER_ID)
    .single();

  if (userErr || !user) {
    console.log('❌ USER NOT FOUND:', userErr?.message ?? 'No record');
    process.exit(1);
  }

  console.log('✅ User exists');
  console.log(`   ID:                ${user.id}`);
  console.log(`   Name:              ${user.name ?? '(null)'}`);
  console.log(`   Email:             ${user.email}`);
  console.log(`   Phone:             ${user.phone ?? '(null)'}`);
  console.log(`   Phone Verified:    ${user.is_phone_verified}`);
  console.log(`   Role:              ${user.role ?? '(null)'}`);
  console.log(`   Firm:              ${user.firm_name ?? '(null)'}`);
  console.log(`   Profile Compl:     ${user.profile_completion}`);
  console.log(`   Source:            ${user.source}`);
  console.log(`   Created:           ${user.created_at}`);

  // ─── 2. Auth Accounts ─────────────────────────────────────────────────────
  sub('Auth accounts linked to this user');
  const { data: accounts } = await supabase
    .from('accounts')
    .select('provider, provider_account_id, type')
    .eq('user_id', TARGET_USER_ID);

  if (!accounts || accounts.length === 0) {
    console.log('   (no linked auth accounts)');
  } else {
    accounts.forEach(a => console.log(`   Provider: ${a.provider} | Type: ${a.type} | Account: ${a.provider_account_id}`));
  }

  // ─── 3. Mandates Table ────────────────────────────────────────────────────
  section('2. MANDATES TABLE (legacy)');

  const { data: mandates, error: mandateErr } = await supabase
    .from('mandates')
    .select('id, intent, sectors, geographies, status, source, created_at, deal_size_min_cr, deal_size_max_cr, raw_text')
    .eq('user_id', TARGET_USER_ID)
    .order('created_at', { ascending: false });

  if (mandateErr) {
    console.log('❌ Error fetching mandates:', mandateErr.message);
  } else if (!mandates || mandates.length === 0) {
    console.log('   No mandates found for this user.');
  } else {
    console.log(`   Total mandates: ${mandates.length}`);
    mandates.forEach((m, i) => {
      console.log(`\n   [${i + 1}] ID: ${m.id}`);
      console.log(`       Intent:    ${m.intent}`);
      console.log(`       Sectors:   ${JSON.stringify(m.sectors)}`);
      console.log(`       Status:    ${m.status}`);
      console.log(`       Source:    ${m.source}`);
      console.log(`       Size:      ${m.deal_size_min_cr ?? '?'} – ${m.deal_size_max_cr ?? '?'} Cr`);
      console.log(`       Created:   ${m.created_at}`);
      console.log(`       Raw text:  ${(m.raw_text ?? '').slice(0, 120)}...`);
    });
  }

  // ─── 4. Proposals Table ───────────────────────────────────────────────────
  section('3. PROPOSALS TABLE (canonical + matchmaking)');

  const { data: proposals, error: propErr } = await supabase
    .from('proposals')
    .select('id, intent, sectors, geographies, status, source, quality_tier, quality_score, embedding_status, created_at, mandate_id, deal_size_min_cr, deal_size_max_cr, raw_text, normalised_text, summary_text, metadata')
    .eq('user_id', TARGET_USER_ID)
    .order('created_at', { ascending: false });

  if (propErr) {
    console.log('❌ Error fetching proposals:', propErr.message);
  } else if (!proposals || proposals.length === 0) {
    console.log('   No proposals found for this user.');
  } else {
    console.log(`   Total proposals: ${proposals.length}`);

    const bySource: Record<string, number> = {};
    const byEmbedStatus: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    proposals.forEach((p, i) => {
      bySource[p.source ?? 'null'] = (bySource[p.source ?? 'null'] ?? 0) + 1;
      byEmbedStatus[p.embedding_status ?? 'null'] = (byEmbedStatus[p.embedding_status ?? 'null'] ?? 0) + 1;
      byStatus[p.status ?? 'null'] = (byStatus[p.status ?? 'null'] ?? 0) + 1;

      console.log(`\n   [${i + 1}] ID: ${p.id}`);
      console.log(`       Intent:          ${p.intent}`);
      console.log(`       Sectors:         ${JSON.stringify(p.sectors)}`);
      console.log(`       Status:          ${p.status}`);
      console.log(`       Source:          ${p.source}`);
      console.log(`       Quality Tier:    ${p.quality_tier} | Score: ${p.quality_score}`);
      console.log(`       Embedding:       ${p.embedding_status}`);
      console.log(`       Mandate ID:      ${p.mandate_id ?? '(none — direct insert?)'}`);
      console.log(`       Size:            ${p.deal_size_min_cr ?? '?'} – ${p.deal_size_max_cr ?? '?'} Cr`);
      console.log(`       Created:         ${p.created_at}`);
      console.log(`       Has summary:     ${!!p.summary_text}`);
      console.log(`       Has metadata:    ${JSON.stringify(p.metadata) !== '{}'}`);
      console.log(`       Raw text:        ${(p.raw_text ?? '').slice(0, 100)}...`);
      console.log(`       Normalised text: ${(p.normalised_text ?? '').slice(0, 100)}...`);
    });

    console.log(`\n   Summary by source:          ${JSON.stringify(bySource)}`);
    console.log(`   Summary by embedding status: ${JSON.stringify(byEmbedStatus)}`);
    console.log(`   Summary by status:           ${JSON.stringify(byStatus)}`);
  }

  // ─── 5. Proposal Matches ──────────────────────────────────────────────────
  section('4. PROPOSAL MATCHES');

  if (proposals && proposals.length > 0) {
    const proposalIds = proposals.map(p => p.id);

    const { data: matches, error: matchErr } = await supabase
      .from('proposal_matches')
      .select('id, proposal_id, matched_proposal_id, final_score, similarity_score, match_archetype, status, created_at')
      .in('proposal_id', proposalIds)
      .order('final_score', { ascending: false });

    if (matchErr) {
      console.log('❌ Error fetching matches:', matchErr.message);
    } else if (!matches || matches.length === 0) {
      console.log('   No matches found for any of this user\'s proposals.');
    } else {
      console.log(`   Total matches: ${matches.length}`);
      matches.forEach((m, i) => {
        console.log(`\n   [${i + 1}] Match ID: ${m.id}`);
        console.log(`       For Proposal:   ${m.proposal_id}`);
        console.log(`       Matched To:     ${m.matched_proposal_id}`);
        console.log(`       Final Score:    ${m.final_score}`);
        console.log(`       Similarity:     ${m.similarity_score}`);
        console.log(`       Archetype:      ${m.match_archetype}`);
        console.log(`       Status:         ${m.status}`);
        console.log(`       Created:        ${m.created_at}`);
      });
    }
  } else {
    console.log('   (skipped — no proposals to check)');
  }

  // ─── 6. Deals Table ───────────────────────────────────────────────────────
  section('5. DEALS TABLE (dashboard surface)');

  const { data: deals, error: dealsErr } = await supabase
    .from('deals')
    .select('id, title, sector, region, size, status, created_at')
    .eq('user_id', TARGET_USER_ID)
    .order('created_at', { ascending: false });

  if (dealsErr) {
    console.log('❌ Error fetching deals:', dealsErr.message);
  } else if (!deals || deals.length === 0) {
    console.log('   No deals found in deals table.');
  } else {
    console.log(`   Total deals: ${deals.length}`);
    deals.forEach((d, i) => {
      console.log(`\n   [${i + 1}] ID: ${d.id}`);
      console.log(`       Title:   ${d.title}`);
      console.log(`       Sector:  ${d.sector}`);
      console.log(`       Status:  ${d.status}`);
      console.log(`       Created: ${d.created_at}`);
    });
  }

  // ─── 7. Chat Sessions ─────────────────────────────────────────────────────
  section('6. CHAT SESSIONS');

  const { data: chatSessions, error: chatErr } = await supabase
    .from('chat_sessions')
    .select('id, title, created_at, state')
    .eq('user_id', TARGET_USER_ID)
    .order('created_at', { ascending: false });

  if (chatErr) {
    console.log('❌ Error fetching chat sessions:', chatErr.message);
  } else if (!chatSessions || chatSessions.length === 0) {
    console.log('   No chat sessions found for this user.');
  } else {
    console.log(`   Total chat sessions: ${chatSessions.length}`);
    chatSessions.forEach((cs, i) => {
      const state = cs.state as Record<string, unknown> | null;
      console.log(`\n   [${i + 1}] Session ID: ${cs.id}`);
      console.log(`       Title:   ${cs.title}`);
      console.log(`       Created: ${cs.created_at}`);
      if (state) {
        console.log(`       Phase:   ${state.phase ?? '?'}`);
        console.log(`       Intent:  ${state.intent ?? '?'}`);
        console.log(`       Complete: ${state.is_complete ?? '?'}`);
      }
    });
  }

  // ─── 8. Saved Searches ────────────────────────────────────────────────────
  section('7. SAVED SEARCHES (re-match queue)');

  const { data: savedSearches, error: ssErr } = await supabase
    .from('saved_searches')
    .select('search_id, proposal_id, status, created_at, expires_at, notified_at')
    .eq('user_id', TARGET_USER_ID);

  if (ssErr) {
    console.log('❌ Error fetching saved searches:', ssErr.message);
  } else if (!savedSearches || savedSearches.length === 0) {
    console.log('   No saved searches found.');
  } else {
    console.log(`   Total saved searches: ${savedSearches.length}`);
    savedSearches.forEach((ss, i) => {
      console.log(`\n   [${i + 1}] Search ID:  ${ss.search_id}`);
      console.log(`       Proposal ID: ${ss.proposal_id}`);
      console.log(`       Status:      ${ss.status}`);
      console.log(`       Created:     ${ss.created_at}`);
      console.log(`       Expires:     ${ss.expires_at}`);
    });
  }

  // ─── 9. DealLog API Filter Simulation ────────────────────────────────────
  section('8. DEAL LOG API FILTER SIMULATION');

  console.log('   The /api/deals endpoint uses these filters:');
  console.log('   • user_id = <authenticated user>');
  console.log('   • status = ACTIVE');
  console.log('   • source != bulk_upload   ← KEY EXCLUSION for Chat Mandates tab');
  console.log();
  console.log('   The /api/deals/bulk endpoint uses:');
  console.log('   • user_id = <authenticated user>');
  console.log('   • status = ACTIVE');
  console.log('   • source = bulk_upload   ← KEY FILTER for Bulk Mandates tab');
  console.log();

  if (proposals && proposals.length > 0) {
    const chatVisible = proposals.filter(p => p.status === 'ACTIVE' && p.source !== 'bulk_upload');
    const bulkVisible = proposals.filter(p => p.status === 'ACTIVE' && p.source === 'bulk_upload');
    const activeOther = proposals.filter(p => p.status !== 'ACTIVE');

    console.log(`   Chat Mandates tab would show:    ${chatVisible.length} proposal(s)`);
    chatVisible.forEach(p => console.log(`      → ${p.id} | source: ${p.source} | intent: ${p.intent}`));

    console.log(`   Bulk Mandates tab would show:    ${bulkVisible.length} proposal(s)`);
    bulkVisible.forEach(p => console.log(`      → ${p.id} | source: ${p.source} | intent: ${p.intent}`));

    console.log(`   Hidden (non-ACTIVE status):      ${activeOther.length} proposal(s)`);
    activeOther.forEach(p => console.log(`      → ${p.id} | status: ${p.status} | source: ${p.source}`));
  }

  // ─── 10. Final Debug Report ───────────────────────────────────────────────
  section('9. FINAL DEBUG REPORT');

  const totalProposals = proposals?.length ?? 0;
  const chatProposals = proposals?.filter(p => p.source !== 'bulk_upload') ?? [];
  const bulkProposals = proposals?.filter(p => p.source === 'bulk_upload') ?? [];
  const embDone = proposals?.filter(p => p.embedding_status === 'DONE') ?? [];
  const embPending = proposals?.filter(p => p.embedding_status === 'PENDING') ?? [];
  const embFailed = proposals?.filter(p => p.embedding_status === 'FAILED') ?? [];
  const activeProp = proposals?.filter(p => p.status === 'ACTIVE') ?? [];
  const inactiveProp = proposals?.filter(p => p.status !== 'ACTIVE') ?? [];

  const totalMandates = mandates?.length ?? 0;
  const bulkMandates = mandates?.filter(m => m.source === 'bulk_upload') ?? [];
  const webMandates = mandates?.filter(m => m.source !== 'bulk_upload') ?? [];

  console.log('\n  USER SUMMARY');
  console.log(`  ✅ User exists:           YES`);
  console.log(`     Email:                 ${user.email}`);
  console.log(`     Name:                  ${user.name ?? '(null)'}`);

  console.log('\n  MANDATES FOUND (legacy table)');
  console.log(`     Total mandates:        ${totalMandates}`);
  console.log(`     Chat/WEB mandates:     ${webMandates.length}`);
  console.log(`     Bulk mandates:         ${bulkMandates.length}`);

  console.log('\n  PROPOSALS FOUND (canonical table)');
  console.log(`     Total proposals:       ${totalProposals}`);
  console.log(`     Chat proposals:        ${chatProposals.length}`);
  console.log(`     Bulk proposals:        ${bulkProposals.length}`);
  console.log(`     Active:                ${activeProp.length}`);
  console.log(`     Inactive/other:        ${inactiveProp.length}`);

  console.log('\n  EMBEDDING SUMMARY');
  console.log(`     Embedded (DONE):       ${embDone.length}`);
  console.log(`     Pending:               ${embPending.length}`);
  console.log(`     Failed:                ${embFailed.length}`);

  const activeChat = proposals?.filter(p => p.status === 'ACTIVE' && p.source !== 'bulk_upload') ?? [];
  const activeBulk = proposals?.filter(p => p.status === 'ACTIVE' && p.source === 'bulk_upload') ?? [];

  console.log('\n  DEALLOG STATUS');
  console.log(`     Chat tab visible:      ${activeChat.length}`);
  console.log(`     Bulk tab visible:      ${activeBulk.length}`);
  console.log(`     Hidden (non-ACTIVE):   ${inactiveProp.length}`);

  console.log('\n  PROBLEMS FOUND');
  const problems: string[] = [];

  if (totalProposals === 0) {
    problems.push('No proposals exist for this user at all.');
  }
  if (embPending.length > 0) {
    problems.push(`${embPending.length} proposal(s) have embedding_status=PENDING — not yet searchable for matching.`);
  }
  if (embFailed.length > 0) {
    problems.push(`${embFailed.length} proposal(s) have embedding_status=FAILED — excluded from vector matching.`);
  }
  if (inactiveProp.length > 0) {
    problems.push(`${inactiveProp.length} proposal(s) are not ACTIVE — excluded from /api/deals.`);
  }
  const noMandate = proposals?.filter(p => !p.mandate_id) ?? [];
  if (noMandate.length > 0) {
    problems.push(`${noMandate.length} proposal(s) have no mandate_id — likely inserted directly without a legacy mandate row.`);
  }

  if (problems.length === 0) {
    console.log('   ✅ No structural problems detected.');
  } else {
    problems.forEach((p, i) => console.log(`   ${i + 1}. ⚠️  ${p}`));
  }

  console.log('\n  RECOMMENDED FIXES');
  if (embPending.length > 0) {
    console.log(`   • Run the embed-proposals script for user ${TARGET_USER_ID} to generate missing embeddings.`);
    console.log('   • Or trigger /api/admin/rematch/[proposalId] for each PENDING proposal.');
  }
  if (inactiveProp.length > 0) {
    console.log('   • Update non-ACTIVE proposals to status=ACTIVE if they should be visible.');
  }
  if (totalProposals === 0 && totalMandates > 0) {
    console.log('   • Mandates exist but proposals were not created — re-run the proposal insertion pipeline.');
  }
  if (problems.length === 0) {
    console.log('   • None required. Data looks healthy; check authentication/session linkage if UI is still not showing mandates.');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  END OF REPORT');
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
