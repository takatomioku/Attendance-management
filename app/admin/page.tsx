import { createServiceClient } from '@/lib/supabase/server';
import {
  getJSTDateString,
  getStatusFromAction,
  ACTION_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_CLASS,
  calculateWorkHours,
  formatTime,
} from '@/lib/utils';
import { Staff, AttendanceRecord, ActionType, AttendanceStatus } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = createServiceClient();
  const today = getJSTDateString();
  const yesterday = getJSTDateString(new Date(Date.now() - 86400000));

  const [{ data: staffList }, { data: todayRecords }, { data: yesterdayRecords }] =
    await Promise.all([
      supabase.from('staff').select('*').order('display_order'),
      supabase.from('attendance_records').select('*').eq('work_date', today).order('timestamp'),
      supabase.from('attendance_records').select('*').eq('work_date', yesterday).order('timestamp'),
    ]);

  const staff: Staff[] = staffList ?? [];
  const records: AttendanceRecord[] = todayRecords ?? [];
  const prevRecords: AttendanceRecord[] = yesterdayRecords ?? [];

  const staffStatuses = staff.map((s) => {
    const myRecords = records.filter((r) => r.staff_id === s.id);
    const lastRecord = myRecords[myRecords.length - 1] ?? null;
    const status = getStatusFromAction(lastRecord?.action ?? null);
    const workHours = myRecords.length > 0 ? calculateWorkHours(myRecords) : null;
    return { staff: s, status, lastRecord, workHours };
  });

  const missedPunchStaff = staff.filter((s) => {
    const myPrev = prevRecords.filter((r) => r.staff_id === s.id);
    if (myPrev.length === 0) return false;
    const lastPrev = myPrev[myPrev.length - 1];
    return lastPrev.action !== 'clock_out';
  });

  const counts: Record<AttendanceStatus, number> = {
    not_started: 0, working: 0, on_break: 0, out: 0, finished: 0,
  };
  staffStatuses.forEach(({ status }) => counts[status]++);

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-md-on-surface tracking-tight">ダッシュボード</h1>
        <p className="text-sm text-md-on-surface-variant mt-1">{today}（当日）</p>
      </div>

      {/* MD3 Warning banner */}
      {missedPunchStaff.length > 0 && (
        <div className="bg-md-warning-container border border-md-on-warning-container/20 rounded-md-lg px-5 py-4 mb-6">
          <p className="text-sm font-semibold text-md-on-warning-container mb-1">⚠ 打刻漏れの可能性</p>
          <p className="text-sm text-md-on-warning-container/80">
            昨日（{yesterday}）退勤打刻がない職員：{missedPunchStaff.map((s) => s.name).join('、')}
          </p>
        </div>
      )}

      {/* MD3 Summary Cards (Filled Tonal) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(
          [
            ['working',     '勤務中', 'bg-md-primary-container text-md-on-primary-container'],
            ['on_break',    '休憩中', 'bg-md-warning-container text-md-on-warning-container'],
            ['out',         '外出中', 'bg-md-secondary-container text-md-on-secondary-container'],
            ['finished',    '退勤済', 'bg-md-surface-container-high text-md-on-surface'],
            ['not_started', '未出勤', 'bg-md-surface-container text-md-on-surface-variant'],
          ] as [AttendanceStatus, string, string][]
        ).map(([key, label, cls]) => (
          <div key={key} className={`rounded-md-lg p-4 ${cls}`}>
            <p className="text-2xl font-bold font-dm">{counts[key]}</p>
            <p className="text-xs font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* MD3 Elevated Card: staff table */}
      <div className="bg-md-surface rounded-md-xl shadow-md-1 overflow-hidden">
        <div className="px-6 py-4 border-b border-md-outline-variant/50">
          <h2 className="font-semibold text-md-on-surface text-sm tracking-wide">職員ステータス一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-md-surface-container text-xs text-md-on-surface-variant uppercase tracking-widest">
                <th className="text-left px-6 py-3 font-medium">職員名</th>
                <th className="text-left px-6 py-3 font-medium">ステータス</th>
                <th className="text-left px-6 py-3 font-medium">最終打刻</th>
                <th className="text-left px-6 py-3 font-medium">勤務時間</th>
                <th className="text-left px-6 py-3 font-medium">本日の打刻記録</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-md-outline-variant/30">
              {staffStatuses.map(({ staff: s, status, lastRecord, workHours }) => {
                const myRecords = records.filter((r) => r.staff_id === s.id);
                return (
                  <tr key={s.id} className="hover:bg-md-surface-container transition-colors duration-md-s4">
                    <td className="px-6 py-4 font-medium text-md-on-surface">{s.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-md-on-surface-variant font-dm">
                      {lastRecord ? formatTime(lastRecord.timestamp) : '—'}
                    </td>
                    <td className="px-6 py-4 text-md-on-surface-variant font-dm">
                      {workHours !== null ? `${workHours}h` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {myRecords.map((r) => (
                          <span
                            key={r.id}
                            className="text-xs bg-md-surface-container text-md-on-surface-variant px-2.5 py-0.5 rounded-md-xs font-dm"
                          >
                            {ACTION_LABELS[r.action as ActionType]}{' '}
                            {formatTime(r.timestamp)}
                          </span>
                        ))}
                        {myRecords.length === 0 && (
                          <span className="text-xs text-md-on-surface-variant/40">なし</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
