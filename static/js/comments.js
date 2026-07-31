function attachMedia() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
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
        alert('Медиа прикреплено!');
      }
    })
    .catch(err => alert('Ошибка загрузки: ' + err));
  };
  input.click();
}
