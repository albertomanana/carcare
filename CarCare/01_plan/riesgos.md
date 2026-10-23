# Registro de riesgos

*Probabilidad e impacto: Alta / Media / Baja. Revisar en cada cierre de oleada o sprint. Última revisión: 21/10/2026 (agente producto), tras ampliar el alcance a particular + taller + 3D.*

## Riesgos activos

| # | Riesgo | Prob. | Impacto | Mitigación | Estado |
|---|--------|-------|---------|------------|--------|
| R1 | No tener la normativa real de Ilerna (la plantilla es de la URJC) | Alta | Alto | Conseguir la guía oficial (D1) antes de redactar la memoria. La arquitectura es reversible mientras haya poco código. | Abierto |
| R2 | Alcance excesivo frente al calendario | — | — | **Sustituido por R12** (el alcance cambió el 21/10/2026). | Sustituido |
| R3 | Las referencias visuales empujan a mostrar datos que no existen (salud, conducción) | Media | Medio | Ninguna cifra sin fuente. Zonas rotuladas "según tus intervalos, no medido". El rayos X rotulado "Ilustrativo". | Abierto |
| R4 | Diseño por delante de funcionalidad: **ahora agravado por el 3D** | Alta | Medio | La definición de terminado exige datos reales y estados. El 3D se construye sobre endpoints reales (`/zones`, `/bays`). Si hay que recortar, se recorta antes el 3D decorativo (portada, rayos X) que el funcional (zonas). | Abierto |
| R5 | Fuga de datos entre usuarios o espacios | Media | Alto | Ver R15. Policies y test de aislamiento por endpoint desde el primer día. | Abierto |
| R6 | Configuración de Sanctum SPA (CORS, cookies, CSRF) | Media | Medio | Mismo origen gracias al proxy de Vite. E2E de login temprano en la oleada 2. | Abierto |
| R7 | Código que no sepa defender ante el tribunal: **más probable con varios agentes generando mucho código en paralelo** | Alta | Alto | Un commit por oleada. Informes con evidencias. Alberto lee los informes y el diff y pide a la sesión principal que le explique cada módulo antes de la memoria. ADR para cada decisión. | Abierto |
| R8 | Imágenes de coches con marcas registradas | Baja | Medio | Coche 3D procedural propio y silueta propia (ADR‑0004): sin logotipos ni formas de modelos concretos. | Mitigado |
| R9 | Costes de hosting e IA | Baja ahora | Alto en fase 3 | IA solo después de validar con usuarios. Demo en local con vídeo de respaldo (D14). | Abierto |
| R10 | Competidores parecidos | Alta | Medio | **Confirmado** (ver `06_investigacion/competencia.md`): lo básico para particulares es gratis o barato y el software de taller abunda y es barato. Diferenciarse solo donde lo justifiquen los datos (D13) y validarlo. | Abierto |
| R11 | Privacidad (RGPD) con usuarios reales | Media | Alto | Mínimos datos. Exportar y borrar cuenta (E1‑7, E10‑4). Política de privacidad antes de abrir a terceros. Ver R21 para los clientes de taller. | Abierto |
| R12 | **Alcance ampliado (particular + taller + 3D) frente a un calendario sin fijar** | Alta | Alto | Fijar D6 ya. Plan de recorte D9 con un **núcleo defendible** marcado en el backlog. No añadir épicas nuevas hasta cerrar la oleada 2. Revisar el alcance al cerrar cada oleada con datos reales (historias en `Hecho`). | Abierto |
| R13 | **Rendimiento 3D en equipos modestos o móviles** (incluido el equipo de la defensa) | Media | Alto | three.js en un chunk diferido, un `<Canvas>` por pantalla, `frameloop="demand"`, DPR [1, 2], miniaturas estáticas (ADR‑0004). Medir los fps en un **equipo de referencia** definido (E14‑7). Silueta 2D si no hay WebGL. Vídeo de la demo como plan B. | Abierto |
| R14 | **Versiones muy recientes o sin soporte**: React 19.3, Vite 8.3, TypeScript 6.0, React Router 8.5, R3F 9.8, drei 10.7, Tailwind 4.3. Además, **Node 25 sin soporte de seguridad desde el 01/06/2026**, PHP 8.2 hasta el 31/12/2026 y Laravel 12 hasta el 24/02/2027 (fuente: endoflife.date, consultado el 21/10/2026) | Alta | Medio | Fijar versiones con lockfile y no actualizar a mitad de una oleada. Que `devops` pase a Node LTS (24 o 26). Decidir D15 (PHP 8.4 + Laravel 13) según la fecha de la defensa. Build y tests en CI. Documentar en la memoria las versiones y su soporte. Ante incompatibilidades entre librerías, preferir la versión estable anterior y justificarlo en el informe. | Abierto |
| R15 | **Complejidad multiespacio y roles**: permisos mal aplicados en UI o API, un mecánico que ve importes, recursos de otro espacio accesibles | Media | Alto | Matriz de permisos del contrato §2 con un test por capacidad y rol (E13‑4). 404 para ajenos (E1‑5). Auditoría de `seguridad` en la oleada 3 (E6‑5). La UI oculta lo que el rol no puede hacer (sin botones decorativos). | Abierto |
| R16 | **Validación con talleres reales difícil** (poco tiempo, desconfianza, acceso) | Alta | Medio | Reclutar ya 2‑3 talleres cercanos (familia, amigos, prácticas de Ilerna). Sesiones cortas (45 min) en su taller con datos demo. Si no se consigue, decirlo en la memoria como limitación y probar con perfiles cercanos (mecánicos o estudiantes de automoción), sin presentarlos como talleres. | Abierto |
| R17 | **Mercado del software de taller saturado y barato en España** (desde 10 €/mes con VERI\*FACTU incluido) | Alta | Medio (comercial) | No competir en facturación ni inventario. Posicionarse en el puente particular ↔ taller (D13) y en la experiencia, y validarlo antes de invertir. | Abierto |
| R18 | **Facturación legal**: presentar el total de la orden como "factura" sin cumplir el reglamento de sistemas informáticos de facturación (RD 1007/2023, VERI\*FACTU) | Media | Alto (si hay uso real) | D12 opción A: rotular "Resumen de la orden (no es una factura)" e "Importe de órdenes entregadas". No emitir facturas en el TFG. | Abierto |
| R19 | **Desajustes al integrar** backend y frontend construidos en paralelo contra el contrato | Media | Medio | Contrato primero (tipos compartidos), oleada 2 dedicada a la integración, cambios de contrato solo vía `arquitecto` y con historial. | Abierto |
| R20 | **El 3D no aporta valor real** a los usuarios (gusta en la demo pero no se usa) | Media | Medio | Medirlo en las pruebas: ¿usan la vista 3D o la lista para encontrar la zona? ¿Lo entienden? (guion, tareas P5 y T6). Si no aporta, el 3D se queda como presentación y la navegación principal en 2D. | Abierto |
| R21 | **Datos personales de terceros** (clientes del taller): el taller sería responsable y CarCare encargado del tratamiento (art. 28 RGPD) | Media | Alto (comercial) | Campos mínimos (nombre, contacto, NIF opcional). Historia E11‑6 (exportar y anonimizar). Contrato de encargado y política de privacidad antes de cualquier uso real. En el TFG, solo datos demo ficticios. | Abierto |
| R22 | **Dependencia de servicios de correo** para funciones de fase 2 (recuperar contraseña, avisos, invitaciones) | Media | Bajo | Mailpit o el log de Laravel en desarrollo. Elegir proveedor solo en fase 2 y anotar el coste en D14. | Abierto |

## Nuevo riesgo

```
| R23 | Descripción | Prob. | Impacto | Mitigación | Abierto |
```
