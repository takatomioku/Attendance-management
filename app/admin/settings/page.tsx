'use client';

import { useState } from 'react';

const PRESETS = [
  { label: '3ヶ月より前', months: 3 },
  { label: '6ヶ月より前', months: 6 },
  { label: '1年より前', months: 12 },
  { label: '2年より前', months: 24 },
];

function getBeforeDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export default function SettingsPage() {
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const beforeDate =
    selectedMonths !== null
      ? getBeforeDate(selectedMonths)
      : customDate || null;

  const handlePreview = async () => {
    if (!beforeDate) return;
    setPreviewing(true);
    setPreviewCount(null);
    setConfirmed(false);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/cleanup?before=${beforeDate}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPreviewCount(json.count);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '不明なエラー');
      setResult('error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleDelete = async () => {
    if (!beforeDate || !confirmed) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/cleanup?before=${beforeDate}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult('success');
      setPreviewCount(null);
      setConfirmed(false);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '不明なエラー');
      setResult('error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-md-on-surface tracking-tight">設定</h1>
        <p className="text-sm text-md-on-surface-variant mt-1">データ管理・クリーンアップ</p>
      </div>

      <div className="bg-md-surface rounded-md-xl shadow-md-1 overflow-hidden max-w-2xl">
        <div className="px-6 py-4 border-b border-md-outline-variant/50">
          <h2 className="font-semibold text-md-on-surface text-sm tracking-wide">古いデータの削除</h2>
          <p className="text-xs text-md-on-surface-variant mt-1">
            指定した日付より前の打刻記録を一括削除します。この操作は元に戻せません。
          </p>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* プリセット選択 */}
          <div>
            <p className="text-sm font-medium text-md-on-surface mb-3">削除範囲を選択</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.months}
                  onClick={() => {
                    setSelectedMonths(p.months);
                    setCustomDate('');
                    setPreviewCount(null);
                    setConfirmed(false);
                    setResult(null);
                  }}
                  className={`px-4 py-2.5 rounded-md-lg border text-sm font-medium transition-colors duration-md-s4 text-left ${
                    selectedMonths === p.months
                      ? 'border-primary bg-md-primary-container text-md-on-primary-container'
                      : 'border-md-outline-variant text-md-on-surface-variant hover:bg-md-surface-container'
                  }`}
                >
                  {p.label}
                  <span className="block text-xs font-normal mt-0.5 opacity-70">
                    {getBeforeDate(p.months)} より前
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 日付直接指定 */}
          <div>
            <p className="text-sm font-medium text-md-on-surface mb-2">または日付を直接指定</p>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setSelectedMonths(null);
                setPreviewCount(null);
                setConfirmed(false);
                setResult(null);
              }}
              className="w-full border border-md-outline-variant rounded-md-md px-3 py-2 text-sm text-md-on-surface bg-md-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {customDate && (
              <p className="text-xs text-md-on-surface-variant mt-1">
                {customDate} より前のデータを削除します
              </p>
            )}
          </div>

          {/* 件数確認ボタン */}
          <button
            onClick={handlePreview}
            disabled={!beforeDate || previewing}
            className="w-full py-2.5 rounded-md-full border border-primary text-primary text-sm font-medium hover:bg-md-primary-container transition-colors duration-md-s4 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {previewing ? '確認中…' : '削除される件数を確認する'}
          </button>

          {/* 件数表示 + 確認 */}
          {previewCount !== null && (
            <div className="bg-md-warning-container border border-md-on-warning-container/20 rounded-md-lg px-5 py-4 space-y-3">
              <p className="text-sm font-semibold text-md-on-warning-container">
                {beforeDate} より前の打刻記録：<span className="text-lg">{previewCount}</span> 件
              </p>
              {previewCount === 0 ? (
                <p className="text-xs text-md-on-warning-container/70">削除対象のデータはありません。</p>
              ) : (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm text-md-on-warning-container">
                      {previewCount} 件のデータを削除することを確認しました
                    </span>
                  </label>

                  <button
                    onClick={handleDelete}
                    disabled={!confirmed || deleting}
                    className="w-full py-2.5 rounded-md-full bg-md-error text-white text-sm font-medium hover:opacity-90 transition-opacity duration-md-s4 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleting ? '削除中…' : `${previewCount} 件を削除する`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* 結果表示 */}
          {result === 'success' && (
            <div className="bg-md-primary-container border border-primary/20 rounded-md-lg px-5 py-4">
              <p className="text-sm font-semibold text-md-on-primary-container">
                ✓ 削除が完了しました
              </p>
            </div>
          )}
          {result === 'error' && (
            <div className="bg-md-error-container border border-md-error/20 rounded-md-lg px-5 py-4">
              <p className="text-sm font-semibold text-md-on-error-container">
                エラー: {errorMsg}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
