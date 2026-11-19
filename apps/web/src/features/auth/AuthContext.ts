import { createContext } from 'react';
import type { Account } from './access';

export interface AuthState {
  /** false until the initial session check finishes */
  ready: boolean;
  configured: boolean;
  userId: string | null;
  account: Account | null;
  accountError: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refetchAccount: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
