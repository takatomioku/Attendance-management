-- =============================================
-- 勤怠管理アプリ データベーススキーマ
-- Supabase の SQL Editor で実行してください
-- =============================================

-- 職員テーブル
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 打刻記録テーブル
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'go_out', 'return', 'night_duty_start', 'night_duty_end')
  ),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  work_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_attendance_staff_date ON attendance_records(staff_id, work_date);
CREATE INDEX idx_attendance_date ON attendance_records(work_date);

-- RLS（Row Level Security）を有効化
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- ポリシー：すべての操作をサービスロールキーで許可（APIルートから使用）
-- 注意: フロントエンドは直接Supabaseを呼ばず、必ずAPIルート経由でアクセスする

-- staff テーブルの読み取りのみ公開（打刻画面での名前一覧表示用）
CREATE POLICY "Public read staff" ON staff
  FOR SELECT USING (true);

-- attendance_records の挿入を公開（打刻送信用）
CREATE POLICY "Public insert attendance" ON attendance_records
  FOR INSERT WITH CHECK (true);

-- attendance_records の読み取りを公開（打刻状態確認用）
CREATE POLICY "Public read attendance" ON attendance_records
  FOR SELECT USING (true);

-- 連絡メモテーブル
CREATE TABLE IF NOT EXISTS staff_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  memo_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_memos_staff_date ON staff_memos(staff_id, memo_date);

ALTER TABLE staff_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert memos" ON staff_memos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read memos" ON staff_memos
  FOR SELECT USING (true);

-- 管理者が入力する日別備考テーブル
CREATE TABLE IF NOT EXISTS daily_remarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  remark_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, remark_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_remarks_staff_date ON daily_remarks(staff_id, remark_date);

ALTER TABLE daily_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for daily_remarks" ON daily_remarks
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 初期データ：職員
-- =============================================

INSERT INTO staff (name, display_order) VALUES
  ('宮下 司', 1),
  ('桑原 利佳', 2),
  ('山口 志保 ', 3),
  ('坂井 香代子', 4),
  ('富樫 綾子', 5),
  ('関 美織', 6),
  ('今野 知美', 7),
  ('竹内 理紗', 8),
  ('加来 景子', 9),
  ('秋山 広美', 10),
  ('江崎 亜胡', 11),
  ('加茂 里見', 12);
