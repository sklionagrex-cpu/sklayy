const splash = document.getElementById('splash');
const splashMessage = document.getElementById('splashMessage');
const app = document.getElementById('app');

let socket = null;
let currentUser = {};
let mediaUrl = null;

function initApp() {
  connectSocket();
  loadChats();
  loadFriendsChats();
  loadProfileData();
  loadFeed();
  loadCommunities();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('feed') === 'updated') {
    setTimeout(() => { loadFeed(); }, 500);
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'profile_updated') {
      const user = event.data.user;
      updateProfilePanel(user);
      loadPanelPosts();
      loadFeed();
    }
    if (event.data && event.data.type === 'avatar_updated') {
      updateAvatar(event.data.url);
    }
  });

  document.addEventListener('click', function(e) {
    const results = document.getElementById('searchResults');
    if (results && !results.contains(e.target) && e.target.id !== 'searchUsers') {
      results.style.display = 'none';
    }
  });
}

function loadFeed() {
  fetch('/api/feed')
    .then(res => res.json())
    .then(posts => {
      const container = document.getElementById('feedList');
      if (!container) return;
      if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Лента пуста</div><div class="empty-text">Создайте первый пост</div></div>';
        return;
      }
      container.innerHTML = posts.map(post => {
        const avatarHtml = post.avatar && post.avatar.startsWith('/static/uploads/')
          ? `<img src="${post.avatar}" alt="Avatar">`
          : (post.avatar || '👤');
        let mediaHtml = '';
        if (post.media_url) {
          if (post.media_url.match(/\.(mp4|webm|ogg)$/i)) {
            mediaHtml = `<div class="feed-media"><video controls><source src="${post.media_url}" type="video/mp4"></video></div>`;
          } else {
            mediaHtml = `<div class="feed-media"><img src="${post.media_url}" alt="Изображение"></div>`;
          }
        }
        return `
          <div class="feed-item">
            <div class="feed-header">
              <div class="feed-avatar">${avatarHtml}</div>
              <div class="feed-author-info">
                <div class="feed-author-name">${post.full_name || post.username}</div>
                <div class="feed-author-username">@${post.username}</div>
              </div>
              <div class="feed-date">${post.created_at ? post.created_at.slice(0,10) : ''}</div>
            </div>
            <div class="feed-content">${post.content}</div>
            ${mediaHtml}
            <div class="feed-actions">
              <button onclick="likePostFeed(${post.id})" class="like-btn">❤️ ${post.likes || 0}</button>
              <button onclick="window.location.href='/post/${post.id}'" class="comment-btn">💬 ${post.comments_count || 0}</button>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки ленты:', err));
}

function likePostFeed(postId) {
  fetch(`/api/posts/${postId}/like`, { method: 'POST' })
    .then(res => res.json())
    .then(data => { if (data.success) loadFeed(); })
    .catch(err => console.error('Ошибка:', err));
}

function loadCommunities() {
  fetch('/api/communities')
    .then(res => res.json())
    .then(data => {
      const myContainer = document.getElementById('myCommunitiesList');
      if (!data.my || data.my.length === 0) {
        myContainer.innerHTML = '<div class="empty-state">Вы не состоите в сообществах</div>';
      } else {
        myContainer.innerHTML = data.my.map(c => `
          <div class="community-item">
            <div class="community-avatar">${c.avatar || '👥'}</div>
            <div class="community-info">
              <div class="community-name">${c.name}</div>
              <div class="community-desc">${c.description || ''}</div>
            </div>
            <button class="btn-sm" onclick="leaveCommunity(${c.id})">Покинуть</button>
          </div>
        `).join('');
      }
      const allContainer = document.getElementById('allCommunitiesList');
      if (!data.all || data.all.length === 0) {
        allContainer.innerHTML = '<div class="empty-state">Нет доступных сообществ</div>';
      } else {
        allContainer.innerHTML = data.all.map(c => {
          const isMember = data.my.some(m => m.id === c.id);
          return `
            <div class="community-item">
              <div class="community-avatar">${c.avatar || '👥'}</div>
              <div class="community-info">
                <div class="community-name">${c.name}</div>
                <div class="community-desc">${c.description || ''}</div>
              </div>
              ${isMember ? '<span class="badge">Участник</span>' : `<button class="btn-sm" onclick="joinCommunity(${c.id})">Вступить</button>`}
            </div>
          `;
        }).join('');
      }
    })
    .catch(err => console.error('Ошибка загрузки сообществ:', err));
}

function createCommunity() {
  const name = prompt('Название сообщества:');
  if (!name || !name.trim()) return;
  const desc = prompt('Описание (необязательно):');
  fetch('/api/communities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), description: desc || '' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.community_id) {
      alert('Сообщество создано!');
      loadCommunities();
      loadFeed();
    } else {
      alert('Ошибка создания');
    }
  })
  .catch(err => alert('Ошибка: ' + err));
}

function joinCommunity(communityId) {
  fetch(`/api/communities/${communityId}/join`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Вы вступили в сообщество!');
        loadCommunities();
        loadFeed();
      } else {
        alert(data.error || 'Ошибка');
      }
    })
    .catch(err => alert('Ошибка: ' + err));
}

function leaveCommunity(communityId) {
  if (!confirm('Покинуть сообщество?')) return;
  alert('Функция в разработке');
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
      loadFriends();
      loadFriendRequests();
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
            mediaHtml = `<div class="post-media"><video controls><source src="${post.media_url}" type="video/mp4"></video></div>`;
          } else {
            mediaHtml = `<div class="post-media"><img src="${post.media_url}" alt="Изображение"></div>`;
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
              <button class="btn-sm like-btn" onclick="likePostInProfile(${post.id})">❤️ ${post.likes || 0}</button>
              <button class="btn-sm delete-btn" onclick="deletePostInProfile(${post.id})">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки постов:', err));
}

function likePostInProfile(postId) {
  fetch(`/api/posts/${postId}/like`, { method: 'POST' })
    .then(res => res.json())
    .then(data => { if (data.success) loadPanelPosts(); })
    .catch(err => console.error('Ошибка:', err));
}

function deletePostInProfile(postId) {
  if (!confirm('Удалить пост?')) return;
  fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => { if (data.success) loadPanelPosts(); })
    .catch(err => console.error('Ошибка:', err));
}

function switchProfileSubTab(tab) {
  document.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelector(`.sub-tab[data-subtab="${tab}"]`).classList.add('active');
  document.getElementById(`subtab-${tab}`).classList.add('active');
  
  if (tab === 'friends') {
    loadFriends();
    loadFriendRequests();
  }
  if (tab === 'posts') {
    loadPanelPosts();
  }
}

function openPostModal() {
  document.getElementById('postModal').style.display = 'flex';
  document.getElementById('postContent').value = '';
  document.getElementById('postContent').focus();
  mediaUrl = null;
  document.getElementById('mediaFileName').textContent = '';
  document.getElementById('removeMediaBtn').style.display = 'none';
  document.getElementById('mediaInput').value = '';
}

function closePostModal() {
  document.getElementById('postModal').style.display = 'none';
}

function uploadMedia(input) {
  const file = input.files[0];
  if (!file) return;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
  if (!allowedTypes.includes(file.type)) {
    alert('Неподдерживаемый формат');
    input.value = '';
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    alert('Файл слишком большой (макс. 50MB)');
    input.value = '';
    return;
  }
  const formData = new FormData();
  formData.append('media', file);
  fetch('/api/upload_media', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      mediaUrl = data.url;
      document.getElementById('mediaFileName').textContent = file.name;
      document.getElementById('removeMediaBtn').style.display = 'inline-block';
    }
  })
  .catch(err => alert('Ошибка загрузки'));
  input.value = '';
}

function removeMedia() {
  mediaUrl = null;
  document.getElementById('mediaFileName').textContent = '';
  document.getElementById('removeMediaBtn').style.display = 'none';
  document.getElementById('mediaInput').value = '';
}

function publishPost() {
  const content = document.getElementById('postContent').value.trim();
  if (!content && !mediaUrl) {
    alert('Введите текст или прикрепите медиа');
    return;
  }
  const data = { content: content };
  if (mediaUrl) data.media_url = mediaUrl;
  fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      closePostModal();
      loadPanelPosts();
      loadFeed();
    }
  })
  .catch(err => console.error('Ошибка:', err));
}

function loadFriends() {
  fetch('/api/friends')
    .then(res => res.json())
    .then(friends => {
      const container = document.getElementById('friendsList');
      if (!friends || friends.length === 0) {
        container.innerHTML = '<div class="empty-state">У вас пока нет друзей</div>';
        return;
      }
      container.innerHTML = friends.map(f => {
        const avatarHtml = f.avatar && f.avatar.startsWith('/static/uploads/')
          ? `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : (f.avatar || '👤');
        return `
          <div class="friend-item">
            <div class="friend-avatar">${avatarHtml}</div>
            <div class="friend-info">
              <div class="friend-name">${f.full_name || f.username}</div>
              <div class="friend-username">@${f.username}</div>
            </div>
            <div class="friend-status">${f.online ? '🟢 Онлайн' : '⚪ Офлайн'}</div>
            <button class="chat-btn" onclick="openChatWith('${f.username}')" title="Написать">
              <i class="fas fa-comment"></i>
            </button>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки друзей:', err));
}

function loadFriendRequests() {
  fetch('/api/friend_requests')
    .then(res => res.json())
    .then(requests => {
      const container = document.getElementById('friendRequests');
      if (!requests || requests.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет входящих заявок</div>';
        return;
      }
      container.innerHTML = requests.map(req => {
        const avatarHtml = req.avatar && req.avatar.startsWith('/static/uploads/')
          ? `<img src="${req.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : (req.avatar || '👤');
        return `
          <div class="friend-item">
            <div class="friend-avatar">${avatarHtml}</div>
            <div class="friend-info">
              <div class="friend-name">${req.full_name || req.username}</div>
              <div class="friend-username">@${req.username}</div>
            </div>
            <div class="friend-actions">
              <button class="btn-sm accept" onclick="acceptFriend(${req.request_id})">✓</button>
              <button class="btn-sm reject" onclick="rejectFriend(${req.request_id})">✕</button>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки заявок:', err));
}

function switchFriendTab(tab) {
  document.querySelectorAll('.friend-tab').forEach(el => el.classList.remove('active'));
  document.querySelector(`.friend-tab[data-ftab="${tab}"]`).classList.add('active');
  if (tab === 'list') {
    document.getElementById('friendsList').style.display = 'block';
    document.getElementById('friendRequests').style.display = 'none';
    loadFriends();
  } else {
    document.getElementById('friendsList').style.display = 'none';
    document.getElementById('friendRequests').style.display = 'block';
    loadFriendRequests();
  }
}

function searchUsers(query) {
  const resultsContainer = document.getElementById('searchResults');
  if (query.length < 2) {
    resultsContainer.style.display = 'none';
    return;
  }
  fetch(`/api/users?search=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(users => {
      if (!users || users.length === 0) {
        resultsContainer.innerHTML = '<div class="search-empty">Пользователи не найдены</div>';
        resultsContainer.style.display = 'block';
        return;
      }
      resultsContainer.innerHTML = users.map(u => `
        <div class="search-result">
          <span>${u.full_name || u.username}</span>
          <span style="color:#888;font-size:12px;">@${u.username}</span>
          <button class="btn-sm" onclick="sendFriendRequest('${u.username}')">➕</button>
        </div>
      `).join('');
      resultsContainer.style.display = 'block';
    })
    .catch(err => console.error('Ошибка поиска:', err));
}

function sendFriendRequest(username) {
  fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert('Заявка отправлена!');
      document.getElementById('searchResults').style.display = 'none';
      document.getElementById('searchUsers').value = '';
    } else {
      alert(data.error || 'Ошибка');
    }
  })
  .catch(err => alert('Ошибка: ' + err));
}

