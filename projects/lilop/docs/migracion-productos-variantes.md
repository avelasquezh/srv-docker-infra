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

- **Agente Negro** (yo, de vuelta) — tras `git pull` confirmo que `catalogo`,
  `pedidos` y `productos_pedido` ya fueron migrados y validados por Agente Rojo
  mientras yo escribía mi propia versión de `catalogo.js` (descartada, cero pérdida
  real — solo tenía la declaración pusheada, sin código). Con eso, el único dominio
  backend que queda sin migrar es **`pedidos_publicos.js`** (checkout público). Lo
  reviso: hace `INSERT` transaccional real (`client.connect()`/`BEGIN`/`COMMIT`) en
  `clientes`→`pedidos`→`productos`, usando columnas ya confirmadas por Agente Rojo
  (`medio_pago_id`, `estado_pago`, `valor_venta_override`) — no encontré nada que
  contradiga el esquema ya documentado. **Empiezo esa migración ahora.** Como es el
  primer dominio con transacción real, voy a agregar un helper `transaction(fn)` a
  `BaseRepository` (core compartido, no específico de este dominio). Toco:
  `core/BaseRepository.js` (agregar método, sin tocar el existente), `domains/pedidos_publicos/`
  (nuevo), `controllers/pedidos_publicos.js` (elimina tras montar), `index.js` (una línea).

  **Completado.** `npm test` → 165/165, 46 suites, 0 fallos. `controllers/`/`routes/`
  quedaron completamente vacíos — **backend 100% migrado, 16/16 dominios en POO/SOLID.**
  Ver entrada #41 de la sección 8.

- **Agente Negro (continúa)** — con el bloqueante del trigger legacy ya resuelto por
  otro agente (`008_desacoplar_valor_venta_de_legacy.sql`), el dueño pide cerrar la
  Fase 5 del todo: cortar el admin de precios (`domains/catalogo/`) para que gestione
  `variables`/`variantes` en vez de escribir directo en `catalogo_precios`.
  **Alcance acotado:** revisé `CatalogoService`/`CatalogoController` — no necesitan
  ningún cambio, el contrato de salida (`precios: [{tamanio, precio, id}]`) ya es
  idéntico sea cual sea la fuente. Todo el cambio va en `CatalogoRepository`: el
  subselect de `precios` en `listar()`/`listarPublicoRaw()`, y `upsertPrecio()`
  (que además de crear/actualizar la variante debe asegurar que exista el
  `variable_valor` del tamaño y que el producto lo tenga habilitado en
  `producto_variables` — la primera vez que se le pone un tamaño nuevo a un
  producto). Mismo criterio de "variante base" (`atributos_resueltos` con solo la
  clave `Tamaño`) que ya usa el trigger desacoplado, para que ambos coincidan
  siempre. **No toco** `categorias`/`disenos`/`atributos` de este dominio — fuera de
  alcance de "admin de precios". Empiezo ahora.

  **Completado, sin desplegar todavía.** `upsertPrecio()` ahora: (1) resuelve/crea el
  `variable_valor` del tamaño, (2) asegura que quede habilitado en
  `producto_variables` (solo si no estaba ya), (3) hace upsert de la variante base
  vía `ON CONFLICT (sku)` con el mismo patrón de SKU exacto que generó el backfill
  original (`<producto_id>-<TAMAÑO>`, mayúsculas), y (4) si `precio <= 0`, borra esa
  variante en vez de guardarla — mismo comportamiento exacto que el `DELETE` viejo.
  `listar()`/`listarPublicoRaw()` leen `precios` desde `variantes` filtrando la
  variante base (`atributos_resueltos - 'Tamaño' = '{}'`), mismo criterio que ya usa
  el trigger desacoplado en `008`. `npm test` → 169/169 (se actualizaron 2 tests
  viejos de `catalogo.test.js` que asumían el comportamiento legacy — ya no aplican).

  **Riesgo residual que dejo explícito, no puedo cerrarlo yo:** no tengo acceso a
  Postgres real, así que todo esto está validado solo con mocks (pool falso,
  respuestas simuladas paso a paso). La lógica de "asegurar variable_valor +
  producto_variables + upsert por SKU" es nueva y no se había probado contra datos
  reales antes. **Antes de dar esto por cerrado hace falta una prueba real en
  producción**: cambiar el precio de un tamaño ya existente (debe actualizar, no
  duplicar), agregar un tamaño nuevo a un producto que no lo tenía (debe aparecer en
  `producto_variables` y en el admin), y poner precio en 0 (debe desaparecer esa
  talla). Documentado como pendiente en la tabla de la sección 8.

