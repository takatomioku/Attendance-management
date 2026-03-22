import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ActionType, AttendanceRecord, AttendanceStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ACTION_LABELS: Record<ActionType, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
  go_out: '外出',
  return: '帰院',
};

// 最後の打刻から次に選択できる操作を定義
export const ACTION_FLOW: Record<string, ActionType[]> = {
  none: ['clock_in'],
  clock_in: ['break_start', 'go_out', 'clock_out'],
  break_start: ['break_end'],
  break_end: ['break_start', 'go_out', 'clock_out'],
  go_out: ['return'],
  return: ['break_start', 'go_out', 'clock_out'],
  clock_out: ['clock_in'], // 複数セッション対応
};

export function getAvailableActions(lastAction: ActionType | null): ActionType[] {
  const key = lastAction ?? 'none';
  return ACTION_FLOW[key] ?? [];
}

export function getStatusFromAction(action: ActionType | null): AttendanceStatus {
  if (!action) return 'not_started';
  switch (action) {
    case 'clock_in': return 'working';
    case 'clock_out': return 'finished';
    case 'break_start': return 'on_break';
    case 'break_end': return 'working';
    case 'go_out': return 'out';
    case 'return': return 'working';
  }
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: '未出勤',
  working: '勤務中',
  on_break: '休憩中',
  out: '外出中',
  finished: '退勤済',
};

export const STATUS_BADGE_CLASS: Record<AttendanceStatus, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  working: 'bg-teal-100 text-teal-700',
  on_break: 'bg-amber-100 text-amber-700',
  out: 'bg-blue-100 text-blue-700',
  finished: 'bg-gray-200 text-gray-600',
};

/** 現在のJST日付を YYYY-MM-DD 形式で返す */
export function getJSTDateString(date?: Date): string {
  const d = date ?? new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/** ISO文字列 → JST HH:MM */
export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const m = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Date → JST HH:MM:SS */
export function formatLiveClock(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const m = String(jst.getUTCMinutes()).padStart(2, '0');
  const s = String(jst.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** Date → JST 年月日（曜日）*/
export function formatDateJP(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][jst.getUTCDay()];
  return `${y}年${mo}月${day}日（${wd}）`;
}

/** 勤務時間を計算（時間単位、小数点1桁） */
export function calculateWorkHours(records: AttendanceRecord[]): number {
  let totalMs = 0;
  let clockInAt: Date | null = null;
  let breakStartAt: Date | null = null;
  let goOutAt: Date | null = null;

  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const r of sorted) {
    const t = new Date(r.timestamp);
    switch (r.action) {
      case 'clock_in':
        clockInAt = t;
        break;
      case 'clock_out':
        if (clockInAt) {
          totalMs += t.getTime() - clockInAt.getTime();
          clockInAt = null;
        }
        break;
      case 'break_start':
        breakStartAt = t;
        break;
      case 'break_end':
        if (breakStartAt) {
          totalMs -= t.getTime() - breakStartAt.getTime();
          breakStartAt = null;
        }
        break;
      case 'go_out':
        goOutAt = t;
        break;
      case 'return':
        if (goOutAt) {
          totalMs -= t.getTime() - goOutAt.getTime();
          goOutAt = null;
        }
        break;
    }
  }

  return Math.max(0, Math.round((totalMs / 3600000) * 10) / 10);
}
