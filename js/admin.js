// Logic for admin.html

let adminSessionsMap = {};
let pendingCoverFile = null;
let pendingEditCoverFile = null;
let editingCurrentCoverUrl = null;

// ── Cover image picker helpers ────────────────────────────

async function pickCoverImage(mode) {
  const file = await pickImage('image/*');
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (mode === 'create') {
    pendingCoverFile = file;
    document.getElementById('s-cover-preview').src = url;
    document.getElementById('s-cover-preview-wrap').classList.remove('hidden');
    document.getElementById('s-cover-zone').classList.add('hidden');
  } else {
    pendingEditCoverFile = file;
    document.getElementById('edit-s-cover-preview').src = url;
    document.getElementById('edit-s-cover-preview-wrap').classList.remove('hidden');
    document.getElementById('edit-s-cover-zone').classList.add('hidden');
  }
}

function removeCoverImage(mode) {
  if (mode === 'create') {
    pendingCoverFile = null;
    document.getElementById('s-cover-preview').src = '';
    document.getElementById('s-cover-preview-wrap').classList.add('hidden');
    document.getElementById('s-cover-zone').classList.remove('hidden');
  } else {
    pendingEditCoverFile = null;
    editingCurrentCoverUrl = null;
    document.getElementById('edit-s-cover-preview').src = '';
    document.getElementById('edit-s-cover-preview-wrap').classList.add('hidden');
    document.getElementById('edit-s-cover-zone').classList.remove('hidden');
  }
}

async function loadAdminSessions() {
  const { data } = await supabase
    .from('sessions')
    .select('*, activities(id, type, title, sort_order)')
    .order('created_at', { ascending: false });

  const list = document.getElementById('admin-sessions-list');
  list.innerHTML = '';
  adminSessionsMap = {};

  if (!data || data.length === 0) {
    list.innerHTML = '<p style="color:var(--ink-3);font-size:.9rem">No hay sesiones aún.</p>';
    return;
  }

  data.forEach(s => {
    adminSessionsMap[s.id] = s;

    const row = document.createElement('div');
    row.className = 'session-row-card';
    row.id = `admin-s-${s.id}`;
    const activities = s.activities || [];
    const actHtml = activities.length
      ? activities.map(a => `
          <div class="act-row">
            <span class="act-type-tag">${a.type}</span>
            <span style="flex:1;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(a.title)}</span>
            <button style="background:none;border:none;cursor:pointer;color:#B91C1C;padding:.1rem .3rem;font-size:.8rem;border-radius:4px" onclick="deleteActivity('${a.id}','${s.id}')">✕</button>
          </div>`).join('')
      : '<p style="font-size:.82rem;color:var(--ink-3)">Sin actividades.</p>';

    row.innerHTML = `
      <div class="session-row-head">
        ${s.cover_image_url
          ? `<img class="session-row-thumb" src="${escapeHtml(s.cover_image_url)}" alt="" loading="lazy" />`
          : `<span class="session-row-emoji">${s.cover_emoji || '✝️'}</span>`}
        <span class="session-row-title">${escapeHtml(s.title)}</span>
        <div style="display:flex;align-items:center;gap:.4rem;flex-shrink:0">
          <button class="btn-edit-session" onclick="openEditSessionModal('${s.id}')">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            Editar
          </button>
          <button class="${s.is_active ? 'tag-active' : 'tag-inactive'}"
                  onclick="toggleSession('${s.id}', ${s.is_active})">
            ${s.is_active ? 'Activa' : 'Oculta'}
          </button>
        </div>
      </div>
      <div id="acts-${s.id}">${actHtml}</div>
      <button class="btn-add-act" style="margin-top:.6rem" onclick="openActivityModal('${s.id}')">
        + Agregar actividad
      </button>
    `;
    list.appendChild(row);
  });
}

// ===== EDITAR SESIÓN =====

