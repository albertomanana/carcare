# Cómo liderar al equipo de agentes de CarCare

Esta guía es para ti, Alberto. Explica quién hay en el equipo, cómo darle trabajo a cada uno, cómo ver lo que están haciendo y cómo revisar lo que entregan.

---

## 1. El equipo de un vistazo

Los agentes son **subagentes de Claude Code** definidos en `.claude/agents/*.md`. Cada uno tiene un rol, una zona del código de la que es dueño, unas normas de calidad y la obligación de dejar un informe con pruebas.

| Agente | Rol | Llámalo cuando… | Zona |
|--------|-----|-----------------|------|
| `arquitecto` | Tech lead | Hay que decidir *cómo* se hace algo, cambiar la API, escribir un ADR, repartir trabajo o revisar coherencia | Contrato de API, `docs/arquitectura/` |
| `producto` | Product manager | Tienes una idea, quieres priorizar, escribir historias, analizar la competencia o preparar entrevistas | `CarCare/` (planificación) |
| `backend-laravel` | Backend | Base de datos, endpoints, reglas de negocio, seeders, tests de API | `backend/` |
| `frontend-react` | Frontend | Pantallas, formularios, componentes, navegación, responsive | `frontend/` (menos el 3D) |
| `experto-3d` | Gráficos 3D | El coche 3D, zonas interactivas, rayos X, taller 3D, portada, rendimiento WebGL | `frontend/src/three/` |
| `disenador-ux` | Diseño y accesibilidad | Quieres una revisión visual, de usabilidad o de accesibilidad, o diseñar un flujo | Revisión (+ tokens) |
| `qa-tester` | Calidad | Verificar que algo funciona de verdad: E2E, axe, criterios de aceptación, bugs | `frontend/e2e/`, tests |
| `seguridad` | Auditor | Antes de una entrega: permisos, aislamiento, archivos, RGPD, dependencias | Revisión |
| `devops` | Infraestructura | Scripts de arranque, CI de GitHub, despliegue, copias de seguridad | Raíz, `scripts/`, `.github/` |
| `documentador-tfg` | Redactor | Memoria, diagramas, requisitos, manuales, preparar la defensa | `docs/tfg/` |

**Tú eres el director del proyecto.** La sesión principal de Claude Code (con la que hablas) actúa como **jefe de equipo**: reparte encargos, lanza agentes en paralelo, integra resultados y te informa.

---

## 2. Cómo darle trabajo a un agente

> **Importante:** Claude Code carga los agentes de `.claude/agents/` al **abrir la sesión**. Si un agente se crea o se edita a mitad de una conversación, no estará disponible por su nombre hasta que reinicies Claude Code (o recargues la ventana de VS Code). Mientras tanto, la sesión principal puede lanzar un agente general indicándole que adopte el rol de su archivo `.md` (así se lanzó la oleada 1).

### Opción A — Pídeselo a la sesión principal (recomendada)
Escribe en lenguaje natural a quién va el encargo:

> Que el agente **backend-laravel** añada la exportación de gastos a CSV. Criterio: el CSV coincide con los filtros de la pantalla de gastos y tiene test.

La sesión principal lanza el agente, espera su informe y te lo resume.

### Opción B — Mención directa
En el cuadro de chat escribe `@` y elige el agente de la lista (aparece como `@agent-backend-laravel`, etc.). Así te aseguras de que lo hace ese agente y no la sesión principal.

### Opción C — Varios a la vez (paralelo)
> Lanza en paralelo: **frontend-react** hace la pantalla de clientes y **experto-3d** mejora los faros en modo noche. Zonas distintas, no se pisan.

Regla: **solo en paralelo si tocan carpetas distintas**. Si dos agentes tienen que tocar lo mismo, va primero uno y luego el otro, o se usa un *worktree* (copia aislada del repo): "lánzalo con aislamiento worktree".

### Plantilla de encargo (cópiala)

