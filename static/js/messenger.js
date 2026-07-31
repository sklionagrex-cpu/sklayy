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
