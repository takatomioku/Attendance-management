'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wifi, Plus, Trash2, ShieldCheck, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react';

type Rule = { id: string; label: string | null; cidr: string };

type State = {
  enabled: boolean;
  rules: Rule[];
  currentIp: string | null;
  currentMatches: boolean;
  suggestedCidr: string | null;
};

export function IpAllowlistSettings() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualCidr, setManualCidr] = useState('');
  const [manualLabel, setManualLabel] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/ip-allowlist', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '読み込みに失敗しました');
      setState(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/admin/ip-allowlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '操作に失敗しました');
        await load();
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '操作に失敗しました');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const handleToggle = () => {
    if (!state) return;
    post({ action: 'toggle', enabled: !state.enabled });
  };

  const handleAddCurrent = () => post({ action: 'addCurrent' });

  const handleAddManual = async () => {
    if (!manualCidr.trim()) return;
    const ok = await post({ action: 'add', cidr: manualCidr.trim(), label: manualLabel.trim() || undefined });
    if (ok) {
      setManualCidr('');
      setManualLabel('');
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/ip-allowlist?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '削除に失敗しました');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-md-surface rounded-md-xl shadow-md-1 overflow-hidden max-w-2xl mt-6">
      <div className="px-6 py-4 border-b border-md-outline-variant/50">
        <h2 className="font-semibold text-md-on-surface text-sm tracking-wide flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" />
          院内Wi-Fi打刻制限
        </h2>
        <p className="text-xs text-md-on-surface-variant mt-1">
          有効にすると、ここに登録したネットワークからのみ打刻できます。院内Wi-Fiの回線IPを登録してください。
        </p>
      </div>

      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <p className="text-sm text-md-on-surface-variant">読み込み中…</p>
        ) : !state ? (
          <p className="text-sm text-md-on-error-container">{error || '読み込みに失敗しました'}</p>
        ) : (
          <>
            {/* ON/OFF トグル */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-md-on-surface">打刻をWi-Fiで制限する</p>
                <p className="text-xs text-md-on-surface-variant mt-0.5">
                  {state.enabled ? '有効：登録ネットワークからのみ打刻できます' : '無効：どこからでも打刻できます'}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={state.enabled}
                onClick={handleToggle}
                disabled={busy}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-md-full transition-colors duration-md-s4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 ${
                  state.enabled ? 'bg-primary' : 'bg-md-surface-container-high'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md-1 transition-transform duration-md-s4 ${
                    state.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 制限が有効なのに許可リストが空 → 締め出し防止で無効扱いの注意 */}
            {state.enabled && state.rules.length === 0 && (
              <div className="flex items-start gap-2 text-md-on-warning-container text-sm bg-md-warning-container rounded-md-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  許可IPが未登録のため、現在は<strong>どこからでも打刻できます</strong>。下のボタンで院内のIPを登録すると制限が効き始めます。
                </p>
              </div>
            )}

            {/* 現在のアクセス元IP */}
            <div className="bg-md-surface-container rounded-md-lg px-4 py-3">
              <p className="text-xs text-md-on-surface-variant mb-1">
                この端末のアクセス元IP（サーバーから見えるIP{state.currentIp ? `・${state.currentIp.includes(':') ? 'IPv6' : 'IPv4'}` : ''}）
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="font-dm-mono text-sm text-md-on-surface break-all">
                  {state.currentIp ?? '取得できませんでした'}
                </span>
                {state.currentMatches ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-md-on-primary-container bg-md-primary-container px-2 py-1 rounded-md-full flex-shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    許可リスト内
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-md-on-surface-variant bg-md-surface-container-high px-2 py-1 rounded-md-full flex-shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    未登録
                  </span>
                )}
              </div>
            </div>

            {/* 現在のIPを登録 */}
            <button
              onClick={handleAddCurrent}
              disabled={busy || !state.currentIp}
              className="w-full py-2.5 rounded-md-full bg-md-primary-container text-md-on-primary-container text-sm font-medium hover:shadow-md-1 transition-shadow duration-md-s4 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              この端末のIP{state.suggestedCidr ? `（${state.suggestedCidr}）` : ''}を許可リストに追加
            </button>
            <div className="text-xs text-md-on-surface-variant -mt-3 space-y-1.5 bg-md-surface-container rounded-md-md px-4 py-3">
              <p>※ この設定は<strong>管理者が院内Wi-Fiに接続した状態</strong>で行ってください。回線IPが変わったら、同じ手順で開き直して登録し直します。</p>
              <p>※ 職員が打刻に使うスマホを院内Wi-Fiに繋ぎ、この画面（管理者ログイン）を開いて登録すると、職員端末と同じ経路のIPを確実に登録できます。</p>
              <p>※ <strong>IPv4とIPv6の両方が使われる回線（ギガらくWiFi等）</strong>では、両方を登録しないと一部の端末が打刻できないことがあります。職員が「打刻できない」と言ったら、その端末でこの画面を開き、表示されたIPを追加してください。</p>
              <p>※ IPv6で複数台あり<strong>/64で弾かれる</strong>ときは、下の手動追加で <code>/56</code> や <code>/48</code> を試してください。</p>
            </div>

            {/* 登録済みリスト */}
            <div>
              <p className="text-sm font-medium text-md-on-surface mb-2">許可リスト（{state.rules.length}件）</p>
              {state.rules.length === 0 ? (
                <p className="text-xs text-md-on-surface-variant">まだ登録されていません。</p>
              ) : (
                <ul className="space-y-2">
                  {state.rules.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 border border-md-outline-variant rounded-md-lg px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-dm-mono text-sm text-md-on-surface break-all">{r.cidr}</p>
                        {r.label && <p className="text-xs text-md-on-surface-variant truncate">{r.label}</p>}
                      </div>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={busy}
                        className="p-2 rounded-md-full text-md-on-surface-variant hover:bg-md-error-container hover:text-md-on-error-container transition-colors duration-md-s4 disabled:opacity-40 flex-shrink-0"
                        aria-label="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 手動追加 */}
            <details className="group">
              <summary className="text-sm text-primary cursor-pointer select-none list-none flex items-center gap-1">
                <Plus className="w-4 h-4" />
                IP/CIDRを手動で追加する
              </summary>
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={manualCidr}
                  onChange={(e) => setManualCidr(e.target.value)}
                  placeholder="例: 203.0.113.45 または 2001:db8::/64"
                  className="w-full border border-md-outline-variant rounded-md-md px-3 py-2 text-sm text-md-on-surface bg-md-surface font-dm-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="text"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  placeholder="メモ（任意）例: クリニック光回線"
                  className="w-full border border-md-outline-variant rounded-md-md px-3 py-2 text-sm text-md-on-surface bg-md-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddManual}
                  disabled={busy || !manualCidr.trim()}
                  className="w-full py-2.5 rounded-md-full border border-primary text-primary text-sm font-medium hover:bg-md-primary-container transition-colors duration-md-s4 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  追加する
                </button>
              </div>
            </details>

            {/* 再読み込み */}
            <button
              onClick={load}
              disabled={busy}
              className="text-xs text-md-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              最新の状態に更新
            </button>

            {error && (
              <div className="flex items-center gap-2 text-md-on-error-container text-sm bg-md-error-container rounded-md-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
