# Lilop — Migración de esquema de productos/variantes (contexto para Claude)

> Este documento existe para que cualquier sesión nueva de Claude (u otra IA) recupere
> contexto completo sin tener que releer el historial del chat. Si estás leyendo esto
> al empezar una sesión nueva: lee todo este archivo antes de tocar código o BD, y
> actualiza tu memoria persistente con lo que aplique según tu propio sistema de memoria.

## 1. Rol que debe asumir Claude en este proyecto

Arquitecto de datos + backend, con responsabilidad de refactor incremental **sin romper
producción**. No es un proyecto de "escribir código nuevo desde cero" — es un rescate de
un sistema ya en producción, construido antes por otra instancia de Claude sin patrón ni
disciplina. Prioridades en orden:

1. Nunca romper lo que ya funciona (admin, sitio público, pedidos reales).
2. Todo cambio de esquema es **aditivo primero, corte después** (ver metodología, sección 5).
3. Nada de commits sin confirmación explícita del dueño del proyecto antes de push.
4. El código debe quedar reutilizable como arquetipo vendible (ver sección 3).

## 2. Repositorio y flujo de trabajo obligatorio

- Repo privado: `https://github.com/avelasquezh/srv-docker-infra`
- Este proyecto vive en `projects/lilop/` dentro del repo (hay otros proyectos hermanos
  en el mismo repo — no tocarlos salvo que se pida explícitamente).
- **Clonar:** `git clone https://<PAT>@github.com/avelasquezh/srv-docker-infra.git`
  (el dueño comparte el PAT cuando se le pide; suele revocarlo entre sesiones).
- **Después de cada push:** limpiar el token del remote con
  `git remote set-url origin https://github.com/avelasquezh/srv-docker-infra.git`
  — salvo que el dueño diga explícitamente que no hace falta esa vez.
- **Nunca hacer `git push` sin autorización explícita.** Flujo correcto: commits locales
  primero → el dueño confirma → se pide el PAT de nuevo si hace falta → push.
- El dueño **no tiene acceso de despliegue directo desde Claude** — el servidor real es
  otra máquina (`arley2911@serverpc`) donde él corre manualmente `git pull` +
  comandos `docker exec`/`docker compose restart`. Claude debe darle los comandos EXACTOS
  para copiar/pegar, nunca asumir que Claude puede ejecutarlos directo.
- Versionado de assets estáticos del admin (`?v=<hash>` en cada HTML, cache-busting vía
  Cloudflare): existe `projects/lilop/scripts/bump-asset-version.py`, que recalcula un
  hash md5 (8 chars) del contenido real de cada `.js`/`.css` y reescribe automáticamente
  las referencias en todos los `.html`. Correrlo tras cualquier commit que toque JS/CSS
  del admin — **no** incrementar un número a mano, no es ese el esquema.

## 3. Objetivo final del proyecto (más allá de "arreglar productos")

El dueño quiere que este desarrollo (ecommerce + dashboard admin + chatbot agente IA vía
n8n) termine siendo un **arquetipo vendible**: código genérico, reutilizable, sin nada
hardcodeado que delate que nació sobre un negocio de ropa de cama. Decisión ya tomada:

- **White-label single-tenant** (un deploy independiente por cliente, cada uno con su
  propia BD/dominio/instancia) — **NO** multi-tenant compartido. Esto ya se descartó
  explícitamente porque meter `tenant_id` en todo es un proyecto en sí mismo y se
  decidió no mezclarlo con el refactor de productos.
- Patrón arquitectónico: MVC (o el equivalente que aplique a Express/JS plano), con
  capas separadas: repositorio de acceso a datos → servicio/lógica de negocio →
  controller delgado → presentación.
- Principios aplicados deliberadamente: **SOLID** (adaptado a JS funcional/procedural,
  no forzando clases), + **DRY**, **separación de responsabilidades**, y **KISS/YAGNI**
  como contrapeso explícito para no sobre-diseñar (ej.: no se construye soporte
  multi-tenant "por si acaso").
