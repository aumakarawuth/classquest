import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from './env';

/** `null` when the app is not configured (e.g. local preview without .env). */
export const supabase: SupabaseClient | null = appConfig
  ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
