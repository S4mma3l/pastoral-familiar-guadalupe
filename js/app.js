// Shared utility functions used across all pages

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return formatDate(iso);
}

function getEmbedUrl(url) {
  if (!url) return '';
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return url;
}

function showConfirm({ message, detail = null, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }, onConfirm) {
  const id = 'confirm-' + Date.now();
  const el = document.createElement('div');
  el.className = 'confirm-overlay';
  el.innerHTML = `
    <div class="confirm-box">
      <p class="confirm-msg">${escapeHtml(message)}</p>
      ${detail ? `<p class="confirm-detail">${escapeHtml(detail)}</p>` : ''}
      <div class="confirm-actions">
        <button class="btn btn-ghost" id="${id}-cancel">${escapeHtml(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" id="${id}-ok">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.getElementById(`${id}-cancel`).onclick = close;
  document.getElementById(`${id}-ok`).onclick = () => { close(); onConfirm(); };
  setTimeout(() => document.getElementById(`${id}-ok`)?.focus(), 60);
}

function sanitizeContent(html) {
  // Allow only safe tags in document content
  const allowed = ['b', 'strong', 'i', 'em', 'p', 'br', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote'];
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('*').forEach(el => {
    if (!allowed.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
    }
    // Remove all attributes
    [...el.attributes].forEach(a => el.removeAttribute(a.name));
  });
  return div.innerHTML;
}
