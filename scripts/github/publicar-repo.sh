#!/usr/bin/env bash
# Publica CarCare en GitHub: crea el repositorio PRIVADO "carcare" en la cuenta conectada,
# sube `main` y `develop` y deja `main` como rama por defecto. Idempotente.
# Requisitos: sesión iniciada (scripts/github/conectar-github.cmd) y commits locales (primer-commit.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GH="$ROOT/.tools/gh/bin/gh.exe"
REPO_NAME="carcare"
cd "$ROOT"

"$GH" auth status >/dev/null 2>&1 || { echo "No hay sesión de GitHub: ejecuta scripts/github/conectar-github.cmd"; exit 2; }
git rev-parse --verify main >/dev/null 2>&1 || bash "$ROOT/scripts/github/primer-commit.sh"
"$GH" auth setup-git

if ! git remote get-url origin >/dev/null 2>&1; then
  "$GH" repo create "$REPO_NAME" --private \
    --description "CarCare: gestión integral del vehículo con interfaz 3D, para particulares y talleres (TFG DAW, Ilerna)" \
    --source . --remote origin
fi
git push -q -u origin main
git push -q -u origin develop
"$GH" repo edit --default-branch main >/dev/null
echo "Publicado: $("$GH" repo view --json url -q .url)"
