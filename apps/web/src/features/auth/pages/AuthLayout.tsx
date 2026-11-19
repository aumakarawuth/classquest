import { Swords } from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="xp-gradient inline-flex size-11 items-center justify-center rounded-lg text-white">
              <Swords className="size-6" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-xl font-bold">ClassQuest</p>
              <p className="text-sm text-muted-foreground">เรียนรู้แบบเกม พัฒนาสมรรถนะ</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
