export type ActionType =
  | 'clock_in'
  | 'clock_out'
  | 'break_start'
  | 'break_end'
  | 'go_out'
  | 'return'
  | 'night_duty_start'
  | 'night_duty_end';

export type AttendanceStatus =
  | 'not_started'
  | 'working'
  | 'on_break'
  | 'out'
  | 'finished';

export interface Staff {
  id: string;
  name: string;
  display_order: number;
}

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  action: ActionType;
  timestamp: string;
  work_date: string;
  note: string | null;
  created_at: string;
  staff?: Staff;
}

export interface StaffMemo {
  id: string;
  staff_id: string;
  memo_date: string;
  content: string;
  created_at: string;
}

export interface DailyStaffStatus {
  staff: Staff;
  status: AttendanceStatus;
  lastAction: ActionType | null;
  lastTimestamp: string | null;
  workHours: number | null;
  records: AttendanceRecord[];
}
