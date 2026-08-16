/* ============================================================
   AutoFlow — script.js
   Interacciones y animaciones
   ============================================================ */

'use strict';

/* ─── CURSOR PERSONALIZADO ─── */
(function initCursor() {
  const cursor   = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  if (!cursor || !follower) return;

  let mouseX = 0, mouseY = 0;
  let followerX = 0, followerY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // cursor inmediato
    cursor.style.left = mouseX + 'px';
    cursor.style.top  = mouseY + 'px';
  });

  // follower con lag suave
  function animateFollower() {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    follower.style.left = followerX + 'px';
    follower.style.top  = followerY + 'px';
    requestAnimationFrame(animateFollower);
  }
  animateFollower();

  // Efecto en elementos interactivos
  const interactives = document.querySelectorAll('a, button, .benefit-card, .service-card, .tech-item');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => {
      follower.style.width  = '50px';
      follower.style.height = '50px';
      follower.style.borderColor = 'rgba(6,182,212,0.6)';
      cursor.style.background = 'var(--violet)';
    });
    el.addEventListener('mouseleave', () => {
      follower.style.width  = '30px';
      follower.style.height = '30px';
      follower.style.borderColor = 'rgba(59,130,246,0.5)';
      cursor.style.background = 'var(--cyan)';
    });
  });
})();

/* ─── NAVBAR SCROLL ─── */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
})();

/* ─── MENÚ HAMBURGUESA ─── */
(function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Cerrar al hacer click en un enlace
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
})();

/* ─── SCROLL REVEAL ─── */
(function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, parseInt(delay));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => observer.observe(el));
})();

/* ─── CONTADORES ANIMADOS (HERO STATS) ─── */
(function initCounters() {
  const numbers = document.querySelectorAll('.stat-number[data-target]');
  if (!numbers.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el     = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const dur    = 1800;
      const start  = performance.now();

      function update(now) {
        const elapsed  = now - start;
        const progress = Math.min(elapsed / dur, 1);
        // Easing out quart
        const eased = 1 - Math.pow(1 - progress, 4);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(update);
      }

      requestAnimationFrame(update);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  numbers.forEach(n => observer.observe(n));
})();

/* ─── PARTICLE CANVAS (HERO) ─── */
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles;

  const PARTICLE_COUNT = 70;
  const MAX_DIST       = 130;

  class Particle {
    constructor() { this.reset(); }

    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r  = Math.random() * 1.5 + 0.5;
      this.alpha = Math.random() * 0.4 + 0.1;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W) this.vx *= -1;
      if (this.y < 0 || this.y > H) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(59,130,246,${this.alpha})`;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
  }

  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.12;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize, { passive: true });
  init();
  loop();
})();

/* ─── CAROUSEL GENÉRICO ─── */
function createCarousel({ trackId, prevId, nextId, dotsId, visibleCount }) {
  const track = document.getElementById(trackId);
  const prev  = document.getElementById(prevId);
  const next  = document.getElementById(nextId);
  const dotsContainer = document.getElementById(dotsId);

  if (!track || !prev || !next) return;

  const items    = track.children;
  const total    = items.length;
  let current    = 0;
  let autoTimer  = null;

  /* Calcula cuántos items son visibles según viewport */
  function getVisible() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return visibleCount === 3 ? 2 : 1;
    return visibleCount;
  }

  /* Crea puntos de navegación */
  function buildDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const groups = Math.ceil(total / getVisible());
    for (let i = 0; i < groups; i++) {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Ir al grupo ${i + 1}`);
      dot.addEventListener('click', () => goTo(i * getVisible()));
      dotsContainer.appendChild(dot);
    }
  }

  function updateDots() {
    if (!dotsContainer) return;
    const dots   = dotsContainer.querySelectorAll('.carousel-dot');
    const active = Math.floor(current / getVisible());
    dots.forEach((d, i) => d.classList.toggle('active', i === active));
  }

  function goTo(index) {
    const visible = getVisible();
    const maxIndex = total - visible;
    current = Math.max(0, Math.min(index, maxIndex));

    /* Calcula el width de un item incluyendo gap */
    const itemWidth = items[0].offsetWidth + 24; // gap: 24px
    track.style.transform = `translateX(-${current * itemWidth}px)`;
    updateDots();
  }

  function goNext() {
    const visible = getVisible();
    const next = current + visible >= total ? 0 : current + 1;
    goTo(next);
  }

  function goPrev() {
    const visible   = getVisible();
    const maxIndex  = total - visible;
    const prevIndex = current <= 0 ? maxIndex : current - 1;
    goTo(prevIndex);
  }

  /* Auto-play */
  function startAuto() {
    autoTimer = setInterval(goNext, 5000);
  }
  function stopAuto() {
    clearInterval(autoTimer);
  }

  next.addEventListener('click', () => { stopAuto(); goNext(); startAuto(); });
  prev.addEventListener('click', () => { stopAuto(); goPrev(); startAuto(); });

  /* Swipe táctil */
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      stopAuto();
      diff > 0 ? goNext() : goPrev();
      startAuto();
    }
  });

  window.addEventListener('resize', () => {
    buildDots();
    goTo(0);
  }, { passive: true });

  buildDots();
  goTo(0);
  startAuto();
}

