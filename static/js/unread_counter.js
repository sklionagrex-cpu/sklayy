// ===== СЧЁТЧИК НЕПРОЧИТАННЫХ =====
function updateUnreadBadges() {
  document.querySelectorAll('.chat-item').forEach(item => {
    const onclick = item.getAttribute('onclick');
    if (!onclick) return;
    const chatId = onclick.match(/\d+/)?.[0];
    if (!chatId) return;
    
    fetch('/api/unread/' + chatId)
      .then(r => r.json())
      .then(data => {
        const unread = data.unread || 0;
        const oldBadge = item.querySelector('.chat-badge');
        if (oldBadge) oldBadge.remove();
        if (unread > 0) {
          const badge = document.createElement('div');
          badge.className = 'chat-badge';
          badge.textContent = unread;
          item.appendChild(badge);
        }
      })
      .catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(updateUnreadBadges, 1000);
});

// Запускаем после обновления чатов
const origLoadChats = window.loadChats;
if (origLoadChats) {
  window.loadChats = function() {
    origLoadChats();
    setTimeout(updateUnreadBadges, 500);
  };
}
console.log('✅ unread_counter.js загружен');
