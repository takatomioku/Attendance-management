import { createServiceClient } from '@/lib/supabase/server';
import { PunchFlow } from '@/components/PunchFlow';
import { Staff, ActionType } from '@/types';
import { getJSTDateString } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createServiceClient();
  const today = getJSTDateString();

  const [{ data: staffList }, { data: todayRecords }] = await Promise.all([
    supabase.from('staff').select('*').order('display_order', { ascending: true }),
    supabase
      .from('attendance_records')
      .select('staff_id, action')
      .eq('work_date', today)
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

  return (
    <PunchFlow
      staffList={(staffList as Staff[]) ?? []}
      initialStatuses={initialStatuses}
    />
  );
}
