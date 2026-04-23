import { fixDatabaseConstraint } from '@/lib/actions/auth-actions';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await fixDatabaseConstraint();
    
    if (result.error) {
       return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Database constraint unified successfully." });
  } catch (error) {
    console.error("error fixing schema:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
