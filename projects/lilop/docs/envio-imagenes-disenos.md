# Envío de fotos de diseños por el agente de WhatsApp

## Objetivo

Que el agente de IA en WhatsApp pueda enviarle al cliente fotos reales
de los diseños disponibles (edredones, sábanas, etc.) en vez de solo
describirlos por texto o mandarlo a buscar por su cuenta en el sitio.
Motivado por conversaciones reales perdidas donde el cliente pidió
fotos explícitamente y el bot nunca resolvió esa parte del mensaje —
mismo patrón que el "conversion killer" ya documentado (responder sin
cerrar el turno con una micro-acción hacia la venta).

## Hallazgos de negocio/datos que definen el diseño

- `vista_catalogo_agente` está scoped **por producto**
  (`catalogo_productos`), no por categoría — los diseños cuelgan del
  producto vía `disenos_catalogo_productos`. El agente necesita
  resolver el producto específico (no solo la categoría genérica)
  antes de poder mandar fotos con sentido.
- `categorias.tipo = 'target'` distingue `Infantil`, `Niño` y `Niña`
  como valores separados (ver `014_categorias_tipo.sql`). Filtrar por
  "infantil" cuando el cliente pidió "niña" muestra diseños que no le
  sirven — hay que usar la categoría específica que el cliente nombró.
- Cada diseño tiene una sola imagen (`disenos.imagen`), no varias — lo
  de "3-4 imágenes" son 3-4 diseños distintos, no 3-4 fotos del mismo
  diseño.
- `catalogo_productos.diseno_principal_id` ya se usa en el resto del
  sistema (sitio público) para decidir qué diseño mostrar primero —
  se reutiliza el mismo criterio para el bot.

## Estado actual

- ✅ Migraciones `012` y `013` aplicadas en producción sobre
  `vista_catalogo_agente`:
  - `categorias` ahora trae `nombre` + `slug` (antes solo nombre), para
    poder armar `https://lilop.store/catalogo.html?categoria={slug}`.
  - `disenos_disponibles` ahora trae `nombre` + `imagen` + `principal`
    (booleano, `true` si es el diseño principal del producto),
    excluye diseños sin imagen (`d.imagen IS NOT NULL`) y viene
    ordenado con el principal primero.
- ✅ Confirmado que `/uploads/disenos/*.webp` en `api.lilop.store` es
  público, sin auth, servido por Express antes de cualquier
  middleware — válido para enviarlo como `link` directo a la Meta
  Cloud API (`https://api.lilop.store` + la ruta relativa guardada en
  `disenos.imagen`).
- 🔧 Se creó una tool nueva en el AI Agent de n8n para que el modelo
  pueda disparar el envío de una imagen — **detalles exactos (tipo de
  nodo, título, descripción, query/body) aún sin confirmar/documentar
  aquí**, pendiente de que Arley los comparta para poder validarlos y,
  si hace falta, corregir el filtro (ej. que use la categoría
  específica pedida por el cliente, no una genérica).
- ⏳ El system prompt del agente (`prompt_agente_lilop.md`, no
  versionado en este repo) todavía **no tiene la regla** que le indique
  cuándo invocar la tool ni cómo armar el link del catálogo con el
  slug correcto. Confirmado con un caso real: el bot dijo "déjame
  confirmar qué diseños tenemos" y cerró el turno sin ejecutar nada,
  y además ofreció el link roto `lilop.store/catalog` (sin `.html` ni
  `?categoria=`) pidiéndole al cliente que filtre él mismo.

## Próximo paso

1. Confirmar con Arley la configuración exacta de la tool ya creada en
   n8n (tipo de nodo, título/descripción que lee el modelo, query o
   body configurado).
2. Ajustar esa tool si hace falta (ej. filtrar por el `target`
   específico — niño/niña — en vez de "infantil" genérico).
3. Redactar e insertar en `prompt_agente_lilop.md` la regla de
   comportamiento que fuerce la invocación de la tool cuando el
   cliente pida fotos y ya haya producto/segmento resuelto, y que
   arme el link del catálogo con `categoria={slug}` en vez de mandar
   al cliente a filtrar manualmente.
4. Probar en una conversación real equivalente a los dos casos ya
   detectados (cliente pregunta por fotos sin dar segmento completo /
   cliente ya dio tamaño y target) para confirmar que el bot ejecuta
   la tool y no solo la menciona.
