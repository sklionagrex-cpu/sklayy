const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const particles = [];
for (let i = 0; i < 60; i++) {
  particles.push({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    radius: 1.5 + Math.random() * 2,
    alpha: 0.2 + Math.random() * 0.3,
  });
}

function drawParticles() {
  ctx.clearRect(0, 0, width, height);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > width) p.vx *= -1;
    if (p.y < 0 || p.y > height) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 180, 255, ${p.alpha})`;
    ctx.fill();
  });
  requestAnimationFrame(drawParticles);
}
drawParticles();

const statNumbers = document.querySelectorAll('.stat-number');
statNumbers.forEach(el => {
  const target = el.dataset.target;
  if (target === '∞') { el.textContent = '∞'; return; }
  const targetNum = parseFloat(target);
  const duration = 2000;
  const startTime = performance.now();
  const isFloat = target.includes('.');
  function updateStat(time) {
    const progress = Math.min((time - startTime) / duration, 1);
    const current = targetNum * progress;
    el.textContent = isFloat ? current.toFixed(2) : Math.round(current);
    if (progress < 1) requestAnimationFrame(updateStat);
    else el.textContent = isFloat ? targetNum.toFixed(2) : targetNum;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { requestAnimationFrame(updateStat); observer.disconnect(); }
  });
  observer.observe(el);
});

const card = document.querySelector('.app-preview');
const heroCard = document.querySelector('.hero-card');
if (card && heroCard) {
  heroCard.addEventListener('mousemove', (e) => {
    const rect = heroCard.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
  });
  heroCard.addEventListener('mouseleave', () => {
    card.style.transform = 'rotateY(-2deg) rotateX(2deg) scale(1)';
  });
}
