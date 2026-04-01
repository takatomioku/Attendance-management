'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const INTERVAL_SEC = 30;

export function DashboardRefresher() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    router.refresh();
    setLastUpdated(new Date());
    setTimeout(() => setSpinning(false), 600);
  };

  useEffect(() => {
    const id = setInterval(refresh, INTERVAL_SEC * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(lastUpdated.getHours())}:${pad(lastUpdated.getMinutes())}:${pad(lastUpdated.getSeconds())}`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-md-on-surface-variant font-dm">
        {timeStr} 更新
      </span>
      <button
        onClick={refresh}
        title="今すぐ更新"
        className="p-1.5 rounded-md-full hover:bg-[var(--md-state-primary-hover)] transition-colors duration-md-s4"
      >
        <RefreshCw
          className={`w-4 h-4 text-md-on-surface-variant transition-transform duration-300 ${spinning ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  );
}
