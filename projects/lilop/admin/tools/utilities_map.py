# Fuente única de verdad: declaración CSS normalizada -> clase utilitaria.
# Solo se incluyen valores que ya usan tokens de tokens.css o que se repiten
# 2+ veces en el proyecto (evidencia real, sin inventar clases de un solo uso).

UTIL = {}

def reg(decl, cls):
    UTIL[decl] = cls

# ── Display / Flex ──────────────────────────────────────────
reg('display:flex', 'd-flex')
reg('display:none', 'd-none')
reg('display:block', 'd-block')
reg('display:grid', 'd-grid')
reg('flex-direction:column', 'flex-col')
reg('align-items:center', 'items-center')
reg('align-items:flex-start', 'items-start')
reg('align-items:flex-end', 'items-end')
reg('justify-content:center', 'justify-center')
reg('justify-content:space-between', 'justify-between')
reg('justify-content:flex-end', 'justify-end')
reg('flex-wrap:wrap', 'flex-wrap')
reg('flex:1', 'flex-1')
reg('flex-shrink:0', 'shrink-0')
reg('min-width:0', 'min-w-0')

# ── Gap (escala --s-N) ───────────────────────────────────────
for n in [1,2,3,4,5,6,8]:
    reg(f'gap:var(--s-{n})', f'gap-{n}')

# ── Padding / Margin (escala --s-N) ───────────────────────────
for n in [1,2,3,4,5,6,8,10]:
    reg(f'padding:var(--s-{n})', f'p-{n}')
    reg(f'margin-bottom:var(--s-{n})', f'mb-{n}')
    reg(f'margin-top:var(--s-{n})', f'mt-{n}')

# padding compuesto (vertical horizontal) más usado
reg('padding:var(--s-4) var(--s-6)', 'p-4-6')
reg('padding:var(--s-5) var(--s-6)', 'p-5-6')
reg('padding:var(--s-2) var(--s-3)', 'p-2-3')
reg('padding:var(--s-3) var(--s-4)', 'p-3-4')

# ── Tipografía ─────────────────────────────────────────────
for key in ['2xs','xs','sm','base','md','lg','xl','2xl']:
    reg(f'font-size:var(--text-{key})', f'text-{key}')
for key in ['light','regular','medium','semibold','bold']:
    reg(f'font-weight:var(--weight-{key})', f'font-{key}')
reg('font-weight:600', 'font-semibold')
reg('font-weight:700', 'font-bold')
reg('text-align:center', 'text-center')
reg('text-align:right', 'text-right')
reg('font-family:var(--font-display)', 'font-display')
reg('white-space:nowrap', 'nowrap')
reg('text-transform:uppercase', 'uppercase')

# ── Color de texto (semántico, según tokens.css) ─────────────
reg('color:var(--color-text)', 'text-ink')
reg('color:var(--color-text-muted)', 'text-muted')
reg('color:var(--color-text-light)', 'text-light')
reg('color:var(--color-violet)', 'text-violet')
reg('color:var(--color-lavender)', 'text-lavender')
reg('color:var(--color-error)', 'text-error')
reg('color:var(--color-warning)', 'text-warning')
reg('color:var(--color-success)', 'text-success')
reg('color:white', 'text-white')
reg('color:inherit', 'text-inherit')

# ── Bordes / radios ────────────────────────────────────────
for key in ['xs','sm','md','lg','xl','2xl','pill']:
    reg(f'border-radius:var(--r-{key})', f'radius-{key}')

# ── Cursor / posición ─────────────────────────────────────────
reg('cursor:pointer', 'cursor-pointer')
reg('user-select:none', 'select-none')
reg('position:relative', 'pos-relative')
reg('position:absolute', 'pos-absolute')

# ── Tamaños recurrentes (icon/avatar) ─────────────────────────
# NOTA: el emparejamiento width+height se resuelve en migrate_inline.py
# (SIZE_PAIRS), no aquí, para no migrar un width o height aislado.
SIZE_PAIRS = {10: 'size-10', 15: 'size-15', 26: 'size-26', 28: 'size-28', 36: 'size-36'}
