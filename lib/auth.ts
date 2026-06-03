import { createSessionClient } from '@/lib/supabase/server';

/**
 * APIルートでログイン済み管理者かどうかを判定する。
 * Cookie のセッションから Supabase Auth のユーザーを取得する。
 *
 * middleware は `/admin/:path*`（ページ）のみ保護しており `/api/admin/*` は対象外なので、
 * 認可が必要なAPIルートでは各ハンドラの先頭でこの関数を呼んでガードする。
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const supabase = createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}
