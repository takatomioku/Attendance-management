import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: 指定日より古いレコードの件数を返す
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before'); // YYYY-MM-DD

  if (!before) {
    return NextResponse.json({ error: 'before パラメータが必要です' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('attendance_records')
    .select('*', { count: 'exact', head: true })
    .lt('work_date', before);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}

// DELETE: 指定日より古いレコードを削除する
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before'); // YYYY-MM-DD

  if (!before) {
    return NextResponse.json({ error: 'before パラメータが必要です' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .lt('work_date', before);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
