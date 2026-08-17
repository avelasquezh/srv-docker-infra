import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from utilities_map import UTIL, SIZE_PAIRS

# Agrupar declaraciones por clase (ej. size-28 junta width+height),
# deduplicando por propiedad (si dos entradas mapean a la misma clase
# y misma propiedad, se queda con la version basada en variable).
by_class = {}
for decl, cls in UTIL.items():
    prop, val = decl.split(':', 1)
    props = by_class.setdefault(cls, {})
    if prop in props and 'var(' in props[prop] and 'var(' not in val:
        continue  # ya hay version con variable, no pisarla con valor crudo
    props[prop] = val

for px, cls in SIZE_PAIRS.items():
    by_class[cls] = {'width': f'{px}px', 'height': f'{px}px'}

lines = [
"/* ============================================================",
"   Lilop Admin — utilities.css",
"   Clases atomicas generadas a partir de patrones de uso real",
"   (ver util_map.py). Cubren estilos repetidos que antes vivian",
"   como atributos style inline en HTML/JS.",
"   ============================================================ */",
"",
]

# orden estable: por nombre de clase
for cls in sorted(by_class.keys()):
    body = ' '.join(f'{p}: {v};' for p, v in by_class[cls].items())
    lines.append(f'.{cls} {{ {body} }}')

out_path = os.path.join(os.path.dirname(__file__), '..', 'html', 'assets', 'css', 'utilities.css')
open(out_path, 'w').write('\n'.join(lines) + '\n')
print(f"Generadas {len(by_class)} clases utilitarias -> {out_path}")
