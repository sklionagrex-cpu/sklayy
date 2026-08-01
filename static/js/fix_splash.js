// Принудительно показываем приложение и скрываем splash
document.addEventListener('DOMContentLoaded', function() {
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');
  
  if (splash) {
    splash.style.display = 'none';
    splash.classList.add('splash-hidden');
    console.log('✅ Splash скрыт принудительно');
  }
  
  if (app) {
    app.style.display = 'flex';
    app.classList.add('app-visible');
    console.log('✅ Приложение показано принудительно');
  }
  
  // Если есть initApp - вызываем её
  if (typeof initApp === 'function') {
    initApp();
    console.log('✅ initApp вызвана');
  }
});
