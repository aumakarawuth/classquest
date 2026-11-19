import { z } from 'zod';
import type { AccountStatus, AppRole } from '@/features/auth/access';
import { supabase } from '@/lib/supabase';

export const PAGE_SIZE = 20;

const roleEnum = z.enum(['admin', 'teacher', 'student']);
const statusEnum = z.enum(['pending', 'active', 'suspended']);

const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string(),
  status: statusEnum,
  created_at: z.string(),
  user_roles: z.array(z.object({ role: roleEnum })),
});

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: AccountStatus;
  createdAt: string;
  roles: AppRole[];
}

export interface UserFilter {
  status: AccountStatus | 'all';
  search: string;
  page: number;
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

/** Escape characters with meaning in PostgREST `or`/`ilike` filters. */
export function sanitizeSearch(term: string): string {
  return term
    .replace(/[%_,()\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function listUsers(
  filter: UserFilter,
): Promise<{ users: AdminUser[]; total: number }> {
  let query = client()
    .from('profiles')
    .select(
      'id, email, display_name, status, created_at, user_roles!user_roles_user_id_fkey(role)',
      {
        count: 'exact',
      },
    )
    .order('created_at', { ascending: false })
    .range(filter.page * PAGE_SIZE, filter.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (filter.status !== 'all') query = query.eq('status', filter.status);
  const term = sanitizeSearch(filter.search);
  if (term) query = query.or(`display_name.ilike.*${term}*,email.ilike.*${term}*`);

  const { data, error, count } = await query;
  if (error) throw error;
  const users = z
    .array(userRowSchema)
    .parse(data)
    .map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      createdAt: row.created_at,
      roles: row.user_roles.map((r) => r.role),
    }));
  return { users, total: count ?? users.length };
}

export async function setUserStatus(userId: string, status: AccountStatus): Promise<void> {
  const { error } = await client().rpc('admin_set_user_status', {
    _user_id: userId,
    _status: status,
  });
  if (error) throw error;
}

export async function setUserRole(userId: string, role: AppRole, grant: boolean): Promise<void> {
  const { error } = await client().rpc('admin_set_user_role', {
    _user_id: userId,
    _role: role,
    _grant: grant,
  });
  if (error) throw error;
}

const auditRowSchema = z.object({
  id: z.string(),
  actor_id: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  before: z.unknown(),
  after: z.unknown(),
  created_at: z.string(),
});

export interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  entity: string;
  targetName: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export async function listAuditLogs(
  page: number,
): Promise<{ entries: AuditEntry[]; total: number }> {
  const { data, error, count } = await client()
    .from('audit_logs')
    .select('id, actor_id, action, entity, entity_id, before, after, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = z.array(auditRowSchema).parse(data);

  // One extra request resolves all names on the page (no N+1).
  const ids = [
    ...new Set(rows.flatMap((r) => [r.actor_id, r.entity_id]).filter((v): v is string => !!v)),
  ];
  const names = new Map<string, string>();
  if (ids.length) {
    const res = await client().from('profiles').select('id, display_name').in('id', ids);
    if (res.error) throw res.error;
    for (const p of z
      .array(z.object({ id: z.string(), display_name: z.string() }))
      .parse(res.data)) {
      names.set(p.id, p.display_name);
    }
  }

  return {
    total: count ?? rows.length,
    entries: rows.map((r) => ({
      id: r.id,
      actorName: r.actor_id ? (names.get(r.actor_id) ?? 'ผู้ใช้ที่ถูกลบ') : 'ระบบ',
      action: r.action,
      entity: r.entity,
      targetName: r.entity_id ? (names.get(r.entity_id) ?? null) : null,
      before: r.before,
      after: r.after,
      createdAt: r.created_at,
    })),
  };
}
