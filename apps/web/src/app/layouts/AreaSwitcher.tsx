import { NavLink } from 'react-router-dom';
import { canAccessArea } from '@/features/auth/access';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/lib/utils';
import { navAreas, type ShellArea } from '../navigation';

const order: ShellArea[] = ['teacher', 'student', 'admin'];

/** Lets users with several roles switch between the teacher / student / admin areas. Hidden for single-role users. */
export function AreaSwitcher({ current }: { current: ShellArea }) {
  const { account } = useAuth();
  if (!account) return null;
  const areas = order.filter((a) => canAccessArea(account, a));
  if (areas.length < 2) return null;
  return (
    <nav aria-label="สลับบทบาท" className="inline-flex rounded-lg border bg-card p-1">
      {areas.map((a) => (
        <NavLink
          key={a}
          to={navAreas[a].basePath}
          aria-current={a === current ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground',
            a === current && 'bg-primary text-primary-foreground hover:text-primary-foreground',
          )}
        >
          {navAreas[a].title}
        </NavLink>
      ))}
    </nav>
  );
}