- El refactor del **frontend** (admin JS + site JS, hoy monolítico sin módulos) es una
  **etapa aparte y posterior** (Etapa 6 del plan, sección 5) — no se toca mientras se
  trabaja el esquema de BD, precisamente para no mezclar dos riesgos distintos.

## 4. Estado real del código antes de esta migración (diagnóstico)

### 4.1 Dashboard admin (`projects/lilop/admin/html`)

HTML/CSS/JS plano, sin build step, servido por nginx (contenedor `lilop-admin`).
Cada página (`productos.html`, `cliente.html`, etc.) tiene su propio `.js` en
`assets/js/pages/`, con **20-30 funciones en scope global por archivo**, sin separar
fetch/estado/render/eventos (ej.: `cliente.js` tenía 1500 líneas planas). Esto es lo que
hace que cualquier tarea consuma muchísimo contexto/tokens — hay que leer casi todo el
archivo para entender el flujo. Migración de este frontend planeada para Etapa 6, con
ES Modules nativos (`<script type="module">`), sin meter build tooling nuevo.

### 4.2 API (`projects/lilop/api`)

Node/Express, sin ORM (queries `pg` directas en los controllers, sin capa de
repositorio — viola inversión de dependencias, se corrige en el refactor de service
layer que viene después del esquema).

**Hallazgo importante ya corregido:** existía una carpeta duplicada y muerta
`api/src/src/` (mirror completo de `api/src/`, no referenciada por `src/index.js`,
cruft de una sesión anterior). **Se eliminó** en el commit `be91760`.

**Convención de IDs de la BD** (ver `001_schema_inicial.sql`): TEXT PRIMARY KEY con
`DEFAULT '<PREFIJO>' || LPAD(nextval('<secuencia>')::TEXT, 4, '0')`. Ej.: `PD0001`
(pedidos), `CAT0032` (catálogo). Todo el esquema nuevo sigue esta misma convención
(`VAR`, `VVA`, `VTE`).

**Gotcha de `node-pg-migrate` (ya resuelto, pero importante para el futuro):**
- El script `npm run migrate` (`node-pg-migrate up -m src/db/migrations`) **no lee**
  las variables `DB_HOST`/`DB_USER`/`DB_PASS`/etc. que sí usa la app — necesita
  `DATABASE_URL`, que no está en el `.env`. Hay que construirla al vuelo:
  ```bash
  docker exec -it lilop-api sh -c 'DATABASE_URL="postgres://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME" npm run migrate'
  ```
- La migración `001_schema_inicial.sql` se había aplicado **manualmente por `psql`**
  en su momento, nunca quedó registrada en la tabla de control `pgmigrations`. Si en
  el futuro `npm run migrate` intenta re-ejecutar 001 y falla con
  `type "X" already exists`, la solución es insertar el registro a mano sin re-correr
  el contenido:
  ```sql
  INSERT INTO pgmigrations (name, run_on)
  SELECT '001_schema_inicial', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM pgmigrations WHERE name = '001_schema_inicial');
  ```
- Contenedores relevantes: `lilop-api` (Node, imagen `node:20-alpine`, `./src` montado
  como volumen — los archivos nuevos llegan solos con `git pull`, sin rebuild) y
  `postgres` (nombre confirmado del contenedor de BD, DB `lilop`, user `postgres`).

### 4.3 El problema original de datos (por qué se hizo esta migración)

El modelo viejo tenía **dos sistemas de "variación" desconectados entre sí**:

1. `atributos` + `atributo_opciones` — catálogo global de atributos con opciones,
   pero `catalogo_atributos` (el link a producto) solo indicaba "este producto usa
   este atributo", **sin** decir qué opción específica ni afectar precio/stock. Era
   descriptivo, no funcional.
2. `catalogo_precios` — el sistema real de variantes vendibles, pero hardcodeado a
   una sola dimensión (`tamanio`, texto libre), sin relación con `atributos`.