```text
Agente: <nombre>
Objetivo: <qué quieres conseguir, en una frase>
Contexto: <por qué; enlaza historia del backlog o decisión si existe>
Alcance: <qué entra y qué NO entra>
Criterios de aceptación:
- <comprobable 1>
- <comprobable 2>
Cómo verificarlo: <tests, comando, pantalla a revisar>
Entrega: informe en docs/equipo/informes/ y fila actualizada en el tablero
```

Cuanto más concretos los criterios, mejor trabaja el agente. "Que quede bonito" no es un criterio; "en 360 px el formulario cabe sin scroll horizontal y el botón principal es visible sin desplazar" sí lo es.

---

## 3. Cómo ver qué están haciendo

| Dónde | Qué ves |
|-------|---------|
| **La conversación** | Cada agente aparece como un bloque desplegable. Al abrirlo ves cada archivo que lee, cada edición y cada comando con su resultado, en directo. Los agentes en segundo plano avisan al terminar. |
| **`docs/equipo/TABLERO.md`** | Qué tiene cada agente entre manos, su estado, su último informe y lo que se piden entre ellos. Ábrelo cuando quieras una foto del equipo. |
| **`docs/equipo/informes/`** | Un informe por encargo: objetivo, archivos tocados, **evidencias** (comandos y resultados reales), limitaciones y siguiente paso. Es lo primero que debes leer al revisar. |
| **Git** | `git status` y `git diff` muestran exactamente qué ha cambiado. Haz un commit al cerrar cada oleada: así cada diff corresponde a un trabajo concreto y puedes deshacerlo. |
| **Los tests** | `php artisan test` (backend) y `npm run test` / `npm run build` (frontend). Si un agente dice "funciona", debe venir con la salida de estos comandos. |
| **La app** | `php artisan serve` + `npm run dev` y abres http://localhost:5173. Nada sustituye a probarlo tú. |
| **`/agents`** | Comando de Claude Code para ver, crear y editar los agentes. |

---

## 4. El ciclo de trabajo (un sprint)

```text
 Idea / problema
      │
      ▼
 producto ──► historia con criterios de aceptación (CarCare/02_backlog)
      │
      ▼
 arquitecto ──► ¿cambia la API o los datos? contrato + ADR + reparto por zonas
      │
      ▼
 backend-laravel ∥ frontend-react ∥ experto-3d   (en paralelo, contra el contrato)
      │
      ▼
 sesión principal ──► integración real API ↔ pantallas
      │
      ▼
 qa-tester ∥ seguridad ∥ disenador-ux   (revisión en paralelo)
      │
      ▼
 correcciones de los dueños ──► documentador-tfg actualiza memoria y manuales
      │
      ▼
 TÚ: lees informes, pruebas la app, haces commit
```

---

## 5. Cómo revisar una entrega (checklist de 5 minutos)

1. **Lee el informe** del agente. ¿Tiene evidencias reales (salida de tests, build)? Si dice "debería funcionar", no está terminado.
2. **Mira el diff** (`git diff --stat` y luego los archivos importantes). ¿Ha tocado archivos fuera de su zona? Debe explicarlo.
3. **Ejecuta los tests** tú mismo.
4. **Pruébalo en el navegador** en escritorio y estrechando la ventana a móvil.
5. **Comprueba la regla de oro**: ¿aparece alguna cifra o función que no salga de datos reales? Si sí, devuélvelo.
6. Si todo está bien: `git add -A && git commit -m "..."`.

---

## 6. Cuando algo sale mal

| Síntoma | Qué hacer |
|---------|-----------|
| El agente dice que funciona pero no hay pruebas | "Ejecuta los tests y pega la salida real en el informe." |
| Ha tocado archivos de otro agente | Pídele que lo revierta y que lo apunte como petición en el tablero. |
| Backend y frontend no encajan (campos distintos) | Llama al `arquitecto`: decide quién se adapta al contrato. |
| Se ha inventado un dato, una cifra o una integración | Recuérdale la regla 2 de `CLAUDE.md` y pide que muestre "faltan datos" en su lugar. |
| Se atasca o da vueltas | Para el agente, divide el encargo en partes más pequeñas y relánzalo con criterios más concretos. |
| No te gusta el resultado visual | `disenador-ux` revisa y propone; `frontend-react` o `experto-3d` aplican. |

