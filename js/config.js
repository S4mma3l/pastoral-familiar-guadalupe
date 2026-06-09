// Supabase client — CDN must be loaded before this file
// Values injected by GitHub Actions at deploy time (see .github/workflows/deploy.yml)
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// detectSessionInUrl:false — auth-callback.html processes OAuth tokens manually
// via setSession() so the client never races against the callback page.
// OAuth redirect is built manually in auth.js using window.supabase.supabaseUrl
// to avoid SDK-internal crypto/lock issues on Safari iOS.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'pastoral-auth-v1',
  }
});
