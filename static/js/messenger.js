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
      updateFriendRequestBadge();
    })
    .catch(err => console.error('Ошибка загрузки профиля:', err));
}

function updateFriendRequestBadge() {
  fetch('/api/friend_requests')
    .then(res => res.json())
    .then(requests => {
      const count = requests ? requests.length : 0;
      const badge = document.getElementById('friendRequestBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    })
    .catch(err => console.error('Ошибка обновления бейджа:', err));
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
    updateFriendRequestBadge();
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
