import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with SERVICE ROLE KEY for backend operations
// Ensure these environment variables are set in your Vercel deployment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // This is a private key

if (!supabaseUrl) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseServiceKey) {
  throw new Error("Missing env var SUPABASE_SERVICE_KEY");
}

// Note: For production, consider a shared Supabase admin client instance
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const mentionId = parseInt(params.id, 10);
  if (isNaN(mentionId)) {
    return NextResponse.json({ error: 'Invalid mention ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { lead, note } = body;

    if (typeof lead !== 'boolean' && typeof note === 'undefined') {
      return NextResponse.json({ error: 'Invalid request body: lead (boolean) or note (string) is required' }, { status: 400 });
    }

    const updateData: { lead?: boolean; note?: string } = {};
    if (typeof lead === 'boolean') {
      updateData.lead = lead;
    }
    if (typeof note === 'string') {
      updateData.note = note; // Allow setting note even if empty string to clear it
    }
    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update provided.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('mentions')
      .update(updateData)
      .eq('id', mentionId)
      .select()
      .single(); // .single() to get the updated row back

    if (error) {
      console.error('Supabase error updating mention:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Mention not found or failed to update.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing PATCH request:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 