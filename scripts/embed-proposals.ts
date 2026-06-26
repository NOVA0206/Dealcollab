import pg from "pg";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const BATCH_SIZE = 25;

async function embedProposals() {
    await client.connect();

    try {
        while (true) {
            const { rows } = await client.query(`
        SELECT id, normalised_text
        FROM proposals
        WHERE embedding IS NULL
          AND normalised_text IS NOT NULL
          AND LENGTH(TRIM(normalised_text)) > 0
        LIMIT ${BATCH_SIZE}
      `);

            if (rows.length === 0) {
                console.log("🎉 All proposals embedded");
                break;
            }

            console.log(`Processing ${rows.length} proposals`);

            for (const row of rows) {
                try {
                    const response = await openai.embeddings.create({
                        model: "text-embedding-3-small",
                        input: row.normalised_text,
                    });

                    const embedding = response.data[0].embedding;

                    await client.query(
                        `
            UPDATE proposals
            SET
              embedding = $1::vector,
              embedding_status = 'DONE',
              updated_at = NOW()
            WHERE id = $2
            `,
                        [JSON.stringify(embedding), row.id]
                    );

                    console.log(`✅ ${row.id}`);
                } catch (error) {
                    console.error(`❌ Failed ${row.id}`, error);
                }
            }
        }
    } finally {
        await client.end();
    }
}

embedProposals()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
