// Logic for session.html — activities, comments, realtime

// ===== ACTIVITIES =====

window.sessionActivitiesMap = {};

async function loadActivities(sessionId) {
  const { data } = await supabase
    .from('activities')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order');

  const list = document.getElementById('activities-list');
  if (!list) return;
  list.innerHTML = '';
  window.sessionActivitiesMap = {};

  if (!data || data.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-3);font-size:.9rem">No hay actividades para esta sesión.</p>';
    return;
  }

  const { data: authData } = await supabase.auth.getSession();
  const userId = authData?.session?.user?.id;
  const actIds = data.map(a => a.id);
  let myResponses = {};
  if (userId && actIds.length) {
    const { data: resp } = await supabase
      .from('activity_responses')
      .select('*')
      .in('activity_id', actIds)
      .eq('user_id', userId);
    (resp || []).forEach(r => { myResponses[r.activity_id] = r; });
  }

  data.forEach(act => {
    window.sessionActivitiesMap[act.id] = act;
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.id = `act-${act.id}`;
    const typeLabels = { reflection: 'Reflexión', question: 'Pregunta', poll: 'Encuesta' };
    const myResp = myResponses[act.id];

    let body = '';
    if (act.type === 'poll') {
      body = renderPollBody(act, myResp);
    } else {
      const saved = myResp?.response || '';
      body = `
        <textarea class="activity-textarea" id="ta-${act.id}" placeholder="Escribe tu reflexión aquí…" maxlength="800">${escapeHtml(saved)}</textarea>
        <div class="activity-row">
          ${myResp ? '<span class="activity-saved">✓ Guardado</span>' : ''}
          <button class="btn btn-primary btn-sm" onclick="saveResponse('${act.id}', '${act.type}')">
            ${myResp ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="activity-badge">${typeLabels[act.type] || act.type}</div>
      <div class="activity-title">${escapeHtml(act.title)}</div>
      ${act.content ? `<div class="activity-desc">${escapeHtml(act.content)}</div>` : ''}
      <div id="act-body-${act.id}">${body}</div>
    `;
    list.appendChild(card);
  });
}

function renderPollBody(act, myResp) {
  const options = act.options || [];
  const selectedId = myResp?.poll_option_id || null;
  const hasVoted = !!myResp;

  if (!hasVoted) {
    const opts = options.map(opt =>
      '<button class="poll-opt-btn" onclick="votePoll(\'' + act.id + '\',\'' + opt.id + '\')">'
      + '<div class="poll-radio"></div>'
      + '<span class="poll-opt-label">' + escapeHtml(opt.text) + '</span>'
      + '</button>'
    ).join('');
    return '<div class="poll-options" id="poll-' + act.id + '">' + opts + '</div>'
      + '<p class="poll-hint">Toca una opción para votar</p>';
  }

  const opts = options.map(opt =>
    '<div class="poll-opt ' + (selectedId === opt.id ? 'voted' : '') + '">'
    + '<div class="poll-bar" id="bar-' + act.id + '-' + opt.id + '" style="width:0%"></div>'
    + '<span class="poll-opt-label">' + escapeHtml(opt.text) + (selectedId === opt.id ? ' ✓' : '') + '</span>'
    + '<span class="poll-pct" id="pct-' + act.id + '-' + opt.id + '"></span>'
    + '</div>'
  ).join('');
  return '<div class="poll-options" id="poll-' + act.id + '">' + opts + '</div>'
    + '<p class="poll-hint">✓ Tu voto fue registrado</p>';
}

async function saveResponse(activityId, type) {
  const ta = document.getElementById(`ta-${activityId}`);
  if (!ta) return;
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  const response = ta.value.trim();
  if (!response) return;

  const { error } = await supabase.from('activity_responses').upsert({
    activity_id: activityId,
    user_id: userId,
    response
  }, { onConflict: 'activity_id,user_id' });

  if (!error) {
    const row = ta.closest('.activity-card').querySelector('.activity-row');
    row.innerHTML = `<span class="activity-saved">✓ Guardado</span><button class="btn btn-primary btn-sm" onclick="saveResponse('${activityId}', '${type}')">Actualizar</button>`;
  }
}

async function votePoll(activityId, optionId) {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('activity_responses').upsert({
    activity_id: activityId,
    user_id: session.user.id,
    poll_option_id: optionId
  }, { onConflict: 'activity_id,user_id' });

  if (error) return;

  const act = window.sessionActivitiesMap?.[activityId];
  if (act) {
    const bodyEl = document.getElementById('act-body-' + activityId);
    if (bodyEl) bodyEl.innerHTML = renderPollBody(act, { poll_option_id: optionId });
  }
  await refreshPollResults(activityId, optionId);
}

