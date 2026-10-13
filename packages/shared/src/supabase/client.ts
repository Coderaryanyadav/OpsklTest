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
const universalStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (AsyncStorage?.getItem) {
          return await AsyncStorage.getItem(key);
        }
      } catch {
        // Fallback
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Fallback
      }
    }
    return memoryStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (AsyncStorage?.setItem) {
          await AsyncStorage.setItem(key, value);
          return;
        }
      } catch {
        // Fallback
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Fallback
      }
    }
    await memoryStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        if (AsyncStorage?.removeItem) {
          await AsyncStorage.removeItem(key);
          return;
        }
      } catch {
        // Fallback
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        // Fallback
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
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL CONFIGURATION ERROR] Missing required Supabase credentials in production. ' +
      'Please supply EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[OPSKL CONFIG WARNING] Live Supabase credentials are not set. Running in development sandbox configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for live database access.'
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
    detectSessionInUrl: false,
  },
});
