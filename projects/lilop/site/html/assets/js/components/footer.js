/* ============================================================
   Lilop — components/footer.js
   Web Component: <lilop-footer>
   Responsabilidad única: renderizar el footer completo.
   - Navegación secundaria por categorías y páginas
   - Información de contacto y redes sociales
   - Links de políticas y copyright
   ============================================================ */

class LilopFooter extends HTMLElement {

  connectedCallback() {
    this.render();
    this.initYear();
  }

  render() {
    this.innerHTML = `
      <footer class="footer" role="contentinfo">
        <div class="container">

          <!-- Grid principal -->
          <div class="footer__grid">

            <!-- Columna: Marca -->
            <div class="footer__brand">
              <a href="/index.html" class="footer__brand-logo" aria-label="Lilop — Ir al inicio">
                Lilop<span>.</span>
              </a>
              <p class="footer__brand-desc">
                Ropa de cama premium bajo pedido. Materiales cuidadosamente seleccionados
                para transformar tu descanso. Entrega en todo Colombia.
              </p>
              <!-- Redes sociales -->
              <div class="footer__social" role="list" aria-label="Redes sociales">

                <a href="https://www.instagram.com/lilop.store"
                   class="footer__social-link"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="Instagram de Lilop"
                   role="listitem">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                  </svg>
                </a>

                <a href="https://www.facebook.com/lilop.store"
                   class="footer__social-link"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="Facebook de Lilop"
                   role="listitem">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                  </svg>
                </a>

                <a href="https://wa.me/573016006654"
                   class="footer__social-link"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="WhatsApp de Lilop"
                   role="listitem">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>

                <a href="https://www.tiktok.com/@lilop.store"
                   class="footer__social-link"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="TikTok de Lilop"
                   role="listitem">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/>
                  </svg>
                </a>

              </div>
            </div>

            <!-- Columna: Categorías -->
            <div class="footer__col">
              <span class="footer__col-title">Categorías</span>
              <nav class="footer__links" aria-label="Categorías de productos">
                <a href="/catalogo.html?categoria=sabanas"    class="footer__link">Sábanas</a>
                <a href="/catalogo.html?categoria=edredones"  class="footer__link">Edredones</a>
                <a href="/catalogo.html?categoria=almohadas"  class="footer__link">Almohadas</a>
                <a href="/catalogo.html?categoria=cubrecamas" class="footer__link">Cubrecamas</a>
                <a href="/catalogo.html?categoria=toallas"    class="footer__link">Toallas</a>
                <a href="/catalogo.html?categoria=protectores" class="footer__link">Protectores</a>
              </nav>
            </div>

            <!-- Columna: Información -->
            <div class="footer__col">
              <span class="footer__col-title">Información</span>
              <nav class="footer__links" aria-label="Información de la empresa">
                <a href="/nosotros.html"  class="footer__link">Nosotros</a>
                <a href="/contacto.html"  class="footer__link">Contacto</a>
                <a href="/contacto.html#faq"       class="footer__link">Preguntas frecuentes</a>
                <a href="/contacto.html#envios"    class="footer__link">Política de envíos</a>
                <a href="/contacto.html#garantias" class="footer__link">Garantías</a>
              </nav>
            </div>

            <!-- Columna: Contacto -->
            <div class="footer__col">
              <span class="footer__col-title">Contacto</span>
              <div class="footer__links">

                <a href="https://wa.me/573016006654"
                   class="footer__contact-item"
                   target="_blank"
                   rel="noopener noreferrer"
                   aria-label="Contactar por WhatsApp">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  +57 300 123 4567
                </a>

                <a href="mailto:hola@lilop.store"
                   class="footer__contact-item"
                   aria-label="Enviar email a Lilop">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  hola@lilop.store
                </a>

                <span class="footer__contact-item" style="cursor:default;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Lunes a sábado: 8am – 7pm
                </span>

              </div>
            </div>

          </div><!-- /footer__grid -->

          <!-- Barra inferior -->
          <div class="footer__bottom">
            <p class="footer__copy">
              © <span id="footerYear"></span> Lilop Store. Todos los derechos reservados.
            </p>
            <nav class="footer__legal" aria-label="Políticas legales">
              <a href="/contacto.html#privacidad" class="footer__legal-link">
                Política de privacidad
              </a>
              <a href="/contacto.html#terminos" class="footer__legal-link">
                Términos y condiciones
              </a>
              <a href="/contacto.html#cookies" class="footer__legal-link">
                Cookies
              </a>
            </nav>
          </div>

        </div><!-- /container -->
      </footer>
    `;
  }

  /* ─── AÑO AUTOMÁTICO ────────────────────────────────────── */
  initYear() {
    const yearEl = this.querySelector('#footerYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }
}

customElements.define('lilop-footer', LilopFooter);