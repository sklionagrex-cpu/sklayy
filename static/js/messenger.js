const splash = document.getElementById('splash');
const splashMessage = document.getElementById('splashMessage');
const app = document.getElementById('app');

let socket = null;
let currentUser = {};

function initApp() {
  connectSocket();
  loadChats();
  loadProfileData();

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'profile_updated') {
      const user = event.data.user;
      updateProfilePanel(user);
      loadPanelPosts();
    }
    if (event.data && event.data.type === 'avatar_updated') {
      updateAvatar(event.data.url);
    }
  });

  const profilePanel = document.getElementById('panel-profile');
  const observer = new MutationObserver(() => {
    if (profilePanel.classList.contains('active')) {
      loadPanelPosts();
    }
  });
  observer.observe(profilePanel, { attributes: true, attributeFilter: ['class'] });
}

function updateProfilePanel(user) {
  currentUser = user;
  document.getElementById('panelName').textContent = user.full_name || user.username;
  document.getElementById('panelStatus').textContent = user.status || 'Статус не установлен';
  document.getElementById('panelBio').textContent = user.bio || 'Добавьте информацию о себе';
  
  document.getElementById('panelFullName').textContent = user.full_name || user.username;
  document.getElementById('panelStatusFull').textContent = user.status || 'Не установлен';
  document.getElementById('panelBioFull').textContent = user.bio || 'Не указано';
  document.getElementById('panelCreatedAt').textContent = user.created_at ? user.created_at.slice(0,10) : '—';
  
  updateAvatar(user.avatar);
}

function updateAvatar(url) {
  const avatarEl = document.getElementById('panelAvatar');
  if (url && url.startsWith('/static/uploads/')) {
    avatarEl.innerHTML = `<img src="${url}?t=${Date.now()}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.textContent = url || '👤';
  }
}

function loadProfileData() {
  fetch('/api/profile')
    .then(res => res.json())
    .then(user => {
      updateProfilePanel(user);
      loadPanelPosts();
    })
    .catch(err => console.error('Ошибка загрузки профиля:', err));
}

function loadPanelPosts() {
  fetch('/api/posts')
    .then(res => res.json())
    .then(posts => {
      const container = document.getElementById('panelPostsList');
      if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="empty-state">У вас пока нет постов</div>';
        return;
      }
      container.innerHTML = posts.map(post => {
        let mediaHtml = '';
        if (post.media_url) {
          if (post.media_url.match(/\.(mp4|webm|ogg)$/i)) {
            mediaHtml = `<video controls style="max-width:100%;max-height:400px;border-radius:12px;margin-top:8px;"><source src="${post.media_url}" type="video/mp4"></video>`;
          } else {
            mediaHtml = `<img src="${post.media_url}" style="max-width:100%;max-height:400px;border-radius:12px;margin-top:8px;" alt="Изображение">`;
          }
        }
        return `
          <div class="post-item">
            <div class="post-header">
              <span class="post-author">${post.full_name || post.username}</span>
              <span class="post-date">${post.created_at ? post.created_at.slice(0,10) : ''}</span>
            </div>
            <div class="post-content">${post.content}</div>
            ${mediaHtml}
            <div class="post-actions">
              <span class="post-likes">❤️ ${post.likes || 0}</span>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки постов:', err));
}

function switchProfileSubTab(tab) {
  document.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelector(`.sub-tab[data-subtab="${tab}"]`).classList.add('active');
  document.getElementById(`subtab-${tab}`).classList.add('active');
}

function connectSocket() {
  socket = io();
  socket.on('connect', () => console.log('✅ WebSocket подключен'));
  socket.on('new_message', () => loadChats());
}

function loadChats() {
  fetch('/api/chats')
    .then(res => res.json())
    .then(chats => {
      const container = document.getElementById('chatList');
      if (!chats || chats.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">Нет чатов</div><div class="empty-text">Начните общение — напишите кому-нибудь первым</div></div>`;
        return;
      }
      container.innerHTML = chats.map(chat => `
        <div class="chat-item" onclick="openChat(${chat.id})">
          <div class="chat-avatar">${chat.type === 'group' ? '👥' : '👤'}</div>
          <div class="chat-info">
            <div class="chat-name">${chat.name || (chat.type === 'group' ? 'Групповой чат' : 'Личный чат')}</div>
            <div class="chat-preview">${chat.member_count || 0} участников</div>
          </div>
          <div class="chat-time">${new Date(chat.created_at).toLocaleDateString()}</div>
        </div>
      `).join('');
    })
    .catch(err => console.error('Ошибка загрузки чатов:', err));
}

function openChat(chatId) {
  window.location.href = `/chat/${chatId}`;
}

function createChat() {
  const username = prompt('Введите имя пользователя для начала чата:');
  if (username && username.trim()) {
    fetch('/api/create_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() })
    })
    .then(res => res.json())
    .then(data => {
      if (data.chat_id) {
        loadChats();
        openChat(data.chat_id);
      } else {
        alert(data.error || 'Ошибка создания чата');
      }
    })
    .catch(err => console.error('Ошибка:', err));
  }
}

