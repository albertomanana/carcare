# Catálogo de vehículos y logotipos de marca

Estado: **implementado el 06/11/2026** (sesión interactiva). Pendiente de visto bueno de Alberto y de anotarlo como ADR si se mantiene.

## Qué es

Ayuda para no teclear en el formulario de vehículo: marca → modelo → versión. El usuario puede escribir cualquier valor; el catálogo solo sugiere y, al elegir una versión, rellena motor, combustible y cambio (y la carrocería del modelo cuando es inequívoca).

## Fuentes (regla de oro 2: nada sin fuente)

| Dato | Fuente | Licencia / límites |
|------|--------|--------------------|
| Modelos y motorizaciones de ~35 marcas, desde 2005 | EPA / DOE *Fuel Economy Data* (`https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip`) | Dominio público de EE. UU. **Mercado estadounidense**: nombres de modelo y motores de allí; **no** traen los acabados comerciales españoles (FR, Xcellence…) |
| Modelos de Seat, Cupra, Dacia, Peugeot, Renault, Citroën, Opel, Škoda, DS, Lancia, Abarth, Alpine, MG, BYD… | Lista **editorial** escrita a mano en `scripts/generar-catalogo.mjs` (solo nombres y carrocería cuando es inequívoca) | Sin fuente abierta limpia (Wikidata mezcla variantes históricas, NHTSA solo cubre EE. UU.). Se marca en la interfaz como «lista orientativa, sin versiones». Conviene revisarla |
| Logotipos | `simple-icons` 13.21.0 vía jsDelivr, copiados a `frontend/public/img/marcas/` | SVG bajo CC0; **las marcas siguen siendo de sus titulares** (uso informativo para identificar la marca del vehículo del usuario) |

Marcas sin logotipo en simple-icons (Cupra, Lexus, DS, Lancia, BYD, Lotus, Alpine, Abarth, Infiniti, Genesis…): se muestra un **monograma**, nunca un logo inventado.

## Cómo se regenera

```bash
node scripts/generar-catalogo.mjs [ruta/vehicles.csv]   # → frontend/src/data/catalogo-vehiculos.json (~630 KB, ~49 KB gzip)
node scripts/descargar-logos.mjs                          # → frontend/public/img/marcas/*.svg (42 logos)
```

Resultado actual: 97 marcas, 1 063 modelos, 6 299 versiones (27 538 filas EPA ≥ 2005).

## Decisiones

- El JSON se importa con `import()` dinámico (`frontend/src/lib/catalog.ts`): solo se descarga al abrir el formulario de vehículo.
- La carrocería solo se autorrellena si **todas** las filas del modelo comparten una clase inequívoca de la EPA (familiar, SUV, monovolumen, furgoneta, pick-up, dos plazas); en el resto la elige el usuario.
- Los nombres de modelo son los de la EPA (p. ej. «Golf/GTI», «3 Series»): se buscan por subcadena sin tildes.
- Relación con ADR-0004 (modelo 3D procedural sin marcas ni modelos con licencia): **no cambia**. El coche 3D sigue siendo genérico; los logotipos solo identifican la marca en la interfaz. Si Alberto prefiere no mostrar marcas registradas en el TFG/producto, basta con quitar `BrandLogo`.

## Limitaciones conocidas

- Versiones del mercado de EE. UU.; faltan acabados españoles y marcas europeas sin versiones.
- Años hasta 2027 en algunas versiones (modelos del año ya publicados por la EPA).
- La lista editorial puede tener omisiones o nombres desactualizados.
