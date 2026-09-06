# Lilop — Migración de esquema de productos/variantes (contexto para Claude)

> Este documento existe para que cualquier sesión nueva de Claude (u otra IA) recupere
> contexto completo sin tener que releer el historial del chat. Si estás leyendo esto
> al empezar una sesión nueva: lee todo este archivo antes de tocar código o BD, y
> actualiza tu memoria persistente con lo que aplique según tu propio sistema de memoria.
>
> **Si eres un agente orquestador que solo necesita saber qué está hecho y verificado**
> (sin ejecutar código tú mismo), ve directo a la sección 8 — es la fuente de verdad
> de qué está confirmado en producción vs. qué es solo código sin probar en vivo.

## 0. Identificación de agentes trabajando en paralelo en este proyecto

El dueño está coordinando **varias sesiones de Claude en paralelo** sobre este mismo
repo, cada una con una tarea que **no se cruza en archivos** con las demás (para poder
commitear/pushear todas sin conflictos de merge). Estado real a la fecha de esta
entrada (verificar la tabla de la sección 8 para el detalle más actualizado):

- **Agente 1** — migración de los dominios backend a POO/SOLID, uno a la vez (sección
  7ter/7quater). Toca `controllers/`, `domains/<dominio>/`, `routes/`, `index.js`.
  Pausado por límite de tokens en algún punto; Agente 2 retomó parte de su cola.
- **Agente 2** — retomó la cola de Agente 1 (dominio `auth`), corrigió un bug
  bloqueante que Agente 1 dejó (`index.js` con import roto tras eliminar
  `controllers/maestros.js`), confirmó deploys reales en producción, e hizo un
  análisis del estado del frontend (Etapa 6). Ver entradas #12-17 de la sección 8.
  **Ahora (anuncio antes de empezar, tras `git pull`):** encontré un bug real en
  producción — `controllers/costos_pedido.js` (`agregarComision`/
  `listaVendedoresComision`) inserta/lee una columna `nombre_vendedor` que **nunca
  existió** en `comisiones` (confirmado con `grep` sobre las dos migraciones). El
  frontend (`cliente.js`/`pedidos.js`) sí llama activamente a este endpoint — no es
  código muerto, es una feature rota hoy. Confirmé con el dueño la intención real:
  **la comisión pasa a ser 100% manual desde el front; el sistema automático por
  `%`/`vendedor_id` (trigger `fn_recalc_pedido_comision`) queda obsoleto.** Voy a
  tocar: nueva migración SQL (`003_comision_manual.sql`, aditiva sobre `comisiones`
  + `DROP TRIGGER`), y `controllers/costos_pedido.js` (fix de `agregarComision`/
  `eliminarComision` con rollup a `pedidos.comision`, mismo patrón que
  `agregarDomicilio`/`eliminarDomicilio`). **No toco** `domains/comisiones/`
  (dominio de listado admin ya migrado por Agente 1, sin frontend que lo use hoy —
  quedará con `vendedor_id` nullable tras la migración, apuntado como pendiente de
  revisión, no lo arreglo en este cambio para no mezclar riesgos) ni `pedidos.js`
  más allá de lo estrictamente necesario.
- **Agente 3** (yo, en esta sesión) — construir la suite de tests real (`api/tests/`,
  `node --test`, sin dependencias nuevas) que formaliza las validaciones ad-hoc con
  mocks que hasta ahora solo vivían en mensajes de commit. Cero superposición de
  archivos con Agente 1/2: solo agrega `tests/` + una línea en `package.json`.
  Elegido explícitamente en vez de "limpieza de categorías" porque esa lógica vive en
  `controllers/maestros.js`, tocado por la migración de `maestros`.

**Nota de coordinación real:** esta sesión se auto-identificó primero como "Agente 2"
sin saber que esa identidad ya estaba activa (el dueño no lo mencionó explícitamente
al asignar la tarea) — se corrigió a Agente 3 al hacer `git pull`/rebase antes de
pushear y encontrar el choque de numeración. **Lección para la próxima sesión que
reciba una tarea nueva de este tipo: siempre hacer `git pull` y leer la sección 8
completa ANTES de auto-asignarse un número de agente**, no asumir que se es el
segundo solo porque el dueño dijo "otro agente".

