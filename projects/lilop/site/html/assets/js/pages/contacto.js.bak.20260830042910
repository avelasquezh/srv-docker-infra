/* ============================================================
   Lilop — pages/contacto.js
   Responsabilidad única: lógica de la página de contacto.
   - Inicializa acordeones del FAQ
   - Valida el formulario de contacto
   - ⚠️ PENDIENTE: envío real requiere backend o Formspree
     Por ahora abre WhatsApp con el mensaje del formulario
   - Inicializa scroll reveal
   ============================================================ */

'use strict';

const WA_NUMBER = '573001234567';

/* ─── SCROLL REVEAL ───────────────────────────────────────── */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('is-visible'),
        parseInt(e.target.dataset.delay || 0));
      obs.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  els.forEach((el) => obs.observe(el));
}

/* ─── ACORDEONES FAQ ──────────────────────────────────────── */
function initAccordions() {
  document.querySelectorAll('.accordion-item__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const body     = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(!expanded));
      body?.classList.toggle('is-hidden', expanded);
    });
  });
}

/* ─── FORMULARIO ──────────────────────────────────────────── */
function initContactForm() {
  const form   = document.getElementById('contactForm');
  const btn    = document.getElementById('contactSubmitBtn');
  if (!form || !btn) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name    = document.getElementById('contactName')?.value.trim();
    const email   = document.getElementById('contactEmail')?.value.trim();
    const subject = document.getElementById('contactSubject')?.value;
    const message = document.getElementById('contactMessage')?.value.trim();

    /* Validación básica */
    if (!name || !email || !message) {
      window.LilopToast?.warning('Campos incompletos', 'Por favor completa nombre, email y mensaje');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      window.LilopToast?.error('Email inválido', 'Ingresa un correo electrónico válido');
      return;
    }

    /* ─────────────────────────────────────────────────────
       TODO: ENVÍO REAL POR EMAIL
       ─────────────────────────────────────────────────────
       Opción A — Formspree (gratuito, sin backend):
       const res = await fetch('https://formspree.io/f/TU_ID', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
         body: JSON.stringify({ name, email, subject, message }),
       });
       if (res.ok) { mostrar éxito } else { mostrar error }

       Opción B — Tu propio backend:
       const res = await fetch('https://tu-api.com/contact', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name, email, subject, message }),
       });
       ──────────────────────────────────────────────────── */

    /* Por ahora: abrir WhatsApp con el mensaje */
    const subjectLabel = document.getElementById('contactSubject')
      ?.querySelector(`option[value="${subject}"]`)?.textContent || 'Consulta general';

    const waMsg = encodeURIComponent(
      `*Mensaje desde lilop.store*\n\n` +
      `*Nombre:* ${name}\n` +
      `*Email:* ${email}\n` +
      `*Asunto:* ${subjectLabel}\n\n` +
      `*Mensaje:*\n${message}`
    );

    btn.textContent = 'Enviando…';
    btn.disabled    = true;

    setTimeout(() => {
      window.open(`https://wa.me/${WA_NUMBER}?text=${waMsg}`, '_blank', 'noopener,noreferrer');
      window.LilopToast?.success('Mensaje enviado', 'Te redirigimos a WhatsApp para completar el envío');
      form.reset();
      btn.textContent = 'Enviar mensaje';
      btn.disabled    = false;
    }, 600);
  });
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initAccordions();
  initContactForm();
});