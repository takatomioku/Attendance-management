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
    action IN ('clock_in', 'clock_out', 'break_start', 'break_end', 'go_out', 'return')
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

-- =============================================
-- 初期データ：職員12名の登録例
-- 実際の名前に変更してください
-- =============================================

INSERT INTO staff (name, display_order) VALUES
  ('山田 太郎', 1),
  ('鈴木 花子', 2),
  ('田中 一郎', 3),
  ('佐藤 美咲', 4),
  ('伊藤 健二', 5),
  ('渡辺 さくら', 6),
  ('中村 誠', 7),
  ('小林 陽子', 8),
  ('加藤 大輔', 9),
  ('吉田 涼子', 10),
  ('山本 拓也', 11),
  ('松本 由美', 12);
