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
  **Ahora (anuncio antes de empezar, tras `git pull` — sin cambios nuevos remotos):**
  empiezo la migración del dominio `pedidos` a POO/SOLID (`controllers/pedidos.js` +
  `routes/pedidos.js`). Es el dominio de mayor riesgo pendiente: tiene 3 triggers
  reales detrás (`fn_recalc_producto_costo` sobre `compras`, `fn_recalc_pedido_costo`
  sobre `productos`, `fn_pedido_set_origen` al crear el pedido) más la columna
  `ganancias` (`GENERATED`) y el trigger de comisión ya documentado en `004`. Voy a
  investigar cada uno con `\d`/`\sf` en prod antes de asumir nada (lección de las
  entradas #12 y #29). Toco: `domains/pedidos/`, `controllers/pedidos.js`,
  `routes/pedidos.js`, `index.js` (una línea). No toco `costos_pedido.js` (ya cerrado
  en #28-30) ni `domains/comisiones/`.

  **PAUSADO EN INVESTIGACIÓN — handoff para quien retome, no asumir que el repo
  refleja el esquema real de `pedidos`.** Corrí `\d pedidos` en prod y el esquema
  real difiere bastante de `001_schema_inicial.sql` (deriva no rastreada, mismo
  patrón que la entrada #29, pero más grande):

  - `ganancias` **ya NO es columna `GENERATED`** (como dice 001) — ahora es
    `numeric(12,2)` normal, sin default, poblada por un trigger nuevo
    `trg_pedidos_ganancias BEFORE INSERT OR UPDATE ON pedidos EXECUTE FUNCTION
    fn_recalc_ganancias()`. **Nadie ha visto todavía la definición de
    `fn_recalc_ganancias()`** — pedido el `\sf` al dueño, respuesta pendiente.
  - Columnas reales en `pedidos` que NO existen en `001_schema_inicial.sql`:
    `costos_otros` (numeric), `estado_pago` (enum `estado_pago_pedido`),
    `medio_pago_id` (integer, FK a tabla `medios_pago` — reemplazó al enum
    `medio_pago` que sí está en 001). `controllers/pedidos.js` (`crear`/
    `actualizar`) ya usa `medio_pago_id` + lookup en `medios_pago` — **eso SÍ
    coincide con la realidad**, no es un bug (a diferencia del caso de
    `nombre_vendedor` en la entrada #28, aquí el código viejo iba adelantado
    al repo, no al revés).
  - `estado` (`estado_pedido`) tiene default real `'por_confirmar'`, no
    `'pendiente'` como dice 001.
  - Faltan por confirmar (pedidos al dueño, **respuesta pendiente al pausar
    esta sesión**): definición real de `fn_recalc_ganancias`,
    `fn_recalc_producto_costo`, `fn_recalc_pedido_costo`, `fn_pedido_set_origen`
    (los 3 últimos son los que 001 sí declara — falta confirmar si siguen
    igual o también cambiaron), valores reales de los enums `estado_pedido`/
    `estado_pago_pedido`/`medio_pago` (`\dT+`), y el esquema real de `productos`
    (`\d productos`, referenciado en `obtener()`).

  **Próximo paso para quien retome:** correr los `\d`/`\sf`/`\dT+` pendientes
  de arriba, y — dado el tamaño de la deriva encontrada — considerar escribir
  primero una migración "as-built" (tipo `005_documentar_esquema_real_pedidos.sql`,
  mismo criterio que `004`) que dé fe en git de TODO el esquema real de
  `pedidos`/`productos` antes de tocar una sola línea de `controllers/pedidos.js`.
  No se tocó ningún archivo de código en esta sesión para `pedidos` — solo
  investigación vía `\d`/`\sf` sobre el servidor real, cero cambios aplicados.

  **Retomado por esta sesión (Agente 2, continuación — no nueva identidad, mismo
  hilo de trabajo pausado arriba).** Tras `git pull` confirmo: sin commits nuevos
  sobre `pedidos`/`productos` desde la pausa, nadie más avanzó esto en paralelo.
  No toco ningún archivo de código todavía — primero hace falta cerrar las
  preguntas pendientes que dejó la sesión anterior (definición real de
  `fn_recalc_ganancias`, `fn_recalc_producto_costo`, `fn_recalc_pedido_costo`,
  `fn_pedido_set_origen`, valores reales de los enums, y `\d productos`). Le pedí
  al dueño los comandos exactos para traer esa información (ver mensaje de chat);
  hasta no tenerla, sigo el plan ya dejado por escrito: escribir primero una
  migración "as-built" (`005_documentar_esquema_real_pedidos.sql`) que deje
  registrado en git el esquema real completo, y solo después tocar
  `controllers/pedidos.js`.

  **Resultados recibidos del dueño (`\sf` de las 4 funciones + `\dT+` + `\d
  productos`):**

  - `fn_recalc_ganancias()` — confirmado: solo recalcula si
    `NEW.estado = 'entregado'` (`valor_venta - costo - valor_domicilio - comision
    - costos_otros`); en cualquier otro estado deja `ganancias := 0`. Coherente
    con lo esperado, sin sorpresas.
  - `fn_recalc_producto_costo()` (trigger sobre `compras`) — hace rollup de
    `SUM(valor_total)` de `compras` hacia `productos.costo_total`. Coincide con
    lo esperado.
  - `fn_recalc_pedido_costo()` (trigger sobre `productos`, evento
    `UPDATE OF costo_total`) — rollup de `SUM(costo_total)` de `productos` hacia
    `pedidos.costo`. Coincide con lo esperado.
  - `fn_pedido_set_origen()` — si `origen` viene `NULL` al crear el pedido, lo
    completa desde `clientes.origen_venta`. Coincide con lo esperado.
  - `estado_pedido` (enum): `por_confirmar, en_alistamiento, por_entregar,
    entregado, cancelado` — confirma el default real `'por_confirmar'` ya
    anotado arriba (001 decía `'pendiente'`, no existe ese valor en el enum real).
  - `estado_pago_pedido` (enum): `pendiente, pagado, rechazado`.
  - `medio_pago` — **`\dT+` devuelve 0 filas: ya no existe como tipo enum en la
    BD.** Confirma (no contradice) lo ya anotado: fue reemplazado por
    `medio_pago_id` (FK a tabla `medios_pago`).
  - `\d productos` trajo un **hallazgo nuevo, no listado en el handoff original**:
    hay un **cuarto/quinto trigger que nadie había visto**:
    `trg_productos_recalc_valor_venta AFTER INSERT OR DELETE OR UPDATE OF nombre,
    tamanio, valor_venta_override ON productos FOR EACH ROW EXECUTE FUNCTION
    fn_recalc_pedido_valor_venta()` — **su definición no ha sido pedida todavía**.
    Por el nombre, todo indica que recalcula `pedidos.valor_venta` a partir de
    los productos del pedido (mismo patrón rollup que `fn_recalc_pedido_costo`),
    lo cual es directamente relevante porque `fn_recalc_ganancias()` **lee
    `NEW.valor_venta`** — si este trigger no corre en el orden correcto respecto
    al de `ganancias`, hay riesgo real de orden de triggers. **No asumir el
    comportamiento sin ver el código real** (misma disciplina que ya evitó un
    problema en la entrada #29).
  - `productos` también reveló columnas/enums no documentados antes:
    `tamanio` (enum `tamanio_producto`), `estado` (enum `estado_producto`,
    default `'Por Comprar'`), `valor_venta_override`, `cantidad` (con constraint
    `> 0`), y un tercer trigger genérico `trg_productos_updated_at` (solo
    `fn_set_updated_at`, sin riesgo).

  **Sigo sin tocar código.** Falta antes de escribir la migración as-built:
  `\sf fn_recalc_pedido_valor_venta` y el output crudo y completo de `\d pedidos`
  (lo de arriba es un resumen en prosa de la sesión anterior, no el output
  verbatim — para dejar la migración 005 exacta hace falta el texto real, no un
  resumen).

  **Recibido `\sf fn_recalc_pedido_valor_venta` + `\d pedidos` completo. Tres
  hallazgos más, dos de ellos serios — pausado de nuevo para decisión del
  dueño antes de escribir la migración 005 o tocar `controllers/pedidos.js`:**

  1. **`fn_recalc_pedido_valor_venta()` depende en vivo de las tablas legacy**
     (`catalogo_productos`/`catalogo_precios`, join por `nombre` de texto +
     `tamanio`) — este trigger corre sobre `productos` (INSERT/DELETE/UPDATE de
     `nombre`/`tamanio`/`valor_venta_override`) y hace
     `UPDATE pedidos SET valor_venta = ...`, que a su vez dispara
     `trg_pedidos_ganancias`. O sea: **el valor de venta y las ganancias de
     TODO pedido real dependen hoy de las tablas legacy**, no son solo cruft de
     rollback. Confirmado además que `controllers/pedidos.js` (`obtener()`,
     líneas 45-46) hace el **mismo join legacy duplicado** para mostrar el
     precio por producto. **Esto es un bloqueante real para la Fase 6**
     (`DROP` de `catalogo_precios`/`catalogo_productos`/`atributos`/
     `atributo_opciones`, sección 7ter #7): no se puede hacer ese drop sin
     migrar primero este trigger (y el query de `obtener()`) al esquema nuevo
     (`variables`/`variable_valores`/`variantes`/`atributos_resueltos`). No es
     un problema exclusivo del dominio `pedidos` — es un hallazgo que afecta
     la metodología completa de la sección 5.
  2. **`trg_pedidos_set_origen` está declarado en `001_schema_inicial.sql`
     pero NO existe en producción** (`\d pedidos` solo lista
     `trg_pedidos_ganancias` y `trg_pedidos_updated_at`) — y
     `controllers/pedidos.js` tampoco setea `origen` en ningún punto
     (`crear`/`actualizar`). Todo apunta a que **`origen` queda `NULL` en
     todos los pedidos creados por el sistema actual** — no confirmado con un
     `SELECT` real todavía. No sé si esto es una feature abandonada
     intencionalmente o un bug que nadie notó.
  3. **Bug latente encontrado en `crear()` (línea ~89):**
     `estado || 'pendiente'` — pero `'pendiente'` **no es un valor válido** del
     enum real `estado_pedido` (los valores reales son `por_confirmar,
     en_alistamiento, por_entregar, entregado, cancelado`). Si algún caller crea
     un pedido sin mandar `estado` explícito, el `INSERT` fallaría en tiempo
     real (`invalid input value for enum`). No confirmado si el admin siempre
     manda `estado` (en cuyo caso es código muerto sin impacto hoy) o si es un
     bug activo.

  **No escribo `005` ni toco `controllers/pedidos.js` hasta que el dueño
  responda estos 3 puntos** — especialmente el #1, que cambia el alcance: ya
  no es "documentar as-built de pedidos", es "documentar as-built de pedidos
  + dejar explícito que el corte de productos/variantes (Fase 5) es
  prerrequisito real para desacoplar `fn_recalc_pedido_valor_venta()` de las
  tablas legacy antes de poder dropearlas (Fase 6)".

  **Respuesta del dueño al punto #3: confirmado, `'por_confirmar'` es el
  valor real/intencional (no `'pendiente'`).** Corregido en
  `controllers/pedidos.js` línea 91 (`crear()`):
  `estado || 'pendiente'` → `estado || 'por_confirmar'`. Cambio mínimo, un
  solo token, verificado con `node -c` (sintaxis OK). No se corrió el
  servidor completo porque no se toca ninguna otra línea ni import — no hay
  superficie nueva que romper. **Puntos #1 (dependencia de `pedidos` con
  tablas legacy, bloqueante de Fase 6) y #2 (`origen` huérfano) siguen sin
  respuesta del dueño — no se toca nada más de `pedidos.js` ni se escribe la
  migración `005` hasta resolverlos.** Commit local hecho, pendiente de
  autorización para push.

  **Decisión del dueño: reactivar `origen` (punto #2) — no era baja
  intencional.** Escrita `005_reactivar_trigger_origen_pedido.sql`:
  `CREATE OR REPLACE FUNCTION fn_pedido_set_origen()` (misma definición
  exacta ya confirmada por `\sf`, sin cambios) + `DROP TRIGGER IF EXISTS` +
  `CREATE TRIGGER trg_pedidos_set_origen BEFORE INSERT ON pedidos ...`.
  Idempotente para correr igual en prod (solo falta el trigger) y en un
  entorno nuevo (donde 001 ya declara la función). Commit local, **sin
  push**.

  **Punto #1 sigue abierto** (dependencia de `pedidos`/`fn_recalc_pedido_
  valor_venta` con tablas legacy) — el dueño pidió "hacer las migraciones
  necesarias antes de continuar", pero al ir a escribir el as-built completo
  de `pedidos` aparecieron **dos vacíos más que no estaban en el handoff
  original** y que no se pueden adivinar sin riesgo real de romper un
  entorno nuevo levantado desde cero:
  - **`medios_pago` no existe en ninguna migración del repo.** 3 controllers
    (`pedidos.js` x2, `pedidos_publicos.js`) hacen
    `SELECT id FROM medios_pago WHERE nombre = $1` contra una tabla que
    nunca se creó vía git — un entorno nuevo con las migraciones actuales
    rompería en el primer `POST /pedidos` con `medio_pago`.
  - **La vista `v_pedidos_resumen` del repo (001) todavía referencia
    `p.medio_pago`** (columna vieja, ya no existe en prod — reemplazada por
    `medio_pago_id`). La vista real en producción tiene que ser distinta,
    porque `listar()`/`obtener()` funcionan hoy. Pedido `\d medios_pago` +
    `pg_get_viewdef('v_pedidos_resumen', true)` al dueño antes de escribir
    el as-built completo del resto (`estado_pedido`, `medio_pago_id`,
    `ganancias`).

  **Recibido `\d medios_pago` + `pg_get_viewdef(v_pedidos_resumen)`. Escrita
  `006_documentar_esquema_real_pedidos.sql`** con todo el as-built pendiente:
  - Crea `medios_pago` (`IF NOT EXISTS`) — no existía en ninguna migración.
  - Crea el enum `estado_pago_pedido` (nuevo, no estaba en 001).
  - Corrige el enum `estado_pedido` (001 tenía 7 valores que no son los
    reales; ahora quedan los 5 reales: `por_confirmar, en_alistamiento,
    por_entregar, entregado, cancelado`) — con guardia de seguridad: si
    detecta el enum viejo Y la tabla `pedidos` ya tiene filas, aborta con
    `RAISE EXCEPTION` en vez de mapear datos a ciegas (solo debería
    ejecutar la corrección real en un entorno recién creado, sin datos).
  - `medio_pago` (enum embebido) → `medio_pago_id` (FK a `medios_pago`).
  - Agrega `costos_otros` y `estado_pago`, confirmadas en prod y ausentes
    en 001.
  - `ganancias`: `DROP EXPRESSION IF EXISTS` (ya no es `GENERATED`) +
    `fn_recalc_ganancias()` + trigger, con la definición real exacta.
  - `fn_recalc_pedido_valor_venta()` + su trigger sobre `productos`,
    documentados tal cual funcionan hoy — **sigue dependiendo de
    `catalogo_productos`/`catalogo_precios`, sin resolver el bloqueante de
    Fase 6, esta migración solo lo deja constatado en git, no lo
    desacopla**.
  - `v_pedidos_resumen`: `DROP VIEW` + recreada con la definición real
    (incluye `comision_pendiente`, `cliente_id`, `vendedor_id`, `notas`,
    join a `medios_pago`) — la de 001 estaba obsoleta y ya no compilaría
    contra el esquema real (referenciaba `p.medio_pago`, columna
    inexistente).

  **Diseño pensado para ser no-op segura en producción** (todo guardado con
  `IF NOT EXISTS`/`IF EXISTS`/chequeo de valores de enum): en prod, todo
  esto ya existe igual, así que correrla no debería cambiar nada excepto
  recrear (de forma idéntica) la vista, las 2 funciones y sus triggers. En
  un entorno nuevo desde cero, corrige el esquema para que quede igual a
  producción. **No se pudo probar contra un Postgres real en esta sesión**
  (sin acceso directo a la BD) — se validó solo balance de paréntesis y
  bloques `$$` con un script en Python. Recomendado probar en un entorno de
  desarrollo/staging antes de correr en prod si existe esa opción; si no,
  el diseño no-op debería hacerlo seguro igual.

  Commit local hecho (`006` + este registro), **sin push**. Sigue sin
  tocarse `controllers/pedidos.js` más allá del fix de `estado` ya aplicado
  — el refactor a POO/SOLID del dominio sigue pendiente hasta correr esta
  migración y confirmar en prod.

  **Migraciones `005` y `006` corridas en producción por el dueño —
  `Migrations complete!`, sin `RAISE EXCEPTION`, ambas registradas en
  `pgmigrations`.** Diseño no-op confirmado: no se reportó ningún error de
  sintaxis ni de guardas (`IF EXISTS`/`IF NOT EXISTS`/chequeo de enum). El
  dueño reportó una línea final `no configuration file provided: not found`
  que no pertenece al output de `npm run migrate` — pendiente confirmar si
  vino de un comando aparte (ej. `docker compose restart` corrido desde un
  directorio sin `docker-compose.yml`) y si el contenedor `lilop-api` ya se
  reinició para que tome los cambios de código del fix de `estado`
  (commit `2fc6bfc`, ya en el volumen montado, pero Node no recarga solo).
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

- **Agente Verde** (nueva identidad asignada por el dueño a esta sesión, continuación
  directa del hilo de "Agente 1") — tras `git pull` confirmo: `pedidos_publicos.js`
  parecía el único candidato libre, pero hace `INSERT` transaccional directo en
  `pedidos`/`productos` — las mismas tablas cuyos triggers investiga activamente
  Agente 2 (`fn_pedido_set_origen`, `fn_recalc_pedido_valor_venta` dependiente de
  legacy). No es tan aislado como parece por estar en archivo propio; no lo toco
  mientras esa investigación siga abierta. `catalogo.js`/`productos.js` (CRUD admin)
  siguen ligados a la Fase 5. Elegí en su lugar una tarea de cero riesgo de choque:
  **tests automatizados para los dominios sin cobertura** (`maestros`, `usuarios`,
  `demo` — los tres míos de antes de la pausa). Solo agrega archivos a `tests/`, no
  toca ningún archivo de dominio. `npm test` → 99/99, 29 suites. Ver entrada #34 de
  la sección 8.

### Trabajo del Agente 3 (esta sesión)

**Completado:** suite de tests real (`api/tests/`, `node --test`) para core, `productos`,
`domicilio`, `imagenes` — ver detalle abajo. **Tras `git pull` (disciplina obligatoria,
sección 2) encontré que Agente 1/2 ya habían migrado `maestros`, `auth`, `usuarios` y
`demo`,** y que Agente 2 está en medio de una investigación profunda y activa del
dominio `pedidos` (varios hallazgos serios sobre deriva de esquema, ver el bloque de
Agente 2 arriba) — **no toqué nada de eso.** Elegí `clientes` como siguiente dominio:
CRUD simple, sin triggers propios, no mencionado como territorio de nadie más.
Migrado a POO/SOLID (`ClienteRepository`/`Service`/`Controller`/`clientes.routes.js`),
validado con mocks, `npm test` → 60/60. Documenté (sin corregir, fuera de alcance) un
bug pre-existente de `toTitleCase` con acentos, heredado tal cual del controller
original — ver entrada #31 de la sección 8.

Siguiente: `atributos` (sistema viejo de atributos/opciones, pre-cutover, sin
triggers ni relación con `pedidos` — tras `git pull`, sin cambios nuevos remotos).
Migrado igual, incluyendo la ruta pública (`/api/public/atributos/:catalogo_id`) que
reutilizaba el controller directamente — ahora reutiliza el controller de la clase
nueva desde el mismo `require`. `npm test` → 66/66. Ver entrada #32.

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

- **Agente Rojo** (nueva identidad asignada por el dueño; continuación de esta sesión,
  antes identificada como "Agente 2" — hay una colisión de nombres real con otra sesión
  paralela que también se llamó "Agente 2" y tomó `pedidos`, ver bullet de Agente Verde
  arriba) — tras `git pull` (sin cambios nuevos remotos) reviso qué queda libre:
  `pedidos`/`pedidos_publicos`/`productos.js`/`catalogo.js` están todos tomados o
  bloqueados (Fase 5 o territorio activo de `pedidos`). El único candidato libre es
  `costos_pedido.js` — el bug ya lo cerré yo mismo como "Agente 2" antes de la
  renombrada (entradas #28-30), pero la migración arquitectónica a POO/SOLID
  (`domains/costos_pedido/`) nunca se hizo, sigue siendo el controller viejo.
  **Empiezo esa migración ahora.** Toco: `domains/costos_pedido/` (nuevo),
  `controllers/costos_pedido.js` (elimina tras montar), `routes/pedidos.js` (una
  línea, es donde se monta anidado con `mergeParams`), `index.js` si aplica. No toco
  nada de `pedidos.js`/`pedidos_publicos.js`/`productos.js`/`catalogo.js`.

- **Agente Negro** (yo, de vuelta en esta sesión) — tras `git pull` (sin cambios
  nuevos remotos) confirmo que `pedidos`/`pedidos_publicos` siguen bloqueados
  (investigación activa/veto) y `productos.js` (admin) toca la misma tabla
  `productos` que está en investigación activa de `pedidos` — lo descarto por
  riesgo. El único libre es `catalogo.js` (`catalogo_productos`/`catalogo_precios`/
  `catalogo_atributos` — tablas sin relación con la investigación de `pedidos`).
  **Empiezo esa migración ahora**, solo el envoltorio POO (repository/service/
  controller), sin tocar el esquema ni hacer el corte de Fase 5 — eso queda aparte,
  como ya está planeado. Toco: `domains/catalogo/` (nuevo), `controllers/catalogo.js`
  (elimina tras montar), `routes/catalogo.js` (elimina), `index.js` (líneas de
  wiring). No toco nada de `pedidos.js`/`pedidos_publicos.js`/`productos.js`.

- **Agente Rojo** (de vuelta, tras `git pull` — trae solo el anuncio de Agente Negro,
  sin cambios de código: `catalogo.js`/`routes/catalogo.js`/`domains/catalogo/`
  siguen intactos, cero archivos tocados). El dueño confirma que esa sesión no va a
  continuar (mismo patrón que Agente 1 con los tokens). **Tomo la posta de
  `catalogo.js`** exactamente con el mismo alcance que anunció Agente Negro: solo
  el envoltorio POO/SOLID (repository/service/controller), sin tocar esquema ni
  hacer corte de Fase 5. Antes de escribir código reviso el estado real en prod
  (mismo criterio de siempre — no asumir que el repo refleja la BD real).
  **Nota aparte:** tengo datos de prueba sin limpiar en `PD0051`
  (`CSP0019`/`EN0046`/`CM0148`, usuario `US0015`) de la validación de
  `costos_pedido` (entrada #35) — vuelvo a limpiarlos después de esto, quedan
  anotados aquí para no perderlos si la sesión se corta.



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
   `imagenes`, `maestros`, `auth`, `comisiones`, `entregas`, `disenos`, `usuarios`,
   `demo`, `clientes`, `atributos` y `compras` migrados (ver sección 8 para estado
   exacto de confirmación en prod de cada uno; `clientes`/`atributos`/`compras`
   siguen ⏳ pendientes de deploy real). El dominio `productos` **solo cubre la
   porción bot/lectura** (`/api/public/bot/*`) — el CRUD admin real
   (`controllers/productos.js`) sigue sin migrar. Restantes sin tocar:
   `pedidos_publicos` (**vetado por ahora** — hace `INSERT` transaccional directo en
   `pedidos`/`productos`, territorio activo de la investigación de Agente 2, ver
   sección 0), el CRUD completo de `productos`/`catalogo` (ligado a la Fase 5), y
   los de mayor riesgo con triggers ya identificados (`pedidos`, `costos_pedido` —
   este último ya cerrado por Agente 2, ver entradas #28-30; `pedidos` en
   investigación activa, sin código tocado aún salvo el fix puntual de `estado`).
   **Cobertura de tests:** todos los dominios migrados tienen test automatizado
   excepto `auth` (ver 7ter #4).
2. **Fase 4-5 de la metodología** — exponer el esquema nuevo en paralelo al viejo desde
   el API (ya arrancado con el dominio `productos`), validar, y solo después hacer
   el corte real en los controllers existentes (`productos.js`, `catalogo.js`, etc.).
   Ningún controller viejo fue tocado todavía.
3. **Conectar los endpoints al nodo de IA en n8n** — endpoints, contrato y validación
   en producción ya cerrados (secciones 7bis y 5-Fase 4); falta configurar el nodo
   HTTP en el workflow de n8n y pegar las 7 reglas en el prompt del agente. Explícito:
   el dueño pidió dejar esto para el final, después de cerrar la migración a POO/SOLID.
4. **Test automatizado para el dominio `auth`** — es el único dominio migrado que no
   tiene test en `tests/domains/` (los demás sí). No es urgente (el dominio ya está
   confirmado en prod con happy path real, ver entradas #13-16), pero cierra el hueco
   de cobertura.
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

| 29 | Agente 2 | `03c93e4` | 🔴 **Deuda técnica no rastreada encontrada al desplegar #28 en prod, corregida.** Al correr `003_comision_manual.sql` en el servidor real, los `NOTICE` de "already exists, skipping" revelaron que alguien ya había aplicado a mano los mismos cambios estructurales — y además había un trigger nuevo (`trg_comisiones_recalc_pedido` / `fn_recalc_comision_pedido`) que **no existía en ningún archivo del repo**. Ese trigger recalcula `pedidos.comision` sumando **solo** comisiones en estado `Pagada` (confirmado con el dueño como la regla de negocio correcta). Mi `UPDATE` manual en `agregarComision`/`eliminarComision` (de la entrada #28) sumaba TODAS las comisiones sin filtrar por estado, y al correr después del mismo `INSERT`/`DELETE` que ya disparó el trigger, pisaba su resultado — generando una inconsistencia real entre agregar/borrar una comisión (ganaba mi lógica) vs. cambiar su estado a Pagada vía `cambiarEstadoComision` (ganaba el trigger, nunca tocado por mí). Fix: se quita el `UPDATE` manual por completo, el trigger de prod queda como única fuente de verdad para las 3 operaciones. Se agrega `004_documentar_trigger_recalc_comision_pagada.sql` (idempotente, `CREATE OR REPLACE`) para dejar ese trigger rastreado en git — sin esto, un entorno nuevo levantado desde las migraciones del repo perdería esta regla de negocio por completo. | ✅ | ⏳ pendiente de deploy real | 4 casos actualizados con pool falso: `agregarComision`/`eliminarComision` ya solo esperan `INSERT`/`DELETE`, sin el `UPDATE` que antes chocaba | ⏳ en mocks; **falta correr 004 en prod + confirmar que `agregarComision`/`cambiarEstadoComision` dan el mismo resultado de `pedidos.comision` que antes de este fix (regresión, no feature nueva)** |

**Lección para la próxima sesión:** antes de escribir cualquier `UPDATE`/rollup manual sobre una columna que podría tener un trigger detrás, correr `\d <tabla>` (o `\dft`) en el servidor real primero — no asumir que el estado del repo (`db/migrations/*.sql`) refleja el 100% de lo que corre en producción. Ya pasó una vez con el import roto de `maestros` (entrada #12) y ahora con este trigger — el repo y la BD real pueden divergir sin que quede ningún rastro hasta que algo falla o se descubre por accidente.

| 30 | Agente 2 | *(sin commit de código)* | Cierra #29: deploy real de `03c93e4`/`004_documentar_trigger_recalc_comision_pagada.sql` confirmado + prueba end-to-end del trigger en prod con datos de prueba (2 comisiones temporales sobre un pedido real, `PD0054`, borradas al final) | N/A (ya cubierto en #29) | ✅ | `git pull` limpio + migración `004` aplicada sin error + restart sin crash. Prueba real: `pedidos.comision` se mantuvo en `0.00` con 2 comisiones de prueba en estado `Pendiente` (20000 c/u); al marcar una como `Pagada` subió exactamente a `20000.00` (no `40000`, confirma que solo cuenta la pagada); al borrar ambas volvió a `0.00`. También se descartó una duda del dueño sobre un "signo menos" que no desaparecía al marcar como pagada en el front — confirmado con el código de `cliente.js` que es diseño intencional preexistente (el monto de comisión/domicilio siempre se muestra con `-`, solo cambia de color rojo→gris al pagarse), no una regresión de este fix | ✅ **trigger de comisión pagada cerrado por completo**: código + deploy + prueba real confirman la regla de negocio exacta que pidió el dueño |
| 31 | Agente 3 | *(pendiente de commit)* | Migración dominio `clientes` a POO/SOLID | ✅ | ⏳ pendiente de deploy/curl real | pool falso: title-case, validación de celular duplicado (409, no llega a actualizar si ya está en uso, no valida si no cambia), bloqueo de eliminar con pedidos existentes (400, no llega a borrar), 404s. Nota: se documentó (no se corrigió, fuera de alcance) un bug pre-existente de `toTitleCase` con acentos (`\b\w` no trata í/ó como letra — "maría" → "MaríA"), heredado tal cual del controller original | ✅ en mocks (`npm test` 60/60); falta confirmación en prod |
| 32 | Agente 3 | *(pendiente de commit)* | Migración dominio `atributos` a POO/SOLID (sistema viejo, pre-cutover: `atributos`/`atributo_opciones`/`catalogo_atributos`) | ✅ | ⏳ pendiente de deploy/curl real | pool falso: trim+cast de sobreprecio, 400 duplicado (23505), 400 sin nombre/tipo, 400 `atributo_ids` no-array, 404 id inexistente | ✅ en mocks (`npm test` 66/66); falta confirmación en prod |
| 33 | Agente 3 (ahora "Agente Negro" — pocos tokens, tarea corta sin consultar) | *(pendiente de commit)* | Migración dominio `compras` a POO/SOLID (anidado bajo `/api/productos/:producto_id/compras`) | ✅ | ⏳ pendiente de deploy/curl real | pool falso: 400 sin cantidad/valor_unitario, 404 producto padre inexistente (no inserta), CRUD completo | ✅ en mocks (`npm test` 70/70); falta confirmación en prod |
| 34 | Agente Verde (continuación de Agente 1) | *(pendiente de commit)* | Tests automatizados para `maestros`, `usuarios` y `demo` (domains sin cobertura tras la pausa por tokens) — incluye caso explícito de la inconsistencia preexistente preservada en `conceptos-compra` (no debe dar 400 con nombre solo-espacios) y del fail-fast correcto de `DemoService` (no debe lanzar sin `webhookUrl`, a diferencia de `AuthService`) | ✅ (solo tests, no toca código de dominio) | N/A (no es código de producción) | `npm test` corrido localmente | ✅ 99/99 tests, 29 suites, 0 fallos |
| 35 | Agente Rojo (ex Agente 2 de este mismo hilo, renombrado por el dueño tras la colisión con la otra sesión) | `0cd9d79` + `67611e9` | Migración dominio `costos_pedido` a POO/SOLID (`CostoPedidoRepository`/`Service`/`Controller`/`costos_pedido.routes.js`, 12 endpoints). Antes de migrar, investigando el esquema real de `entregas`/`costos_pedido` encontré el **mismo bug de #29 pero en domicilio**: trigger no rastreado `trg_entregas_recalc_domicilio` (documentado en `007_documentar_triggers_domicilio_costos_otros.sql`) recalcula `pedidos.valor_domicilio` sumando solo entregas con `estado_pago = 'Pagado'`, y `agregarDomicilio`/`eliminarDomicilio` tenían el mismo `UPDATE` manual conflictivo (suma TODAS) que ya se había corregido para comisiones — corregido igual, se quita el `UPDATE` manual. También documenté un tercer trigger (`trg_costos_otros_recalc_pedido`, sobre `costos_pedido`) que **no** tenía conflicto (el código nunca duplicó ese cálculo). La migración a `domains/costos_pedido/` mantiene el contrato HTTP exacto de las 12 rutas, agrupa las 3 tablas en un solo dominio (mismo criterio que `MaestroController`), y corrige de paso un defecto menor (ruta `/listas/conceptos` duplicada dos veces en el router viejo). | ✅ | ⏳ pendiente de deploy real | `node -c` en todos los archivos + arranque real del servidor completo + `curl` real a `/api/pedidos/PD0001/costos` (401 sin token, ruta montada). Suite formal `tests/domains/costos_pedido.test.js` (`node:test`): 12 casos — listado compuesto, 400/201 en `agregarOtro`, 400/201 en `agregarDomicilio` (confirma un solo `INSERT`, sin duplicar el rollup del trigger), 400/404/200 en `cambiarEstadoPagoDomicilio`, 400/200/404 en el flujo de comisión, arrays planos en las 3 listas, 500 genérico en error de BD. `npm test` completo: **112/112, 35 suites, 0 fallos** | ⏳ en mocks; falta correr `007` en prod + confirmar `curl` reales de `costos_pedido` (mismo patrón de prueba que se usó para `auth` y comisiones: crear/borrar datos de prueba) |

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

- **Antes de empezar a escribir código en un dominio nuevo, declararlo en la
  sección 0 con una línea corta ("Agente X — arrancando `<dominio>`, `<hora
  aprox>`") y hacer un commit-only-docs de esa línea de inmediato** (no esperar a
  terminar el dominio para anunciarlo). Esto no elimina la posibilidad de
  colisión (dos agentes pueden arrancar casi al mismo tiempo sin verse), pero la
  hace detectable con un solo `git pull` a mitad de camino, no solo al final —
  ver la colisión de `compras` (Agente 1 / Agente Negro) documentada en la
  sección 0: ambos llegaron a un dominio completo antes de descubrir el choque.
  Si al hacer `git pull` a mitad de trabajo aparece que otro agente ya declaró o
  ya terminó el mismo dominio, parar de inmediato y elegir otro — no completar
  "por si acaso la mía es mejor".

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
- **Antes de escribir un `UPDATE`/rollup manual sobre una columna que podría tener
  lógica automática detrás:** correr `\d <tabla>` en el servidor real primero para
  ver los triggers que existen de verdad — el repo (`db/migrations/*.sql`) puede
  no reflejar el 100% de lo que corre en producción (ver entrada #29 de la sección 8:
  un trigger fue agregado directo en prod sin migración asociada, y casi genera una
  inconsistencia real de negocio).
- **El nombre del servicio en `docker compose` no siempre coincide con
  `container_name`.** En `projects/lilop/api/docker-compose.yml` el servicio
  se llama `api` (contenedor `lilop-api`); en
  `projects/lilop/admin/docker-compose.yml` coinciden (`lilop-admin` es
  ambos). Al dar el comando de restart al dueño, usar el nombre real del
  servicio (`docker compose restart api`), no asumir que siempre es igual
  al `container_name` — confirmado que `docker compose restart lilop-api`
  falla con `no such service` en el compose del api.

  **Verificación post-migración confirmada por el dueño:** `\d pedidos` en
  prod muestra las 3 columnas nuevas (`costos_otros`, `medio_pago_id`,
  `estado_pago`) con tipos/defaults correctos, y **los 3 triggers
  esperados** (`trg_pedidos_ganancias`, `trg_pedidos_set_origen` — ya
  reactivado y funcionando —, `trg_pedidos_updated_at`). Los últimos 3
  pedidos reales (`PD0057`, `PD0055`, `PD0054`) leen el enum `estado` sin
  error. `medios_pago` tiene 8 filas (no solo las 5 del enum viejo de
  001): incluye `"Por confirmar"` como opción seleccionable y **tanto
  `"MP"` como `"Mercado Pago"` como entradas separadas** — posible
  duplicado histórico, no confirmado, no bloqueante, queda para revisión
  del dueño si le interesa. Migraciones `005`/`006` dadas por **cerradas y
  confirmadas en producción**.
