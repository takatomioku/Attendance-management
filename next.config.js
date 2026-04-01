/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 管理者ダッシュボードのクライアントサイドRouter Cacheを無効化し、
    // ページ遷移のたびに最新データを取得する
    staleTimes: {
      dynamic: 0,
    },
  },
};

module.exports = nextConfig;
