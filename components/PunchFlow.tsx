'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { Staff, ActionType } from '@/types';
import {
  ACTION_LABELS,
  getAvailableActions,
  cn,
  formatLiveClock,
  formatDateJP,
} from '@/lib/utils';

type Step = 'select_name' | 'select_action' | 'confirm' | 'success';

// MD3 Filled Tonal Button styles per action
const ACTION_STYLES: Record<ActionType, string> = {
  clock_in:    'bg-primary text-white hover:shadow-md-2',
  clock_out:   'bg-md-surface-container-high text-md-on-surface hover:shadow-md-1',
  break_start: 'bg-md-warning-container text-md-on-warning-container hover:shadow-md-1',
  break_end:   'bg-md-warning-container text-md-on-warning-container hover:shadow-md-1',
  go_out:            'bg-md-secondary-container text-md-on-secondary-container hover:shadow-md-1',
  return:            'bg-md-secondary-container text-md-on-secondary-container hover:shadow-md-1',
  night_duty_start:  'bg-md-night-container text-md-on-night-container hover:shadow-md-1',
  night_duty_end:    'bg-md-night-container text-md-on-night-container hover:shadow-md-1',
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

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (step !== 'success') return;
    const id = setTimeout(() => {
      setStep('select_name');
      setSelectedStaff(null);
      setSelectedAction(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(id);
  }, [step]);

  const handleSelectName = useCallback((staff: Staff) => {
    const lastAction = initialStatuses[staff.id] ?? null;
    setSelectedStaff(staff);
    setAvailableActions(getAvailableActions(lastAction));
    setStep('select_action');
  }, [initialStatuses]);

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
      setStep('success');
    } catch {
      setError('打刻に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, selectedAction]);

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
                <p className="text-sm font-medium text-md-on-surface-variant text-center mb-6 tracking-wide">
                  名前を選んでください
                </p>
                {error && (
                  <div className="flex items-center gap-2 text-md-on-error-container text-sm bg-md-error-container rounded-md-md p-3 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {staffList.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => handleSelectName(staff)}
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

          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <a
          href="/admin"
          className="text-xs text-md-on-surface-variant/40 hover:text-md-on-surface-variant transition-colors duration-md-s4"
        >
          管理者画面
        </a>
      </div>
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
