"""Numera tablas y figuras de la memoria y genera sus índices.

Uso, desde la raíz del repositorio:
    python docs/tfg/herramientas/numerar_figuras_tablas.py            # renumera y escribe los índices
    python docs/tfg/herramientas/numerar_figuras_tablas.py --comprobar  # solo informa

Convenciones (capítulo 0, "Convenciones de este documento"):
- Cada tabla lleva ENCIMA una línea `*Tabla C.N. Título.*`.
- Cada diagrama Mermaid lleva DEBAJO del bloque una línea `*Figura C.N. Título.*`.
- C es el número del capítulo (prefijo del archivo) y N el orden dentro del capítulo.
- El archivo 00-indice.md no se numera: es la portada y el índice.
El script respeta el título de cada pie y solo cambia su número. Si una tabla o figura no
tiene pie, lo informa como error para que se escriba a mano (no inventa títulos).
Los índices se escriben en 00-indice.md entre las marcas <!-- indice-figuras --> y
<!-- fin-indice-tablas -->.
"""
import glob
import os
import re
import sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "memoria")
PIE = re.compile(r"^\*(Tabla|Figura) (\d+)\.(\d+)\. (.+)\*$")


def procesar(ruta, capitulo):
    lineas = open(ruta, encoding="utf-8").read().split("\n")
    tablas, figuras, errores = [], [], []
    en_codigo, es_mermaid = False, False
    for i, l in enumerate(lineas):
        if l.startswith("```"):
            if not en_codigo:
                en_codigo, es_mermaid = True, l.startswith("```mermaid")
            else:
                en_codigo = False
                if es_mermaid:
                    j = i + 1
                    while j < len(lineas) and lineas[j].strip() == "":
                        j += 1
                    m = PIE.match(lineas[j]) if j < len(lineas) else None
                    if m and m.group(1) == "Figura":
                        figuras.append(j)
                    else:
                        errores.append(f"{os.path.basename(ruta)}:{i + 1} figura sin pie")
            continue
        if en_codigo:
            continue
        if l.startswith("|") and (i == 0 or not lineas[i - 1].startswith("|")):
            j = i - 1
            while j >= 0 and lineas[j].strip() == "":
                j -= 1
            m = PIE.match(lineas[j]) if j >= 0 else None
            if m and m.group(1) == "Tabla":
                tablas.append(j)
            else:
                errores.append(f"{os.path.basename(ruta)}:{i + 1} tabla sin pie")
    entradas = []
    for tipo, indices in (("Tabla", tablas), ("Figura", figuras)):
        for n, j in enumerate(indices, start=1):
            titulo = PIE.match(lineas[j]).group(4)
            lineas[j] = f"*{tipo} {capitulo}.{n}. {titulo}*"
            entradas.append((tipo, capitulo, n, titulo, os.path.basename(ruta)))
    return "\n".join(lineas), entradas, errores


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    comprobar = "--comprobar" in sys.argv
    todas, errores = [], []
    for ruta in sorted(glob.glob(os.path.join(BASE, "[0-9][0-9]-*.md"))):
        capitulo = int(os.path.basename(ruta)[:2])
        if capitulo == 0:
            continue
        texto, entradas, errs = procesar(ruta, capitulo)
        todas += entradas
        errores += errs
        if not comprobar:
            open(ruta, "w", encoding="utf-8").write(texto)
    for e in errores:
        print("ERROR", e)
    figs = [e for e in todas if e[0] == "Figura"]
    tabs = [e for e in todas if e[0] == "Tabla"]
    print(f"{len(figs)} figuras y {len(tabs)} tablas")
    if comprobar or errores:
        return
    bloque = ["<!-- indice-figuras -->", "## Índice de figuras", ""]
    bloque += [f"- Figura {c}.{n}. {t} — [{a}]({a})" for _, c, n, t, a in figs]
    bloque += ["", "## Índice de tablas", ""]
    bloque += [f"- Tabla {c}.{n}. {t} — [{a}]({a})" for _, c, n, t, a in tabs]
    bloque += ["<!-- fin-indice-tablas -->"]
    indice = os.path.join(BASE, "00-indice.md")
    texto = open(indice, encoding="utf-8").read()
    patron = re.compile(r"<!-- indice-figuras -->.*<!-- fin-indice-tablas -->", re.S)
    if patron.search(texto):
        texto = patron.sub(lambda _: "\n".join(bloque), texto)
    else:
        texto = texto.rstrip("\n") + "\n\n" + "\n".join(bloque) + "\n"
    open(indice, "w", encoding="utf-8").write(texto)


if __name__ == "__main__":
    main()
