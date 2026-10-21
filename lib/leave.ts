import { Client } from 'pg';

/**
 * 有給管理アプリ（別Supabaseプロジェクト・Prismaスキーマ）のDBから、
 * 指定月の承認済み休暇を読み取る。勤怠側からは読み取りのみ。
 *
 * 職員の紐付けは名前で行う（空白を除去して比較）。
 */

type LeaveRow = {
  name: string;
  type: 'ANNUAL' | 'HALF_DAY' | 'HOURLY';
  start_date: string; // YYYY-MM-DD
  end_date: string;
  half_period: 'AM' | 'PM' | null;
  hours: number | null;
};

export type LeaveEntry = {
  type: LeaveRow['type'];
  halfPeriod: LeaveRow['half_period'];
  hours: number | null;
};

/** 名前比較用。半角・全角スペースを除去する */
export function normalizeName(name: string): string {
  return name.replace(/[\s　]/g, '');
}

export function formatLeaveEntry(e: LeaveEntry): string {
  if (e.type === 'ANNUAL') return '有給（1日）';
  if (e.type === 'HALF_DAY') {
    if (e.halfPeriod === 'AM') return '有給（午前半休）';
    if (e.halfPeriod === 'PM') return '有給（午後半休）';
    return '有給（半休）';
  }
  return e.hours ? `時間休（${e.hours}時間）` : '時間休';
}

/**
 * 指定月（YYYY-MM）の承認済み有給（1日・半日・時間休）を取得する。
 * 戻り値: 正規化した名前 → 日付(YYYY-MM-DD) → 休暇の配列
 */
export async function fetchMonthlyLeaves(
  month: string,
  nextMonth: string
): Promise<Map<string, Map<string, LeaveEntry[]>>> {
  const url = process.env.LEAVE_DATABASE_URL;
  if (!url) throw new Error('LEAVE_DATABASE_URL is not set');

  // Prisma用の ?pgbouncer=true は pg では不要なので除去する
  const connectionString = url.replace(/[?&]pgbouncer=true/, '');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let rows: LeaveRow[];
  try {
    // 日付は to_char で文字列化する（pg の Date 変換はローカルTZの影響を受けるため）
    const result = await client.query<LeaveRow>(
      `SELECT u.name,
              r.type::text AS type,
              to_char(r."startDate", 'YYYY-MM-DD') AS start_date,
              to_char(r."endDate", 'YYYY-MM-DD') AS end_date,
              r."halfPeriod"::text AS half_period,
              r.hours
         FROM "LeaveRequest" r
         JOIN "User" u ON u.id = r."userId"
        WHERE r.status = 'APPROVED'
          AND r.type IN ('ANNUAL', 'HALF_DAY', 'HOURLY')
          AND r."startDate" < $2::date
          AND r."endDate" >= $1::date
        ORDER BY r."startDate"`,
      [`${month}-01`, `${nextMonth}-01`]
    );
    rows = result.rows;
  } finally {
    await client.end();
  }

  const byName = new Map<string, Map<string, LeaveEntry[]>>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (!byName.has(key)) byName.set(key, new Map());
    const byDate = byName.get(key)!;

    // 複数日にまたがる申請（ANNUAL）は1日ずつ展開し、対象月の日付だけ残す
    const end = new Date(`${row.end_date}T00:00:00Z`);
    for (let d = new Date(`${row.start_date}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      if (!date.startsWith(month)) continue;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push({ type: row.type, halfPeriod: row.half_period, hours: row.hours });
    }
  }
  return byName;
}