Esta ambigüedad (nombres de tabla que prometen algo que el esquema no cumple) es lo que
confundía al bot de IA (Claude Haiku 4 vía n8n) al intentar presentar productos al
cliente — no podía inferir relaciones que en la BD simplemente no existían.

**Estas 4 tablas viejas siguen existiendo intactas** (`catalogo_precios`, `atributos`,
`atributo_opciones`, `catalogo_atributos`) — no se tocan hasta la Fase 5 (corte).

También se identificó (no resuelto aún, ver sección 7) que `categorias` mezcla 4
taxonomías distintas en una lista plana: tipo de producto, material/línea comercial,
composición ("Combo"), y target/diseño (Niño/Niña/Unicolor/Con Diseño).

## 5. Metodología de migración (fases)

Disciplina acordada explícitamente con el dueño: **nunca modificar o borrar algo que
funciona hasta confirmar que el reemplazo funciona.** Ir por clones/tablas nuevas, no
por edición en sitio.

1. **Descubrimiento (solo lectura)** — consultas SQL de solo lectura para conocer datos
   reales (productos, precios, atributos en uso). ✅ Completado.
2. **Diseño del esquema nuevo (en papel)** — sin tocar BD. ✅ Completado (ver sección 6).
3. **Construcción por clon** — tablas nuevas junto a las viejas + backfill desde datos
   reales. ✅ **Completado y corrido en producción** (ver sección 6.3 para el estado
   exacto). El API viejo sigue funcionando exactamente igual — el contrato JSON que
   consumen admin/site no cambia todavía.
4. **Validación en paralelo** — ✅ Completado para los endpoints del bot: verificado
   contra producción vía Cloudflare, schema exacto confirmado (sección 7bis), sin
   campo `disponible` (no aplica, ver 6.3). Pendiente aún para el resto de la fase:
   exponer/leer desde los controllers viejos (`productos.js`, `catalogo.js`) el
   esquema nuevo — eso sigue sin tocarse.
5. **Corte (cutover)** — 🔲 Pendiente. Los controllers pasan a usar el esquema nuevo
   como fuente de verdad; el viejo queda de solo respaldo.
6. **Limpieza** — 🔲 Pendiente. Drop de tablas viejas + de los `.bak`/`.bak2`
   versionados en git que existen hoy en `admin/html/assets/`.

**Etapa 6, aparte y posterior a todo lo anterior — Frontend:** refactor de admin JS +
site JS a ES Modules, una vez el esquema nuevo esté ya en corte y estable.

## 6. Esquema de datos nuevo (definitivo, ya implementado)

### 6.1 Decisión de diseño

Se evaluaron 4 patrones de industria antes de decidir (dejar registro por si se
reconsidera):
1. EAV acotado relacional puro (catálogo global + scope por producto vía tabla de
   subconjunto permitido) — el elegido.
2. JSONB de atributos sin catálogo de valores — más simple, pierde integridad
   referencial.
3. Patrón "Shopify" (`option1/2/3` fijos en la tabla de variantes) — más rígido,
   límite artificial de 3 ejes.
4. El modelo viejo roto (descartado, es el problema original).

**Se eligió un híbrido de 1 y 2:** catálogo relacional normalizado como fuente de
verdad (lo que edita el admin, con integridad referencial real vía FKs) + una columna
`atributos_resueltos JSONB` en `variantes`, generada por trigger de Postgres, que
aplana todo a un JSON de solo lectura sin joins — pensada específicamente para que el
bot de n8n (y cualquier endpoint público) la consuma directo, sin reconstruir nada.

### 6.2 Tablas (migración `api/src/db/migrations/002_variables_variantes.sql`)

