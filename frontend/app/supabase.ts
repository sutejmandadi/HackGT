import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = Boolean(url || key);
let client: SupabaseClient | undefined;

// Public key only. Database grants and RLS enforce access, not this UI.
export function getSupabase() {
  if (!url || !key) throw new Error("Supabase is not configured.");
  if (!client) client = createClient(url, key);
  return client;
}

