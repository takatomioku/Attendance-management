import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeIp, suggestCidr } from '@/lib/ip';

// =============================================
// 院内回線のIP変更を外部から自動で許可リストへ反映するAPI
// 院内のノートPCで動くIP監視プログラム（別リポジトリ IP_inform_app の ip_monitor.py）が
// グローバルIPの変化を検知したときに、ここへPOSTする。
//
// 管理者のログインセッションは使えないため、環境変数 IP_AUTO_UPDATE_TOKEN の
// 共有トークン（Authorization: Bearer ...）で認証する。未設定時は常に拒否。
// =============================================

/** 自動登録した行を手動登録と区別するためのラベル接頭辞 */
const AUTO_LABEL_PREFIX = '自動登録（IP監視）';

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.IP_AUTO_UPDATE_TOKEN;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// body: { newIp: string, oldIp?: string, host?: string, detectedAt?: string }
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const newIp = typeof body.newIp === 'string' ? normalizeIp(body.newIp) : null;
  const newCidr = newIp ? suggestCidr(newIp) : null;
  if (!newIp || !newCidr) {
    return NextResponse.json({ error: '新しいIPの形式が正しくありません' }, { status: 400 });
  }
  const oldIp = typeof body.oldIp === 'string' ? normalizeIp(body.oldIp) : null;
  const oldCidr = oldIp ? suggestCidr(oldIp) : null;

  const supabase = createServiceClient();
  const { data: rules, error: listError } = await supabase
    .from('ip_allowlist')
    .select('id, label, cidr');
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  // 1) 新しいIPを追加（同じメールの再処理などで既に登録済みなら何もしない）
  const alreadyExists = (rules ?? []).some((r) => r.cidr === newCidr);
  if (!alreadyExists) {
    const host = typeof body.host === 'string' && body.host.trim() ? ` ${body.host.trim()}` : '';
    const detectedAt = typeof body.detectedAt === 'string' ? body.detectedAt.trim() : '';
    const label = `${AUTO_LABEL_PREFIX}${detectedAt || new Date().toISOString()}${host}`.slice(0, 200);
    const { error } = await supabase.from('ip_allowlist').insert({ cidr: newCidr, label });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) 旧IPを削除。手動登録した行は消さず、このAPIが自動登録した行だけを対象にする。
  //    使われなくなった回線IPを残すと、そのIPが他の契約者に再割当てされた際に打刻を許してしまうため。
  let removed = 0;
  if (oldCidr && oldCidr !== newCidr) {
    const ids = (rules ?? [])
      .filter((r) => r.cidr === oldCidr && (r.label ?? '').startsWith(AUTO_LABEL_PREFIX))
      .map((r) => r.id);
    if (ids.length > 0) {
      const { error } = await supabase.from('ip_allowlist').delete().in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      removed = ids.length;
    }
  }

  console.info(`[ip-auto] 許可リスト更新: added=${alreadyExists ? 'none' : newCidr} removedOld=${removed}`);
  return NextResponse.json({ ok: true, added: alreadyExists ? null : newCidr, removed });
}
