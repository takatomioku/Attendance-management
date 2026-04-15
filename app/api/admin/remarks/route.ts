import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required' }, { status: 400 });

  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('daily_remarks')
    .select('*')
    .gte('remark_date', `${month}-01`)
    .lt('remark_date', `${nextMonth}-01`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { staff_id, date, content } = body as { staff_id: string; date: string; content: string };
  if (!staff_id || !date) {
    return NextResponse.json({ error: 'staff_id and date are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (!content || content.trim() === '') {
    const { error } = await supabase
      .from('daily_remarks')
      .delete()
      .eq('staff_id', staff_id)
      .eq('remark_date', date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from('daily_remarks')
    .upsert(
      { staff_id, remark_date: date, content: content.trim() },
      { onConflict: 'staff_id,remark_date' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
