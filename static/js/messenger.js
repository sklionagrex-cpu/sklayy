const splash = document.getElementById('splash');
const splashMessage = document.getElementById('splashMessage');
const app = document.getElementById('app');

let socket = null;
let currentUser = {};
let mediaUrl = null;
let currentFeedIndex = 0;
let feedPosts = [];

function initApp() {
  connectSocket();
  loadChats();
  loadFriendsChats();
  loadProfileData();
  loadFeed();
  setupFeedNavigation();

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
      feedPosts = posts;
      currentFeedIndex = 0;
      if (!posts || posts.length === 0) {
        document.getElementById('feedList').innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Лента пуста</div><div class="empty-text">Создайте первый пост</div></div>';
        return;
      }
      renderFeedPost(0);
    })
    .catch(err => console.error('Ошибка загрузки ленты:', err));
}

function renderFeedPost(index) {
  if (!feedPosts || feedPosts.length === 0 || index >= feedPosts.length) return;
  const post = feedPosts[index];
  const container = document.getElementById('feedList');
  
  // Определяем тип контента
  let contentHtml = '';
  let isMedia = false;
  
  if (post.media_url) {
    isMedia = true;
    if (post.media_url.match(/\.(mp4|webm|ogg)$/i)) {
      contentHtml = `<video class="feed-video" src="${post.media_url}" autoplay loop muted playsinline></video>`;
    } else {
      contentHtml = `<img class="feed-image" src="${post.media_url}" alt="Изображение">`;
    }
  } else {
    // Текстовый пост в стиле ВК
    contentHtml = `
      <div class="feed-text-content">
        <div class="feed-text-author">${post.full_name || post.username}</div>
        <div class="feed-text-date">${post.created_at ? post.created_at.slice(0,10) : ''}</div>
        <div class="feed-text-body">${post.content}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="feed-wrapper ${isMedia ? 'feed-media-wrapper' : 'feed-text-wrapper'}">
      <div class="feed-content">
        ${isMedia ? `
          <div class="feed-media-container">
            ${contentHtml}
            <div class="feed-overlay">
              <div class="feed-user">
                <div class="feed-user-avatar">${post.avatar ? `<img src="${post.avatar}" alt="Avatar">` : '👤'}</div>
                <div class="feed-user-name">${post.full_name || post.username}</div>
              </div>
            </div>
          </div>
        ` : contentHtml}
        
        <div class="feed-actions-bar ${isMedia ? 'feed-actions-overlay' : 'feed-actions-text'}">
          <div class="feed-action-btn" onclick="likePostFeed(${post.id})">
            <i class="fas fa-heart ${post.liked ? 'liked' : ''}"></i>
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
    <div class="feed-navigation">
      <div class="feed-dots">
        ${feedPosts.map((_, i) => `<span class="feed-dot ${i === index ? 'active' : ''}" onclick="goToFeedPost(${i})"></span>`).join('')}
      </div>
    </div>
  `;
  
  currentFeedIndex = index;
}

function setupFeedNavigation() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentFeedIndex > 0) renderFeedPost(currentFeedIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentFeedIndex < feedPosts.length - 1) renderFeedPost(currentFeedIndex + 1);
    }
  });
}

function goToFeedPost(index) {
  if (index >= 0 && index < feedPosts.length) {
    renderFeedPost(index);
  }
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

// ... остальные функции остаются без изменений ...

// ===== ЛЕНТА В СТИЛЕ ТИК ТОК =====
let currentFeedIndex = 0;
let feedPosts = [];

function loadFeed() {
  fetch('/api/feed')
    .then(res => res.json())
    .then(posts => {
      feedPosts = posts;
      currentFeedIndex = 0;
      const container = document.getElementById('feedList');
      if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Лента пуста</div><div class="empty-text">Создайте первый пост</div></div>';
        return;
      }
      renderFeedPost(0);
    })
    .catch(err => console.error('Ошибка загрузки ленты:', err));
}

function renderFeedPost(index) {
  if (!feedPosts || feedPosts.length === 0 || index >= feedPosts.length) return;
  const post = feedPosts[index];
  const container = document.getElementById('feedList');
  
  let contentHtml = '';
  let isMedia = false;
  
  if (post.media_url) {
    isMedia = true;
    if (post.media_url.match(/\.(mp4|webm|ogg)$/i)) {
      contentHtml = `<video class="feed-video" src="${post.media_url}" autoplay loop muted playsinline></video>`;
    } else {
      contentHtml = `<img class="feed-image" src="${post.media_url}" alt="Изображение">`;
    }
  } else {
    contentHtml = `
      <div class="feed-text-content">
        <div class="feed-text-author">${post.full_name || post.username}</div>
        <div class="feed-text-date">${post.created_at ? post.created_at.slice(0,10) : ''}</div>
        <div class="feed-text-body">${post.content}</div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="feed-wrapper ${isMedia ? 'feed-media-wrapper' : 'feed-text-wrapper'}">
      <div class="feed-content">
        ${isMedia ? `
          <div class="feed-media-container">
            ${contentHtml}
            <div class="feed-overlay">
              <div class="feed-user">
                <div class="feed-user-avatar">${post.avatar ? `<img src="${post.avatar}" alt="Avatar">` : '👤'}</div>
                <div class="feed-user-name">${post.full_name || post.username}</div>
              </div>
            </div>
          </div>
        ` : contentHtml}
        
        <div class="feed-actions-bar ${isMedia ? 'feed-actions-overlay' : 'feed-actions-text'}">
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
    <div class="feed-navigation">
      <div class="feed-dots">
        ${feedPosts.map((_, i) => `<span class="feed-dot ${i === index ? 'active' : ''}" onclick="goToFeedPost(${i})"></span>`).join('')}
      </div>
    </div>
  `;
  
  currentFeedIndex = index;
}

function goToFeedPost(index) {
  if (index >= 0 && index < feedPosts.length) {
    renderFeedPost(index);
  }
}

function sharePost(postId) {
  const url = window.location.origin + '/post/' + postId;
  if (navigator.share) {
    navigator.share({ title: 'Пост в Sklay', url: url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('Ссылка скопирована!')).catch(() => {});
  }
}

// Добавляем навигацию клавишами
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && currentFeedIndex > 0) {
    renderFeedPost(currentFeedIndex - 1);
  } else if (e.key === 'ArrowDown' && currentFeedIndex < feedPosts.length - 1) {
    renderFeedPost(currentFeedIndex + 1);
  }
});
