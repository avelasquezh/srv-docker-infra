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
  como valores separados (ver `014_categorias_tipo.sql` del dominio
  categorias). Filtrar por "infantil" cuando el cliente pidió "niña"
  muestra diseños que no le sirven — hay que usar la categoría
  específica que el cliente nombró.
- Cada diseño tiene una sola imagen (`disenos.imagen`), no varias — lo
  de "3-4 imágenes" son 3-4 diseños distintos, no 3-4 fotos del mismo
  diseño.
- `catalogo_productos.diseno_principal_id` ya se usa en el resto del
  sistema (sitio público) para decidir qué diseño mostrar primero —
  se reutiliza el mismo criterio para el bot.
- **Patrón de envío de media en WhatsApp Cloud API:** Meta documenta
  explícitamente que el envío por `link` repetido para el mismo
  archivo, reutilizado en múltiples mensajes a distintos
  destinatarios (exactamente el caso de un diseño de catálogo), debe
  resolverse subiendo el archivo una vez al endpoint `/media` y
  reutilizando el `media_id` devuelto — el envío por `link` está
  documentado como "not recommended" para este patrón. El `media_id`
  expira a los 30 días desde que se subió (no desde el último uso),
  así que requiere lógica de refresco.

## Estado actual

- ✅ Migraciones `012`, `013` y `014` aplicadas/preparadas sobre
  `vista_catalogo_agente` y `disenos`:
  - `categorias` trae `nombre` + `slug`, para armar
    `https://lilop.store/catalogo.html?categoria={slug}`.
  - `disenos_disponibles` trae `id` + `nombre` + `imagen` + `principal`,
    excluye diseños sin imagen y viene ordenado con el principal
    primero.
  - `disenos` tiene columnas nuevas `meta_media_id` y
    `meta_media_subido_en` para cachear el media_id vigente de cada
    diseño (014, pendiente de aplicar en producción).
- ✅ Confirmado que `/uploads/disenos/*.webp` en `api.lilop.store` es
  público, sin auth — se usa como origen para subir la imagen al
  endpoint `/media` de Meta (ya no como destino final de envío).
- 🔧 Tool `enviar_diseno_whatsapp` creada en el AI Agent de n8n como
  HTTP Request Tool simple (envío directo por `link`) — **debe
  convertirse en un sub-workflow (Workflow Tool)** para soportar el
  patrón por `media_id` con refresco, ver spec abajo.
- ⏳ El system prompt del agente (`prompt_agente_lilop.md`, no
  versionado en este repo) todavía no tiene la regla de cuándo invocar
  la tool.

## Arquitectura decidida: envío por `media_id` con refresco automático

La lógica de "¿tengo un media_id vigente o necesito resubir la
imagen?" es determinística (comparar fechas) y **no debe delegarse al
modelo de IA** — vive en un sub-workflow de n8n que la tool del AI
Agent invoca como caja negra. El modelo solo decide "manda la foto del
diseño con id=X"; el sub-workflow decide cómo.

**Sub-workflow `Enviar Diseño WhatsApp` (Workflow Tool del AI Agent),
nodo por nodo:**

1. **Execute Workflow Trigger** — recibe como input `diseno_id` (del
   campo `id` en `disenos_disponibles`) y `numero_cliente`.
2. **Postgres — Leer diseño**: `SELECT id, nombre, imagen, meta_media_id, meta_media_subido_en FROM disenos WHERE id = {{ $json.diseno_id }}`.
3. **IF — ¿Necesita refresco?**: condición
   `{{ $json.meta_media_id == null || $json.meta_media_subido_en < $now.minus({days: 25}) }}`
   (25 días de margen antes de los 30 reales).
   - **Rama verdadera (refrescar):**
     a. **HTTP Request — Descargar imagen**: GET a
        `https://api.lilop.store{{ $json.imagen }}`, response como binary.
     b. **HTTP Request — Subir a Meta**: POST a
        `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/media`,
        `Content-Type: multipart/form-data`, campos
        `messaging_product=whatsapp`, `type=image/webp`, `file=`
        (binary del paso anterior). Header `Authorization: Bearer
        {TU_TOKEN_META}` (reutilizar credencial ya configurada).
     c. **Postgres — Actualizar cache**: `UPDATE disenos SET meta_media_id = {{ $json.id }}, meta_media_subido_en = NOW() WHERE id = {{ $('Postgres — Leer diseño').item.json.id }}`.
   - **Rama falsa (usar el que ya hay):** sigue directo con el
     `meta_media_id` ya guardado.
4. **Merge** — ambas ramas confluyen con un `media_id` vigente (el
   recién subido o el existente).
5. **HTTP Request — Enviar mensaje**: POST a
   `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`:
   ```json
   {
     "messaging_product": "whatsapp",
     "to": "{{ $json.numero_cliente }}",
     "type": "image",
     "image": { "id": "{{ $json.media_id }}", "caption": "{{ $json.nombre }}" }
   }
   ```

**Tool en el AI Agent** (la que el modelo ve y decide invocar): tipo
"Call n8n Workflow Tool" apuntando al sub-workflow anterior, con
descripción: *"Envía por WhatsApp la foto de UN diseño específico al
cliente actual, dado su id (campo 'id' de disenos_disponibles). Solo
úsala después de tener resuelto el producto exacto y cuando el cliente
haya pedido ver fotos. Llama una vez por cada diseño a enviar."*

## Próximo paso

1. Aplicar la migración `014` en producción (mismo procedimiento que
   `012`/`013`: `docker exec -i postgres psql -U postgres -d lilop <
   .../014_meta_media_id_disenos.sql`).
2. Reconstruir la tool `enviar_diseno_whatsapp` en n8n como el
   sub-workflow descrito arriba (hoy es un HTTP Request Tool simple
   por `link`, insuficiente para el patrón de `media_id`).
3. Redactar e insertar en `prompt_agente_lilop.md` la regla de
   comportamiento que fuerce la invocación cuando el cliente pida
   fotos y ya haya producto/segmento resuelto, y que arme el link del
   catálogo con `categoria={slug}` cuando no haya fotos que mandar.
4. Probar con los dos casos reales ya detectados (cliente pregunta por
   fotos sin dar segmento completo / cliente ya dio tamaño y target)
   para confirmar ejecución real, no solo la promesa de "déjame
   confirmar".
