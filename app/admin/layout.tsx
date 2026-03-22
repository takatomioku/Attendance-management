import Link from 'next/link';
import { LogoutButton } from '@/components/admin/LogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-md-surface-container">
      {/* MD3 Top App Bar (Small) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-md-surface shadow-md-1">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Leading: logo + title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-md-md flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-semibold text-md-on-surface text-base tracking-tight">勤怠管理</span>
          </div>

          {/* Trailing: navigation links + logout */}
          <nav className="flex items-center gap-1">
            <NavLink href="/admin" label="ダッシュボード" />
            <NavLink href="/admin/monthly" label="月次集計" />
            <NavLink href="/admin/edit" label="打刻修正" />
            <div className="ml-3 pl-3 border-l border-md-outline-variant">
              <LogoutButton />
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-sm font-medium rounded-md-full text-md-on-surface-variant hover:bg-[var(--md-state-primary-hover)] hover:text-primary transition-[background-color,color] duration-md-s4 ease-md-standard focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {label}
    </Link>
  );
}
