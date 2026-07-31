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
