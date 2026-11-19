import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { appConfig } from '@/lib/env';
import type { Account } from './access';

const profileSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string(),
  status: z.enum(['pending', 'active', 'suspended']),
});
const rolesSchema = z.array(z.object({ role: z.enum(['admin', 'teacher', 'student']) }));

/** Reads the signed-in user's own profile and roles (allowed by RLS even while pending). */
export async function fetchAccount(
  client: SupabaseClient,
  userId: string,
): Promise<Account | null> {
  const [profileRes, rolesRes] = await Promise.all([
    client
      .from('profiles')
      .select('id, email, display_name, status')
      .eq('id', userId)
      .maybeSingle(),
    client.from('user_roles').select('role').eq('user_id', userId),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (rolesRes.error) throw rolesRes.error;
  if (!profileRes.data) return null;
  const profile = profileSchema.parse(profileRes.data);
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    status: profile.status,
    roles: rolesSchema.parse(rolesRes.data).map((r) => r.role),
  };
}

export async function signInWithGoogle(client: SupabaseClient): Promise<void> {
  const queryParams: Record<string, string> = { prompt: 'select_account' };
  if (appConfig?.googleHostedDomain) queryParams.hd = appConfig.googleHostedDomain;
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams },
  });
  if (error) throw error;
}