function openEditSessionModal(sessionId) {
  const s = adminSessionsMap[sessionId];
  if (!s) return;
  document.getElementById('edit-s-id').value = s.id;
  document.getElementById('edit-s-emoji').value = s.cover_emoji || '✝️';
  document.getElementById('edit-s-title').value = s.title || '';
  document.getElementById('edit-s-desc').value = s.description || '';
  document.getElementById('edit-s-video').value = s.video_url || '';
  document.getElementById('edit-s-content').value = htmlToText(s.document_content);
  document.getElementById('edit-session-error').classList.add('hidden');

  // Reset cover image state
  pendingEditCoverFile = null;
  editingCurrentCoverUrl = s.cover_image_url || null;
  if (s.cover_image_url) {
    document.getElementById('edit-s-cover-preview').src = s.cover_image_url;
    document.getElementById('edit-s-cover-preview-wrap').classList.remove('hidden');
    document.getElementById('edit-s-cover-zone').classList.add('hidden');
  } else {
    document.getElementById('edit-s-cover-preview').src = '';
    document.getElementById('edit-s-cover-preview-wrap').classList.add('hidden');
    document.getElementById('edit-s-cover-zone').classList.remove('hidden');
  }

  document.getElementById('modal-edit-session').classList.remove('hidden');
}

async function handleUpdateSession(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-update-session');
  const errEl = document.getElementById('edit-session-error');
  btn.disabled = true;
  errEl.classList.add('hidden');

  const id = document.getElementById('edit-s-id').value;
  const rawContent = document.getElementById('edit-s-content').value;

  // Determine new cover_image_url
  let newCoverUrl = editingCurrentCoverUrl;
  if (pendingEditCoverFile) {
    try {
      const oldUrl = adminSessionsMap[id]?.cover_image_url;
      newCoverUrl = await uploadSessionCover(pendingEditCoverFile, id);
      if (oldUrl && oldUrl !== newCoverUrl) await deleteStorageFile(oldUrl);
    } catch (_) {
      errEl.textContent = 'Error al subir la imagen. Intenta de nuevo.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      return;
    }
  } else if (editingCurrentCoverUrl === null && adminSessionsMap[id]?.cover_image_url) {
    // User explicitly removed the image
    await deleteStorageFile(adminSessionsMap[id].cover_image_url);
    newCoverUrl = null;
  }

  const { error } = await supabase.from('sessions').update({
    title:            document.getElementById('edit-s-title').value.trim(),
    description:      document.getElementById('edit-s-desc').value.trim() || null,
    video_url:        document.getElementById('edit-s-video').value.trim() || null,
    document_content: textToHtml(rawContent),
    cover_emoji:      document.getElementById('edit-s-emoji').value.trim() || '✝️',
    cover_image_url:  newCoverUrl,
  }).eq('id', id);

  btn.disabled = false;
  if (error) {
    errEl.textContent = 'Error al guardar: ' + error.message;
    errEl.classList.remove('hidden');
    return;
  }

  pendingEditCoverFile = null;
  document.getElementById('modal-edit-session').classList.add('hidden');
  if (typeof showToast === 'function') showToast('Sesión actualizada');
  await loadAdminSessions();
}

function closeEditSessionModal(e) {
  if (e.target === document.getElementById('modal-edit-session'))
    document.getElementById('modal-edit-session').classList.add('hidden');
}

async function handleCreateSession(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-create-session');
  const errEl = document.getElementById('session-error');
  btn.disabled = true;
  errEl.classList.add('hidden');

  const rawContent = document.getElementById('s-content').value;
  const { data: newSession, error } = await supabase.from('sessions').insert({
    title: document.getElementById('s-title').value.trim(),
    description: document.getElementById('s-desc').value.trim() || null,
    video_url: document.getElementById('s-video').value.trim() || null,
    document_content: textToHtml(rawContent),
    cover_emoji: document.getElementById('s-emoji').value.trim() || '✝️',
    created_by: adminProfile.id
  }).select().single();

  btn.disabled = false;
  if (error) {
    errEl.textContent = 'Error al crear la sesión: ' + error.message;
    errEl.classList.remove('hidden');
    return;
  }

  // Upload cover image if selected
  if (pendingCoverFile && newSession) {
    try {
      const coverUrl = await uploadSessionCover(pendingCoverFile, newSession.id);
      await supabase.from('sessions').update({ cover_image_url: coverUrl }).eq('id', newSession.id);
    } catch (_) {
      if (typeof showToast === 'function') showToast('Sesión creada, pero la imagen no se pudo subir.');
    }
  }

  pendingCoverFile = null;
  document.getElementById('s-cover-preview').src = '';
  document.getElementById('s-cover-preview-wrap').classList.add('hidden');
  document.getElementById('s-cover-zone').classList.remove('hidden');
  document.getElementById('form-session').reset();
  document.getElementById('s-emoji').value = '✝️';
  await loadAdminSessions();
}

