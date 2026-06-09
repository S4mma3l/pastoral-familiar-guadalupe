// Feed logic: posts, likes, comments, stories

const SVG_HEART      = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_HEART_FILL = `<svg class="icon" viewBox="0 0 24 24" fill="#E53935" stroke="#E53935" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_COMMENT    = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const SVG_TRASH      = `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

// ===== STORIES (sesiones como historias) =====
async function loadStories() {
  const { data } = await supabase.from('sessions').select('id,title,cover_emoji').order('created_at', { ascending: false }).limit(10);
  const row = document.getElementById('stories-row');
  if (!row) return;
  row.innerHTML = '';
  if (!data || !data.length) { row.style.display = 'none'; return; }
  data.forEach(s => {
    const item = document.createElement('div');
    item.className = 'story-item';
    item.onclick = () => window.location.href = `session.html?id=${s.id}`;
    item.innerHTML = `
      <div class="story-ring-wrap">
        <div class="avatar lg" style="background:linear-gradient(135deg,var(--p-light),var(--p-dark));font-size:1.6rem;display:flex;align-items:center;justify-content:center">
          ${s.cover_emoji || '✝️'}
        </div>
      </div>
      <span class="story-label">${escapeHtml(s.title)}</span>
    `;
    row.appendChild(item);
  });
}

// ===== FEED =====
async function loadFeed() {
  const list = document.getElementById('feed-list');
  const empty = document.getElementById('empty-feed');
  if (!list) return;

  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles!posts_user_id_fkey(nickname, color, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(30);

  list.innerHTML = '';
  if (error || !data || !data.length) { empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const postIds = data.map(p => p.id);

  // Fetch session titles for cross-posted comments
  const sessionIds = [...new Set(data.filter(p => p.session_id).map(p => p.session_id))];
  let sessionsMap = {};
  if (sessionIds.length) {
    const { data: sess } = await supabase
      .from('sessions').select('id, title, cover_emoji').in('id', sessionIds);
    (sess || []).forEach(s => { sessionsMap[s.id] = s; });
  }

  let myLikes = new Set();
  let likeCounts = {};
  let commentCounts = {};

  const [likesRes, allLikesRes, commentsRes] = await Promise.all([
    userId ? supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', userId) : Promise.resolve({ data: [] }),
    supabase.from('post_likes').select('post_id').in('post_id', postIds),
    supabase.from('post_comments').select('id, post_id, content, created_at, profiles!post_comments_user_id_fkey(nickname, color, avatar_url)').in('post_id', postIds).order('created_at', { ascending: false })
  ]);

  (likesRes.data || []).forEach(l => myLikes.add(l.post_id));
  (allLikesRes.data || []).forEach(l => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1; });

  const commentsByPost = {};
  (commentsRes.data || []).forEach(c => {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
    commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
  });

  data.forEach(post => {
    const sessionInfo = post.session_id ? sessionsMap[post.session_id] : null;
    const card = buildPostCard(post, userId, myLikes.has(post.id), likeCounts[post.id] || 0, commentsByPost[post.id] || [], commentCounts[post.id] || 0, sessionInfo);
    list.appendChild(card);
  });
}

function buildPostCard(post, userId, liked, likeCount, comments, commentCount, sessionInfo) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.id = `post-${post.id}`;
  const p = post.profiles || { nickname: '?', color: '#999', avatar_url: null };
  const isOwner = userId === post.user_id;
  const topComment = comments[comments.length - 1];

  const authorAv = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" />`
    : p.nickname.charAt(0).toUpperCase();

  const sessionRef = sessionInfo
    ? '<a class="post-session-ref" href="session.html?id=' + sessionInfo.id + '">'
      + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
      + ' Comentó en la sesión: ' + escapeHtml(sessionInfo.title)
      + '</a>'
    : '';

  el.innerHTML = `
    <div class="post-header">
      <div class="avatar md" style="background:${p.color};cursor:pointer" onclick="window.location.href='profile.html?id=${post.user_id}'">${authorAv}</div>
      <div style="flex:1;min-width:0">
        <div class="post-author-name">${escapeHtml(p.nickname)}</div>
        <div class="post-time">${formatRelative(post.created_at)}</div>
      </div>
      ${isOwner || currentProfile?.is_admin
        ? `<button class="post-menu-btn" onclick="deletePost('${post.id}')" title="Eliminar">${SVG_TRASH}</button>`
        : ''}
    </div>
    ${sessionRef}
    ${post.image_url ? `<img class="post-image" src="${escapeHtml(post.image_url)}" alt="imagen" loading="lazy" onerror="this.style.display='none'" />` : ''}
    <div class="post-content">${escapeHtml(post.content)}</div>
    <div class="post-actions">
      <div class="post-like-wrap">
        <button class="post-action-btn ${liked ? 'liked' : ''}" id="like-btn-${post.id}" onclick="togglePostLike('${post.id}')">
          <span id="like-icon-${post.id}">${liked ? SVG_HEART_FILL : SVG_HEART}</span>
        </button>
        <button class="like-count-pill" id="like-count-${post.id}" onclick="showLikers('${post.id}')">${likeCount || ''}</button>
      </div>
      <button class="post-action-btn" onclick="openComments('${post.id}','${escapeHtml(p.nickname)}')">
        ${SVG_COMMENT}
        <span>${commentCount || ''}</span>
      </button>
    </div>
    ${topComment ? buildTopComment(topComment, post.id, p.nickname, commentCount) : ''}
  `;
  return el;
}