async function refreshPollResults(activityId, myVote) {
  const { data } = await supabase
    .from('activity_responses')
    .select('poll_option_id')
    .eq('activity_id', activityId)
    .not('poll_option_id', 'is', null);

  const counts = {};
  (data || []).forEach(r => { counts[r.poll_option_id] = (counts[r.poll_option_id] || 0) + 1; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  Object.entries(counts).forEach(([optId, count]) => {
    const pct = total ? Math.round((count / total) * 100) : 0;
    const barEl = document.getElementById(`bar-${activityId}-${optId}`);
    const pctEl = document.getElementById(`pct-${activityId}-${optId}`);
    if (barEl) barEl.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    const optEl = barEl?.closest('.poll-opt');
    if (optEl) optEl.style.cursor = 'default';
    if (optId === myVote && optEl) optEl.classList.add('voted');
  });

  const container = document.getElementById(`poll-${activityId}`);
  if (container) {
    const existing = container.nextElementSibling;
    if (!existing || !existing.textContent.includes('voto')) {
      const note = document.createElement('p');
      note.style.cssText = 'font-size:.8rem;color:var(--ink-3);margin-top:.3rem';
      note.textContent = '✓ Tu voto fue registrado';
      container.after(note);
    }
  }
}

// ===== COMMENTS =====

async function loadComments(sessionId) {
  const { data } = await supabase
    .from('comments')
    .select('*, profiles!comments_user_id_fkey(nickname, color, avatar_url)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  let myLikes = new Set();
  if (userId) {
    const ids = (data || []).map(c => c.id);
    if (ids.length) {
      const { data: likes } = await supabase
        .from('comment_likes').select('comment_id')
        .in('comment_id', ids).eq('user_id', userId);
      (likes || []).forEach(l => myLikes.add(l.comment_id));
    }
  }

  let likeCounts = {};
  if (data?.length) {
    const { data: allLikes } = await supabase
      .from('comment_likes').select('comment_id')
      .in('comment_id', data.map(c => c.id));
    (allLikes || []).forEach(l => { likeCounts[l.comment_id] = (likeCounts[l.comment_id] || 0) + 1; });
  }

  renderComments(data || [], userId, myLikes, likeCounts);
}

function renderComments(comments, userId, myLikes, likeCounts) {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '';

  if (comments.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-3);font-size:.9rem;padding:.5rem 0">Sé el primero en comentar.</p>';
    return;
  }

  comments.forEach(c => {
    const el = buildCommentEl(c, userId, myLikes.has(c.id), likeCounts[c.id] || 0);
    list.appendChild(el);
  });
}

function buildCommentEl(c, userId, liked, likeCount) {
  const div = document.createElement('div');
  div.className = 'comment-row';
  div.id = `comment-${c.id}`;
  const profile = c.profiles || { nickname: '?', color: '#999', avatar_url: null };
  const isOwner = userId === c.user_id;
  const av = profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" />` : profile.nickname.charAt(0).toUpperCase();

  div.innerHTML = `
    <div class="avatar sm" style="background:${profile.color}">${av}</div>
    <div class="comment-bubble">
      <div class="comment-nick">${escapeHtml(profile.nickname)}</div>
      <div class="comment-text">${escapeHtml(c.content)}</div>
      <div class="comment-meta">
        <span class="comment-time">${formatRelative(c.created_at)}</span>
        <button class="comment-like-btn ${liked ? 'liked' : ''}" id="like-btn-${c.id}" onclick="toggleLike('${c.id}')">
          ♥ <span id="like-count-${c.id}">${likeCount || ''}</span>
        </button>
        ${isOwner || currentProfile?.is_admin
          ? `<button class="comment-del-btn" onclick="deleteComment('${c.id}')">Eliminar</button>`
          : ''}
      </div>
    </div>
  `;
  return div;
}

async function submitComment(e) {
  e.preventDefault();
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;

  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('comments').insert({
    session_id: currentSession.id,
    user_id: session.user.id,
    content
  });

  if (!error) {
    // Cross-post to feed so it appears on inicio and profile
    await supabase.from('posts').insert({
      user_id: session.user.id,
      content,
      session_id: currentSession.id
    });
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('char-count').textContent = '0 / 500';
    await loadComments(currentSession.id);
  }
}

function subscribeToComments(sessionId) {
  supabase
    .channel(`comments-${sessionId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'comments',
      filter: `session_id=eq.${sessionId}`
    }, () => loadComments(sessionId))
    .subscribe();
}

async function toggleLike(commentId) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session.user.id;
  const btn = document.getElementById(`like-btn-${commentId}`);
  const countEl = document.getElementById(`like-count-${commentId}`);
  const liked = btn.classList.contains('liked');

  if (liked) {
    await supabase.from('comment_likes').delete()
      .eq('comment_id', commentId).eq('user_id', userId);
    btn.classList.remove('liked');
    const n = parseInt(countEl.textContent || '0') - 1;
    countEl.textContent = n > 0 ? n : '';
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
    btn.classList.add('liked');
    const n = parseInt(countEl.textContent || '0') + 1;
    countEl.textContent = n;
  }
}

async function deleteComment(commentId) {
  showConfirm({ message: '¿Eliminar este comentario?', confirmText: 'Eliminar', danger: true }, async () => {
    await supabase.from('comments').delete().eq('id', commentId);
    document.getElementById(`comment-${commentId}`)?.remove();
  });
}
