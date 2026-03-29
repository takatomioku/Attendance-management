import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/utils';
import { ActionType } from '@/types';
import * as XLSX from 'xlsx';

const ACTION_COLUMNS: ActionType[] = [
  'clock_in', 'clock_out', 'break_start', 'break_end',
  'go_out', 'return', 'night_duty_start', 'night_duty_end',
];

const COLUMN_HEADERS = [
  '日付', '出勤', '退勤', '休憩開始', '休憩終了',
  '外出', '帰院', '夜間当番開始', '夜間当番終了', '連絡メモ',
];

const COL_WIDTHS = [12, 8, 8, 10, 10, 8, 8, 14, 14, 40];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required' }, { status: 400 });

  const supabase = createServiceClient();

  const [{ data: staffList }, { data, error }, { data: memosData }] = await Promise.all([
    supabase.from('staff').select('*').order('display_order'),
    supabase
      .from('attendance_records')
      .select('*')
      .gte('work_date', `${month}-01`)
      .lte('work_date', `${month}-31`)
      .order('work_date', { ascending: true })
      .order('timestamp', { ascending: true }),
    supabase
      .from('staff_memos')
      .select('*')
      .gte('memo_date', `${month}-01`)
      .lte('memo_date', `${month}-31`)
      .order('created_at', { ascending: true }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const records = data ?? [];
  const staff = staffList ?? [];
  const memos = memosData ?? [];

  // 月の全日付を生成
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`
  );

  const workbook = XLSX.utils.book_new();

  for (const s of staff) {
    const myRecords = records.filter((r: any) => r.staff_id === s.id);
    const myMemos = memos.filter((memo: any) => memo.staff_id === s.id);

    const sheetData: string[][] = [COLUMN_HEADERS];

    for (const date of days) {
      const dayRecs = myRecords.filter((r: any) => r.work_date === date);
      const dayMemos = myMemos.filter((memo: any) => memo.memo_date === date);
      const row: string[] = [date];
      for (const action of ACTION_COLUMNS) {
        const rec = dayRecs.find((r: any) => r.action === action);
        row.push(rec ? formatTime(rec.timestamp) : '');
      }
      row.push(dayMemos.map((memo: any) => memo.content).join('、'));
      sheetData.push(row);
    }

    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    sheet['!cols'] = COL_WIDTHS.map((wch) => ({ wch }));

    // シート名は31文字以内・特殊文字禁止
    const sheetName = s.name.replace(/[\\/?*[\]]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  const buf: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance_${month}.xlsx"`,
    },
  });
}