```
variables            (id TEXT 'VARnnnn', nombre UNIQUE, tipo ENUM('lista','booleano'),
                       sobreprecio NUMERIC — solo aplica a tipo booleano, activo, timestamps)

variable_valores     (id TEXT 'VVAnnnn', variable_id FK, valor TEXT, orden INTEGER,
                       UNIQUE(variable_id, valor))
                      -- catálogo GLOBAL de valores, solo para variables tipo 'lista'

producto_variables   (producto_id FK -> catalogo_productos, variable_id FK -> variables,
                       valores_permitidos TEXT[] -- IDs de variable_valores, NULL si booleano,
                       PK(producto_id, variable_id))
                      -- qué variables usa cada producto Y qué subconjunto de la lista
                      -- global le aplica específicamente a ese producto

variantes            (id TEXT 'VTEnnnn', producto_id FK,
                       valores JSONB    -- {"<variable_id>":"<variable_valor_id>"} solo tipo lista
                       booleanos JSONB  -- {"<variable_id>": true|false} solo tipo booleano
                       atributos_resueltos JSONB -- GENERADO POR TRIGGER, nunca editar a mano
                       sku UNIQUE, precio NUMERIC, stock INTEGER, activo, timestamps)
```

Trigger `trg_resolver_atributos_variante` (`BEFORE INSERT OR UPDATE OF valores,
booleanos ON variantes`) reconstruye `atributos_resueltos` resolviendo los IDs contra
`variables`/`variable_valores` cada vez. La capa de aplicación **nunca** escribe ese
campo directamente.

### 6.3 Datos reales del negocio ya modelados (backfill corrido y confirmado en prod)

- **Material NO es variante.** Microfibra/Venus/Yakar tienen escalas de precio base
  totalmente distintas entre sí (confirmado con precios reales) — son líneas de
  producto/catálogo separadas, tal como ya estaban. No se creó variable "Material".
- **Única variable tipo `lista`:** `Tamaño` — valores globales: Único, Sencillo,
  Semidoble, Doble, Queen, King. Cada producto habilita el subconjunto real que vende
  (ej.: Cortinas solo "Único"; Edredones los 5 tamaños de cama).
- **Dos variables tipo `booleano`, independientes y combinables de a una por vez**
  (nunca ambas activas en la misma variante — confirmado explícitamente con el dueño):
  - `Plumón (extragrueso)` — sobreprecio $20.000
  - `Piel de conejo (una cara)` — sobreprecio $25.000
  - Solo aplican a 8 productos: Edredones acolchados y sus Combos (Combo = producto
    catálogo aparte con sábanas incluidas, **no** es bundle ni variante, es un producto
    distinto con su propio precio base).
- **Almohadas y Sábanas/Duvets/Cortinas/Colcha** con tamaño único no seleccionable
  (ej. `CAT0037` Almohada) quedan con `atributos_resueltos = {}` — sin nada que
  preguntarle al cliente.
- Resultado del backfill ya verificado en producción: 3 variables, 6 variable_valores,
  37 filas de producto_variables, **169 variantes**. Verificado con query real que
  `atributos_resueltos` resuelve limpio, ej. para `CAT0032`:
  `{"Tamaño": "Doble", "Plumón (extragrueso)": true}` → precio 155000.
- **No hay stock real trackeado en el negocio** (confirmado con el dueño: productos
  hechos sobre pedido). El sistema viejo hardcodea `stock: 'available'` en
  `controllers/catalogo.js` — no hay columna ni dato real de inventario que migrar.
  `variantes.stock` quedó en su default `0` porque no hay fuente de la que
  poblarlo; **no representa falta de disponibilidad**. El contrato del bot
  (sección 7bis) no expone ni usa este campo por esta misma razón.

### 6.4 Script de backfill

`api/src/db/backfill_variables_variantes.js` — idempotente (usa `ON CONFLICT`), lee
`catalogo_precios` + `atributos` (tipo booleano) + `catalogo_atributos` existentes y
puebla el esquema nuevo. No modifica ni borra las tablas viejas. Ya corrido
exitosamente contra la BD real de producción (`docker exec -it lilop-api node
src/db/backfill_variables_variantes.js`).

## 7bis. Contrato de respuesta del bot (endpoints nuevos, ya implementados)

Endpoints públicos sin autenticación, aditivos (una sola línea nueva en
`index.js`, ningún controller/ruta existente tocado):

- `GET /api/public/bot/productos` — catálogo completo activo.
- `GET /api/public/bot/productos/:id` — un producto por `catalogo_id` (ej. `CAT0032`).

