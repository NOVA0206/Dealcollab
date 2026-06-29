import pg from 'pg';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateSummary(
  rawText: string | null,
  normalizedText: string
): Promise<string> {
  const prompt = `
You are a senior investment banker.

Generate a professional deal summary from the following data.

Requirements:
- 80-150 words
- Professional investment banking language
- Mention intent, sector, geography, revenue, EBITDA, valuation, growth metrics if available
- No bullet points
- Return only the summary

RAW TEXT:
${rawText ?? ""}

NORMALIZED DATA:
${JSON.stringify(normalizedText, null, 2)}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "You are an elite M&A analyst creating deal summaries."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return (
    response.choices[0]?.message?.content?.trim() ??
    "Professional deal summary unavailable."
  );
}

async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  });
  return res.data[0].embedding;
}

function embeddingsEqual(a: number[] | null, b: number[] | null): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  }
  return true;
}

async function main() {
  const userId = '6fa06d21-c203-4935-a6c0-dc248638f241';
  await client.connect();

  try {
    console.log('1. Fetching target proposals...');
    const selectRes = await client.query(`
      SELECT id, mandate_id, raw_text, normalised_text, embedding, summary_text
      FROM proposals
      WHERE user_id = $1
        AND DATE(updated_at AT TIME ZONE 'UTC') = '2026-06-24'
        AND source = 'WEB'
    `, [userId]);

    const proposals = selectRes.rows;
    console.log(`Found ${proposals.length} target proposals matching criteria.`);

    if (proposals.length === 0) {
      console.log('No proposals require updating.');
      return;
    }

    const processedData: Array<{
      id: string;
      mandateId: string | null;
      summary: string;
      newEmbedding: number[];
      embeddingChanged: boolean;
    }> = [];

    let summaryCount = 0;
    let embeddingVerifiedCount = 0;
    let embeddingChangedCount = 0;

    console.log('2. Starting OpenAI generation for summaries and embeddings...');
    for (let i = 0; i < proposals.length; i++) {
      const p = proposals[i];
      console.log(`Processing proposal [${i + 1}/${proposals.length}] ID: ${p.id}`);

      // Generate summary
      const summary = await generateSummary(p.raw_text, p.normalised_text);
      summaryCount++;

      // Generate embedding
      const newEmbedding = await embedText(p.normalised_text);
      embeddingVerifiedCount++;

      // Compare embedding with existing one
      const oldEmbedding = p.embedding;
      const changed = !embeddingsEqual(oldEmbedding, newEmbedding);
      if (changed) {
        embeddingChangedCount++;
      }

      processedData.push({
        id: p.id,
        mandateId: p.mandate_id,
        summary,
        newEmbedding,
        embeddingChanged: changed,
      });

      // Avoid OpenAI rate limits
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log('\n3. OpenAI processing complete.');
    console.log(`   Summaries generated: ${summaryCount}`);
    console.log(`   Embeddings verified: ${embeddingVerifiedCount}`);
    console.log(`   Embeddings changed: ${embeddingChangedCount}`);

    console.log('\n4. Executing updates within a SQL transaction...');
    await client.query('BEGIN');

    let updatedProposals = 0;
    let updatedMandates = 0;

    for (const data of processedData) {
      // Update proposal
      const resProp = await client.query(`
        UPDATE proposals
        SET source = 'bulk_upload',
            summary_text = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [data.summary, data.id]);
      updatedProposals += resProp.rowCount ?? 0;

      // Update legacy mandate if present
      if (data.mandateId) {
        const resMand = await client.query(`
          UPDATE mandates
          SET source = 'bulk_upload'
          WHERE id = $1
        `, [data.mandateId]);
        updatedMandates += resMand.rowCount ?? 0;
      }
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');
    console.log(`   Proposals updated in DB: ${updatedProposals}`);
    console.log(`   Mandates updated in DB: ${updatedMandates}`);

    console.log('\n5. Updating pgvector store for changed embeddings...');
    let vectorUpdateCount = 0;
    for (const data of processedData) {
      if (data.embeddingChanged) {
        const rpcRes = await client.query(`
          SELECT public.update_proposal_embedding($1, $2::vector)
        `, [data.id, '[' + data.newEmbedding.join(',') + ']']);
        vectorUpdateCount++;
        console.log(`   Updated vector for proposal: ${data.id}`);
      }
    }
    console.log(`   Vectors updated in pgvector: ${vectorUpdateCount}`);

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Number of records updated in proposals: ${updatedProposals}`);
    console.log(`Number of records updated in mandates: ${updatedMandates}`);
    console.log(`Number of summaries generated: ${summaryCount}`);
    console.log(`Number of embeddings verified/regenerated: ${embeddingVerifiedCount}`);
    console.log(`Number of vectors updated in pgvector: ${vectorUpdateCount}`);

  } catch (error) {
    console.error('An error occurred. Rolling back transaction if open...');
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      // Ignore if no transaction was open
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
