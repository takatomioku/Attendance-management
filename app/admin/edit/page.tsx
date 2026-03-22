'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { Staff, AttendanceRecord, ActionType } from '@/types';
import { ACTION_LABELS, formatTime, getJSTDateString, cn } from '@/lib/utils';

const ACTION_OPTIONS: ActionType[] = [
  'clock_in', 'clock_out', 'break_start', 'break_end', 'go_out', 'return',
];

export default function EditPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getJSTDateString());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ action: ActionType; timestamp: string; note: string }>({
    action: 'clock_in', timestamp: '', note: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addValues, setAddValues] = useState<{ action: ActionType; time: string; note: string }>({
    action: 'clock_in', time: '09:00', note: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/staff').then((r) => r.json()).then(setStaffList);
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!selectedStaffId || !selectedDate) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/records?date=${selectedDate}`
      );
      const data: AttendanceRecord[] = await res.json();
      setRecords(data.filter((r) => r.staff_id === selectedStaffId));
    } finally {
      setLoading(false);
    }
  }, [selectedStaffId, selectedDate]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 編集開始
  const startEdit = (r: AttendanceRecord) => {
    setEditingId(r.id);
    // timestamp を JST の datetime-local 形式に変換
    const jst = new Date(new Date(r.timestamp).getTime() + 9 * 3600000);
    const local = jst.toISOString().slice(0, 16);
    setEditValues({ action: r.action, timestamp: local, note: r.note ?? '' });
  };

  // 編集保存
  const saveEdit = async (id: string) => {
    try {
      // datetime-local の入力を UTC ISO に変換（JST として扱う）
      const localDt = new Date(editValues.timestamp + ':00');
      const utcIso = new Date(localDt.getTime() - 9 * 3600000).toISOString();

      const res = await fetch(`/api/admin/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editValues.action,
          timestamp: utcIso,
          note: editValues.note || null,
        }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      showMsg('success', '更新しました');
      fetchRecords();
    } catch {
      showMsg('error', '更新に失敗しました');
    }
  };

  // 削除
  const deleteRecord = async (id: string) => {
    if (!confirm('この打刻記録を削除しますか？')) return;
    try {
      const res = await fetch(`/api/admin/records/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showMsg('success', '削除しました');
      fetchRecords();
    } catch {
      showMsg('error', '削除に失敗しました');
    }
  };

  // 追加
  const addRecord = async () => {
    if (!selectedStaffId || !selectedDate) return;
    try {
      const [hh, mm] = addValues.time.split(':');
      const dt = new Date(`${selectedDate}T${hh}:${mm}:00`);
      const utcIso = new Date(dt.getTime() - 9 * 3600000).toISOString();

      const res = await fetch('/api/admin/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: selectedStaffId,
          action: addValues.action,
          timestamp: utcIso,
          work_date: selectedDate,
          note: addValues.note || null,
        }),
      });
      if (!res.ok) throw new Error();
      setShowAddForm(false);
      showMsg('success', '追加しました');
      fetchRecords();
    } catch {
      showMsg('error', '追加に失敗しました');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">打刻修正</h1>
        <p className="text-sm text-gray-400 mt-1">打刻記録の追加・編集・削除</p>
      </div>

      {/* メッセージ */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium mb-4',
              message.type === 'success'
                ? 'bg-teal-50 text-teal-700 border border-teal-100'
                : 'bg-red-50 text-red-600 border border-red-100'
            )}
          >
            {message.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* フィルター */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">職員</label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">選択してください</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">日付</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-dm"
            />
          </div>
        </div>
      </div>

      {/* 記録テーブル */}
      {selectedStaffId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-700 text-sm">
              {staffList.find((s) => s.id === selectedStaffId)?.name} /{' '}
              {selectedDate}
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              追加
            </button>
          </div>

          {/* 追加フォーム */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-gray-50 bg-teal-50"
              >
                <div className="px-5 py-4 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">操作</label>
                    <select
                      value={addValues.action}
                      onChange={(e) => setAddValues({ ...addValues, action: e.target.value as ActionType })}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ACTION_OPTIONS.map((a) => (
                        <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">時刻（JST）</label>
                    <input
                      type="time"
                      value={addValues.time}
                      onChange={(e) => setAddValues({ ...addValues, time: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-dm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">備考</label>
                    <input
                      type="text"
                      value={addValues.note}
                      onChange={(e) => setAddValues({ ...addValues, note: e.target.value })}
                      placeholder="任意"
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary w-32"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addRecord}
                      className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">読み込み中…</div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-gray-300 text-sm">記録がありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400">
                  <th className="text-left px-5 py-2.5 font-medium">操作</th>
                  <th className="text-left px-5 py-2.5 font-medium">時刻（JST）</th>
                  <th className="text-left px-5 py-2.5 font-medium">備考</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r) => (
                  <tr key={r.id} className={editingId === r.id ? 'bg-teal-50' : 'hover:bg-gray-50'}>
                    {editingId === r.id ? (
                      <>
                        <td className="px-5 py-2.5">
                          <select
                            value={editValues.action}
                            onChange={(e) => setEditValues({ ...editValues, action: e.target.value as ActionType })}
                            className="px-2 py-1 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {ACTION_OPTIONS.map((a) => (
                              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-2.5">
                          <input
                            type="datetime-local"
                            value={editValues.timestamp}
                            onChange={(e) => setEditValues({ ...editValues, timestamp: e.target.value })}
                            className="px-2 py-1 rounded border border-gray-200 text-sm font-dm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-5 py-2.5">
                          <input
                            type="text"
                            value={editValues.note}
                            onChange={(e) => setEditValues({ ...editValues, note: e.target.value })}
                            className="px-2 py-1 rounded border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-24"
                          />
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => saveEdit(r.id)} className="p-1.5 text-teal-600 hover:bg-teal-100 rounded">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 text-gray-700">{ACTION_LABELS[r.action]}</td>
                        <td className="px-5 py-3 font-dm text-gray-600">{formatTime(r.timestamp)}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{r.note ?? '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-teal-50 rounded transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteRecord(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
