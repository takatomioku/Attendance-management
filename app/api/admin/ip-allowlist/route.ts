import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getIpGateState } from '@/lib/ip-gate';
import { getClientIp, normalizeIp, suggestCidr, isValidCidr } from '@/lib/ip';
import { isAuthenticated } from '@/lib/auth';

const unauthorized = () => NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

// 現在の設定・許可リスト・アクセス元IPを返す
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();
  const state = await getIpGateState(request);
  return NextResponse.json({
    enabled: state.enabled,
    rules: state.rules,
    currentIp: state.clientIp,
    currentMatches: state.matched,
    suggestedCidr: state.clientIp ? suggestCidr(state.clientIp) : null,
  });
}

// 制限ON/OFFの切替・許可IPの追加（手動 or 現在のIPを自動登録）
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const supabase = createServiceClient();

  if (body.action === 'toggle') {
    const enabled = !!body.enabled;
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'ip_restriction_enabled', value: enabled, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, enabled });
  }

  if (body.action === 'add' || body.action === 'addCurrent') {
    let cidr: string | null = null;
    let label: string | null = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null;

    if (body.action === 'addCurrent') {
      const raw = getClientIp(request.headers);
      const ip = raw ? normalizeIp(raw) : null;
      if (!ip) {
        return NextResponse.json({ error: 'アクセス元IPを取得できませんでした' }, { status: 400 });
      }
      cidr = suggestCidr(ip);
      if (!label) label = `自動登録（${ip}）`;
    } else {
      cidr = typeof body.cidr === 'string' ? body.cidr.trim() : null;
    }

    if (!cidr || !isValidCidr(cidr)) {
      return NextResponse.json({ error: 'IPアドレス/CIDRの形式が正しくありません' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ip_allowlist')
      .insert({ cidr, label })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: '不明な操作です' }, { status: 400 });
}

// 許可IPの削除
export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) return unauthorized();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from('ip_allowlist').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
