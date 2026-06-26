import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { count: nullEmbeddingCount } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .is('embedding', null);

    const { count: notDoneCount } = await supabase
        .from('proposals')
        .select('*', { count: 'exact', head: true })
        .neq('embedding_status', 'DONE');

    const { data: countByStatus } = await supabase
        .from('proposals')
        .select('embedding_status');

    const counts: Record<string, number> = {};
    for (const r of countByStatus || []) {
        counts[r.embedding_status] = (counts[r.embedding_status] || 0) + 1;
    }

    console.log({
        nullEmbeddingCount,
        notDoneCount,
        counts
    });
}

check().catch(console.error);
