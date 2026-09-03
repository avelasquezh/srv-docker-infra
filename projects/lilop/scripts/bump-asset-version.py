#!/usr/bin/env python3
"""
Versiona automáticamente los <script src="/assets/js/...js"> y
<link href="/assets/css/...css"> de todo HTML bajo un directorio raíz,
usando un hash del contenido real del archivo.
Uso: python3 bump-asset-version.py <ruta_a_html_root>
Ejecutar en cada despliegue que modifique JS o CSS. Idempotente y auditable:
la versión SIEMPRE refleja el contenido real, no un número manual.
"""
import sys, re, hashlib, pathlib

def hash_file(path):
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]

# (attr_name, carpeta, extensión)
ASSET_KINDS = [
    ("src",  "/assets/js/",  ".js"),
    ("href", "/assets/css/", ".css"),
]

def main(html_root):
    root = pathlib.Path(html_root)
    total_files = 0
    total_refs  = 0
    for html_file in root.glob("*.html"):
        text = html_file.read_text(encoding="utf-8")
        original = text
        for attr, folder, ext in ASSET_KINDS:
            escaped_folder = re.escape(folder)
            escaped_ext = re.escape(ext)
            pattern = re.compile(
                rf'({attr}="({escaped_folder}[^"?]+{escaped_ext}))(\?v=[a-f0-9]+)?"'
            )
            def repl(m):
                nonlocal total_refs
                rel_path = m.group(2).lstrip("/")
                asset_path = root / rel_path
                if not asset_path.exists():
                    print(f"  AVISO: {asset_path} no existe, se deja sin tocar")
                    return m.group(0)
                v = hash_file(asset_path)
                total_refs += 1
                return f'{m.group(1)}?v={v}"'
            text = pattern.sub(repl, text)
        if text != original:
            html_file.write_text(text, encoding="utf-8")
            total_files += 1
            print(f"OK: {html_file.name} actualizado")
    print(f"\nResumen: {total_files} archivos HTML modificados, {total_refs} referencias versionadas")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python3 bump-asset-version.py <ruta_a_html_root>")
        sys.exit(1)
    main(sys.argv[1])
