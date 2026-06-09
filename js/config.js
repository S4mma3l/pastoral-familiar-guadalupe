// Supabase client — CDN must be loaded before this file
// Values injected by GitHub Actions at deploy time (see .github/workflows/deploy.yml)
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// flowType:'implicit' — avoids PKCE crypto.subtle and lock-contention on Safari iOS.
// With PKCE (default), signInWithOAuth internally calls crypto.subtle.digest + acquires
// an auth lock. If autoRefreshToken holds that lock (processing a 400 refresh_token_not_found),
// the lock times out and throws — showing "Error de conexión" to the user.
// Implicit flow redirects directly; auth-callback.html receives access_token in the hash
// and calls setSession() manually. detectSessionInUrl stays false so the client never
// auto-processes URL tokens; auth-callback.html owns that logic exclusively.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'pastoral-auth-v1',
  }
});
