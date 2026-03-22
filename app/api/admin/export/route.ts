import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ACTION_LABELS, formatTime } from '@/lib/utils';
import { ActionType } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*, staff(id, name, display_order)')
    .gte('work_date', `${month}-01`)
    .lte('work_date', `${month}-31`)
    .order('work_date', { ascending: true })
    .order('timestamp', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = ['職員名', '日付', '操作', '時刻', '備考'];
  const rows = (data ?? []).map((r: any) => [
    r.staff?.name ?? '',
    r.work_date,
    ACTION_LABELS[r.action as ActionType] ?? r.action,
    formatTime(r.timestamp),
    r.note ?? '',
  ]);

  const csv =
    '\uFEFF' + // BOM for Excel
    [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance_${month}.csv"`,
    },
  });
}