function buildTopComment(c, postId, nick, total) {
  const cp = c.profiles || { nickname: '?', color: '#999', avatar_url: null };
  const cav = cp.avatar_url ? `<img src="${escapeHtml(cp.avatar_url)}" />` : cp.nickname.charAt(0).toUpperCase();
  return `
    <div class="post-comments-preview">
      <div class="post-comment-row">
        <div class="avatar xs" style="background:${cp.color}">${cav}</div>
        <div class="post-comment-bubble">
          <span class="post-comment-nick">${escapeHtml(cp.nickname)}</span>
          <span class="post-comment-text"> ${escapeHtml(c.content)}</span>
          <div class="post-comment-time">${formatRelative(c.created_at)}</div>
        </div>
      </div>
      ${total > 1 ? `<div class="post-view-more" onclick="openComments('${postId}','${escapeHtml(nick)}')">Ver los ${total} comentarios</div>` : ''}
    </div>
  `;
}

async function togglePostLike(postId) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  const btn = document.getElementById(`like-btn-${postId}`);
  const countEl = document.getElementById(`like-count-${postId}`);
  const iconEl  = document.getElementById(`like-icon-${postId}`);
  if (!btn || !countEl) return;
  const liked = btn.classList.contains('liked');

  if (liked) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    btn.classList.remove('liked');
    iconEl.innerHTML = SVG_HEART;
    const n = parseInt(countEl.textContent || '0') - 1;
    countEl.textContent = n > 0 ? n : '';
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    btn.classList.add('liked');
    iconEl.innerHTML = SVG_HEART_FILL;
    const n = parseInt(countEl.textContent || '0') + 1;
    countEl.textContent = n;
  }
}

