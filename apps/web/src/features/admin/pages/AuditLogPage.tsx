import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { Pagination } from '@/components/common/Pagination';
import { Card } from '@/components/ui/card';
import { formatThaiDateTime } from '@/lib/datetime';
import { listAuditLogs, PAGE_SIZE } from '../api';
import { actionLabel, roleLabels, statusLabels } from '../labels';

function describeChange(before: unknown, after: unknown): string | null {
  const b = (before ?? {}) as Record<string, string>;
  const a = (after ?? {}) as Record<string, string>;
  if (a.role) return roleLabels[a.role as keyof typeof roleLabels] ?? a.role;
  if (a.status) {
    const from = b.status ? (statusLabels[b.status as keyof typeof statusLabels] ?? b.status) : '-';
    const to = statusLabels[a.status as keyof typeof statusLabels] ?? a.status;
    return `${from} → ${to}`;
  }
  return null;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () => listAuditLogs(page),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกการเปลี่ยนแปลงสิทธิ์และสถานะบัญชี (แก้ไขหรือลบไม่ได้)
        </p>
      </div>
      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.entries.length === 0 ? (
        <EmptyState icon={History} title="ยังไม่มีบันทึก" />
      ) : (
        <>
          <ol className="space-y-2">
            {query.data.entries.map((entry) => {
              const change = describeChange(entry.before, entry.after);
              return (
                <li key={entry.id}>
                  <Card className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <p>
                        <span className="font-semibold">{entry.actorName}</span>{' '}
                        {actionLabel(entry.action)}
                        {entry.targetName && (
                          <>
                            {' '}
                            ของ <span className="font-semibold">{entry.targetName}</span>
                          </>
                        )}
                      </p>
                      {change && <p className="text-muted-foreground">{change}</p>}
                    </div>
                    <time
                      dateTime={entry.createdAt}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {formatThaiDateTime(entry.createdAt)}
                    </time>
                  </Card>
                </li>
              );
            })}
          </ol>
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
