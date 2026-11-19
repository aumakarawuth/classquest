import { z } from 'zod';

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_GOOGLE_HOSTED_DOMAIN: z.string().optional(),
});

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** UX hint for Google's account chooser only — the real domain check runs in the database. */
  googleHostedDomain?: string;
}

export function parseConfig(env: Record<string, unknown>): AppConfig | null {
  const result = schema.safeParse(env);
  if (!result.success) return null;
  return {
    supabaseUrl: result.data.VITE_SUPABASE_URL,
    supabaseAnonKey: result.data.VITE_SUPABASE_ANON_KEY,
    googleHostedDomain: result.data.VITE_GOOGLE_HOSTED_DOMAIN || undefined,
  };
}

export const appConfig = parseConfig(import.meta.env);
