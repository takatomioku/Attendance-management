import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getJSTDateString } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const { staff_id, action } = await request.json();
  if (!staff_id || !action) {
    return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const work_date = getJSTDateString(now);

  const { data, error } = await supabase
    .from('attendance_records')
    .insert({ staff_id, action, timestamp: now.toISOString(), work_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
