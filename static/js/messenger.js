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
        let isMedia = false;
        
        if (post.media_url) {
          isMedia = true;
          if (post.media_url.match(/\.(mp4|webm|ogg)$/i)) {
            mediaHtml = `<video class="feed-video" src="${post.media_url}" controls></video>`;
          } else {
            mediaHtml = `<img class="feed-image" src="${post.media_url}" alt="Изображение">`;
          }
        }
        
        if (isMedia) {
          return `
            <div class="feed-item feed-media-item">
              <div class="feed-media-wrapper">
                <div class="feed-media-container">
                  ${mediaHtml}
                  <div class="feed-overlay">
                    <div class="feed-user">
                      <div class="feed-user-avatar">${avatarHtml}</div>
                      <div class="feed-user-name">${post.full_name || post.username}</div>
                    </div>
                    <div class="feed-actions">
                      <div class="feed-action-btn" onclick="likePostFeed(${post.id})">
                        <i class="fas fa-heart"></i>
                        <span>${post.likes || 0}</span>
                      </div>
                      <div class="feed-action-btn" onclick="window.location.href='/post/${post.id}'">
                        <i class="fas fa-comment"></i>
                        <span>${post.comments_count || 0}</span>
                      </div>
                      <div class="feed-action-btn" onclick="sharePost(${post.id})">
                        <i class="fas fa-share"></i>
                      </div>
                    </div>
                  </div>
                </div>
                ${post.content ? `<div class="feed-caption">${post.content}</div>` : ''}
              </div>
            </div>
          `;
        } else {
          return `
            <div class="feed-item feed-text-item">
              <div class="feed-text-post">
                <div class="feed-text-header">
                  <div class="feed-text-avatar">${avatarHtml}</div>
                  <div class="feed-text-author-info">
                    <div class="feed-text-author">${post.full_name || post.username}</div>
                    <div class="feed-text-username">@${post.username}</div>
                  </div>
                  <div class="feed-text-date">${post.created_at ? post.created_at.slice(0,10) : ''}</div>
                </div>
                <div class="feed-text-body">${post.content}</div>
                <div class="feed-text-actions">
                  <button onclick="likePostFeed(${post.id})" class="feed-text-like">❤️ ${post.likes || 0}</button>
                  <button onclick="window.location.href='/post/${post.id}'" class="feed-text-comment">💬 ${post.comments_count || 0}</button>
                  <button onclick="sharePost(${post.id})" class="feed-text-share">🔗</button>
                </div>
              </div>
            </div>
          `;
        }
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки ленты:', err));
}

function sharePost(postId) {
  const url = window.location.origin + '/post/' + postId;
  if (navigator.share) {
    navigator.share({ title: 'Пост в Sklay', url: url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('Ссылка скопирована!')).catch(() => {});
  }
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
