import { parseConfig } from './env';

it('returns null when Supabase env is missing or invalid', () => {
  expect(parseConfig({})).toBeNull();
  expect(
    parseConfig({ VITE_SUPABASE_URL: 'not-a-url', VITE_SUPABASE_ANON_KEY: 'x'.repeat(30) }),
  ).toBeNull();
});

it('parses a valid config', () => {
  expect(
    parseConfig({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'x'.repeat(30),
      VITE_GOOGLE_HOSTED_DOMAIN: '',
    }),
  ).toEqual({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'x'.repeat(30) });
});
