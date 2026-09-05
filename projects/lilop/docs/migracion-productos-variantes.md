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
4. **Validación en paralelo** — 🔲 Pendiente. El API debe exponer/leer del esquema
   nuevo sin apagar el viejo, comparando resultados contra tráfico real.
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

### 6.4 Script de backfill

`api/src/db/backfill_variables_variantes.js` — idempotente (usa `ON CONFLICT`), lee
`catalogo_precios` + `atributos` (tipo booleano) + `catalogo_atributos` existentes y
puebla el esquema nuevo. No modifica ni borra las tablas viejas. Ya corrido
exitosamente contra la BD real de producción (`docker exec -it lilop-api node
src/db/backfill_variables_variantes.js`).

## 7. Pendientes explícitos para la siguiente sesión

1. **Contrato de respuesta del bot** — definir el formato/tono en que el bot de IA
   (vía n8n) debe presentar productos y variantes al cliente de forma coherente. Este
   es el siguiente paso inmediato acordado con el dueño, aún sin definir.
2. **Fase 4-5 de la metodología** — exponer el esquema nuevo en paralelo al viejo desde
   el API (repositorio/servicio nuevo), validar, y solo después hacer el corte real en
   los controllers. Ningún controller fue tocado todavía.
3. **Limpieza de `categorias`** — separar las 4 taxonomías mezcladas (tipo, material,
   composición, target/diseño). No bloqueante, marcado explícitamente como fase aparte.
4. **Etapa 6 (frontend)** — refactor de admin JS + site JS a ES Modules, solo después
   de que el esquema nuevo esté en corte y estable.
5. **Limpieza final** — drop de `catalogo_precios`/`atributos`/`atributo_opciones`/
   `catalogo_atributos` y de los `.bak`/`.bak2` versionados en `admin/html/assets/`,
   solo tras confirmar que ya no se necesitan para rollback.

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