- **Agente Negro (cierre de sesión)** — con Fase 5 ya cerrada (entrada #43), el dueño
  preguntó si alcanzaba el margen de la sesión (93% de uso) para iniciar la Fase 6
  (limpieza: `DROP TABLE` de `catalogo_precios`/`atributos`/`atributo_opciones`/
  `catalogo_atributos`, ya sin escritores activos). **Decisión: no se inicia.** Son
  operaciones destructivas e irreversibles sobre producción — este tipo de trabajo
  necesita margen completo de sesión para verificar bien antes de tocar nada, no es
  apto para arrancar con poco margen y quedar a medias. **Antes de que la siguiente
  sesión arranque Fase 6**, debe: (1) `git pull` + releer esta sección y la tabla de
  la sección 8 completa; (2) confirmar con consultas de solo lectura que ninguna de
  esas 4 tablas tiene escritores activos en el código actual (`grep -rn
  "catalogo_precios\|atributo_opciones\|catalogo_atributos" api/src/domains/` no
  debería devolver nada — si aparece algo, no está listo para Fase 6 todavía); (3) ir
  tabla por tabla, no las 4 de una — mismo criterio de "un cambio a la vez" que todo
  el resto de esta migración.

- **Agente 2 (orquestador) — inicio de Fase 6 y ANUNCIO IMPORTANTE para cualquier
  agente que lea esto:** seguí el checklist de arriba al pie de la letra (ver
  entrada #46 de la sección 8 para el detalle completo). Hallazgo relevante: el
  paso 2 del checklist reveló que el plan original estaba mal para 3 de las 4
  tablas (`atributos`/`atributo_opciones`/`catalogo_atributos` siguen siendo
  feature viva, no deuda técnica) — solo `catalogo_precios` se dropeó
  (`009_fase6_drop_catalogo_precios.sql`), con backup real tomado antes.
  **Este MD llegó a 1186 líneas / ~115KB (~29.000 tokens estimados) — cada
  sesión nueva paga ese costo completo solo para tener contexto, sin haber
  escrito una sola línea de código todavía.** Se va a iniciar una limpieza de
  este documento para reducir ese costo, probablemente en la próxima sesión o
  más adelante en esta misma. **Plan de la limpieza (para que ningún agente se
  sorprenda si el archivo cambia de tamaño/forma):** condensar el historial
  narrativo de la sección 0 y las entradas ya cerradas de la sección 8 en un
  resumen compacto por dominio (qué se hizo, qué se validó, qué quedó
  pendiente si algo), **sin perder ningún hallazgo activo, lección aprendida
  recurrente (los 3-4 patrones de "el repo no refleja la BD real" que ya
  costaron incidentes reales), bloqueante vigente, ni el checklist de esta
  misma sección.** Lo que se recorta es la narración paso a paso de trabajo ya
  cerrado y confirmado (por ejemplo, no hace falta conservar 3 confirmaciones
  independientes redundantes de un mismo deploy una vez que las 3 dicen lo
  mismo). **Si estás a mitad de una tarea cuando esto pase:** termina y
  commitea tu trabajo antes, o si ves que el MD cambió de forma a mitad de tu
  sesión, hacé `git log` sobre este archivo para confirmar que tu contexto
  sigue vigente antes de seguir escribiendo sobre información que pudo haberse
  resumido (no borrado, resumido).



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
  **Gotcha real:** `docker-compose.yml` de lilop **no vive en la raíz del repo**, vive
  en `projects/lilop/api/` — `docker compose restart` desde `~/srv/docker` falla con
  "no configuration file provided". El comando correcto es
  `cd ~/srv/docker/projects/lilop/api && docker compose restart lilop-api`.
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
5. **Corte (cutover)** — ✅ **Cerrada.** `domains/catalogo/CatalogoRepository`
   (admin de precios) y `fn_recalc_pedido_valor_venta()` (trigger de `pedidos`,
   entrada #42) ya leen/escriben contra `variables`/`variantes`, no contra
   `catalogo_precios`. Confirmado con 3 pruebas reales en producción (entrada #43).
   Las tablas viejas (`catalogo_precios`/`atributos`/`atributo_opciones`/
   `catalogo_atributos`) siguen existiendo como respaldo — nada las escribe ya desde
   el código nuevo, pero no se han borrado (eso es la Fase 6).
6. **Limpieza** — 🔲 Pendiente. Drop de `catalogo_precios`/`atributos`/
   `atributo_opciones`/`catalogo_atributos` (ya sin escritores activos desde la
   Fase 5) + de los `.bak`/`.bak2` versionados en git en `admin/html/assets/`
   (ya eliminados, ver entrada de limpieza previa — verificar que no reaparecieron).

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

### Lecciones de diseño del rollout (todos los dominios ya migrados, ver sección 8)

- **No forzar herencia de `BaseRepository` cuando el contrato no aplica** (Liskov):
  `domicilio` (solo reenvía a un webhook) e `imagenes` (filesystem + `sharp`) no
  extienden `BaseRepository` — ese contrato envuelve `pool.query`, y un cliente
  HTTP o el filesystem no son intercambiables por un pool de Postgres. Inversión
  de dependencias a mano: `fetch`/`sharp`/`fs` se inyectan por constructor.
- **Bounded contexts distintos sobre la misma tabla no comparten repository**:
  `usuarios` (CRUD admin) y `auth` (login/vendedores) tienen cada uno su propio
  `UsuarioRepository` pese a apuntar a la misma tabla — evita que un repository
  termine siendo "god class" de dos responsabilidades no relacionadas. Mismo
  criterio aplicado después a `productos` (bot) vs `productos_pedido` (líneas de
  pedido).
- **Errores de Postgres se traducen a errores de dominio en el service**, nunca
  se filtra el código de Postgres al controller — `RegistroDuplicadoError`
  (`maestros`), `EmailDuplicadoError` (`usuarios`), `MedioPagoInvalidoError`
  (`pedidos`), todos con el mismo patrón `instanceof` en el controller.
- **Repository genérico parametrizado por tabla cuando varias tablas son
  idénticas en forma** (`maestros`: `origenes_venta`/`conceptos_costo`/
  `conceptos_compra` comparten `id`/`nombre`) — pero sin forzar una tabla con
  forma distinta (`categorias`, con `slug`/`activo`) dentro del mismo molde.
- **Bugs preexistentes del código viejo se documentan, no se corrigen de paso**
  en un refactor de arquitectura — mezclar los dos riesgos dificulta aislar qué
  rompió qué. Ejemplos preservados a propósito: `maestros.crearConceptoCompra`
  acepta nombre solo-espacios (a diferencia de los otros 2 catálogos hermanos);
  `toTitleCase` de `clientes` no trata bien los acentos.
- **Des-hardcodeo de URLs/paths a env vars** se hizo en el mismo commit que la
  migración a POO cuando el controller viejo ya las tenía hardcodeadas
  (`DOMICILIO_WEBHOOK_URL`, `IMAGENES_UPLOADS_DIR`) — mismo valor como default,
  cero cambio de comportamiento si la env var no se configura.

## 7ter. Pendientes explícitos para la siguiente sesión

1. ~~Migrar el resto de dominios a POO/SOLID~~ — ✅ **Completado: backend 100%
   migrado (16/16 dominios, entrada #41).**
2. ~~Fase 4-5 (validación en paralelo + corte)~~ — ✅ **Completado (entradas #42/#43).**
   El admin de precios y el cálculo de `valor_venta`/`ganancias` de pedidos ya leen
   del esquema nuevo, no de `catalogo_precios`.
3. **Fase 6 (limpieza) — en curso.** `catalogo_precios` dropeada (`009`, entrada
   #46, código listo, falta deploy). `atributos`/`atributo_opciones`/
   `catalogo_atributos` quedan **fuera**, tienen escritores activos hoy (feature
   viva de atributos extra con sobreprecio) — dropearlas requiere antes una
   decisión de producto (¿se mantienen para siempre o se migran a `variables`?),
   no es limpieza de deuda técnica.
4. **Conectar los endpoints al nodo de IA en n8n** — endpoints, contrato y validación
   en producción ya cerrados (secciones 7bis y 5-Fase 4); falta configurar el nodo
   HTTP en el workflow de n8n y pegar las 7 reglas en el prompt del agente. Explícito:
   el dueño pidió dejar esto para el final, después de cerrar la migración a POO/SOLID
   (ya cerrada — este pendiente pasa a ser el siguiente candidato natural).
5. **Test automatizado para el dominio `auth`** — es el único dominio migrado que no
   tiene test en `tests/domains/` (los demás sí). No es urgente (el dominio ya está
   confirmado en prod con happy path real, ver entradas #13-16), pero cierra el hueco
   de cobertura.
6. **Limpieza de `categorias`** — separar las 4 taxonomías mezcladas (tipo, material,
   composición, target/diseño). No bloqueante, marcado explícitamente como fase aparte.
7. **Etapa 6 (frontend)** — refactor de admin JS + site JS a ES Modules. Ya no está
   bloqueada por Fase 5 (cerrada) — sigue pendiente la decisión de `atributos`/
   `catalogo` (punto 3) antes de considerar esto completamente destrabado, pero
   podría evaluarse en paralelo si el dueño lo prioriza.
8. **Limpieza de este mismo MD** — anunciada y en curso (ver sección 0), para
   reducir el costo de tokens de cada sesión nueva.

## 8. Registro de verificación por agente (para el orquestador)

> **Nota:** esta sección se compactó (ver anuncio en la sección 0) para reducir el
> costo de tokens de leer este archivo. El detalle narrativo completo de las
> entradas cerradas y confirmadas sigue disponible en el historial de git de este
> archivo (`git log -p -- projects/lilop/docs/migracion-productos-variantes.md`)
> si algún día hace falta el razonamiento exacto de alguna decisión ya tomada.
> Aquí solo queda: qué se hizo, quién, y el estado final. Las entradas que
> siguen con algo pendiente (⏳) conservan el detalle necesario para retomarlas.

`domains/productos/` cubre **solo** los endpoints de solo lectura del bot
(`/api/public/bot/productos[/:id]`) — bounded context distinto de
`domains/productos_pedido/` (CRUD de líneas de un pedido, entrada #40).

| # | Agente | Dominio / tarea | Estado final |
|---|---|---|---|
| 1 | Agente 1 | Endpoints bot `/api/public/bot/productos[/:id]` | ✅ confirmado en prod |
| 2 | Agente 1 | Limpieza de 45 archivos `.bak*` versionados | ✅ |
| 3 | Agente 1 | Fix: quitar `disponible`/`stock` del contrato del bot | ✅ confirmado en prod |
| 4 | Agente 1 | Docs: cerrar Fase 4 (validación) para endpoints del bot | ✅ |
| 5 | — | Migración `productos` a POO/SOLID (caso de referencia del patrón) | ✅ confirmado en prod |
| 6 | Agente 1 | Migración `domicilio` a POO/SOLID + webhook a env var | ✅ confirmado en prod |
| 7 | Agente 1 | Migración `imagenes` a POO/SOLID + uploads dir a env var | ✅ confirmado en prod |
| 8-10 | Agente 1 | Docs (registro por agente, regla de pull, sincronización) | ✅ |
| 11 | Agente 1 | Migración `maestros` a POO/SOLID (4 catálogos) | ✅ confirmado en prod (ver #23) |
| 12 | Agente 2 | 🔴 Fix bloqueante: `index.js` con import roto tras migrar `maestros` (habría tumbado el arranque) | ✅ confirmado en prod |
| 13 | Agente 2 | Migración `auth` a POO/SOLID (login + vendedores) | ✅ confirmado en prod (ver #14-16) |
| 14-16 | Agente 2 | Deploy + validación real de `auth` (contrato de error + happy path de login con usuario de prueba) | ✅ |
| 17 | Agente 2 | Análisis: estado de JS admin/site, confirma Etapa 6 ya planeada y bloqueada por Fase 5/6 | ✅ análisis, sin código |
| 18 | Agente 3 | Suite de tests real (`api/tests/`) para core + productos/domicilio/imagenes | ✅ |
| 19-21 | Agente 3 | Migración `comisiones`, `entregas`, `disenos` a POO/SOLID | ✅ confirmados en prod (ver #23) |
| 22-23 | Agente 1 | Validación combinada + deploy real de `auth`/`comisiones`/`entregas`/`disenos`/`maestros` | ✅ |
| 24 | Agente 1 | Migración `usuarios` a POO/SOLID | ✅ confirmado en prod (ver #27) |
| 25-26 | Agente 1 | Migración `demo` a POO/SOLID → 🔴 **incidente: API caído (502)** por `DemoService` validando `webhookUrl` en el constructor sin necesitarlo — corregido en el mismo deploy | ✅ incidente resuelto |
| 27 | Agente 1 | Confirmación en prod de `usuarios` + `demo` (mismo deploy que cerró #26) | ✅ |
| 28 | Agente 2 | Fix de bug real: `costos_pedido.js` usaba columna `nombre_vendedor` inexistente en `comisiones` (feature activa en el front) — comisión pasa a ser 100% manual | ✅ confirmado en prod |
| 29-30 | Agente 2 | 🔴 Deuda técnica encontrada al desplegar #28: trigger `fn_recalc_comision_pedido` no rastreado en git pisaba el `UPDATE` manual — se quita el manual, el trigger queda como única fuente de verdad (`004`) | ✅ confirmado en prod con prueba end-to-end |
| 31-32 | Agente 3 | Migración `clientes` y `atributos` a POO/SOLID | ✅ confirmados en prod |
| 33 | Agente Negro (ex Agente 3) | Migración `compras` a POO/SOLID | ✅ confirmado en prod |
| 34 | Agente Verde | Tests automatizados para `maestros`/`usuarios`/`demo` | ✅ |
| 35-36, 38 | Agente Rojo (ex Agente 2) | Migración `costos_pedido` a POO/SOLID + 🔴 mismo bug de #29 pero en `domicilio` (trigger `trg_entregas_recalc_domicilio` no rastreado, mismo fix) — confirmado con prueba end-to-end real (comisión + domicilio subiendo exactamente lo esperado, datos de prueba limpiados después) | ✅ confirmado en prod |
| 37, 39 | Agente Rojo | Migración `catalogo` a POO/SOLID (admin de precios legacy) | ✅ confirmado en prod con datos reales del catálogo público |
| 40 | Agente 2 | Migración `pedidos` + `productos_pedido` a POO/SOLID (dominio de mayor riesgo, 3 triggers + `ganancias` `GENERATED` — investigado con `\d`/`\sf` antes de tocar nada, ver migraciones `005`/`006`) | ✅ confirmado en prod |
| 41 | Agente Negro | Migración `pedidos_publicos` a POO/SOLID — **backend 100% migrado (16/16 dominios)** | ✅ confirmado en prod |
| 42 | Agente Rojo | 🔴 **Bloqueante real de Fase 6, resuelto**: desacople de `fn_recalc_pedido_valor_venta()` de `catalogo_precios` a `variantes` (migración `008`) | ✅ confirmado en prod, cero cambios financieros (validado antes/después + trigger forzado en vivo, ver #44/#45) |
| 43 | Agente Negro | Cierre de Fase 5: admin de precios (`catalogo.js`) migrado de `catalogo_precios` a `variantes` | ✅ confirmado en prod con 3 pruebas reales |
| 44-45 | Agente Verde, Agente Rojo | Confirmaciones independientes (en paralelo) del deploy de `008` — mismo resultado, sin contradicciones. Hallazgo aparte: `PD0051` tiene un producto con nombre que nunca resolvió precio en ningún esquema (deuda de datos preexistente, no bloqueante) | ✅ |
| 46 | Agente 2 (orquestador) | Inicio de Fase 6: verificación reveló que solo `catalogo_precios` tiene cero escritores activos — `atributos`/`atributo_opciones`/`catalogo_atributos` siguen siendo feature viva, quedan **fuera** de la limpieza. Backup real tomado (89 filas) antes de escribir `009_fase6_drop_catalogo_precios.sql` | ⏳ **código y backup listos, falta desplegar `009` en prod y confirmar con `\dt`** |
| 47 | Agente 2 (orquestador) | 🔴 Al desplegar `009`, la migración falló en prod (rollback automático, sin daño): `vista_catalogo_agente` — vista no rastreada en git, creada directo en producción — depende de `catalogo_precios`. Confirmado por el dueño: **n8n la consulta directo contra Postgres** (el catálogo pre-armado para el nodo de IA, pendiente #4). Escrita `010_desacoplar_vista_catalogo_agente_de_legacy.sql`: actualiza solo `precios_por_tamanio` para leer de `variantes` (mismo criterio que `008`), sin tocar `adicionales`/`categorias`/`disenos_disponibles` (siguen leyendo de tablas vivas). Validado antes de escribir: comparación 1:1 sobre todos los productos activos reales, **0 discrepancias** | ⏳ **`010` lista, falta desplegarla + reintentar `009` después** |


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

- **Agente Rojo** (de vuelta, tras `git pull` — sin cambios nuevos remotos). El dueño
  autoriza empezar el bloqueante real de Fase 6: desacoplar `fn_recalc_pedido_valor_venta()`
  (y el join legacy duplicado en `PedidoRepository.obtener()`) de las tablas
  `catalogo_productos`/`catalogo_precios`, para que lean del esquema nuevo
  (`variables`/`variantes`/`atributos_resueltos`) en su lugar. **Es el cambio de mayor
  riesgo hasta ahora** — toca el cálculo de `valor_venta`/`ganancias` de TODO pedido
  real en producción. Plan antes de escribir una sola línea:
  1. Investigar el esquema real de `variables`/`variantes`/`atributos_resueltos` en
     prod con `\d` (no asumir que 002_variables_variantes.sql refleja el 100%,
     mismo criterio de siempre).
  2. Confirmar con datos reales que hay paridad 1:1 entre lo que hoy vive en
     `catalogo_productos`/`catalogo_precios` y lo que existe en el esquema nuevo —
     si falta algún producto/precio en el esquema nuevo, el corte rompería pedidos
     reales.
  3. Escribir el trigger nuevo de forma **aditiva** (no tocar el viejo todavía):
     misma función, mismo trigger, pero apuntando al esquema nuevo, corriendo en
     paralelo comparando resultados antes de hacer el corte real.
  4. Solo después de validar en paralelo, hacer el corte (reemplazar el trigger
     viejo) — nunca en el mismo commit que el punto 3.
  Toco: nueva migración SQL (aditiva), `PedidoRepository.obtener()` (solo cuando el
  punto 3/4 esté validado). No toco nada de `catalogo`/`costos_pedido` (ya cerrados).

  **Deploy real de la migración `008` confirmado y validado end-to-end por el dueño
  (rol de orquestador, Agente 2) — entrada #42 dada por CERRADA:**
  1. Foto ANTES del deploy (`valor_venta`/`ganancias` de los 7 pedidos reales con
     productos) guardada.
  2. Comparación legacy-vs-nuevo corrida justo antes del deploy sobre datos reales:
     **0 filas** — paridad total confirmada una vez más, inmediatamente antes del
     corte (no solo en la validación previa a escribir el código).
  3. `git pull` + `npm run migrate` en producción: `008` aplicada sin error,
     `docker compose restart api` limpio, contenedor `healthy`.
  4. Foto DESPUÉS del deploy: **idéntica, pedido por pedido**, a la foto de antes
     (`PD0050` 180000.00/53000.00, `PD0051` 390000.00/145600.00, `PD0052`
     360000.00/100900.00, `PD0053` 165000.00/47900.00, `PD0054` 288000.00/74000.00,
     `PD0055` 155000.00/41200.00, `PD0057` 195000.00/44000.00) — cero cambios
     financieros para ningún pedido real.
  5. Prueba end-to-end real: se forzó `UPDATE productos SET updated_at = now()` sobre
     un producto real de `PD0050` (`PR0067`) para disparar de verdad
     `trg_productos_recalc_valor_venta` contra el trigger nuevo — `UPDATE 1` sin
     error, y `PD0050` mantuvo exactamente el mismo `valor_venta`/`ganancias`.
  **Bloqueante real de Fase 6 resuelto y confirmado por completo**: el cálculo de
  `valor_venta`/`ganancias` de todo pedido ya no depende de `catalogo_productos`/
  `catalogo_precios`. **Nota de esta misma sesión, ya superada al momento de
  hacer push**: al escribir esto todavía pensaba que el corte del admin de precios
  (`catalogo.js`) seguía pendiente — un `git pull` inmediatamente después reveló
  que Agente Negro ya lo había cerrado en paralelo (entrada #43) mientras yo
  hacía esta misma prueba. Mi confirmación del deploy de `008` también resultó
  redundante con las de Agente Verde (#44) y Agente Rojo (#45), corridas en
  paralelo — mismo resultado, sin contradicciones, se deja como tercera
  confirmación independiente sin valor adicional real más allá de la redundancia.
