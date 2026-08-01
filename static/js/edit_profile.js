function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Файл слишком большой (макс. 5MB)');
    input.value = '';
    return;
  }
  if (!file.type.startsWith('image/')) {
    alert('Можно загружать только изображения');
    input.value = '';
    return;
  }
  
  const formData = new FormData();
  formData.append('avatar', file);
  
  fetch('/api/upload_avatar', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      document.getElementById('avatarDisplay').innerHTML = `<img src="${data.url}?t=${Date.now()}" alt="Avatar">`;
      alert('✅ Аватар обновлён!');
      // Обновляем страницу через 1 секунду
      setTimeout(() => location.reload(), 800);
    } else {
      alert('❌ ' + (data.error || 'Ошибка загрузки'));
    }
  })
  .catch(err => {
    alert('❌ Ошибка загрузки: ' + err);
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
