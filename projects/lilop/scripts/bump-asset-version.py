#!/usr/bin/env python3
"""
Versiona automáticamente los <script src="/assets/js/...local...js"> de todo
HTML bajo un directorio raíz, usando un hash del contenido real del archivo.
Uso: python3 bump-asset-version.py <ruta_a_html_root>
Ejecutar en cada despliegue que modifique JS. Idempotente y auditable:
la versión SIEMPRE refleja el contenido real, no un número manual.
"""
import sys, re, hashlib, pathlib

def hash_file(path):
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]

def main(html_root):
    root = pathlib.Path(html_root)
    pattern = re.compile(r'(src="(/assets/js/[^"?]+\.js))(\?v=[a-f0-9]+)?"')
    total_files = 0
    total_refs  = 0
    for html_file in root.glob("*.html"):
        text = html_file.read_text(encoding="utf-8")
        def repl(m):
            nonlocal total_refs
            rel_path = m.group(2).lstrip("/")
            js_path = root / rel_path
            if not js_path.exists():
                print(f"  AVISO: {js_path} no existe, se deja sin tocar")
                return m.group(0)
            v = hash_file(js_path)
            total_refs += 1
            return f'{m.group(1)}?v={v}"'
        new_text = pattern.sub(repl, text)
        if new_text != text:
            html_file.write_text(new_text, encoding="utf-8")
            total_files += 1
            print(f"OK: {html_file.name} actualizado")
    print(f"\nResumen: {total_files} archivos HTML modificados, {total_refs} referencias versionadas")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python3 bump-asset-version.py <ruta_a_html_root>")
        sys.exit(1)
    main(sys.argv[1])
