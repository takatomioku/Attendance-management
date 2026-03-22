import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getJSTDateString } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const staff_id = searchParams.get('staff_id');
  const date = searchParams.get('date') ?? getJSTDateString();

  if (!staff_id) {
    return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('staff_id', staff_id)
    .eq('work_date', date)
    .order('timestamp', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
