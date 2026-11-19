import { Swords } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/utils';
import { fullPath, navAreas, type ShellArea } from '../navigation';

export function AppShell({ area }: { area: ShellArea }) {
  const nav = navAreas[area];
  const primaryItems = nav.items.filter((item) => item.primary);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <aside className="hidden border-r bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Brand subtitle={nav.title} className="px-5 py-5" />
        <nav aria-label={`เมนู${nav.title}`} className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-1">
            {nav.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={fullPath(nav, item)}
                  end={item.path === ''}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                      isActive &&
                        'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
                    )
                  }
                >
                  <item.icon className="size-5 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Brand subtitle={nav.title} className="lg:invisible" />
          <ThemeToggle />
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-10">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <nav
        aria-label={`เมนูหลัก${nav.title}`}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${primaryItems.length}, 1fr)` }}
        >
          {primaryItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={fullPath(nav, item)}
                end={item.path === ''}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.7rem] leading-tight font-medium text-muted-foreground',
                    isActive && 'text-primary',
                  )
                }
              >
                <item.icon className="size-5" aria-hidden />
                <span className="line-clamp-1 text-center">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Brand({ subtitle, className }: { subtitle: string; className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-3 rounded-lg', className)}>
      <span className="xp-gradient inline-flex size-9 items-center justify-center rounded-lg text-white">
        <Swords className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-bold">ClassQuest</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </Link>
  );
}
