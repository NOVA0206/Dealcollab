import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { extractTextFromFile } from '@/lib/documentParser';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(buffer, file.type);

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("DOCUMENT PARSE ERROR:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to parse document: ${message}` }, { status: 500 });
  }
}
