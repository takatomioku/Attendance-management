'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません');
      setLoading(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-md-surface-container flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-md-xl mb-4 shadow-md-2">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-md-on-surface">管理者ログイン</h1>
          <p className="text-sm text-md-on-surface-variant mt-1">勤怠管理システム</p>
        </div>

        {/* MD3 Elevated Card */}
        <form onSubmit={handleLogin} className="bg-md-surface rounded-md-xl shadow-md-1 p-6 space-y-5">
          {/* MD3 Outlined TextField */}
          <div>
            <label className="block text-xs font-medium text-md-on-surface-variant mb-1.5 tracking-wide">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={cn(
                'w-full px-4 py-3.5 rounded-md-sm border border-md-outline bg-md-surface-container',
                'text-md-on-surface text-base',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:bg-md-surface',
                'transition-[border-color,background-color,box-shadow] duration-md-s4 ease-md-standard',
                'placeholder:text-md-on-surface-variant/40'
              )}
              placeholder="admin@clinic.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-md-on-surface-variant mb-1.5 tracking-wide">
              パスワード
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={cn(
                  'w-full px-4 py-3.5 pr-12 rounded-md-sm border border-md-outline bg-md-surface-container',
                  'text-md-on-surface text-base',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:bg-md-surface',
                  'transition-[border-color,background-color,box-shadow] duration-md-s4 ease-md-standard',
                  'placeholder:text-md-on-surface-variant/40'
                )}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-md-on-surface-variant hover:text-md-on-surface transition-colors duration-md-s4"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-md-on-error-container text-sm bg-md-error-container rounded-md-sm px-3 py-2.5"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* MD3 Filled Button (pill) */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-3.5 rounded-md-full bg-primary text-white font-medium text-base tracking-wide',
              'hover:shadow-md-2 transition-[box-shadow,background-color] duration-md-s4 ease-md-standard',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'active:bg-primary-dark active:scale-[0.98]',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>

          {/* 打刻画面へ戻る */}
          <a
            href="/"
            className={cn(
              'flex items-center justify-center gap-2 w-full py-3 rounded-md-full',
              'border border-md-outline text-md-on-surface-variant text-sm font-medium',
              'hover:bg-md-surface-container transition-colors duration-md-s4 ease-md-standard',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            打刻画面へ戻る
          </a>
        </form>
      </motion.div>
    </div>
  );
}
