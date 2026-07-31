function uploadAvatar(input) {
  const file = input.files[0];
  const status = document.getElementById('uploadStatus');
  
  if (!file) {
    status.textContent = '❌ Файл не выбран';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    status.textContent = '❌ Файл слишком большой (макс. 5MB)';
    input.value = '';
    return;
  }

  if (!file.type.startsWith('image/')) {
    status.textContent = '❌ Можно загружать только изображения';
    input.value = '';
    return;
  }

  status.textContent = '⏳ Загрузка...';
  
  const formData = new FormData();
  formData.append('avatar', file);

  fetch('/api/upload_avatar', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      const avatarDisplay = document.getElementById('avatarDisplay');
      avatarDisplay.innerHTML = `<img src="${data.url}?t=${Date.now()}" alt="Avatar">`;
      status.textContent = '✅ Аватар обновлён!';
      
      // Обновляем аватар в панели профиля (через postMessage)
      if (window.opener) {
        window.opener.postMessage({ type: 'avatar_updated', url: data.url }, '*');
      }
      
      setTimeout(() => {
        location.reload();
      }, 800);
    } else {
      status.textContent = '❌ ' + (data.error || 'Неизвестная ошибка');
    }
  })
  .catch(err => {
    status.textContent = '❌ Ошибка загрузки: ' + err;
  });

  input.value = '';
}

function saveProfile() {
  const data = {
    full_name: document.getElementById('edit-full_name').value,
    status: document.getElementById('edit-status').value,
    bio: document.getElementById('edit-bio').value,
    email: document.getElementById('edit-email').value,
    phone: document.getElementById('edit-phone').value
  };

  fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(() => {
    alert('✅ Профиль обновлён!');
    window.location.href = '/app';
  })
  .catch(err => {
    alert('❌ Ошибка обновления: ' + err);
  });
}
