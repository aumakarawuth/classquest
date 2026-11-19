import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search, UserX, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AccountStatus, AppRole } from '@/features/auth/access';
import { useAuth } from '@/features/auth/useAuth';
import { formatThaiDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import {
  listUsers,
  PAGE_SIZE,
  setUserRole,
  setUserStatus,
  type AdminUser,
  type UserFilter,
} from '../api';
import { adminErrorMessage, roleLabels, statusLabels } from '../labels';

const statusTabs: { value: UserFilter['status']; label: string }[] = [
  { value: 'pending', label: 'รออนุมัติ' },
  { value: 'active', label: 'ใช้งาน' },
  { value: 'suspended', label: 'ระงับ' },
  { value: 'all', label: 'ทั้งหมด' },
];
const allRoles: AppRole[] = ['student', 'teacher', 'admin'];

const statusTone: Record<AccountStatus, string> = {
  pending: 'bg-warning/15 text-foreground',
  active: 'bg-success/15 text-foreground',
  suspended: 'bg-destructive/10 text-foreground',
};

export default function UsersPage() {
  const [status, setStatus] = useState<UserFilter['status']>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const filter: UserFilter = { status, search, page };

  const query = useQuery({
    queryKey: ['admin', 'users', filter],
    queryFn: () => listUsers(filter),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ผู้ใช้งาน</h1>
        <p className="text-sm text-muted-foreground">อนุมัติบัญชีใหม่ กำหนดสิทธิ์ และระงับการใช้งาน</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="สถานะบัญชี"
          className="inline-flex flex-wrap gap-1 rounded-lg border bg-card p-1"
        >
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(0);
              }}
              className={cn(
                'min-h-9 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground',
                status === tab.value &&
                  'bg-primary text-primary-foreground hover:text-primary-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput);
            setPage(0);
          }}
        >
          <label htmlFor="user-search" className="sr-only">
            ค้นหาชื่อหรืออีเมล
          </label>
          <input
            id="user-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ค้นหาชื่อหรืออีเมล"
            className="min-h-11 w-full rounded-lg border bg-card px-3 text-sm md:w-64"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="ค้นหา">
            <Search aria-hidden />
          </Button>
        </form>
      </div>

      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={status === 'pending' ? 'ไม่มีบัญชีรออนุมัติ' : 'ไม่พบผู้ใช้งาน'}
          description={search ? 'ลองค้นหาด้วยคำอื่น' : undefined}
        />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={query.isFetching}>
            {query.data.users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const isSelf = auth.userId === user.id;
  const [approveRole, setApproveRole] = useState<AppRole>('student');

  const onDone = (message: string) => {
    toast.success(message);
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };
  const onError = (error: unknown) => toast.error(adminErrorMessage(error));

  const approve = useMutation({
    mutationFn: async () => {
      await setUserRole(user.id, approveRole, true);
      await setUserStatus(user.id, 'active');
    },
    onSuccess: () => onDone(`อนุมัติ ${user.displayName} เป็น${roleLabels[approveRole]}แล้ว`),
    onError,
  });
  const changeStatus = useMutation({
    mutationFn: (next: AccountStatus) => setUserStatus(user.id, next),
    onSuccess: (_, next) =>
      onDone(`เปลี่ยนสถานะ ${user.displayName} เป็น "${statusLabels[next]}" แล้ว`),
    onError,
  });
  const toggleRole = useMutation({
    mutationFn: ({ role, grant }: { role: AppRole; grant: boolean }) =>
      setUserRole(user.id, role, grant),
    onSuccess: (_, v) =>
      onDone(`${v.grant ? 'เพิ่ม' : 'ถอน'}สิทธิ์${roleLabels[v.role]}ของ ${user.displayName} แล้ว`),
    onError,
  });
  const busy = approve.isPending || changeStatus.isPending || toggleRole.isPending;

  return (
    <li>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {user.displayName}
              {isSelf && <span className="ml-2 text-xs text-muted-foreground">(คุณ)</span>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              สมัครเมื่อ {formatThaiDateTime(user.createdAt)}
            </p>
          </div>
          <span
            className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusTone[user.status])}
          >
            {statusLabels[user.status]}
          </span>
        </div>

        {user.status === 'pending' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-sm" htmlFor={`approve-role-${user.id}`}>
              อนุมัติเป็น
            </label>
            <select
              id={`approve-role-${user.id}`}
              value={approveRole}
              onChange={(e) => setApproveRole(e.target.value as AppRole)}
              className="min-h-11 rounded-lg border bg-card px-3 text-sm"
            >
              {allRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
            <Button onClick={() => approve.mutate()} disabled={busy}>
              <Check aria-hidden />
              อนุมัติ
            </Button>
          </div>
        ) : (
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-sm font-medium">สิทธิ์การใช้งาน</legend>
            <div className="flex flex-wrap gap-2">
              {allRoles.map((role) => {
                const has = user.roles.includes(role);
                const lockedSelfAdmin = isSelf && role === 'admin';
                const toggle = () => toggleRole.mutate({ role, grant: !has });
                const button = (
                  <Button
                    variant={has ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={has}
                    disabled={lockedSelfAdmin}
                    title={lockedSelfAdmin ? 'ไม่สามารถถอนสิทธิ์ผู้ดูแลของตัวเองได้' : undefined}
                    onClick={role === 'admin' ? undefined : toggle}
                  >
                    {has && <Check aria-hidden />}
                    {roleLabels[role]}
                  </Button>
                );
                return role === 'admin' && !lockedSelfAdmin ? (
                  <ConfirmDialog
                    key={role}
                    trigger={button}
                    title={has ? 'ถอนสิทธิ์ผู้ดูแลระบบ?' : 'ให้สิทธิ์ผู้ดูแลระบบ?'}
                    description={`ผู้ดูแลระบบจัดการผู้ใช้และสิทธิ์ทั้งหมดได้ — ${user.displayName}`}
                    destructive={has}
                    onConfirm={toggle}
                  />
                ) : (
                  <span key={role}>{button}</span>
                );
              })}
            </div>
          </fieldset>
        )}

        {!isSelf && user.status !== 'pending' && (
          <div className="flex justify-end">
            {user.status === 'active' ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={busy}>
                    <UserX aria-hidden />
                    ระงับบัญชี
                  </Button>
                }
                title="ระงับบัญชีนี้?"
                description={`${user.displayName} จะเข้าใช้งานระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง`}
                confirmLabel="ระงับบัญชี"
                destructive
                onConfirm={() => changeStatus.mutate('suspended')}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => changeStatus.mutate('active')}
              >
                เปิดใช้งานอีกครั้ง
              </Button>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}
