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

// OAuth sign-in (Google, Microsoft/Azure, Apple)
const OAUTH_REDIRECT = 'https://s4mma3l.github.io/pastoral-familiar-guadalupe/auth-callback.html';

async function signInWithProvider(provider) {
  await ensureSupabase();
  const options = { redirectTo: OAUTH_REDIRECT };
  if (provider === 'azure') options.scopes = 'email profile';
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options });
  return { data, error };
}