/* ─── INICIALIZAR CAROUSELES ─── */
(function initCarousels() {
  createCarousel({
    trackId:      'casesTrack',
    prevId:       'casesPrev',
    nextId:       'casesNext',
    dotsId:       'casesDots',
    visibleCount: 3,
  });

  createCarousel({
    trackId:      'testimonialsTrack',
    prevId:       'testimonialsPrev',
    nextId:       'testimonialsNext',
    dotsId:       'testimonialsDots',
    visibleCount: 2,
  });
})();

/* ─── SMOOTH SCROLL PARA ANCHORS ─── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 80; // altura navbar
      const top    = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ─── PARALLAX SUAVE EN HERO ORBS ─── */
(function initParallax() {
  const orbs = document.querySelectorAll('.glow-orb');
  if (!orbs.length) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    orbs.forEach((orb, i) => {
      const factor = (i % 2 === 0 ? 0.04 : -0.03);
      orb.style.transform = `translateY(${scrollY * factor}px)`;
    });
  }, { passive: true });
})();

/* ─── HOVER TILT EN CARDS ─── */
(function initCardTilt() {
  const cards = document.querySelectorAll('.service-card, .benefit-card');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect   = card.getBoundingClientRect();
      const x      = (e.clientX - rect.left) / rect.width  - 0.5;
      const y      = (e.clientY - rect.top)  / rect.height - 0.5;
      const tiltX  = y * -8;
      const tiltY  = x *  8;

      card.style.transform = `translateY(-6px) perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)';
    });

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'none';
    });
  });
})();

/* ─── INDICADOR DE SECCIÓN ACTIVA EN NAV ─── */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        const isActive = link.getAttribute('href') === `#${id}`;
        link.style.color = isActive ? 'var(--text-primary)' : '';
      });
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
})();

/* ─── ANIMACIÓN CHART BARS EN MOCKUP ─── */
(function initChartAnimation() {
  const bars = document.querySelectorAll('.chart-bar');
  if (!bars.length) return;

  bars.forEach((bar, i) => {
    bar.style.animationDelay = `${i * 0.12}s`;
  });
})();

/* ─── CTA GLOW PULSE ─── */
(function initCtaGlow() {
  const ctaBtn = document.querySelector('.cta-section .btn-primary');
  if (!ctaBtn) return;

  let growing = true;
  let size    = 0.25;

  function pulsate() {
    if (growing) {
      size += 0.002;
      if (size >= 0.5) growing = false;
    } else {
      size -= 0.002;
      if (size <= 0.2) growing = true;
    }
    ctaBtn.style.boxShadow = `0 0 ${60 * size * 4}px rgba(59,130,246,${size})`;
    requestAnimationFrame(pulsate);
  }
  pulsate();
})();

/* ─── RIPPLE EN BOTONES ─── */
(function initRipple() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect   = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size   = Math.max(rect.width, rect.height) * 2;

      ripple.style.cssText = `
        position:absolute;
        width:${size}px; height:${size}px;
        border-radius:50%;
        background:rgba(255,255,255,0.15);
        top:${e.clientY - rect.top  - size/2}px;
        left:${e.clientX - rect.left - size/2}px;
        transform:scale(0);
        animation:ripple-expand 0.6s linear forwards;
        pointer-events:none;
      `;

      // Asegura position: relative en el botón
      const pos = window.getComputedStyle(this).position;
      if (pos === 'static') this.style.position = 'relative';
      this.appendChild(ripple);

      setTimeout(() => ripple.remove(), 700);
    });
  });

  // Inyectar keyframe de ripple
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple-expand {
      to { transform: scale(1); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();

/* ─── LOG DE CARGA ─── */
console.log('%cAutoFlow 🚀 | Automatización Empresarial Inteligente', [
  'background: linear-gradient(135deg, #2563eb, #7c3aed)',
  'color: white',
  'padding: 8px 16px',
  'border-radius: 6px',
  'font-weight: bold',
  'font-size: 13px',
].join(';'));