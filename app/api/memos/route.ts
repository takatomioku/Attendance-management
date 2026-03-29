import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('staff_memos').select('*').order('created_at');
  if (month) {
    query = query.gte('memo_date', `${month}-01`).lte('memo_date', `${month}-31`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { staff_id, memo_date, content } = body;
  if (!staff_id || !memo_date || !content?.trim()) {
    return NextResponse.json(
      { error: 'staff_id, memo_date, content are required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('staff_memos')
    .insert({ staff_id, memo_date, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
