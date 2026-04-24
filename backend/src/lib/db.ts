import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Service-role client for backend-only operations. NEVER expose to the browser.
// Use RLS-aware clients (anon key + user JWT) for anything user-scoped that
// should respect Row-Level Security.
export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
