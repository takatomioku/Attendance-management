'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, AlertCircle, FileText, Clock } from 'lucide-react';
import { Staff, ActionType, AttendanceRecord } from '@/types';
import {
  ACTION_LABELS,
  getAvailableActions,
  cn,
  formatLiveClock,
  formatDateJP,
  formatTime,
  getJSTDateString,
  calculateWorkHours,
} from '@/lib/utils';

type Step =
  | 'select_name'
  | 'select_action'
  | 'confirm'
  | 'success'
  | 'memo_name'
  | 'memo_input'
  | 'memo_success'
  | 'timecard_name'
  | 'timecard_view';

function getCurrentYearMonth(): string {
  const jst = new Date(Date.now() + 9 * 3600000);
  return jst.toISOString().slice(0, 7);
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Action chip colors for timecard view
const ACTION_CHIP_STYLES: Record<ActionType, string> = {
  clock_in:         'bg-md-primary-container text-md-on-primary-container',
  clock_out:        'bg-md-surface-container-high text-md-on-surface',
  break_start:      'bg-md-warning-container text-md-on-warning-container',
  break_end:        'bg-md-warning-container text-md-on-warning-container',
  go_out:           'bg-md-secondary-container text-md-on-secondary-container',
  return:           'bg-md-secondary-container text-md-on-secondary-container',
  night_duty_start: 'bg-md-night-container text-md-on-night-container',
  night_duty_end:   'bg-md-night-container text-md-on-night-container',
};

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
function dateWithDow(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${dow}）`;
}

// MD3 Filled Tonal Button styles per action
const ACTION_STYLES: Record<ActionType, string> = {
  clock_in:         'bg-primary text-white hover:shadow-md-2',
  clock_out:        'bg-md-surface-container-high text-md-on-surface hover:shadow-md-1',
  break_start:      'bg-md-warning-container text-md-on-warning-container hover:shadow-md-1',
  break_end:        'bg-md-warning-container text-md-on-warning-container hover:shadow-md-1',
  go_out:           'bg-md-secondary-container text-md-on-secondary-container hover:shadow-md-1',
  return:           'bg-md-secondary-container text-md-on-secondary-container hover:shadow-md-1',
  night_duty_start: 'bg-md-night-container text-md-on-night-container hover:shadow-md-1',
  night_duty_end:   'bg-md-night-container text-md-on-night-container hover:shadow-md-1',
};

const fadeSlide = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -12 },
  transition: { duration: 0.18 },
};

export function PunchFlow({
  staffList,
  initialStatuses,
}: {
  staffList: Staff[];
  initialStatuses: Record<string, ActionType | null>;
}) {
  const [step, setStep] = useState<Step>('select_name');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [availableActions, setAvailableActions] = useState<ActionType[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ページロード後の打刻でも最新ステータスを反映するためローカルで追跡
  const [currentStatuses, setCurrentStatuses] = useState<Record<string, ActionType | null>>(initialStatuses);
  // Memo states
  const [memoStaff, setMemoStaff] = useState<Staff | null>(null);
  const [memoDate, setMemoDate] = useState('');
  const [memoContent, setMemoContent] = useState('');
  // Timecard states
  const [timecardStaff, setTimecardStaff] = useState<Staff | null>(null);
  const [timecardMonth, setTimecardMonth] = useState(getCurrentYearMonth);
  const [timecardRecords, setTimecardRecords] = useState<AttendanceRecord[]>([]);
  const [timecardLoading, setTimecardLoading] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (step !== 'success' && step !== 'memo_success') return;
    const id = setTimeout(() => {
      setStep('select_name');
      setSelectedStaff(null);
      setSelectedAction(null);
      setMemoStaff(null);
      setMemoContent('');
      setError(null);
    }, 3000);
    return () => clearTimeout(id);
  }, [step]);

  // Reset memo fields when entering memo_name
  useEffect(() => {
    if (step !== 'memo_name') return;
    setMemoDate(getJSTDateString());
    setMemoContent('');
    setMemoStaff(null);
  }, [step]);

  // Fetch timecard records when staff or month changes
  useEffect(() => {
    if (step !== 'timecard_view' || !timecardStaff) return;
    setTimecardLoading(true);
    fetch(`/api/admin/records?month=${timecardMonth}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setTimecardRecords(arr.filter((r: AttendanceRecord) => r.staff_id === timecardStaff.id));
      })
      .finally(() => setTimecardLoading(false));
  }, [step, timecardStaff, timecardMonth]);

  const handleSelectName = useCallback((staff: Staff) => {
    const lastAction = currentStatuses[staff.id] ?? null;
    setSelectedStaff(staff);
    setAvailableActions(getAvailableActions(lastAction));
    setStep('select_action');
  }, [currentStatuses]);

  const handleConfirm = useCallback(async () => {
    if (!selectedStaff || !selectedAction) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: selectedStaff.id, action: selectedAction }),
      });
      if (!res.ok) throw new Error();
      // 打刻成功後にローカルステータスを更新（ページ再読み込みなしで次の操作を正しく表示）
      setCurrentStatuses((prev) => ({ ...prev, [selectedStaff.id]: selectedAction }));
      setStep('success');
    } catch {
      setError('打刻に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, selectedAction]);

  const handleMemoSubmit = useCallback(async () => {
    if (!memoStaff || !memoDate || !memoContent.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: memoStaff.id,
          memo_date: memoDate,
          content: memoContent.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setStep('memo_success');
    } catch {
      setError('メモの送信に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [memoStaff, memoDate, memoContent]);

  const staffGrid = (onSelect: (s: Staff) => void) => (
    <div className="grid grid-cols-2 gap-3">
      {staffList.map((staff) => (
        <button
          key={staff.id}
          onClick={() => onSelect(staff)}
          disabled={loading}
          className={cn(
            'py-6 px-3 rounded-md-lg border border-md-outline-variant bg-md-surface',
            'text-md-on-surface font-medium text-base',
            'transition-all duration-md-s4 ease-md-standard active:scale-[0.97]',
            'hover:border-primary hover:bg-[var(--md-state-primary-hover)] hover:text-primary',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            loading && 'opacity-40 pointer-events-none'
          )}
        >
          {staff.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-md-surface flex flex-col">
      {/* MD3 date & clock header */}
      <div className="text-center pt-14 pb-10 px-6">
        <p className="text-sm text-md-on-surface-variant mb-2 font-dm tracking-wide">
          {now ? formatDateJP(now) : ''}
        </p>
        <p className="text-6xl font-light tracking-[0.1em] text-md-on-surface font-dm tabular-nums">
          {now ? formatLiveClock(now) : '--:--:--'}
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">

            {/* Step 1: Staff selection — MD3 Outlined Cards */}
            {step === 'select_name' && (
              <motion.div key="name" {...fadeSlide}>
                <div className="flex flex-col items-center mb-6 gap-2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md-full bg-primary text-white text-sm font-medium">
                    打刻
                  </span>
                  <p className="text-sm text-md-on-surface-variant tracking-wide">名前を選んでください</p>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-md-on-error-container text-sm bg-md-error-container rounded-md-md p-3 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                {staffGrid(handleSelectName)}
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setError(null); setStep('memo_name'); }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-md-lg',
                      'bg-md-warning-container text-md-on-warning-container text-xs font-medium',
                      'hover:shadow-md-1 transition-[box-shadow] duration-md-s4 active:scale-[0.97]'
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    連絡メモを入力する
                  </button>
                  <button
                    onClick={() => { setError(null); setTimecardMonth(getCurrentYearMonth()); setStep('timecard_name'); }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-md-lg',
                      'bg-md-night-container text-md-on-night-container text-xs font-medium',
                      'hover:shadow-md-1 transition-[box-shadow] duration-md-s4 active:scale-[0.97]'
                    )}
                  >
                    <Clock className="w-4 h-4" />
                    タイムカードを確認する
                  </button>
                  <a
                    href="/admin"
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-md-lg',
                      'bg-md-surface-container text-md-on-surface-variant text-xs font-medium',
                      'hover:shadow-md-1 transition-[box-shadow] duration-md-s4 active:scale-[0.97]'
                    )}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                    管理画面
                  </a>
                </div>
              </motion.div>
            )}

            {/* Step 2: Action selection — MD3 Filled Tonal Buttons (pill) */}
            {step === 'select_action' && (
              <motion.div key="action" {...fadeSlide}>
                <button
                  onClick={() => { setStep('select_name'); setError(null); }}
                  className="flex items-center text-md-on-surface-variant hover:text-md-on-surface mb-6 text-sm transition-colors duration-md-s4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <p className="text-center text-primary font-semibold mb-1">
                  {selectedStaff?.name}
                </p>
                <p className="text-sm font-medium text-md-on-surface-variant text-center mb-6 tracking-wide">
                  操作を選んでください
                </p>
                {availableActions.length === 0 ? (
                  <div className="text-center py-10 text-md-on-surface-variant">
                    <p>本日の操作はすべて完了しています</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => { setSelectedAction(action); setStep('confirm'); }}
                        className={cn(
                          'py-5 px-3 rounded-md-full font-medium text-base',
                          'transition-all duration-md-s4 ease-md-standard active:scale-[0.97]',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
                          ACTION_STYLES[action]
                        )}
                      >
                        {ACTION_LABELS[action]}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Confirm — MD3 Elevated Card */}
            {step === 'confirm' && (
              <motion.div key="confirm" {...fadeSlide}>
                <button
                  onClick={() => { setStep('select_action'); setError(null); }}
                  className="flex items-center text-md-on-surface-variant hover:text-md-on-surface mb-6 text-sm transition-colors duration-md-s4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <p className="text-sm font-medium text-md-on-surface-variant text-center mb-6 tracking-wide">
                  内容を確認してください
                </p>

                <div className="bg-md-surface rounded-md-xl shadow-md-1 p-6 mb-6 space-y-4">
                  <Row label="職員名" value={selectedStaff?.name ?? ''} />
                  <div className="h-px bg-md-outline-variant" />
                  <div className="flex justify-between items-center">
                    <span className="text-md-on-surface-variant text-sm">操作</span>
                    <span className="font-bold text-primary text-xl">
                      {selectedAction ? ACTION_LABELS[selectedAction] : ''}
                    </span>
                  </div>
                  <div className="h-px bg-md-outline-variant" />
                  <div className="flex justify-between items-center">
                    <span className="text-md-on-surface-variant text-sm">打刻時刻</span>
                    <span className="font-dm text-md-on-surface text-xl font-medium tabular-nums">
                      {now ? formatLiveClock(now) : '--:--:--'}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-md-on-error-container text-sm bg-md-error-container rounded-md-md p-3 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* MD3 Filled Button (pill) */}
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={cn(
                    'w-full py-4 rounded-md-full bg-primary text-white font-medium text-base tracking-wide',
                    'hover:shadow-md-2 transition-[box-shadow,background-color] duration-md-s4 ease-md-standard',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    'active:bg-primary-dark active:scale-[0.98]',
                    loading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {loading ? '送信中…' : '確定する'}
                </button>
              </motion.div>
            )}

            {/* Step 4: Success — MD3 Primary Container circle */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, type: 'spring', stiffness: 180 }}
                className="text-center py-10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 220 }}
                  className="w-24 h-24 bg-md-primary-container rounded-full flex items-center justify-center mx-auto mb-6 shadow-md-2"
                >
                  <Check className="w-12 h-12 text-md-on-primary-container stroke-[2.5]" />
                </motion.div>
                <p className="text-3xl font-bold text-md-on-surface mb-2">
                  {selectedAction ? ACTION_LABELS[selectedAction] : ''}
                </p>
                <p className="text-md-on-surface-variant text-lg">{selectedStaff?.name}</p>
                <p className="text-md-on-surface-variant/50 text-sm mt-6">3秒後に戻ります</p>
              </motion.div>
            )}

            {/* Memo Step 1: name selection */}
            {step === 'memo_name' && (
              <motion.div key="memo_name" {...fadeSlide}>
                <button
                  onClick={() => { setStep('select_name'); setError(null); }}
                  className="flex items-center text-md-on-surface-variant hover:text-md-on-surface mb-6 text-sm transition-colors duration-md-s4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <div className="flex flex-col items-center mb-6 gap-2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md-full bg-md-warning-container text-md-on-warning-container text-sm font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    連絡メモを入力する
                  </span>
                  <p className="text-sm text-md-on-surface-variant tracking-wide">名前を選んでください</p>
                </div>
                {staffGrid((staff) => {
                  setMemoStaff(staff);
                  setStep('memo_input');
                })}
              </motion.div>
            )}

            {/* Memo Step 2: date + content input */}
            {step === 'memo_input' && (
              <motion.div key="memo_input" {...fadeSlide}>
                <button
                  onClick={() => { setStep('memo_name'); setError(null); }}
                  className="flex items-center text-md-on-surface-variant hover:text-md-on-surface mb-6 text-sm transition-colors duration-md-s4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <p className="text-center text-primary font-semibold mb-1">
                  {memoStaff?.name}
                </p>
                <div className="flex items-center justify-center gap-2 mb-6">
                  <FileText className="w-4 h-4 text-md-on-surface-variant" />
                  <p className="text-sm font-medium text-md-on-surface-variant tracking-wide">連絡メモ</p>
                </div>

                <div className="bg-md-surface rounded-md-xl shadow-md-1 p-6 mb-6 space-y-4">
                  <div>
                    <label className="text-xs text-md-on-surface-variant block mb-1.5">日付</label>
                    <input
                      type="date"
                      value={memoDate}
                      onChange={(e) => setMemoDate(e.target.value)}
                      className="w-full border border-md-outline-variant rounded-md-md px-3 py-2 text-sm text-md-on-surface bg-md-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-dm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-md-on-surface-variant block mb-1.5">内容</label>
                    <textarea
                      value={memoContent}
                      onChange={(e) => setMemoContent(e.target.value)}
                      placeholder="連絡事項を入力してください"
                      rows={4}
                      className="w-full border border-md-outline-variant rounded-md-md px-3 py-2 text-sm text-md-on-surface bg-md-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-md-on-error-container text-sm bg-md-error-container rounded-md-md p-3 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleMemoSubmit}
                  disabled={loading || !memoContent.trim()}
                  className={cn(
                    'w-full py-4 rounded-md-full bg-primary text-white font-medium text-base tracking-wide',
                    'hover:shadow-md-2 transition-[box-shadow,background-color] duration-md-s4 ease-md-standard',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    'active:bg-primary-dark active:scale-[0.98]',
                    (loading || !memoContent.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {loading ? '送信中…' : '送信する'}
                </button>
              </motion.div>
            )}

            {/* Memo success */}
            {step === 'memo_success' && (
              <motion.div
                key="memo_success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, type: 'spring', stiffness: 180 }}
                className="text-center py-10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 220 }}
                  className="w-24 h-24 bg-md-primary-container rounded-full flex items-center justify-center mx-auto mb-6 shadow-md-2"
                >
                  <Check className="w-12 h-12 text-md-on-primary-container stroke-[2.5]" />
                </motion.div>
                <p className="text-3xl font-bold text-md-on-surface mb-2">送信しました</p>
                <p className="text-md-on-surface-variant text-lg">{memoStaff?.name}</p>
                <p className="text-md-on-surface-variant/50 text-sm mt-6">3秒後に戻ります</p>
              </motion.div>
            )}

            {/* Timecard Step 1: name selection */}
            {step === 'timecard_name' && (
              <motion.div key="timecard_name" {...fadeSlide}>
                <button
                  onClick={() => { setStep('select_name'); setError(null); }}
                  className="flex items-center text-md-on-surface-variant hover:text-md-on-surface mb-6 text-sm transition-colors duration-md-s4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
                <div className="flex flex-col items-center mb-6 gap-2">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md-full bg-md-night-container text-md-on-night-container text-sm font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    タイムカードを確認する
                  </span>
                  <p className="text-sm text-md-on-surface-variant tracking-wide">名前を選んでください</p>
                </div>
                {staffGrid((staff) => {
                  setTimecardStaff(staff);
                  setStep('timecard_view');
                })}
              </motion.div>
            )}

            {/* Timecard Step 2: monthly view */}
            {step === 'timecard_view' && timecardStaff && (() => {
              const byDate = timecardRecords.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
                (acc[r.work_date] = acc[r.work_date] ?? []).push(r);
                return acc;
              }, {});
              const sortedDates = Object.keys(byDate).sort();
              const totalHours = Math.round(
                sortedDates.reduce((sum, d) => sum + calculateWorkHours(byDate[d]), 0) * 10
              ) / 10;
              const workDays = sortedDates.filter((d) => calculateWorkHours(byDate[d]) > 0).length;
              return (
                <motion.div key="timecard_view" {...fadeSlide}>
                  <button
                    onClick={() => { setStep('timecard_name'); setError(null); }}
                    className="flex items-center text-md-on-surface-variant hover:text-md-on-surface mb-4 text-sm transition-colors duration-md-s4"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    戻る
                  </button>

                  {/* Header card: name + month nav */}
                  <div className="bg-md-surface-container rounded-md-xl px-4 py-4 mb-4 shadow-md-1">
                    <p className="text-center text-lg font-semibold text-md-on-surface mb-3">
                      {timecardStaff.name}
                    </p>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setTimecardMonth((m) => shiftMonth(m, -1))}
                        className="p-2 rounded-md-full hover:bg-[var(--md-state-primary-hover)] transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-md-on-surface-variant" />
                      </button>
                      <span className="text-base font-semibold text-md-on-surface font-dm">
                        {timecardMonth.replace('-', '年')}月
                      </span>
                      <button
                        onClick={() => setTimecardMonth((m) => shiftMonth(m, 1))}
                        className="p-2 rounded-md-full hover:bg-[var(--md-state-primary-hover)] transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-md-on-surface-variant" />
                      </button>
                    </div>
                  </div>

                  {timecardLoading ? (
                    <div className="text-center py-10 text-md-on-surface-variant text-sm">読み込み中…</div>
                  ) : timecardRecords.length === 0 ? (
                    <div className="text-center py-10 text-md-on-surface-variant/50 text-sm">記録なし</div>
                  ) : (
                    <>
                      {/* Summary chips */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-md-primary-container rounded-md-lg px-4 py-3 text-center">
                          <p className="text-xs text-md-on-primary-container/70 mb-0.5">出勤日数</p>
                          <p className="text-2xl font-dm font-bold text-md-on-primary-container leading-none">
                            {workDays}<span className="text-sm font-normal ml-0.5">日</span>
                          </p>
                        </div>
                        <div className="bg-md-primary-container rounded-md-lg px-4 py-3 text-center">
                          <p className="text-xs text-md-on-primary-container/70 mb-0.5">合計時間</p>
                          <p className="text-2xl font-dm font-bold text-md-on-primary-container leading-none">
                            {totalHours}<span className="text-sm font-normal ml-0.5">h</span>
                          </p>
                        </div>
                      </div>

                      {/* Day cards */}
                      <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-0.5">
                        {sortedDates.map((date) => {
                          const recs = byDate[date].slice().sort(
                            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                          );
                          const hours = calculateWorkHours(recs);
                          const missedPunch = recs.some((r) => r.action === 'clock_in') && !recs.some((r) => r.action === 'clock_out');
                          return (
                            <div key={date} className="bg-md-surface rounded-md-xl shadow-md-1 px-4 py-3">
                              {/* Date row */}
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-sm font-semibold text-md-on-surface font-dm">
                                  {dateWithDow(date)}
                                </span>
                                {hours > 0 ? (
                                  <span className="text-sm font-dm font-bold text-primary">{hours}h</span>
                                ) : (
                                  <span className="text-xs text-md-on-surface-variant/40 font-dm">—</span>
                                )}
                              </div>
                              {/* Action chips */}
                              <div className="flex flex-wrap gap-1.5">
                                {recs.map((r) => (
                                  <span
                                    key={r.id}
                                    className={cn(
                                      'inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md-full font-dm font-medium',
                                      ACTION_CHIP_STYLES[r.action]
                                    )}
                                  >
                                    {ACTION_LABELS[r.action]}
                                    <span className="opacity-80">{formatTime(r.timestamp)}</span>
                                  </span>
                                ))}
                              </div>
                              {missedPunch && (
                                <p className="text-xs text-md-on-error-container mt-2 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  退勤未打刻
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })()}

          </AnimatePresence>
        </div>
      </div>

      <div className="py-6" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-md-on-surface-variant text-sm">{label}</span>
      <span className="font-medium text-md-on-surface">{value}</span>
    </div>
  );
}
