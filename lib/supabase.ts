import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase client — null when env vars are not set, so the app falls back to
 * local-only (localStorage) mode and nothing cloud-related runs.
 */
export const supabase: SupabaseClient | null =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Implicit flow: the magic link returns tokens in the URL hash, so a
          // session is established even when the link is opened in a different
          // browser/context than the one that requested it (no PKCE verifier
          // needed). The 6-digit code path (verifyOtp) is the robust fallback.
          flowType: "implicit",
        },
      })
    : null;

export const cloudEnabled = Boolean(supabase);
