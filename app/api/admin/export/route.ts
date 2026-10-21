import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/utils';
import { ActionType } from '@/types';
import { fetchMonthlyLeaves, formatLeaveEntry, normalizeName, LeaveEntry } from '@/lib/leave';
import * as XLSX from 'xlsx';

const ACTION_COLUMNS: ActionType[] = [
  'clock_in', 'clock_out', 'break_start', 'break_end',
  'go_out', 'return', 'night_duty_start', 'night_duty_end',
];

const COLUMN_HEADERS = [
  '日付', '出勤', '退勤', '休憩開始', '休憩終了',
  '外出', '帰院', '夜間当番開始', '夜間当番終了', '連絡メモ', '備考', '有給',
];

const COL_WIDTHS = [12, 8, 8, 10, 10, 8, 8, 14, 14, 40, 40, 20];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: 'month is required' }, { status: 400 });

  const supabase = createServiceClient();

  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  const [{ data: staffList }, { data, error }, { data: memosData }, { data: remarksData }] = await Promise.all([
    supabase.from('staff').select('*').order('display_order'),
    supabase
      .from('attendance_records')
      .select('*')
      .gte('work_date', `${month}-01`)
      .lt('work_date', `${nextMonth}-01`)
      .order('work_date', { ascending: true })
      .order('timestamp', { ascending: true }),
    supabase
      .from('staff_memos')
      .select('*')
      .gte('memo_date', `${month}-01`)
      .lt('memo_date', `${nextMonth}-01`)
      .order('created_at', { ascending: true }),
    supabase
      .from('daily_remarks')
      .select('*')
      .gte('remark_date', `${month}-01`)
      .lt('remark_date', `${nextMonth}-01`),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 有給管理アプリ（別DB）の承認済み休暇。取得に失敗しても勤怠の出力は続行する
  let leaves: Map<string, Map<string, LeaveEntry[]>> | null = null;
  try {
    leaves = await fetchMonthlyLeaves(month, nextMonth);
  } catch (e) {
    console.error('[export] 有給データの取得に失敗', e);
  }

  const records = data ?? [];
  const staff = staffList ?? [];
  const memos = memosData ?? [];
  const remarks = remarksData ?? [];

  // 月の全日付を生成
  const lastDay = new Date(y, m, 0).getDate();
  const days = Array.from({ length: lastDay }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`
  );

  const workbook = XLSX.utils.book_new();

  for (const s of staff) {
    const myRecords = records.filter((r: any) => r.staff_id === s.id);
    const myMemos = memos.filter((memo: any) => memo.staff_id === s.id);
    const myRemarks = remarks.filter((rk: any) => rk.staff_id === s.id);

    const myLeaves = leaves?.get(normalizeName(s.name));

    const headers = leaves ? COLUMN_HEADERS : [...COLUMN_HEADERS.slice(0, -1), '有給（取得失敗）'];
    const sheetData: string[][] = [headers];
    let fullDays = 0;
    let halfDays = 0;
    let hourlyHours = 0;

    for (const date of days) {
      const dayRecs = myRecords.filter((r: any) => r.work_date === date);
      const dayMemos = myMemos.filter((memo: any) => memo.memo_date === date);
      const dayRemark = myRemarks.find((rk: any) => rk.remark_date === date);
      const row: string[] = [date];
      for (const action of ACTION_COLUMNS) {
        const rec = dayRecs.find((r: any) => r.action === action);
        row.push(rec ? formatTime(rec.timestamp) : '');
      }
      row.push(dayMemos.map((memo: any) => memo.content).join('、'));
      row.push(dayRemark ? dayRemark.content : '');
      const dayLeaves = myLeaves?.get(date) ?? [];
      for (const lv of dayLeaves) {
        if (lv.type === 'ANNUAL') fullDays++;
        else if (lv.type === 'HALF_DAY') halfDays++;
        else hourlyHours += lv.hours ?? 0;
      }
      row.push(dayLeaves.map(formatLeaveEntry).join('、'));
      sheetData.push(row);
    }

    if (leaves) {
      const total = fullDays + halfDays * 0.5;
      const summary =
        `有給 1日×${fullDays}日、半休×${halfDays}回（計${total}日）` +
        (hourlyHours > 0 ? `、時間休 計${hourlyHours}時間` : '');
      sheetData.push([]);
      sheetData.push(['有給合計', ...Array(COLUMN_HEADERS.length - 2).fill(''), summary]);
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