async function handleCreateActivity(e) {
  e.preventDefault();
  const errEl = document.getElementById('act-error');
  errEl.classList.add('hidden');

  const sessionId = document.getElementById('act-session-id').value;
  const type = document.getElementById('act-type').value;
  const title = document.getElementById('act-title').value.trim();
  const content = document.getElementById('act-content').value.trim();

  let options = null;
  if (type === 'poll') {
    const lines = document.getElementById('act-options').value
      .split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) {
      errEl.textContent = 'Una encuesta necesita al menos 2 opciones.';
      errEl.classList.remove('hidden');
      return;
    }
    options = lines.map((text, i) => ({ id: `opt_${i}`, text }));
  }

  // Count existing activities to set sort_order
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  const { error } = await supabase.from('activities').insert({
    session_id: sessionId,
    type,
    title,
    content: content || null,
    options,
    sort_order: count || 0
  });

  if (error) {
    errEl.textContent = 'Error: ' + error.message;
    errEl.classList.remove('hidden');
    return;
  }

  document.getElementById('modal-activity').classList.add('hidden');
  await loadAdminSessions();
}

async function deleteActivity(activityId, sessionId) {
  showConfirm({ message: '¿Eliminar esta actividad?', confirmText: 'Eliminar', danger: true }, async () => {
    await supabase.from('activities').delete().eq('id', activityId);
    await loadAdminSessions();
  });
}

function deleteSessionConfirm(sessionId) {
  const s = adminSessionsMap[sessionId];
  if (!s) return;
  showConfirm({
    message: `¿Eliminar la sesión "${s.title}"?`,
    detail: 'Se borrarán también todas sus actividades, respuestas y comentarios. No se puede deshacer.',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    danger: true
  }, async () => {
    document.getElementById('modal-edit-session').classList.add('hidden');
    const coverUrl = adminSessionsMap[sessionId]?.cover_image_url;
    const { data: acts } = await supabase.from('activities').select('id').eq('session_id', sessionId);
    if (acts?.length) {
      const ids = acts.map(a => a.id);
      await supabase.from('activity_responses').delete().in('activity_id', ids);
      await supabase.from('activities').delete().in('id', ids);
    }
    await supabase.from('comments').delete().eq('session_id', sessionId);
    await supabase.from('sessions').delete().eq('id', sessionId);
    if (coverUrl && typeof deleteStorageFile === 'function') await deleteStorageFile(coverUrl);
    if (typeof showToast === 'function') showToast('Sesión eliminada');
    await loadAdminSessions();
  });
}

function deleteUser(userId, nickname) {
  if (userId === adminProfile?.id) {
    showConfirm({ message: 'No puedes eliminarte a ti mismo.', confirmText: 'Entendido' }, () => {});
    return;
  }
  showConfirm({
    message: `¿Eliminar a ${nickname}?`,
    detail: 'Se borrarán su perfil, publicaciones y comentarios. Esta acción no se puede deshacer.',
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    danger: true
  }, () => performDeleteUser(userId, nickname));
}

async function performDeleteUser(userId, nickname) {
  try {
    // Collect storage files before deleting DB records
    const [{ data: userPosts }, { data: userProfile }] = await Promise.all([
      supabase.from('posts').select('id, image_url').eq('user_id', userId),
      supabase.from('profiles').select('avatar_url').eq('id', userId).single()
    ]);

    await supabase.from('activity_responses').delete().eq('user_id', userId);
    await supabase.from('comment_likes').delete().eq('user_id', userId);
    if (userPosts?.length) {
      const ids = userPosts.map(p => p.id);
      await supabase.from('post_likes').delete().in('post_id', ids);
      await supabase.from('post_comments').delete().in('post_id', ids);
    }
    await supabase.from('post_likes').delete().eq('user_id', userId);
    await supabase.from('post_comments').delete().eq('user_id', userId);
    await supabase.from('comments').delete().eq('user_id', userId);
    await supabase.from('posts').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    // Delete storage files after DB records are gone
    if (typeof deleteStorageFile === 'function') {
      const deleteJobs = (userPosts || [])
        .filter(p => p.image_url)
        .map(p => deleteStorageFile(p.image_url));
      if (userProfile?.avatar_url) deleteJobs.push(deleteStorageFile(userProfile.avatar_url));
      await Promise.all(deleteJobs);
    }
    if (typeof showToast === 'function') showToast(`${nickname} fue eliminado`);
    const nick = document.getElementById('user-search')?.value.trim();
    if (nick) searchUsers(); else loadUsers();
  } catch (err) {
    if (typeof showToast === 'function') showToast('Error al eliminar: ' + err.message);
  }
}