---

## 7. Ajustar a los agentes

Cada agente es un archivo Markdown en `.claude/agents/`. Puedes editarlo directamente o con `/agents`:
- **`description`**: cuándo debe usarse. Si la sesión principal elige mal al agente, afina esta frase.
- **`tools`**: qué herramientas puede usar (por ejemplo, `seguridad` no tiene `Edit` para que no cambie código).
- **`model`**: `inherit` usa el mismo modelo que la sesión; puedes poner `sonnet` o `haiku` para tareas sencillas y ahorrar.
- **El cuerpo**: sus normas. Si un agente repite un error, añade la regla aquí.

Las reglas comunes a todos están en `CLAUDE.md` (raíz). Cámbialas ahí para que las sigan todos.

---

## 8. Chuleta de encargos útiles

```text
@agent-producto Convierte esta idea en historias con criterios: "avisar por email 7 días antes de la ITV".
@agent-arquitecto ¿Cómo añadimos notificaciones por email sin colas complejas? Propón contrato y ADR.
@agent-backend-laravel Implementa la historia E7-3 según el contrato actualizado, con tests de aislamiento.
@agent-frontend-react Pantalla de ajustes de notificaciones. Estados de carga, vacío y error. 360/768/1280.
@agent-experto-3d Añade un modo "noche" al taller 3D con luces de los elevadores. Presupuesto: 60 fps en portátil.
@agent-disenador-ux Revisa el dashboard del taller en 360 px y dame los 5 problemas más graves.
@agent-qa-tester Escribe el E2E del flujo de orden de trabajo completo y ejecútalo.
@agent-seguridad Audita la subida y descarga de documentos.
@agent-devops Crea el workflow de CI y comprueba que pasa en local.
@agent-documentador-tfg Genera el diagrama E-R desde las migraciones actuales.
```

---

## 9. Piloto automático (trabaja solo cuando tú no estás)

Al iniciar sesión en Windows se abre CarCare (servidores + VS Code) y una ventana minimizada **"CarCare - piloto automático"**. Cada hora, o justo cuando se resetea el límite de uso, lanza una sesión de Claude Code sin chat que coge la siguiente tarea de la cola de [`AUTOPILOTO.md`](AUTOPILOTO.md), se la encarga al agente adecuado, verifica y deja informe y nota de sesión.

- **Dirigirlo** = ordenar la cola de `AUTOPILOTO.md`. Lo que esté arriba y `Pendiente` es lo siguiente que hará.
- **Pausarlo** mientras trabajas tú con Claude: `scripts/autopiloto/pausar.cmd` (y `reanudar.cmd` al terminar). Si no lo pausas, respeta la fila "Sesión interactiva" del tablero, pero ambos gastaréis del mismo límite de uso.
- **Ver qué hizo**: tabla "Últimas ejecuciones" de `AUTOPILOTO.md`, `CarCare/05_sesiones/` y `scripts/autopiloto/logs/`.
- **Quitarlo**: `scripts/autopiloto/desinstalar.cmd` y cerrar su ventana.
- Nunca hace commit, push, borrados ni decisiones marcadas "Decide Alberto".

## 10. Rituales recomendados

- **Al empezar una sesión**: "Resume el tablero y los informes desde la última vez. ¿Qué está bloqueado?"
- **Al terminar una sesión**: "Crea la nota de sesión en `CarCare/05_sesiones/` con lo hecho, lo comprobado y lo siguiente." Luego commit.
- **Una vez por semana**: `producto` revisa el backlog; `seguridad` pasa auditoría; `documentador-tfg` actualiza la memoria.
