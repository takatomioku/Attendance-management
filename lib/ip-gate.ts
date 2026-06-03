// =============================================
// 院内Wi-Fi打刻制限のゲート判定（DBアクセスあり）
// 打刻API・管理画面APIの両方から利用する。
// =============================================
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getClientIp, normalizeIp, isIpAllowed } from '@/lib/ip';

export type IpRule = { id: string; label: string | null; cidr: string };

export type IpGateState = {
  enabled: boolean; // 制限が有効か
  rules: IpRule[]; // 登録済み許可IP/CIDR
  clientIp: string | null; // 今回のリクエスト元IP（正規化済み）
  matched: boolean; // clientIp が許可リストに一致するか（制限ON/OFFとは独立）
  allowed: boolean; // 最終判定：打刻を許可してよいか
};

/**
 * リクエスト元IPと設定を突き合わせ、打刻を許可してよいかを判定する。
 *
 * 締め出し防止のため fail-open 設計：
 *  - 制限が無効、または許可リストが空（＝未設定 or マイグレーション未実行）の場合は常に許可する。
 *  - 制限が有効かつ許可リストがある場合のみ、一致した時だけ許可する。
 */
export async function getIpGateState(request: NextRequest): Promise<IpGateState> {
  const supabase = createServiceClient();
  const raw = getClientIp(request.headers);
  const clientIp = raw ? normalizeIp(raw) ?? raw : null;

  const [settingRes, rulesRes] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'ip_restriction_enabled').maybeSingle(),
    supabase.from('ip_allowlist').select('id, label, cidr').order('created_at', { ascending: true }),
  ]);

  // DBエラーは握り潰さずログに残す（fail-openは維持しつつ、機能の故障を運用で検知できるように）。
  // テーブル未作成（マイグレーション未実行）の段階でも error になるが、その場合も fail-open で打刻は通る。
  if (settingRes.error) console.error('[ip-gate] app_settings の取得に失敗:', settingRes.error.message);
  if (rulesRes.error) console.error('[ip-gate] ip_allowlist の取得に失敗:', rulesRes.error.message);

  const settingValue = settingRes.data?.value;
  const enabled = settingValue === true || settingValue === 'true' || settingValue === 1;
  const rules: IpRule[] = Array.isArray(rulesRes.data) ? rulesRes.data : [];

  const matched = clientIp ? isIpAllowed(clientIp, rules.map((r) => r.cidr)) : false;
  const allowed = !enabled || rules.length === 0 ? true : matched;

  return { enabled, rules, clientIp, matched, allowed };
}