Capa nueva `repositories/productosBot.js` → `services/productosBot.js` →
`controllers/productosBot.js` — primera separación real repositorio → servicio →
controller del proyecto; es el patrón a replicar en el corte real de Fase 5.

**Schema exacto de respuesta** (mismo shape en ambos endpoints; el segundo
devuelve un objeto suelto, el primero un array de estos objetos):

```json
{
  "id": "CAT0032",
  "nombre": "Edredón Unicolor",
  "descripcion": "texto corto o null",
  "variables": [
    { "nombre": "Tamaño", "tipo": "lista", "valores": ["Sencillo", "Doble", "Queen", "King", "Semidoble"] },
    { "nombre": "Plumón (extragrueso)", "tipo": "booleano", "valores": null },
    { "nombre": "Piel de conejo (una cara)", "tipo": "booleano", "valores": null }
  ],
  "variantes": [
    { "id": "VTE0139", "atributos": {"Tamaño": "Sencillo"}, "precio": 125000 },
    { "id": "VTE0141", "atributos": {"Tamaño": "Sencillo", "Plumón (extragrueso)": true}, "precio": 145000 }
  ]
}
```

Nombres reales en `variables`/`atributos` (nunca IDs internos VAR/VVA/VTE
expuestos salvo el `id` de la variante, necesario para referenciar el pedido).
El precio en `variantes[].precio` ya viene calculado (incluye sobreprecio de
booleanos) — el bot **nunca** debe sumar ni inferir precio por su cuenta.

**Las 7 reglas de comportamiento para el prompt del nodo de IA en n8n:**

1. Presentar siempre el `nombre` del producto y su `descripcion`, nunca el `id`
   interno (CAT/VTE/VAR), salvo que el cliente ya vaya a confirmar un pedido y
   se necesite referenciar la variante exacta.
2. Antes de dar un precio, preguntar por cada variable de tipo `lista` que
   tenga más de un valor en `valores` (ej. Tamaño) — nunca asumir un valor.
3. Para variables tipo `booleano`, ofrecerlas como upgrade opcional
   ("¿lo quieres con Piel de conejo por $X más?"), nunca como pregunta
   obligatoria si el producto no las tiene.
4. Si `variables` viene vacío, el producto no tiene nada que preguntar — dar
   el precio de la única variante en `variantes` directamente.
5. Nunca combinar dos variables booleanas en la misma variante — el negocio
   no vende esa combinación (confirmado: son mutuamente excluyentes).
6. **No existe stock real trackeado** (confirmado con el dueño: todo es hecho
   sobre pedido) — el campo `stock` de `variantes` no se usa ni se expone;
   toda variante que aparece en la respuesta se asume disponible siempre.
   No preguntar por disponibilidad ni condicionar la respuesta a `stock`.
7. Nunca inventar productos, variantes ni precios que no vengan en la
   respuesta del endpoint — si el cliente pide algo que no aparece en
   `/api/public/bot/productos`, decir que no está disponible, no improvisar.

## 7quater. Migración a POO/SOLID (arrancada — dominio `productos` como referencia)

Decisión del dueño: migrar el backend de estilo funcional a **POO real** (clases JS
con `class`/`extends`, instancias inyectadas por constructor), SOLID/DRY aplicado
literalmente. Alcance acordado: **un dominio primero como referencia, el resto se
migra después, uno a la vez** — nunca todo el API de golpe.

**Dominio de referencia: `productos`** — se reescribió la versión funcional
(`repositories/services/controllers/productosBot.js`) a clases, sin cambiar ni una
query ni el contrato de salida (validado con mocks: shape idéntico al de 7bis).

### Estructura del patrón (a replicar en cada dominio futuro)

