# Herramientas internas (no se sirven en producción)

`utilities_map.py` — fuente de verdad: declaración CSS -> clase utilitaria.
`gen_utilities_css.py` — genera `../html/assets/css/utilities.css` a partir del mapa.

Para regenerar tras editar el mapa:

```
cd projects/lilop/admin/tools
python3 gen_utilities_css.py
```
