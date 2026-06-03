import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getJSTDateString } from '@/lib/utils';
import { getIpGateState } from '@/lib/ip-gate';

export async function POST(request: NextRequest) {
  // 院内Wi-Fi打刻制限：許可ネットワーク外からの打刻をブロック
  const gate = await getIpGateState(request);
  if (!gate.allowed) {
    console.warn(`[attendance] IP制限により打刻をブロック: ${gate.clientIp ?? '不明'}`);
    return NextResponse.json(
      {
        error: `院内のWi-Fiに接続してから打刻してください。それでも打刻できない場合は、この番号を管理者にお伝えください: ${gate.clientIp ?? '不明'}`,
        code: 'ip_blocked',
      },
      { status: 403 }
    );
  }

  const { staff_id, action } = await request.json();
  if (!staff_id || !action) {
    return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const work_date = getJSTDateString(now);

  const { data, error } = await supabase
    .from('attendance_records')
    .insert({ staff_id, action, timestamp: now.toISOString(), work_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