function openChatWith(username) {
  fetch('/api/create_chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username })
  })
  .then(res => res.json())
  .then(data => {
    if (data.chat_id) {
      window.location.href = '/chat/' + data.chat_id;
    } else {
      alert('Ошибка создания чата');
    }
  })
  .catch(err => alert('Ошибка: ' + err));
}

function addFriend() {
  const username = prompt('Введите имя пользователя:');
  if (!username || !username.trim()) return;
  sendFriendRequest(username.trim());
}

function acceptFriend(requestId) {
  fetch(`/api/friends/${requestId}`, { method: 'PUT' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadFriendRequests();
        loadFriends();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function rejectFriend(requestId) {
  fetch(`/api/friends/${requestId}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadFriendRequests();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function loadFriendsChats() {
  fetch('/api/friends_with_chat')
    .then(res => res.json())
    .then(friends => {
      const container = document.getElementById('friendsChatList');
      if (!friends || friends.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет друзей для чата</div>';
        return;
      }
      container.innerHTML = `
        <div class="section-label">👥 Друзья</div>
        ${friends.map(f => {
          const avatarHtml = f.avatar && f.avatar.startsWith('/static/uploads/')
            ? `<img src="${f.avatar}" alt="Avatar">`
            : (f.avatar || '👤');
          return `
            <div class="chat-item" onclick="openChatOrCreate(${f.chat_id}, '${f.username}')">
              <div class="chat-avatar">${avatarHtml}</div>
              <div class="chat-info">
                <div class="chat-name">${f.full_name || f.username}</div>
                <div class="chat-preview">${f.online ? '🟢 Онлайн' : '⚪ Не в сети'}</div>
              </div>
            </div>
          `;
        }).join('')}
      `;
    })
    .catch(err => console.error('Ошибка загрузки друзей:', err));
}

function openChatOrCreate(chatId, username) {
  if (chatId) {
    window.location.href = `/chat/${chatId}`;
  } else {
    fetch('/api/create_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username })
    })
    .then(res => res.json())
    .then(data => {
      if (data.chat_id) {
        window.location.href = `/chat/${data.chat_id}`;
      } else {
        alert('Ошибка создания чата');
      }
    })
    .catch(err => alert('Ошибка: ' + err));
  }
}

function connectSocket() {
  socket = io();
  socket.on('connect', () => console.log('✅ WebSocket подключен'));
  socket.on('new_message', () => {
    loadChats();
  });
}

function loadChats() {
  fetch('/api/chats')
    .then(res => res.json())
    .then(chats => {
      const container = document.getElementById('chatList');
      if (!chats || chats.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">Нет чатов</div><div class="empty-text">Начните общение</div></div>`;
        return;
      }
      const privateChats = chats.filter(c => c.type === 'private');
      const groupChats = chats.filter(c => c.type === 'group');
      let html = '';
      if (privateChats.length > 0) {
        html += `<div class="section-label">👤 Личные чаты</div>`;
        html += privateChats.map(chat => `
          <div class="chat-item" onclick="openChat(${chat.id})">
            <div class="chat-avatar">👤</div>
            <div class="chat-info">
              <div class="chat-name">${chat.name || 'Личный чат'}</div>
              <div class="chat-preview">${chat.member_count || 0} участников</div>
            </div>
            <div class="chat-time">${new Date(chat.created_at).toLocaleDateString()}</div>
          </div>
        `).join('');
      }
      if (groupChats.length > 0) {
        html += `<div class="section-label">👥 Групповые чаты</div>`;
        html += groupChats.map(chat => `
          <div class="chat-item" onclick="openChat(${chat.id})">
            <div class="chat-avatar">👥</div>
            <div class="chat-info">
              <div class="chat-name">${chat.name || 'Групповой чат'}</div>
              <div class="chat-preview">${chat.member_count || 0} участников</div>
            </div>
            <div class="chat-time">${new Date(chat.created_at).toLocaleDateString()}</div>
          </div>
        `).join('');
      }
      container.innerHTML = html || `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">Нет чатов</div><div class="empty-text">Начните общение</div></div>`;
    })
    .catch(err => console.error('Ошибка загрузки чатов:', err));
}

function openChat(chatId) {
  window.location.href = `/chat/${chatId}`;
}

function createGroup() {
  const name = prompt('Название группы:');
  if (!name || !name.trim()) return;
  const membersInput = prompt('Участники через запятую (минимум 2):');
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

const splashShown = sessionStorage.getItem('splash_shown');
if (splashShown) {
  splash.style.display = 'none';
  app.classList.add('app-visible');
  initApp();
} else {
  const messages = ['Создаем пространство...', 'Настраиваем безопасность...', 'Почти готово...'];
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
      }, 600);
    }
  }, 1200);
}
