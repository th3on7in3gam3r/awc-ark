import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Same Supabase project and settings as AWC Connect. The Ark is served from Connect's
 * address (/ark), so it reads the same saved sign-in: no second login. Anon key only.
 */
export const supabase: SupabaseClient = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
});

export const CONNECT_URL = (import.meta.env.VITE_CONNECT_URL?.trim() || 'https://awc-connect.vercel.app').replace(/\/$/, '');
