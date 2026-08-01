// ===== СЧЁТЧИК НЕПРОЧИТАННЫХ =====
// Этот файл работает отдельно от messenger.js и не ломает его

function updateUnreadBadges() {
  // Находим все чаты
  document.querySelectorAll('.chat-item').forEach(item => {
    // Получаем ID чата из атрибута или onclick
    const onclick = item.getAttribute('onclick');
    if (!onclick) return;
    const chatId = onclick.match(/\d+/)?.[0];
    if (!chatId) return;
    
    // Запрашиваем количество непрочитанных
    fetch('/api/unread/' + chatId)
      .then(r => r.json())
      .then(data => {
        const unread = data.unread || 0;
        
        // Удаляем старый бейдж
        const oldBadge = item.querySelector('.chat-badge');
        if (oldBadge) oldBadge.remove();
        
        // Добавляем новый бейдж
        if (unread > 0) {
          const badge = document.createElement('div');
          badge.className = 'chat-badge';
          badge.textContent = unread;
          item.appendChild(badge);
        }
      })
      .catch(err => console.error('Ошибка загрузки unread:', err));
  });
}

// Запускаем при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(updateUnreadBadges, 1000);
});

// Запускаем после каждого обновления чатов
if (typeof loadChats === 'function') {
  const originalLoadChats = loadChats;
  loadChats = function() {
    originalLoadChats();
    setTimeout(updateUnreadBadges, 500);
  };
}

console.log('✅ unread_counter.js загружен');
