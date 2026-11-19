import type { ShellArea } from '@/app/navigation';

export type AppRole = 'admin' | 'teacher' | 'student';
export type AccountStatus = 'pending' | 'active' | 'suspended';

export interface Account {
  id: string;
  email: string;
  displayName: string;
  status: AccountStatus;
  roles: AppRole[];
}

/** Which role unlocks which shell area. Roles themselves come from the database. */
const areaRole: Record<ShellArea, AppRole> = {
  student: 'student',
  teacher: 'teacher',
  admin: 'admin',
};

export function canAccessArea(account: Account, area: ShellArea): boolean {
  return account.status === 'active' && account.roles.includes(areaRole[area]);
}

/** Landing area after sign-in, or null when the account cannot use the app yet. */
export function defaultArea(account: Account): ShellArea | null {
  if (account.status !== 'active') return null;
  // teachers land on their teaching area even when they are also admins
  const order: ShellArea[] = ['teacher', 'admin', 'student'];
  return order.find((area) => account.roles.includes(areaRole[area])) ?? null;
}
