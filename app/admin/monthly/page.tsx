'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Staff, AttendanceRecord, ActionType, StaffMemo } from '@/types';
import { calculateWorkHours, formatTime, ACTION_LABELS } from '@/lib/utils';

type DaySummary = {
  date: string;
  records: AttendanceRecord[];
  workHours: number | null;
  isOvertime: boolean;
  hasMissedPunch: boolean;
  memo: string | null;
};

type StaffSummary = {
  staff: Staff;
  days: DaySummary[];
  totalHours: number;
  overtimeDays: number;
  workDays: number;
};

function getMonthDays(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) =>
    `${yearMonth}-${String(i + 1).padStart(2, '0')}`
  );
}

function getCurrentYearMonth(): string {
  const jst = new Date(Date.now() + 9 * 3600000);
  return jst.toISOString().slice(0, 7);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyPage() {
  const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [memos, setMemos] = useState<StaffMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  const fetchData = useCallback(async (ym: string) => {
    setLoading(true);
    try {
      const [staffRes, recRes, memosRes] = await Promise.all([
        fetch('/api/staff'),
        fetch(`/api/admin/records?month=${ym}`),
        fetch(`/api/memos?month=${ym}`),
      ]);
      setStaffList(await staffRes.json());
      setRecords(await recRes.json());
      setMemos(await memosRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(yearMonth); }, [yearMonth, fetchData]);

  const days = getMonthDays(yearMonth);

  const summaries: StaffSummary[] = staffList.map((s) => {
    const myRecords = records.filter((r) => r.staff_id === s.id);
    const myMemos = memos.filter((m) => m.staff_id === s.id);
    const daySummaries = days.map((date) => {
      const dayRecs = myRecords.filter((r) => r.work_date === date);
      const dayMemos = myMemos.filter((m) => m.memo_date === date);
      const hasClockedIn = dayRecs.some((r) => r.action === 'clock_in');
      const hasClockedOut = dayRecs.some((r) => r.action === 'clock_out');
      const workHours = dayRecs.length > 0 ? calculateWorkHours(dayRecs) : null;
      return {
        date,
        records: dayRecs,
        workHours,
        isOvertime: (workHours ?? 0) > 8,
        hasMissedPunch: hasClockedIn && !hasClockedOut,
        memo: dayMemos.length > 0 ? dayMemos.map((m) => m.content).join('、') : null,
      };
    });
    const totalHours = daySummaries.reduce((sum, d) => sum + (d.workHours ?? 0), 0);
    return {
      staff: s,
      days: daySummaries,
      totalHours: Math.round(totalHours * 10) / 10,
      overtimeDays: daySummaries.filter((d) => d.isOvertime).length,
      workDays: daySummaries.filter((d) => (d.workHours ?? 0) > 0).length,
    };
  });

  const handleExport = () => {
    window.open(`/api/admin/export?month=${yearMonth}`, '_blank');
  };

  const [y, m] = yearMonth.split('-');

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-md-on-surface tracking-tight">月次集計</h1>
          <p className="text-sm text-md-on-surface-variant mt-1">職員ごとの勤務時間集計</p>
        </div>
        {/* MD3 Filled Button */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-md-full hover:shadow-md-2 transition-[box-shadow,background-color] duration-md-s4 ease-md-standard active:bg-primary-dark"
        >
          <Download className="w-4 h-4" />
          CSV出力
        </button>
      </div>

      {/* MD3 month navigator */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setYearMonth(shiftMonth(yearMonth, -1))}
          className="p-2 rounded-md-full hover:bg-[var(--md-state-primary-hover)] transition-colors duration-md-s4"
        >
          <ChevronLeft className="w-5 h-5 text-md-on-surface-variant" />
        </button>
        <h2 className="text-lg font-semibold text-md-on-surface font-dm min-w-[7rem] text-center">
          {y}年{m}月
        </h2>
        <button
          onClick={() => setYearMonth(shiftMonth(yearMonth, 1))}
          className="p-2 rounded-md-full hover:bg-[var(--md-state-primary-hover)] transition-colors duration-md-s4"
        >
          <ChevronRight className="w-5 h-5 text-md-on-surface-variant" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-md-on-surface-variant">読み込み中…</div>
      ) : (
        <div className="space-y-4">
          {summaries.map((s) => (
            <div
              key={s.staff.id}
              className="bg-md-surface rounded-md-xl shadow-md-1 overflow-hidden"
            >
              {/* Staff header row */}
              <button
                onClick={() =>
                  setExpandedStaff(expandedStaff === s.staff.id ? null : s.staff.id)
                }
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--md-state-primary-hover)] transition-colors duration-md-s4"
              >
                <span className="font-semibold text-md-on-surface">{s.staff.name}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-md-on-surface-variant">
                    出勤{' '}
                    <span className="font-dm font-semibold text-md-on-surface">{s.workDays}</span>
                    日
                  </span>
                  <span className="text-md-on-surface-variant">
                    合計{' '}
                    <span className="font-dm font-semibold text-primary">{s.totalHours}</span>
                    h
                  </span>
                  {s.overtimeDays > 0 && (
                    <span className="text-md-on-warning-container text-xs font-medium bg-md-warning-container px-2.5 py-0.5 rounded-md-full">
                      残業 {s.overtimeDays}日
                    </span>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 text-md-on-surface-variant transition-transform duration-md-s4 ${
                      expandedStaff === s.staff.id ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Expanded detail */}
              {expandedStaff === s.staff.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-md-outline-variant/40"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-md-surface-container text-xs text-md-on-surface-variant">
                          <th className="text-left px-6 py-2.5 font-medium">日付</th>
                          <th className="text-left px-6 py-2.5 font-medium">勤務時間</th>
                          <th className="text-left px-6 py-2.5 font-medium">打刻記録</th>
                          <th className="text-left px-6 py-2.5 font-medium">備考</th>
                          <th className="text-left px-6 py-2.5 font-medium">連絡メモ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-md-outline-variant/30">
                        {s.days
                          .filter((d) => d.records.length > 0 || d.memo)
                          .map((d) => (
                            <tr key={d.date} className="hover:bg-md-surface-container transition-colors duration-md-s4">
                              <td className="px-6 py-2.5 font-dm text-md-on-surface-variant">
                                {d.date.slice(5).replace('-', '/')}
                              </td>
                              <td className="px-6 py-2.5 font-dm font-medium">
                                {d.workHours !== null ? (
                                  <span className={d.isOvertime ? 'text-md-on-warning-container' : 'text-md-on-surface'}>
                                    {d.workHours}h
                                  </span>
                                ) : (
                                  <span className="text-md-on-surface-variant/40">—</span>
                                )}
                              </td>
                              <td className="px-6 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {d.records.map((r) => (
                                    <span
                                      key={r.id}
                                      className="text-xs bg-md-surface-container text-md-on-surface-variant px-2.5 py-0.5 rounded-md-xs font-dm"
                                    >
                                      {ACTION_LABELS[r.action as ActionType]}{' '}
                                      {formatTime(r.timestamp)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-2.5 text-xs">
                                {d.isOvertime && (
                                  <span className="text-md-on-warning-container">残業</span>
                                )}
                                {d.hasMissedPunch && (
                                  <span className="text-md-on-error-container ml-1">退勤未打刻</span>
                                )}
                              </td>
                              <td className="px-6 py-2.5 text-xs text-md-on-surface-variant max-w-xs">
                                {d.memo ? (
                                  <span className="whitespace-pre-wrap">{d.memo}</span>
                                ) : (
                                  <span className="text-md-on-surface-variant/30">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        {s.days.filter((d) => d.records.length > 0 || d.memo).length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-4 text-center text-md-on-surface-variant/40 text-sm">
                              記録なし
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
