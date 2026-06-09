// Notification helpers: load, badge, mark-read

async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count || 0;
}

async function loadNotifications(userId, limit = 30) {
  const { data } = await supabase
    .from('notifications')
    .select('*, actor:actor_id(nickname, color, avatar_url), post:post_id(content)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

async function markAllNotificationsRead(userId) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

function renderNotificationBell(userId, container) {
  container.innerHTML = `
    <button class="notif-bell" id="notif-bell-btn" title="Notificaciones" onclick="openNotifSheet()">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span class="notif-badge hidden" id="notif-badge">0</span>
    </button>
  `;
  refreshNotifBadge(userId);
}

async function refreshNotifBadge(userId) {
  if (!userId) return;
  const count = await getUnreadCount(userId);
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function buildNotifSheet(userId) {
  if (document.getElementById('notif-sheet-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'notif-sheet-overlay';
  overlay.onclick = e => { if (e.target === overlay) closeNotifSheet(); };
  overlay.innerHTML = `
    <div class="sheet" id="notif-sheet">
      <div class="sheet-handle"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <div class="sheet-title" style="margin:0">Notificaciones</div>
        <button class="link-btn" style="font-size:.82rem" id="notif-mark-read-btn" onclick="handleMarkAllRead()">Marcar todo leído</button>
      </div>
      <div id="notif-list" style="max-height:60vh;overflow-y:auto">
        <div class="mini-spin"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function openNotifSheet() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  buildNotifSheet(session.user.id);
  document.getElementById('notif-sheet-overlay').classList.remove('hidden');
  await renderNotifList(session.user.id);
  await markAllNotificationsRead(session.user.id);
  refreshNotifBadge(session.user.id);
}

function closeNotifSheet() {
  const overlay = document.getElementById('notif-sheet-overlay');
  if (overlay) overlay.classList.add('hidden');
}

async function renderNotifList(userId) {
  const listEl = document.getElementById('notif-list');
  if (!listEl) return;
  const items = await loadNotifications(userId);
  if (!items.length) {
    listEl.innerHTML = '<p style="color:var(--ink-3);text-align:center;padding:1.5rem;font-size:.9rem">No tienes notificaciones aún.</p>';
    return;
  }
  listEl.innerHTML = items.map(n => {
    const actor = n.actor || { nickname: '?', color: '#999', avatar_url: null };
    const av = actor.avatar_url
      ? `<img src="${escapeHtml(actor.avatar_url)}" />`
      : actor.nickname.charAt(0).toUpperCase();
    const isLike = n.type === 'like';
    const msg = isLike
      ? `<strong>${escapeHtml(actor.nickname)}</strong> le dio <span style="color:#E53935">♥</span> a tu publicación`
      : `<strong>${escapeHtml(actor.nickname)}</strong> comentó: <em>"${escapeHtml((n.comment_preview || '').substring(0, 60))}${(n.comment_preview || '').length > 60 ? '…' : ''}"</em>`;
    return `
      <div class="notif-row ${n.read ? '' : 'notif-unread'}" onclick="goToPost('${n.post_id}')">
        <div class="avatar sm" style="background:${actor.color};flex-shrink:0">${av}</div>
        <div class="notif-body">
          <div class="notif-msg">${msg}</div>
          <div class="notif-time">${formatRelative(n.created_at)}</div>
        </div>
        <div class="notif-type-icon">${isLike ? '♥' : '💬'}</div>
      </div>
    `;
  }).join('');
}

function goToPost(postId) {
  if (!postId) return;
  closeNotifSheet();
  window.location.href = `feed.html#post-${postId}`;
}

async function handleMarkAllRead() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await markAllNotificationsRead(session.user.id);
  refreshNotifBadge(session.user.id);
  const items = document.querySelectorAll('.notif-row');
  items.forEach(el => el.classList.remove('notif-unread'));
}

async function insertNotification(type, postId, postOwnerId, commentPreview) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const actorId = session.user.id;
  if (actorId === postOwnerId) return;
  await supabase.from('notifications').insert({
    user_id: postOwnerId,
    actor_id: actorId,
    post_id: postId,
    type,
    comment_preview: commentPreview || null,
    read: false
  });
}