async function toggleSession(sessionId, currentActive) {
  await supabase.from('sessions').update({ is_active: !currentActive }).eq('id', sessionId);
  await loadAdminSessions();
}

// ===== GESTIÓN DE MIEMBROS =====

async function loadUsers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, nickname, color, avatar_url, is_admin, created_at')
    .order('created_at', { ascending: false })
    .limit(25);
  renderUsersList(data || []);
}

async function searchUsers() {
  const nick = document.getElementById('user-search').value.trim();
  const list = document.getElementById('users-list');
  list.innerHTML = '<div class="mini-spin"></div>';

  let query = supabase.from('profiles').select('id, nickname, color, avatar_url, is_admin, created_at');
  if (nick) {
    query = query.ilike('nickname', `%${nick}%`);
  } else {
    query = query.order('created_at', { ascending: false }).limit(25);
  }
  const { data, error } = await query.order('nickname').limit(30);
  if (error) { list.innerHTML = `<p style="color:#CC2A2A;font-size:.9rem">Error: ${escapeHtml(error.message)}</p>`; return; }
  renderUsersList(data || []);
}

function renderUsersList(users) {
  const list = document.getElementById('users-list');
  if (!users.length) {
    list.innerHTML = '<p style="color:var(--ink-3);font-size:.9rem;padding:.5rem 0">No se encontraron miembros.</p>';
    return;
  }

  const SVG_TRASH_SM = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  const rows = users.map(u => {
    const isSelf = u.id === adminProfile?.id;
    const av = u.avatar_url
      ? '<img src="' + escapeHtml(u.avatar_url) + '" />'
      : u.nickname.charAt(0).toUpperCase();
    const tag = u.is_admin
      ? '<span class="tag-active" style="pointer-events:none">Admin</span>'
      : '<span class="tag-inactive" style="pointer-events:none">Miembro</span>';
    const adminBtn = '<button class="btn btn-ghost btn-xs" onclick="toggleUserAdmin(\'' + u.id + '\',' + u.is_admin + ',\'' + escapeHtml(u.nickname) + '\')">'
      + (u.is_admin ? 'Quitar admin' : 'Hacer admin') + '</button>';
    const deleteBtn = isSelf ? '' : '<button class="btn btn-danger btn-xs" onclick="deleteUser(\'' + u.id + '\',\'' + escapeHtml(u.nickname) + '\')" title="Eliminar usuario">' + SVG_TRASH_SM + '</button>';

    return '<div class="user-row" id="user-row-' + u.id + '">'
      + '<div class="avatar sm" style="background:' + u.color + '">' + av + '</div>'
      + '<span class="user-row-nick">' + escapeHtml(u.nickname) + '</span>'
      + '<div class="user-row-actions">' + tag + adminBtn + deleteBtn + '</div>'
      + '</div>';
  });

  list.innerHTML = rows.join('');
}

function textToHtml(text) {
  return (text || '').split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => '<p>' + escapeHtml(line) + '</p>')
    .join('');
}

function htmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  div.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  div.querySelectorAll('p,h3,h4,li').forEach(el => {
    el.before(el.textContent + '\n');
    el.remove();
  });
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

async function toggleUserAdmin(userId, currentAdmin, nickname) {
  const msg = userId === adminProfile?.id && currentAdmin
    ? '¿Quitarte el rol de coordinador? Perderás acceso a este panel.'
    : currentAdmin
      ? `¿Quitar el rol de coordinador a ${nickname}?`
      : `¿Hacer coordinador a ${nickname}?`;
  showConfirm({ message: msg, confirmText: 'Confirmar', danger: userId === adminProfile?.id && currentAdmin }, async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentAdmin })
      .eq('id', userId);

    if (error) {
      if (typeof showToast === 'function') showToast('Error: ' + error.message);
      return;
    }

    if (typeof showToast === 'function')
      showToast(currentAdmin ? `${nickname} ya no es coordinador` : `¡${nickname} ahora es coordinador!`);

    const nick = document.getElementById('user-search')?.value.trim();
    if (nick) searchUsers(); else loadUsers();
  });
}