function createGroup() {
  const name = prompt('Введите название группы:');
  if (!name || !name.trim()) return;
  const membersInput = prompt('Введите имена участников через запятую (минимум 2):');
  if (!membersInput || !membersInput.trim()) return;
  const members = membersInput.split(',').map(m => m.trim()).filter(m => m);
  if (members.length < 2) {
    alert('Нужно минимум 2 участника');
    return;
  }
  fetch('/api/create_group', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), members: members })
  })
  .then(res => res.json())
  .then(data => {
    if (data.chat_id) {
      loadChats();
      openChat(data.chat_id);
    } else {
      alert(data.error || 'Ошибка создания группы');
    }
  })
  .catch(err => console.error('Ошибка:', err));
}

const dockItems = document.querySelectorAll('.dock-item');
const panels = {
  'panel-feed': document.getElementById('panel-feed'),
  'panel-chats': document.getElementById('panel-chats'),
  'panel-communities': document.getElementById('panel-communities'),
  'panel-profile': document.getElementById('panel-profile')
};

dockItems.forEach(item => {
  item.addEventListener('click', function() {
    dockItems.forEach(d => d.classList.remove('active'));
    this.classList.add('active');
    Object.values(panels).forEach(p => p.classList.remove('active'));
    const panelId = this.dataset.panel;
    if (panels[panelId]) {
      panels[panelId].classList.add('active');
    }
  });
});

// ===== ЗАСТАВКА =====
const splashShown = sessionStorage.getItem('splash_shown');

if (splashShown) {
  splash.style.display = 'none';
  app.classList.add('app-visible');
  initApp();
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'profile') {
    setTimeout(() => {
      const profileDock = document.querySelector('.dock-item[data-panel="panel-profile"]');
      if (profileDock) profileDock.click();
    }, 200);
  }
  if (window.history && window.history.replaceState) {
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
} else {
  const messages = ['Создаем ваше пространство...', 'Настраиваем безопасность...', 'Почти готово...'];
  let msgIndex = 0;
  const msgInterval = setInterval(() => {
    msgIndex++;
    if (msgIndex < messages.length) {
      splashMessage.textContent = messages[msgIndex];
    } else {
      clearInterval(msgInterval);
      setTimeout(() => {
        splash.classList.add('splash-hidden');
        app.classList.add('app-visible');
        sessionStorage.setItem('splash_shown', 'true');
        initApp();
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'profile') {
          setTimeout(() => {
            const profileDock = document.querySelector('.dock-item[data-panel="panel-profile"]');
            if (profileDock) profileDock.click();
          }, 200);
        }
        if (window.history && window.history.replaceState) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }, 600);
    }
  }, 1200);
}

console.log('🚀 Sklay мессенджер загружен!');