Si se suma un agente nuevo, agregarlo aquí con su tarea y confirmar primero (vía
`git pull` + lectura de la sección 8) que no toca archivos de los demás antes de
arrancar.

### Trabajo del Agente 3 (esta sesión) — completado

`api/tests/` con `node:test` (nativo desde Node 18, cero dependencias nuevas):
- `tests/core.test.js` — `BaseRepository`/`BaseService`/`BaseController`.
- `tests/domains/productos.test.js` — regresión congelada contra el contrato de 7bis
  (fila real CAT0032), incluye caso de error de BD (500, no propaga excepción).
- `tests/domains/domicilio.test.js` — `fetch` falso, incluye caso de webhook caído.
- `tests/domains/imagenes.test.js` — `sharp`/`fs` falsos, los 5 casos ya mencionados
  en el commit `40c7d04` del Agente 1, ahora como test automatizado y no solo prosa.
- `package.json`: `"test": "node --test tests/*.test.js tests/domains/*.test.js"`
  (glob explícito, no la carpeta sola — `node --test tests/` falla por una rareza de
  este entorno de contenedor; el glob es más portable, correrlo así también en CI si
  algún día se agrega).
- **Resultado real corrido:** `npm test` → **35/35 tests, 12 suites, 0 fallos.**
- Esto también cierra parcialmente la nota de la entrada #5 de la tabla de la sección
  8 (dominio `productos` sin confirmar): ahora hay una regresión automatizada que
  fallaría si alguien rompe el contrato sin querer — sigue sin ser lo mismo que un
  `curl` contra producción real, pero es una red de seguridad real que antes no existía.

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
**`usuarios` — ✅ migrado.** CRUD admin puro sobre Postgres, sin tablas legacy.
`UsuarioRepository` de este dominio es **distinto** del `UsuarioRepository` del
dominio `auth` (mismo table `usuarios`, bounded context diferente: CRUD admin vs.
login/vendedores) — evita que un solo repositorio termine haciendo de "god class"
para dos responsabilidades no relacionadas. `bcrypt` inyectado por constructor en
`UsuarioService`, mismo criterio que `AuthService` (Agente 2). Duplicado de email
(`23505`) traducido a `EmailDuplicadoError` de dominio. Validado con pool/bcrypt
falsos: listar, 404 en obtener/actualizar/eliminar, `toTitleCase` en creación,
validación de nombre/password requeridos, duplicado — todos idénticos al
controller viejo.

**`demo` — ✅ migrado.** Dominio de la demo guiada (Azure DevOps + webhook n8n),
sin `auth` (igual que antes, rutas públicas). `fetch` y `webhookUrl` inyectados
por constructor en `DemoService` (mismo criterio que `DomicilioRepository`); la
URL ya venía de env var (`N8N_DEMO_WEBHOOK`, no hardcodeada) — no requirió
des-hardcodeo adicional. El disparo al webhook sigue siendo fire-and-forget a
propósito (no bloquea la respuesta), igual que el controller viejo. Validado con
pool/`fetch` falsos: validación de campos requeridos, creación con steps
iniciales, disparo correcto del payload al webhook, 404 en estado/paso
inexistente, actualización de paso — idéntico al controller viejo.

**`atributos` — deliberadamente NO migrado.** Opera sobre las tablas legacy
(`atributos`, `atributo_opciones`, `catalogo_atributos`) que la Fase 6 de este
mismo MD marca para eliminar una vez se complete el corte al esquema nuevo de
`variables`/`variable_valores`/`producto_variables`. Migrar este dominio a POO
ahora sería invertir esfuerzo en código con fecha de caducidad ya decidida —
queda fuera del rollout hasta que se decida su destino real (¿se elimina sin
más, o alguna consulta necesita puentear al esquema nuevo primero?).

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

