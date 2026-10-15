import { createClient, SupabaseClient } from '@supabase/supabase-js';

class MemoryStorage {
  private store = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const memoryStorage = new MemoryStorage();

// Universal storage adapter that safely works in React Native (AsyncStorage), Browser (localStorage), and Node/SSR (MemoryStorage)
const getAsyncStorage = () => {
  try {
    const mod = require("@react-native-async-storage/async-storage");
    return mod?.default || mod;
  } catch {
    return null;
  }
};

export const universalStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const asyncStorage = getAsyncStorage();
    if (asyncStorage?.getItem) {
      try {
        return await asyncStorage.getItem(key);
      } catch {
        // Fallback to local/memory storage
      }
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Fallback to memory
      }
    }
    return memoryStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const asyncStorage = getAsyncStorage();
    if (asyncStorage?.setItem) {
      try {
        await asyncStorage.setItem(key, value);
        return;
      } catch {
        // Fallback to local/memory storage
      }
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Fallback to memory
      }
    }
    await memoryStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    const asyncStorage = getAsyncStorage();
    if (asyncStorage?.removeItem) {
      try {
        await asyncStorage.removeItem(key);
        return;
      } catch {
        // Fallback to local/memory storage
      }
    }
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        // Fallback to memory
      }
    }
    await memoryStorage.removeItem(key);
  },
};

  export const isSupabaseConfigured = Boolean(
    (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

  if (!isSupabaseConfigured) {
    // In production browser/server runtime, throw so an app doesn't silently connect to placeholder backend.
    // In Next.js static build phase or tests, warn so static page compilation succeeds without live runtime secrets.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || typeof window === 'undefined' && process.env.npm_lifecycle_event === 'build';
    if (process.env.NODE_ENV === 'production' && !isBuildPhase && typeof window !== 'undefined') {
      throw new Error(
        '[OPSKL FATAL CONFIG ERROR] Live Supabase credentials (SUPABASE_URL and SUPABASE_ANON_KEY) must be configured in production environment. Refusing to start against placeholder backend.'
      );
    } else if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[OPSKL CONFIG WARNING] Live Supabase credentials are not set in environment. Running with placeholder sandbox configuration. Supply EXPO_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL for live database access.'
      );
    }
  }

const SUPABASE_URL =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://placeholder-opskil.supabase.co';

  const SUPABASE_ANON_KEY =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder_anon_key_for_client_app';

  export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: universalStorage,
      autoRefreshToken: typeof window !== 'undefined' || (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative'),
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
  });

  let sharedClientInstance: SupabaseClient | null = null;

  export function setSharedSupabaseClient(client: SupabaseClient | null): void {
    sharedClientInstance = client;
  }

export function getSharedSupabaseClient(): SupabaseClient {
    return sharedClientInstance || supabase;
}