async function submitPost() {
  const content = document.getElementById('post-content').value.trim();
  const errEl   = document.getElementById('post-error');
  errEl.classList.add('hidden');

  if (!content) {
    errEl.innerHTML = '<span>Escribe algo antes de publicar.</span>';
    errEl.classList.remove('hidden'); return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  let imageUrl = null;

  if (window.postImageFile) {
    try {
      imageUrl = await uploadPostImage(window.postImageFile, session.user.id);
    } catch (e) {
      errEl.innerHTML = `<span>Error al subir la imagen: ${escapeHtml(e.message)}</span>`;
      errEl.classList.remove('hidden'); return;
    }
  }

  const { error } = await supabase.from('posts').insert({
    user_id: session.user.id,
    content,
    image_url: imageUrl
  });

  if (error) {
    errEl.innerHTML = '<span>Error al publicar. Intenta de nuevo.</span>';
    errEl.classList.remove('hidden'); return;
  }

  document.getElementById('modal-newpost').classList.add('hidden');
  showToast('Publicación compartida ✓');
  await loadFeed();
}

async function deletePost(postId) {
  showConfirm({ message: '¿Eliminar esta publicación?', confirmText: 'Eliminar', danger: true }, async () => {
    const { data: post } = await supabase.from('posts').select('image_url').eq('id', postId).single();
    await supabase.from('posts').delete().eq('id', postId);
    if (post?.image_url) await deleteStorageFile(post.image_url);
    document.getElementById(`post-${postId}`)?.remove();
    showToast('Publicación eliminada');
  });
}

async function quickComment(postId, input) {
  const content = input.value.trim();
  if (!content) return;
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.from('post_comments').insert({ post_id: postId, user_id: session.user.id, content });
  input.value = '';
  await loadFeed();
}

// ===== MODAL COMMENTS =====
async function loadPostComments(postId) {
  const listEl = document.getElementById('modal-comments-list');
  listEl.innerHTML = '<div class="mini-spin"></div>';

  const { data } = await supabase
    .from('post_comments')
    .select('*, profiles!post_comments_user_id_fkey(nickname, color, avatar_url)')
    .eq('post_id', postId)
    .order('created_at');

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  listEl.innerHTML = '';

  if (!data || !data.length) {
    listEl.innerHTML = '<p style="color:var(--ink-3);text-align:center;padding:1rem;font-size:.9rem">Sin comentarios aún.</p>';
    return;
  }

  data.forEach(c => {
    const cp = c.profiles || { nickname: '?', color: '#999', avatar_url: null };
    const isOwner = userId === c.user_id || currentProfile?.is_admin;
    const cav = cp.avatar_url ? `<img src="${escapeHtml(cp.avatar_url)}" />` : cp.nickname.charAt(0).toUpperCase();
    const div = document.createElement('div');
    div.id = `pc-${c.id}`;
    div.className = 'comment-row';
    div.innerHTML = `
      <div class="avatar sm" style="background:${cp.color}">${cav}</div>
      <div class="comment-bubble">
        <div class="comment-nick">${escapeHtml(cp.nickname)}</div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div class="comment-meta">
          <span class="comment-time">${formatRelative(c.created_at)}</span>
          ${isOwner ? `<button class="comment-del-btn" onclick="deletePostComment('${c.id}')">Eliminar</button>` : ''}
        </div>
      </div>
    `;
    listEl.appendChild(div);
  });
  listEl.scrollTop = listEl.scrollHeight;
}

async function submitPostComment() {
  const input = document.getElementById('modal-comment-input');
  const content = input.value.trim();
  if (!content || !activePostId) return;
  const { data: { session } } = await supabase.auth.getSession();
  await supabase.from('post_comments').insert({ post_id: activePostId, user_id: session.user.id, content });
  input.value = '';
  await loadPostComments(activePostId);
  await loadFeed();
}

async function deletePostComment(commentId) {
  showConfirm({ message: '¿Eliminar este comentario?', confirmText: 'Eliminar', danger: true }, async () => {
    await supabase.from('post_comments').delete().eq('id', commentId);
    document.getElementById(`pc-${commentId}`)?.remove();
    await loadFeed();
  });
}

async function showLikers(postId) {
  const countEl = document.getElementById(`like-count-${postId}`);
  if (!countEl || !countEl.textContent.trim()) return;

  const { data } = await supabase
    .from('post_likes')
    .select('profiles!post_likes_user_id_fkey(nickname, color, avatar_url)')
    .eq('post_id', postId)
    .limit(50);

  const likers = (data || []).map(l => l.profiles).filter(Boolean);

  const overlay = document.createElement('div');
  overlay.className = 'likers-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'likers-sheet';
  sheet.innerHTML = '<div class="likers-sheet-handle"></div>'
    + '<div class="likers-sheet-title">Le dio ♥ a esta publicación</div>'
    + (likers.length === 0
      ? '<p style="color:var(--ink-3);font-size:.9rem">Nadie aún.</p>'
      : likers.map(p => {
          const av = p.avatar_url
            ? '<img src="' + escapeHtml(p.avatar_url) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" />'
            : '<div class="avatar sm" style="background:' + p.color + ';flex-shrink:0">' + p.nickname.charAt(0).toUpperCase() + '</div>';
          return '<div class="liker-row">' + av + '<span class="liker-name">' + escapeHtml(p.nickname) + '</span></div>';
        }).join(''));

  const close = () => { overlay.remove(); sheet.remove(); };
  overlay.addEventListener('click', close);
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
}

function subscribeToFeed() {
  supabase.channel('feed-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => loadFeed())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => loadFeed())
    .subscribe();
}