**`maestros` — ✅ migrado.** Primer dominio con Postgres real desde `productos`
(4 catálogos: `origenes_venta`, `conceptos_costo`, `conceptos_compra`,
`categorias`). Decisión de diseño: `CatalogoSimpleRepository` genérico
parametrizado por tabla para los 3 catálogos idénticos en forma (`id`, `nombre`)
— DRY sin forzar `categorias` (que tiene `slug`/`activo`/`actualizar`) dentro del
mismo molde (habría sido mal uso de la generalización). Duplicados de Postgres
(`23505`) se traducen a un `RegistroDuplicadoError` de dominio en el service —
el controller nunca conoce el código de Postgres, solo hace `instanceof`.
**Inconsistencia preexistente preservada a propósito:** `crearConceptoCompra`
valida `!nombre` sin `.trim()` (acepta nombre solo-espacios), a diferencia de
`crearOrigen`/`crearConcepto` que sí exigen `.trim()`. Es un bug real del código
viejo, pero corregirlo aquí habría mezclado un fix de negocio con el refactor de
arquitectura — queda anotado para decidir aparte. Validado con pool falso: 13
endpoints, incluyendo duplicado de Postgres en dos rutas distintas, idénticos al
controller viejo.

## 7ter. Pendientes explícitos para la siguiente sesión

