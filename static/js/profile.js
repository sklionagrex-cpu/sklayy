let currentUser = {};
let editMode = false;
let mediaUrl = null;

function loadProfile() {
  fetch('/api/profile')
    .then(res => res.json())
    .then(data => {
      currentUser = data;
      updateUI(data);
      loadFriends();
      loadFriendRequests();
      loadPosts();
    })
    .catch(err => {
      console.error('Ошибка загрузки:', err);
      showToast('❌ Ошибка загрузки профиля');
    });
}

function updateUI(user) {
  const avatarEl = document.getElementById('avatarDisplay');
  if (user.avatar && user.avatar.startsWith('/static/uploads/')) {
    avatarEl.innerHTML = `<img src="${user.avatar}?t=${Date.now()}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.textContent = user.avatar || '👤';
  }
  
  document.getElementById('fullNameDisplay').textContent = user.full_name || user.username;
  document.getElementById('statusDisplay').textContent = user.status || 'Статус не установлен';
  document.getElementById('bioDisplay').textContent = user.bio || 'Нет описания';
  
  document.getElementById('view-full_name').textContent = user.full_name || 'Не указано';
  document.getElementById('view-email').textContent = user.email || 'Не указан';
  document.getElementById('view-phone').textContent = user.phone || 'Не указан';
  document.getElementById('view-bio').textContent = user.bio || 'Не указано';
  document.getElementById('view-status').textContent = user.status || 'Не установлен';
  
  document.getElementById('edit-full_name').value = user.full_name || '';
  document.getElementById('edit-email').value = user.email || '';
  document.getElementById('edit-phone').value = user.phone || '';
  document.getElementById('edit-bio').value = user.bio || '';
  document.getElementById('edit-status').value = user.status || '';
  
  if (window.opener) {
    window.opener.postMessage({ type: 'profile_updated', user: user }, '*');
  }
}

function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) {
    showToast('❌ Файл не выбран');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('❌ Файл слишком большой (макс. 5MB)');
    input.value = '';
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('❌ Можно загружать только изображения');
    input.value = '';
    return;
  }
  
  const formData = new FormData();
  formData.append('avatar', file);
  showToast('⏳ Загрузка...');
  
  fetch('/api/upload_avatar', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      currentUser.avatar = data.url;
      updateUI(currentUser);
      showToast('✅ Аватар обновлён!');
    } else {
      showToast('❌ ' + (data.error || 'Ошибка загрузки'));
    }
  })
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка загрузки');
  });
  input.value = '';
}

function uploadMedia(input) {
  const file = input.files[0];
  if (!file) return;
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];
  if (!allowedTypes.includes(file.type)) {
    showToast('❌ Неподдерживаемый формат');
    input.value = '';
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('❌ Файл слишком большой (макс. 50MB)');
    input.value = '';
    return;
  }
  
  const formData = new FormData();
  formData.append('media', file);
  showToast('⏳ Загрузка медиа...');
  
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
      showToast('✅ Медиа загружено');
    } else {
      showToast('❌ ' + (data.error || 'Ошибка загрузки'));
    }
  })
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка загрузки медиа');
  });
  input.value = '';
}

function removeMedia() {
  mediaUrl = null;
  document.getElementById('mediaFileName').textContent = '';
  document.getElementById('removeMediaBtn').style.display = 'none';
  document.getElementById('mediaInput').value = '';
  showToast('🗑️ Медиа удалено');
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
  
  if (tabId === 'posts') {
    loadPosts();
  }
}

function toggleEditMode() {
  editMode = !editMode;
  document.getElementById('viewMode').style.display = editMode ? 'none' : 'block';
  document.getElementById('editMode').style.display = editMode ? 'block' : 'none';
}

function saveProfile() {
  const data = {
    full_name: document.getElementById('edit-full_name').value,
    email: document.getElementById('edit-email').value,
    phone: document.getElementById('edit-phone').value,
    bio: document.getElementById('edit-bio').value,
    status: document.getElementById('edit-status').value
  };
  
  fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(() => {
    showToast('✅ Профиль обновлён!');
    // Перенаправляем в мессенджер на вкладку профиля
    window.location.href = '/app?tab=profile';
  })
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка обновления');
  });
}

// ===== ПОСТЫ =====
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

function publishPost() {
  const content = document.getElementById("postContent").value.trim();
  if (!content && !mediaUrl) {
    showToast("❌ Введите текст или прикрепите медиа");
    return;
  }
  const data = { content: content };
  if (mediaUrl) data.media_url = mediaUrl;
  fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast("✅ Пост опубликован!");
      closePostModal();
      window.location.href = "/app?feed=updated";
    } else {
      showToast("❌ " + (data.error || "Ошибка"));
    }
  })
  .catch(err => {
    console.error("Ошибка:", err);
    showToast("❌ Ошибка публикации");
  });
}

function loadPosts() {
  fetch('/api/posts')
    .then(res => res.json())
    .then(posts => {
      const container = document.getElementById('postsList');
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
              <button class="btn-sm" onclick="likePost(${post.id})">❤️ ${post.likes || 0}</button>
              <button class="btn-sm" onclick="deletePost(${post.id})">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => console.error('Ошибка загрузки постов:', err));
}

function likePost(postId) {
  fetch(`/api/posts/${postId}/like`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        loadPosts();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function deletePost(postId) {
  if (!confirm('Удалить пост?')) return;
  fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('✅ Пост удалён');
        loadPosts();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function shareProfile() {
  const url = `sklay.app/@${currentUser.username}`;
  if (navigator.share) {
    navigator.share({
      title: 'Мой профиль в Sklay',
      text: `Свяжись со мной в Sklay: ${url}`,
      url: url
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showToast('✅ Ссылка скопирована!');
    }).catch(() => {
      prompt('Скопируйте ссылку:', url);
    });
  }
}

// ===== ДРУЗЬЯ =====
function loadFriends() {
  fetch('/api/friends')
    .then(res => res.json())
    .then(friends => {
      const container = document.getElementById('friendsList');
      if (!friends || friends.length === 0) {
        container.innerHTML = '<div class="empty-state">У вас пока нет друзей</div>';
        return;
      }
      container.innerHTML = friends.map(f => `
        <div class="friend-item">
          <div class="friend-avatar">${f.avatar || '👤'}</div>
          <div class="friend-info">
            <div class="friend-name">${f.full_name || f.username}</div>
            <div class="friend-username">@${f.username}</div>
          </div>
          <div class="friend-status">${f.online ? '🟢 Онлайн' : '⚪ Офлайн'}</div>
          <div class="friend-actions">
            <button class="btn-sm" style="background:rgba(255,70,70,0.1);color:#ff6b6b;" onclick="blockUser(${f.id})">
              <i class="fas fa-ban"></i>
            </button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => console.error('Ошибка:', err));
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
      container.innerHTML = requests.map(req => `
        <div class="friend-item">
          <div class="friend-avatar">${req.avatar || '👤'}</div>
          <div class="friend-info">
            <div class="friend-name">${req.full_name || req.username}</div>
            <div class="friend-username">@${req.username}</div>
          </div>
          <div class="friend-actions">
            <button class="btn-sm accept" onclick="acceptFriend(${req.request_id})">✓</button>
            <button class="btn-sm reject" onclick="rejectFriend(${req.request_id})">✕</button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => console.error('Ошибка:', err));
}

function switchFriendTab(tab) {
  document.querySelectorAll('.friend-tab').forEach(el => el.classList.remove('active'));
  document.querySelector(`.friend-tab[data-ftab="${tab}"]`).classList.add('active');
  document.getElementById('friendRequests').style.display = 'none';
  document.getElementById('friendsList').style.display = 'block';
  if (tab === 'list') loadFriends();
  else if (tab === 'incoming') {
    document.getElementById('friendsList').style.display = 'none';
    document.getElementById('friendRequests').style.display = 'block';
    loadFriendRequests();
  } else if (tab === 'outgoing') {
    showToast('📤 Исходящие заявки (в разработке)');
  } else if (tab === 'blocked') loadBlockedUsers();
}

function loadBlockedUsers() {
  fetch('/api/blocked')
    .then(res => res.json())
    .then(blocked => {
      const container = document.getElementById('friendsList');
      document.getElementById('friendsList').style.display = 'block';
      document.getElementById('friendRequests').style.display = 'none';
      if (!blocked || blocked.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет заблокированных</div>';
        return;
      }
      container.innerHTML = blocked.map(u => `
        <div class="friend-item">
          <div class="friend-avatar">${u.avatar || '👤'}</div>
          <div class="friend-info">
            <div class="friend-name">${u.full_name || u.username}</div>
            <div class="friend-username">@${u.username}</div>
          </div>
          <div class="friend-actions">
            <button class="btn-sm" style="background:rgba(74,222,128,0.1);color:#4ade80;" onclick="unblockUser(${u.id})">
              <i class="fas fa-check"></i> Разблокировать
            </button>
          </div>
        </div>
      `).join('');
    })
    .catch(err => console.error('Ошибка:', err));
}

function searchFriends(query) {
  const items = document.querySelectorAll('.friend-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query.toLowerCase()) ? 'flex' : 'none';
  });
}

function addFriend() {
  const username = prompt('Введите имя пользователя:');
  if (!username || !username.trim()) return;
  fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim() })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('✅ Заявка отправлена!');
    } else {
      showToast('❌ ' + (data.error || 'Ошибка'));
    }
  })
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка отправки');
  });
}

function acceptFriend(requestId) {
  fetch(`/api/friends/${requestId}`, { method: 'PUT' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('✅ Друг добавлен!');
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
        showToast('❌ Заявка отклонена');
        loadFriendRequests();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function blockUser(userId) {
  if (!confirm('Заблокировать пользователя?')) return;
  fetch(`/api/block/${userId}`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('✅ Заблокирован');
        loadFriends();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function unblockUser(userId) {
  fetch(`/api/unblock/${userId}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('✅ Разблокирован');
        loadBlockedUsers();
      }
    })
    .catch(err => console.error('Ошибка:', err));
}

function saveSetting(field, value) {
  const data = {};
  data[field] = value;
  fetch('/api/profile/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(() => showToast('✅ Сохранено'))
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка сохранения');
  });
}

function saveNotifications() {
  const data = {
    notifications_sound: document.getElementById('notif_sound').checked ? 1 : 0,
    notifications_vibration: document.getElementById('notif_vibration').checked ? 1 : 0,
    notifications_push: document.getElementById('notif_push').checked ? 1 : 0,
    notifications_email: document.getElementById('notif_email').checked ? 1 : 0
  };
  fetch('/api/profile/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(() => showToast('✅ Настройки сохранены'))
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка сохранения');
  });
}

function deleteAccount() {
  if (!confirm('⚠️ Удалить аккаунт безвозвратно?')) return;
  const password = prompt('Введите пароль для подтверждения:');
  if (!password) return;
  fetch('/api/delete_account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('✅ Аккаунт удалён');
      setTimeout(() => window.location.href = '/', 1000);
    } else {
      showToast('❌ ' + (data.error || 'Ошибка'));
    }
  })
  .catch(err => {
    console.error('Ошибка:', err);
    showToast('❌ Ошибка удаления');
  });
}

function showToast(message) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePostModal();
  }
});
