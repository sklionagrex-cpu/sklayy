// ===== СОЗДАНИЕ ГРУППЫ =====
let selectedGroupMembers = [];

function openGroupModal() {
  document.getElementById('groupModal').style.display = 'flex';
  document.getElementById('groupNameInput').value = '';
  selectedGroupMembers = [];
  document.getElementById('selectedMembers').innerHTML = '';
  loadGroupFriendsList();
}

function loadGroupFriendsList() {
  fetch('/api/friends')
    .then(r => r.json())
    .then(friends => {
      const container = document.getElementById('groupFriendsList');
      if (!friends || friends.length === 0) {
        container.innerHTML = '<div style="color:#666;padding:12px;text-align:center;">У вас нет друзей</div>';
        return;
      }
      container.innerHTML = friends.map(f => `
        <div style="padding:8px 12px;background:rgba(255,255,255,0.02);border-radius:10px;display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(91,108,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden;">
            ${f.avatar && f.avatar.startsWith('/static/uploads/') ? `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;">` : (f.avatar || '👤')}
          </div>
          <div style="flex:1;">
            <div style="font-weight:500;">${f.full_name || f.username}</div>
            <div style="font-size:12px;color:#888;">@${f.username}</div>
          </div>
          <button onclick="addGroupMember(${f.id}, '${f.username}', '${f.full_name || f.username}')" style="background:#5B6CFF;border:none;border-radius:50%;width:30px;height:30px;color:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">+</button>
        </div>
      `).join('');
    })
    .catch(err => console.error('Ошибка загрузки друзей:', err));
}

function addGroupMember(id, username, fullName) {
  if (selectedGroupMembers.some(m => m.id === id)) { alert('Уже добавлен'); return; }
  selectedGroupMembers.push({ id, username, fullName });
  renderSelectedMembers();
}

function removeGroupMember(id) {
  selectedGroupMembers = selectedGroupMembers.filter(m => m.id !== id);
  renderSelectedMembers();
}

function renderSelectedMembers() {
  const container = document.getElementById('selectedMembers');
  if (selectedGroupMembers.length === 0) {
    container.innerHTML = '<div style="color:#666;font-size:14px;">Никто не выбран</div>';
    return;
  }
  container.innerHTML = selectedGroupMembers.map(m => `
    <span style="background:rgba(91,108,255,0.15);padding:4px 10px;border-radius:20px;font-size:13px;display:flex;align-items:center;gap:6px;">
      ${m.fullName || m.username}
      <button onclick="removeGroupMember(${m.id})" style="background:none;border:none;color:#ff6b6b;cursor:pointer;padding:0;font-size:16px;">✕</button>
    </span>
  `).join('');
}

document.getElementById('createGroupBtn').addEventListener('click', function() {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) { alert('Введите название группы'); return; }
  if (selectedGroupMembers.length < 2) { alert('Выберите минимум 2 участника'); return; }
  const members = selectedGroupMembers.map(m => m.username);
  fetch('/api/create_group', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, members: members })
  })
  .then(r => r.json())
  .then(data => {
    if (data.chat_id) {
      document.getElementById('groupModal').style.display = 'none';
      if (typeof loadChats === 'function') loadChats();
      window.location.href = '/chat/' + data.chat_id;
    } else {
      alert(data.error || 'Ошибка создания группы');
    }
  })
  .catch(err => alert('Ошибка: ' + err));
});
