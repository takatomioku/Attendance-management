import { createServiceClient } from '@/lib/supabase/server';
import { PunchFlow } from '@/components/PunchFlow';
import { Staff, ActionType } from '@/types';
import { getJSTDateString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createServiceClient();
  const today = getJSTDateString();
  const weekAgo = getJSTDateString(new Date(Date.now() - 7 * 24 * 3600 * 1000));

  const [{ data: staffList }, { data: todayRecords }, { data: pastRecords }] = await Promise.all([
    supabase.from('staff').select('*').order('display_order', { ascending: true }),
    supabase
      .from('attendance_records')
      .select('staff_id, action')
      .eq('work_date', today)
      .order('timestamp', { ascending: true }),
    supabase
      .from('attendance_records')
      .select('staff_id, action, work_date')
      .gte('work_date', weekAgo)
      .lt('work_date', today)
      .order('timestamp', { ascending: true }),
  ]);

  // 全職員を null で初期化し、当日の最終アクションで上書き
  const initialStatuses: Record<string, ActionType | null> = {};
  for (const staff of staffList ?? []) {
    initialStatuses[staff.id] = null;
  }
  for (const record of todayRecords ?? []) {
    initialStatuses[record.staff_id] = record.action as ActionType;
  }

  // 過去7日の (staff_id, work_date) ごとの最終アクションが clock_out でなければ未退勤として記録
  const lastActionPerDay = new Map<string, ActionType>();
  for (const r of pastRecords ?? []) {
    lastActionPerDay.set(`${r.staff_id}|${r.work_date}`, r.action as ActionType);
  }
  const incompleteDates: Record<string, string[]> = {};
  lastActionPerDay.forEach((action, key) => {
    if (action === 'clock_out') return;
    const sep = key.indexOf('|');
    const staffId = key.slice(0, sep);
    const date = key.slice(sep + 1);
    if (!incompleteDates[staffId]) incompleteDates[staffId] = [];
    incompleteDates[staffId].push(date);
  });
  Object.keys(incompleteDates).forEach((id) => {
    incompleteDates[id].sort();
  });

  return (
    <PunchFlow
      staffList={(staffList as Staff[]) ?? []}
      initialStatuses={initialStatuses}
      incompleteDates={incompleteDates}
    />
  );
}
