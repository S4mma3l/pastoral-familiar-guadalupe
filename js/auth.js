// Authentication helpers — all use nickname@pastoral.internal as the email format

const EMAIL_DOMAIN = 'pastoral.internal';

function nickToEmail(nick) {
  return `${nick.toLowerCase()}@${EMAIL_DOMAIN}`;
}

async function ensureSupabase() {
  // Wait until supabase client is initialized from CDN
  let tries = 0;
  while ((!window.supabase || !window.supabase.auth) && tries < 100) {
    await new Promise(r => setTimeout(r, 50));
    tries++;
  }
  if (!window.supabase || !window.supabase.auth) throw new Error('Supabase no disponible');
}

async function signUp(nickname, password, color) {
  await ensureSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: nickToEmail(nickname),
    password,
    options: { data: { nickname, color } }
  });
  return { data, error };
}

async function signIn(nickname, password) {
  await ensureSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: nickToEmail(nickname),
    password
  });
  return { data, error };
}

async function getSession() {
  await ensureSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

async function getProfile(userId) {
  await ensureSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

// OAuth sign-in (Google, Microsoft/Azure)
// We bypass supabase.auth.signInWithOAuth entirely to avoid SDK-internal issues
// (crypto.subtle, lock contention, flowType parsing) on Safari iOS.
// Instead we build the GoTrue /authorize URL manually and do a direct redirect.
// The callback is handled by auth-callback.html which calls setSession() with
// the access_token returned in the URL hash (implicit flow from GoTrue).
const OAUTH_REDIRECT = 'https://s4mma3l.github.io/pastoral-familiar-guadalupe/auth-callback.html';

async function signInWithProvider(provider) {
  await ensureSupabase();
  const baseUrl = window.supabase.supabaseUrl;
  const params = new URLSearchParams({
    provider: provider,
    redirect_to: OAUTH_REDIRECT,
  });
  if (provider === 'azure') params.set('scopes', 'email profile');
  // Synchronous redirect — cannot throw
  window.location.href = `${baseUrl}/auth/v1/authorize?${params.toString()}`;
  return { data: null, error: null };
}
