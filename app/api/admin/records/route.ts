import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getJSTDateString } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const month = searchParams.get('month'); // YYYY-MM

  const supabase = createServiceClient();

  let query = supabase
    .from('attendance_records')
    .select('*, staff(id, name, display_order)')
    .order('timestamp', { ascending: true });

  if (month) {
    query = query
      .gte('work_date', `${month}-01`)
      .lte('work_date', `${month}-31`);
  } else {
    query = query.eq('work_date', date ?? getJSTDateString());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('attendance_records')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
