function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  fetch('/api/upload_avatar', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.url) {
      document.getElementById('avatarDisplay').innerHTML = `<img src="${data.url}?t=${Date.now()}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      alert('Аватар обновлён!');
    }
  })
  .catch(err => alert('Ошибка загрузки'));
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
    alert('Профиль обновлён!');
    window.location.href = '/app';
  })
  .catch(err => alert('Ошибка обновления'));
}