```
api/src/
├── core/                        -- clases base compartidas por TODOS los dominios
│   ├── BaseRepository.js        -- pool inyectado, wrapper de query()
│   ├── BaseService.js           -- repos inyectados por nombre, sin saber de HTTP
│   └── BaseController.js        -- try/catch centralizado (this.handle(fn))
└── domains/
    └── productos/
        ├── ProductoRepository.js -- extends BaseRepository — SQL puro
        ├── ProductoService.js    -- extends BaseService — arma el contrato de salida
        ├── ProductoController.js -- extends BaseController — HTTP puro
        └── productos.routes.js   -- composition root: instancia todo con DI real
```

Los ~13 dominios restantes (usuarios, clientes, pedidos, compras, comisiones,
entregas, costos_pedido, disenos, domicilio, imagenes, maestros, auth, demo) **siguen
en `controllers/`/`routes/` planos, sin tocar**, hasta decidir migrarlos uno a uno.

### Principios aplicados literalmente

- **S:** Repository=solo SQL, Service=solo forma/reglas de negocio, Controller=solo HTTP.
- **O:** `BaseController.handle()` centraliza try/catch; se extiende la base, no se
  edita cada hijo.
- **L:** cualquier repo que extienda `BaseRepository` es intercambiable donde se
  espere uno.
- **I:** cada dominio expone solo los métodos que su consumidor necesita.
- **D (el más literal):** pool/repos/services se inyectan por constructor desde el
  *composition root* (`productos.routes.js`) — ninguna clase importa Postgres
  directo. Probado real: `ProductoRepository` instanciado con un pool falso
  (`{query: async () => ({rows:[]})}`) funcionó sin tocar Postgres.
- **DRY:** el try/catch duplicado en los ~13 controllers viejos ahora vive en un
  solo lugar (`BaseController.handle`).

### Wiring en `index.js`

```js
app.use('/api/public/bot', require('./domains/productos/productos.routes'));
```

### Validado antes de commitear (sin tocar Postgres real)

Router carga sin errores de require; instanciación completa con pool falso;
`ProductoService._formatear()` probado contra una fila de ejemplo real (CAT0032,
Sencillo+Plumón) — salida byte a byte igual al contrato de la sección 7bis.

### Rollout a los demás dominios

**`domicilio` — ✅ migrado.** El más pequeño (19 líneas) y el más aislado: no toca
Postgres en absoluto, solo reenvía a un webhook externo de n8n. Decisiones de diseño:

- `DomicilioRepository` **no extiende `BaseRepository`** — ese contrato envuelve
  `pool.query` (SQL); forzar la herencia aquí habría violado Sustitución de Liskov
  (un cliente HTTP no es intercambiable por un pool de Postgres). Se aplicó
  Inversión de Dependencias a mano: `fetch` y la URL del webhook se inyectan por
  constructor.
- **Primer paso del des-hardcodeo (sección 3/8):** la URL `https://n8n.autokore.space/
  webhook/envwdomlilop` (con "lilop" hardcodeado en el path, apuntando además a un
  dominio de *otro* proyecto del mismo servidor) ahora sale de `DOMICILIO_WEBHOOK_URL`,
  con ese mismo valor como default — comportamiento idéntico si la env var no se
  configura. **Pendiente:** decidir si ese webhook de n8n de `autokore.space` es
  compartido a propósito entre proyectos o es un remanente que debería vivir en
  `n8n.lilop.store` — no se tocó, solo se sacó de código a configuración.
- **Cambio de comportamiento consciente y documentado:** el mensaje de error pasó de
  `"Error al enviar al webhook"` (texto custom del controller viejo) a `"Error interno
  del servidor"` (genérico de `BaseController.handle`), mismo código 500. Se prefirió
  consistencia entre dominios sobre preservar un texto arbitrario que ningún consumidor
  (es un endpoint interno del admin, no público) depende de leer.
- Validado con `fetch` falso (happy path: `{ok:true}` y payload reenviado idéntico;
  caso de error: 500 con el nuevo mensaje genérico), sin tocar red ni Postgres real.
- Ruta sin cambios: sigue anidada en `routes/pedidos.js` (`POST /api/pedidos/:id/
  domicilio-webhook`, con `auth`), ahora vía `router.use(require('../domains/domicilio/
  domicilio.routes'))` en vez de importar el controller funcional directo.

