import { z } from 'zod';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const quotaSchema = z.object({
  db_bytes: z.coerce.number(),
  storage_bytes: z.coerce.number(),
  limits: z.object({
    db_bytes: z.number(),
    storage_bytes: z.number(),
    egress_bytes_month: z.number(),
    mau: z.number(),
  }),
  last_backup_at: z.string().nullable(),
  users: z.number(),
  active_users_30d: z.number(),
  courses: z.number(),
  submissions: z.number(),
  quiz_attempts: z.number(),
  xp_transactions: z.number(),
  audit_logs: z.number(),
  largest_tables: z.array(z.object({ name: z.string(), bytes: z.coerce.number() })).nullable(),
});
export type Quota = z.infer<typeof quotaSchema>;

export async function getQuota(): Promise<Quota> {
  const { data, error } = await client().rpc('admin_quota');
  if (error) throw error;
  return quotaSchema.parse(data);
}

export async function exportAll(): Promise<unknown> {
  const { data, error } = await client().rpc('admin_export');
  if (error) throw error;
  return data;
}

const settingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable(),
  updated_at: z.string(),
});
export type Setting = z.infer<typeof settingSchema>;

export async function listSettings(): Promise<Setting[]> {
  const { data, error } = await client()
    .from('system_settings')
    .select('key, value, description, updated_at')
    .order('key');
  if (error) throw error;
  return z.array(settingSchema).parse(data);
}

export async function updateSetting(key: string, value: unknown, userId: string) {
  const { error } = await client()
    .from('system_settings')
    .update({ value, updated_by: userId })
    .eq('key', key);
  if (error) throw error;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString('th-TH', { maximumFractionDigits: 1 })} ${units[i]}`;
}

/** Validates the allowed-domain list: lower-case hostnames, no "@". */
export function parseDomains(text: string): { domains: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const re = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
  return {
    domains: [...new Set(parts.filter((d) => re.test(d)))],
    invalid: parts.filter((d) => !re.test(d)),
  };
}