1. **Migrar el resto de dominios a POO/SOLID** (sección 7quater) — `domicilio`,
   `imagenes`, `maestros`, `auth`, `comisiones`, `entregas`, `disenos`, `usuarios` y
   `demo` migrados **y confirmados en producción** (ver sección 8, incluyendo el
   incidente #26 ya resuelto). El dominio `productos` **solo cubre la porción
   bot/lectura** (`/api/public/bot/*`) — el CRUD admin real
   (`controllers/productos.js`) sigue sin migrar. `atributos` deliberadamente fuera
   del rollout (tablas legacy con fecha de caducidad, ver 7quater). Restantes:
   `clientes`, `compras`, `pedidos_publicos`, el CRUD completo de `productos`, y los
   de mayor riesgo por tener triggers de Postgres detrás (`pedidos`,
   `costos_pedido`) + el corte real de `catalogo` (admin, ligado a la Fase 5).
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

## 8. Registro de verificación por agente (para el orquestador)

> **Aclaración importante (Agente 1, tras `git pull` de sincronización):**
> `domains/productos/` cubre **solo** los endpoints de solo lectura para el bot
> (`/api/public/bot/productos[/:id]`). El CRUD real de productos usado por el admin
> y el site (`listar/crear/actualizar/eliminar/catalogo`, montado en
> `/api/productos` vía `routes/productos.js`) **sigue en `controllers/productos.js`,
> sin migrar**. No es código muerto — `index.js` y `routes/productos.js` lo siguen
> importando activamente. Cualquier agente que lea "productos ✅ migrado" en este
> documento debe entender que es solo la porción bot/lectura, no el dominio completo
> de administración de productos — ese CRUD sigue pendiente como tarea propia.
>
> Esta sección existe para que un agente orquestador (u otra sesión de Claude) sepa
> el estado **real y verificado** de cada pieza sin releer el chat ni el resto del MD.
> Formato fijo por entrada — no narrativo. Se agrega una entrada por commit relevante,
> nunca se edita una entrada ya escrita (si algo cambia, se agrega una entrada nueva
> que lo referencia). "Verificado" = probado en producción o con mocks, no solo "código
> escrito".

| # | Agente | Commit | Qué | Código | Deploy prod | Prueba | Resultado |
|---|--------|--------|-----|--------|-------------|--------|-----------|
| 1 | Agente 1 | `ffec9c6` | Endpoints bot `/api/public/bot/productos[/:id]` (reconstrucción de `1d0adcd`, perdido) | ✅ | ✅ | curl vía Cloudflare | ✅ schema correcto |
| 2 | Agente 1 | `85648ab` | Limpieza 45 `.bak*` en admin/api/site | ✅ | N/A (no requiere deploy) | git status limpio | ✅ |
| 3 | Agente 1 | `5fcb031` | Fix: quitar `disponible`/`stock` del contrato del bot (negocio no trackea stock real) | ✅ | ✅ | curl directo al contenedor + vía Cloudflare | ✅ campo eliminado, resto intacto |
| 4 | Agente 1 | `4e7ed6f` | Docs: cerrar Fase 4 (validación) para endpoints del bot | ✅ (solo docs) | N/A | N/A | ✅ |
| 5 | (otro agente/sesión) | `5df9fb0` | Migración dominio `productos` a POO/SOLID (caso de referencia) | ✅ | ✅ **confirmado por Agente 1** | mocks (pool falso, otra sesión) + curl real vía Cloudflare (`/api/public/bot/productos/CAT0032`, Agente 1) | ✅ schema correcto en vivo, dominio cerrado |
| 6 | Agente 1 | `95e31ff` | Migración dominio `domicilio` a POO/SOLID + des-hardcodeo webhook a `DOMICILIO_WEBHOOK_URL` | ✅ | ✅ | `fetch` falso (happy path + error) + `curl -X POST` sin token en prod → `401` (confirma ruta montada y `auth` activo) | ✅ Cambio consciente: mensaje de error genérico en vez de custom (mismo 500) |
| 7 | Agente 1 | `40c7d04` | Migración dominio `imagenes` a POO/SOLID + des-hardcodeo uploads dir a `IMAGENES_UPLOADS_DIR` | ✅ | ✅ | `sharp`/`fs` falsos (5/5 casos) + `curl -X POST /api/imagenes/upload` sin token en prod → `401` (confirma ruta montada y `auth` activo) | ✅ dominio cerrado |
| 8 | Agente 1 | `5b8a7cb` | Docs: agregar esta sección de registro por agente | ✅ (solo docs) | N/A | N/A | ✅ |
| 9 | Agente 1 | `99f29c7` | Docs: regla de pull/relectura del MD antes de cada commit | ✅ (solo docs) | N/A | N/A | ✅ |
| 10 | Agente 1 | `7979ba4` | Docs: sincronizar tabla — `productos` e `imagenes` confirmados en prod | ✅ (solo docs) | N/A | N/A | ✅ |
| 11 | Agente 1 | *(pendiente de commit)* | Migración dominio `maestros` a POO/SOLID (4 catálogos: orígenes, conceptos-costo, conceptos-compra, categorías) | ✅ | ⏳ pendiente de deploy/curl real | pool falso: 13 endpoints incluyendo 2 casos de duplicado (`23505`→`RegistroDuplicadoError`) | ✅ en mocks; falta confirmación en prod |
| 12 | Agente 2 | `8717e61` | Fix bloqueante: `index.js` importaba `./controllers/maestros`, eliminado en la migración de `maestros` (entrada #11) pero nunca actualizado en `index.js` — habría tumbado el arranque completo del API en el próximo deploy (`MODULE_NOT_FOUND` síncrono). Import además nunca se usaba. | ✅ | ⏳ pendiente de deploy real (bug no llegó a prod porque #11 tampoco se ha desplegado aún) | `node -c` + arranque real del servidor + `curl /api/public/categorias` (responde, no crashea) | ✅ deja de ser bloqueante para el próximo `git pull` + restart |
| 13 | Agente 2 | `a53f06c` | Migración dominio `auth` a POO/SOLID (login + vendedores) — Agente 1 pausado por tokens | ✅ | ⏳ pendiente de deploy/curl real | pool/bcrypt/jwt falsos: 8 casos (400 sin credenciales, 401 email inexistente, 401 inactivo, 401 password incorrecto, 200 happy path con shape exacto, vendedores con/sin filtro de rol, validación de deps en constructor) + arranque real del servidor completo + curl real a `/api/auth/login` (400) y `/api/auth/vendedores` sin token (401) | ✅ en mocks y curl local sin BD; falta login real con credenciales existentes vía Cloudflare en prod |
| 14 | Agente 2 | *(deploy, sin commit de código)* | Deploy real de #12 y #13 confirmado por el dueño: `git pull` + `docker compose restart lilop-api` en `arley2911@serverpc` | N/A (ya cubierto en #12/#13) | ✅ | `git log` en servidor real → HEAD `7e59555` (incluye ambos commits); `docker exec lilop-api ls domains/auth/` → los 4 archivos presentes en el volumen; contenedor arrancó sin `MODULE_NOT_FOUND` | ✅ #12 cerrado por completo — ya no es bloqueante en prod |
| 15 | Agente 2 | *(mismo deploy que #14)* | Verificación del contrato de error de `auth` en prod, vía `wget` interno al contenedor (sin pasar por Cloudflare) | N/A | ✅ parcial | `POST /api/auth/login` con body vacío → `400`; `GET /api/auth/vendedores` sin token → `401` — ambos coinciden exacto con el contrato esperado | ✅ contrato de error confirmado en vivo; **sigue pendiente** el happy path real de login (credenciales válidas → JWT + shape de `usuario`) para cerrar #13 del todo |
| 16 | Agente 2 | *(sin commit de código)* | Happy path real de login: usuario de prueba temporal creado vía `psql` (password con hash bcrypt generado por Agente 2, nunca credenciales reales del negocio), login exitoso, usuario de prueba eliminado tras la prueba | N/A | ✅ | `POST /api/auth/login` con credenciales válidas → `200` con JWT decodificable (payload `id`/`nombre`/`email`/`rol` correcto) + `usuario` en la respuesta con el shape exacto esperado; usuario de prueba confirmado borrado (`DELETE 1`) | ✅ dominio `auth` cerrado por completo — happy path y contrato de error confirmados en prod real, sin usar ni exponer credenciales de usuarios reales |
| 17 | Agente 2 | *(sin commit — solo análisis, nada tocado)* | Análisis solicitado por el dueño: estado real de los JS del admin/site y si el refactor a un patrón (MVC/módulos) ya estaba planeado. Confirmado: **ya estaba planeado como Etapa 6** (secciones 3, 4.1, 5 y pendiente #5 de este mismo MD), bloqueado explícitamente hasta que Fase 5 (corte de esquema BD) esté cerrada — hoy sigue 🔲 Pendiente. No se inició ningún refactor de frontend. Métricas verificadas: `admin/html/assets/js/pages/cliente.js` = 1500 líneas / 28 funciones top-level en scope global (coincide con el diagnóstico de la sección 4.1); resto de páginas del admin entre 282–783 líneas; `site/html/js/script.js` = 485 líneas. Ningún HTML usa todavía `<script type="module">`; no existe `package.json` ni build tool en `admin/` ni `site/` — confirma que el plan de Etapa 6 (ES Modules nativos, sin build tooling nuevo) sigue siendo el camino correcto y nada lo contradice. | N/A (solo lectura) | N/A | `wc -l`, conteo de `function `/`async function` top-level, `grep type="module"`, búsqueda de `package.json`/`webpack`/`vite` | ✅ confirmado: tarea ya asignada (Etapa 6), no iniciada, sigue bloqueada por Fase 5 |
| 18 | **Agente 3** | `cbc947d` | Suite de tests real (`api/tests/`, `node:test`) para core + productos/domicilio/imagenes — tarea asignada a esta sesión por el dueño explícitamente sin superposición de archivos con Agente 1 (dominios backend) ni Agente 2 (auth + frontend). Nota: esta sesión se auto-identificó primero como "Agente 2" sin saber que esa identidad ya estaba en uso activo — corregido a Agente 3 al hacer `git pull`/rebase y encontrar el choque. | ✅ | N/A (no es código de producción, no requiere deploy) | `npm test` corrido localmente | ✅ 35/35 tests, 12 suites, 0 fallos |
| 19 | Agente 3 | *(pendiente de commit)* | Migración dominio `comisiones` a POO/SOLID | ✅ | ⏳ pendiente de deploy/curl real | pool falso: filtros de `listar()`, 400 sin estado, 404 id inexistente, happy path | ✅ en mocks (`npm test` 41/41); falta confirmación en prod |
| 20 | Agente 3 | *(pendiente de commit)* | Migración dominio `entregas` a POO/SOLID (anidado bajo `/api/pedidos/:pedido_id/entregas`) | ✅ | ⏳ pendiente de deploy/curl real | pool falso: 404 si el pedido padre no existe (no llega a insertar), CRUD completo | ✅ en mocks (`npm test` 46/46); falta confirmación en prod |
| 21 | Agente 3 | *(pendiente de commit)* | Migración dominio `disenos` a POO/SOLID (incluye generación de nombre automático si no se envía) | ✅ | ⏳ pendiente de deploy/curl real | pool falso: generación de nombre con y sin valor dado, 400 si `catalogo_ids` no es array, 404s | ✅ en mocks (`npm test` 52/52); falta confirmación en prod |
| 22 | Agente 1 | *(pull de sincronización, sin commit propio)* | Validación del estado combinado tras traer los commits de Agente 2 (`auth`) y Agente 3 (`comisiones`/`entregas`/`disenos`/tests) en un solo `git pull` | N/A | N/A | `grep` amplio de referencias rotas a controllers/routes eliminados (limpio) + `npm test` (52/52) + arranque real del servidor con env vars dummy (sin `MODULE_NOT_FOUND` ni crash) | ✅ el estado combinado de los 3 agentes es consistente y arranca; hallazgo: `domains/productos/` es solo la porción bot/lectura, el CRUD admin de productos sigue sin migrar (ver nota al inicio de esta sección) |
| 23 | Agente 1 | *(deploy, sin commit de código)* | Deploy real de `f810688` confirmado por el dueño en `arley2911@serverpc`: `git pull` + `docker compose restart api`. **Cierra las entradas #11 (`maestros`), #19 (`comisiones`), #20 (`entregas`) y #21 (`disenos`)** — pasan de ⏳ a confirmadas en prod. | N/A (ya cubierto en #11/#19/#20/#21) | ✅ | Logs de arranque limpios + 5 `curl` reales sin token: `GET /api/maestros/origenes` → `401`; `GET /api/public/categorias` → `12` (sigue intacto); `GET /api/comisiones` → `401`; `GET /api/pedidos/PD0001/entregas` → `401`; `GET /api/disenos` → `401`. Ningún `404` — confirma las 4 rutas montadas y protegidas por `auth` | ✅ `maestros`, `comisiones`, `entregas` y `disenos` cerrados: código + deploy + prueba real, los 4 con status esperado |
| 24 | Agente 1 | *(pendiente de commit)* | Migración dominio `usuarios` a POO/SOLID (CRUD admin) | ✅ | ⏳ pendiente de deploy/curl real | pool/bcrypt falsos: listar, 404 en obtener/actualizar/eliminar, `toTitleCase`, validación nombre/password requeridos, duplicado de email | ✅ en mocks; falta confirmación en prod |
| 25 | Agente 1 | *(pendiente de commit)* | Migración dominio `demo` a POO/SOLID (demo guiada Azure DevOps + webhook n8n) | ✅ | ⏳ pendiente de deploy/curl real | pool/`fetch` falsos: validación de campos, creación con steps iniciales, payload correcto al webhook (fire-and-forget preservado), 404 en estado/paso inexistente, actualización de paso | ✅ en mocks; falta confirmación en prod |
| 26 | Agente 1 | `abceefa` | 🔴 **INCIDENTE — API caído en prod (502) por el deploy de #25.** `DemoService` validaba `webhookUrl` en el constructor y lanzaba si faltaba (copiado del patrón de `AuthService`/`JWT_SECRET`). El servidor real no tiene `N8N_DEMO_WEBHOOK` configurada — el controller viejo nunca la validaba al arrancar, solo fallaba en silencio dentro de un `.catch()` de un `fetch` no esperado. El `throw` en el constructor tumbó el proceso completo de Node al cargar `index.js` (no solo `/api/demo`) — **downtime real de todo el API**, reportado por el dueño con 502 en cualquier ruta. Fix: se quita la validación temprana; `webhookUrl` puede ser `undefined`, y `fetch(undefined,...)` devuelve una promesa rechazada (confirmado con prueba real de Node), no un throw síncrono — el `.catch()` ya existente la absorbe sin crashear nada, igual que el comportamiento original. | ✅ (fix) | ✅ **incidente cerrado** | Prueba real de `fetch(undefined,...)` en Node (confirma promesa rechazada) + `run()` con `webhookUrl` ausente responde `200` sin crash + arranque local sin `N8N_DEMO_WEBHOOK` + **deploy real confirmado por el dueño**: `docker ps` → `Up About a minute (healthy)` (sin restart-loop), `curl` reales → `/api/public/productos` 200, `/api/public/categorias` 200, `/api/demo/run` 400 (esperado, sin body), `/api/usuarios` 401 — ningún `502` | ✅ **incidente resuelto por completo**: causa raíz identificada, fix desplegado, servicio restaurado y verificado en vivo |
| 27 | Agente 1 | *(mismo deploy que #26, sin commit adicional)* | Confirmación en prod de los dominios `usuarios` (entrada #24) y `demo` (entrada #25, contrato de error) — mismo deploy que cerró el incidente #26 | N/A (ya cubierto en #24/#25) | ✅ | `curl` reales sin token/body: `GET /api/usuarios` → `401` (ruta montada, auth activo); `POST /api/demo/run` sin body → `400` (validación de campos requeridos, dominio público sin auth funcionando) | ✅ ambos dominios cerrados |
| 28 | Agente 2 | `b7cdfbd` | Fix de bug real en prod: `costos_pedido.js` (`agregarComision`/`listaVendedoresComision`) usaba una columna `nombre_vendedor` que nunca existió en `comisiones` — feature activa en el frontend (`cliente.js`/`pedidos.js`), no código muerto. Decisión de negocio confirmada por el dueño: la comisión pasa a ser 100% manual, se obsoleta el % automático (`comision_pct` + trigger `fn_recalc_pedido_comision`). Migración `003_comision_manual.sql`: agrega `nombre_vendedor`, afloja `vendedor_id` (ya no `NOT NULL`), quita `UNIQUE(pedido_id)` (ahora puede haber varias comisiones manuales por pedido), `DROP TRIGGER trg_pedidos_recalc_comision` (función conservada, documentada como deprecada). `agregarComision`/`eliminarComision` ahora recalculan `pedidos.comision` (rollup `SUM`), mismo patrón que `agregarDomicilio`/`eliminarDomicilio` — necesario porque `ganancias` es columna `GENERATED` que depende de `comision`. | ✅ | ⏳ pendiente de deploy real (requiere correr la migración SQL con Postgres real, no disponible en este sandbox) | 4 casos con pool falso (proxyquire manual vía `require.cache`): 400 sin `valor_comision` sin tocar BD, INSERT + rollup correcto, `nombre_vendedor` opcional (null), `eliminarComision` usa `pedido_id` de la ruta anidada (`mergeParams`) para el rollup. Validado solo sintácticamente el SQL (sin Postgres real en este entorno) | ⏳ en mocks; **falta correr la migración en prod + probar `agregarComision`/`eliminarComision` reales antes de cerrar esta entrada** — ver nota de riesgo abajo |

**Nota de riesgo para el deploy de la entrada #28:** `003_comision_manual.sql` hace `DROP TRIGGER` y `DROP CONSTRAINT` — no son reversibles con un simple rollback si ya se insertaron filas nuevas sin `vendedor_id` después de aplicarla. Recomendado backup de la tabla `comisiones` (`pg_dump -t comisiones`) antes de correr la migración en prod.

**Pendiente anotado, no resuelto en #28:** `domains/comisiones/` (dominio de listado admin ya migrado por Agente 1, entrada #19) hace `JOIN usuarios u ON u.id = c.vendedor_id` — con comisiones manuales, `vendedor_id` puede ser `NULL`, así que esas filas quedarían excluidas del listado de `/api/comisiones`. Verificado con `grep` que el frontend admin actual no usa esa ruta (todo pasa por `/api/pedidos/:id/costos/comision`), así que no es urgente, pero si se reactiva ese listado en el futuro, cambiar el `JOIN` a `LEFT JOIN` y hacer `COALESCE(u.nombre, c.nombre_vendedor)`.

**Nota sobre la entrada #5 (actualizada):** ya no hay pendiente — Agente 1 corrió el
curl real de verificación (`/api/public/bot/productos/CAT0032` vía Cloudflare) y el
dominio `productos` de POO/SOLID responde en producción con el schema exacto de la
sección 7bis. Se puede depender de `ProductoRepository`/`ProductoService` como
probado en vivo, no solo en mocks.

**Cómo leer esta tabla:** "Deploy prod" en ✅ significa que el dueño corrió
`git pull` + `docker compose restart <servicio>` en el servidor real y se confirmó
con logs/curl reales — no basta con que el commit exista en `origin/main`. Un commit
sin fila aquí, o con "⏳", significa que el código existe pero **no está confirmado
funcionando en producción** — tratarlo como no confirmado hasta que aparezca una
entrada nueva que lo cierre.

**Nota sobre la entrada #12 (proceso, no solo el bug puntual):** al borrar un
controller/route viejo tras migrar un dominio (paso final del flujo en 7quater),
verificar SIEMPRE con `grep -rn "controllers/<dominio>\|routes/<dominio>"` sobre
todo `api/src` — no solo sobre las rutas que uno mismo tocó — antes de dar el
dominio por cerrado. El import roto de `maestros` no se detectó en su momento
porque nadie corrió `node -c`/arrancó el servidor completo después de borrar los
archivos viejos; solo se habría visto en el próximo deploy real. Agregado a la
sección 9 como regla de conducta.

## 9. Reglas de conducta que deben seguir aplicando

- **Nunca validar/lanzar en el constructor de un Service por una dependencia
  opcional cuya ausencia el código viejo toleraba en silencio** (ver incidente
  entrada #26: `DemoService` copió el patrón fail-fast de `AuthService` para
  `webhookUrl`, sin verificar que el servidor real tuviera esa env var
  configurada — tumbó el API completo). El fail-fast de `AuthService` con
  `JWT_SECRET` es correcto porque esa dependencia SIEMPRE fue requerida (sin
  ella, ningún login funcionaba de todas formas); antes de replicar ese patrón
  en otro dominio, confirmar que la dependencia era igual de obligatoria en el
  código viejo — si el código viejo la usaba con `if`/`?.`/`.catch()` sin
  validarla al arrancar, el reemplazo debe tolerar su ausencia de la misma
  forma, no endurecerla.

- **Antes de escribir cualquier commit: `git fetch`/`pull` y releer el MD (mínimo la
  sección 8) para detectar trabajo de otro agente/orquestador que haya llegado desde
  la última lectura.** Esto evita migrar dos veces el mismo dominio o pisar cambios
  concurrentes — es la razón por la que existe el registro por agente de la sección 8.
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
- **Tras borrar un controller/route viejo al cerrar una migración de dominio:**
  correr `grep -rn "controllers/<dominio>\|routes/<dominio>"` sobre todo `api/src`
  (no solo sobre lo que uno tocó) Y arrancar el servidor completo (`node src/index.js`
  con `node_modules` instalados) para confirmar que no queda ningún `require` roto
  antes de dar el dominio por cerrado (ver entrada #12 de la sección 8: así se
  encontró un import muerto de la migración de `maestros` que habría tumbado el
  próximo deploy).
