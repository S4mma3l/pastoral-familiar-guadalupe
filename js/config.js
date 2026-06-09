// Supabase client — CDN must be loaded before this file
// Values injected by GitHub Actions at deploy time (see .github/workflows/deploy.yml)
const SUPABASE_URL = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// detectSessionInUrl:false — we exchange the PKCE code manually in auth-callback.html
// to avoid the client racing to exchange it before our code runs.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'pastoral-auth-v1',
  }
});
