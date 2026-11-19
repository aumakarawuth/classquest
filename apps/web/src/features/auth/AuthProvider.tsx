import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAccount, signInWithGoogle } from './api';
import { AuthContext, type AuthState } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(!supabase);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const accountQuery = useQuery({
    queryKey: ['auth', 'account', userId],
    queryFn: () => {
      if (!supabase || !userId) throw new Error('not signed in');
      return fetchAccount(supabase, userId);
    },
    enabled: !!supabase && !!userId,
  });

  const signIn = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured');
    await signInWithGoogle(supabase);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      ready: ready && (!userId || !accountQuery.isPending),
      configured: !!supabase,
      userId,
      account: accountQuery.data ?? null,
      accountError: accountQuery.isError,
      signIn,
      signOut,
      refetchAccount: () => void accountQuery.refetch(),
    }),
    [ready, userId, accountQuery, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