Mismo patrón para los ~12 dominios restantes: crear `domains/<nombre>/{Repository,
Service,Controller,routes}.js` (extendiendo las bases del `core/` **solo cuando el
contrato realmente aplica** — ver el caso `domicilio` como ejemplo de cuándo NO
heredar), validar con mocks, montar en `index.js`/router padre con una línea, y
**recién ahí** borrar el controller/route viejo.
Sugerencia de orden (no decidido): siguientes candidatos simples/aislados —
`imagenes`, `maestros`, `auth` — antes que los que tienen triggers de Postgres detrás
(`pedidos`, `comisiones`, `costos_pedido`).

**`imagenes` — ✅ migrado.** Sin Postgres (filesystem + `sharp`), mismo criterio que
`domicilio`: `ImagenRepository` no extiende `BaseRepository` (Liskov), `sharp`/`fs`
inyectados por constructor. Validaciones de forma (archivo faltante, extensión,
nombre de archivo inseguro) viven en el controller como decisiones HTTP directas
—mismo patrón que `notFound()`—, no en el `try/catch` genérico de `handle()`
(pensado para errores inesperados de I/O, no para validación de entrada).
Des-hardcodeo: directorio de uploads sale a `IMAGENES_UPLOADS_DIR`, con el valor
actual (`/app/uploads/disenos`) como default. Validado con `sharp`/`fs` falsos:
los 5 casos (sin archivo, extensión inválida, happy path, filename inseguro,
eliminar ok) devuelven exactamente el mismo status/mensaje que el controller viejo
— sin ningún cambio de comportamiento esta vez, ni siquiera en errores.

## 7ter. Pendientes explícitos para la siguiente sesión

1. **Migrar el resto de dominios a POO/SOLID** (sección 7quater) — `domicilio` e
   `imagenes` ya migrados. Siguientes candidatos simples: `maestros`, `auth`.
2. **Fase 4-5 de la metodología** — exponer el esquema nuevo en paralelo al viejo desde
   el API (ya arrancado con el dominio `productos`), validar, y solo después hacer
   el corte real en los controllers existentes (`productos.js`, `catalogo.js`, etc.).
   Ningún controller viejo fue tocado todavía.
3. **Conectar los endpoints al nodo de IA en n8n** — endpoints, contrato y validación
   en producción ya cerrados (secciones 7bis y 5-Fase 4); falta configurar el nodo
   HTTP en el workflow de n8n y pegar las 7 reglas en el prompt del agente. Explícito:
   el dueño pidió dejar esto para el final, después de cerrar la migración a POO/SOLID.
4. **Limpieza de `categorias`** — separar las 4 taxonomías mezcladas (tipo, material,
   composición, target/diseño). No bloqueante, marcado explícitamente como fase aparte.
5. **Etapa 6 (frontend)** — refactor de admin JS + site JS a ES Modules, solo después
   de que el esquema nuevo esté en corte y estable.
6. ~~Eliminar los `.bak*` versionados en git~~ — ✅ Completado.
7. **Limpieza final** — drop de `catalogo_precios`/`atributos`/`atributo_opciones`/
   `catalogo_atributos`, solo tras confirmar que ya no se necesitan para rollback.

## 8. Reglas de conducta que deben seguir aplicando

- Nunca hacer push sin confirmación explícita.
- Nunca mezclar dos riesgos en el mismo cambio (ej.: esquema de BD + refactor de
  frontend al mismo tiempo).
- Todo cambio de esquema es aditivo hasta que se confirme el corte.
- No hardcodear nada específico del negocio de ropa de cama en código nuevo — pensar
  siempre en términos del arquetipo genérico vendible.
- Preferir preguntar antes de asumir en decisiones de modelo de datos (el dueño ya
  corrigió varias veces suposiciones de diseño que parecían razonables pero no
  correspondían a la realidad del negocio — ej. Plumón no era parte del grupo de
  telas, era un flag independiente ya implementado en el front).
