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
