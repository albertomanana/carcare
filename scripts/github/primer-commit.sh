#!/usr/bin/env bash
# Primeros commits del repositorio local, ordenados según CONTRIBUTING.md:
#   main    → solo README, normas y plantilla de PR
#   develop → todo el proyecto, un commit por área
# Solo actúa si el repositorio aún no tiene commits.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TRAILER=$'\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
cd "$ROOT"

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "El repositorio ya tiene commits: nada que hacer."; exit 0
fi

# Seguridad: ningún .env ni archivos de storage en lo que se va a añadir.
if git add -A --dry-run | grep -E "/\.env'$|/\.env\.[^e][^']*'$|/storage/(app|logs|framework)/" | grep -v "/\.gitignore'$"; then
  echo "ABORTADO: se colaría un .env o archivos de storage."; exit 4
fi

commit() { # $1 = mensaje, resto = rutas
  local msg="$1"; shift
  git add -- "$@" 2>/dev/null || true
  if ! git diff --cached --quiet; then git commit -q -m "$msg$TRAILER"; echo "  ✔ $msg"; fi
}

git symbolic-ref HEAD refs/heads/main
commit "docs: README, normas de contribución y plantilla de pull request" README.md CONTRIBUTING.md .gitignore .github

git checkout -q -b develop
commit "docs(plan): documentación original y carpeta de planificación" Car_Care_Documentacion CarCare
commit "docs(equipo): reglas del proyecto, ADR, contrato de la API y equipo de agentes" CLAUDE.md .claude docs frontend/src/api/types.ts
commit "feat(backend): API REST v1 con Laravel 12, reglas de negocio, datos demo y tests" backend
commit "feat(3d): coche procedural por carrocería, zonas, rayos X y taller 3D" frontend/src/three frontend/three-lab.html
commit "feat(frontend): SPA React para particulares y talleres" frontend
commit "chore(scripts): arranque local, piloto automático y conexión con GitHub" scripts iniciar-carcare.bat .tools/composer
git add -A
git diff --cached --quiet || { git commit -q -m "chore: resto de archivos del proyecto$TRAILER"; echo "  ✔ resto"; }

echo
git log --oneline --graph --all
