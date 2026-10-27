# 14. Bibliografía

> ⚠️ **Depende de Ilerna.** El formato de las referencias (APA, ISO 690 u otro) lo fijará la guía del módulo de Proyecto. Este borrador usa un formato de tipo APA, con la fecha de consulta en las fuentes web.

**Criterio.** Solo se incluyen fuentes que la memoria cita o que se han usado en el proyecto. Las fuentes del análisis de competencia se consultaron el 21/10/2026 y así consta en [`CarCare/06_investigacion/competencia.md`](../../../CarCare/06_investigacion/competencia.md). La documentación técnica se ha usado durante el desarrollo, pero no se anotó la fecha en que se consultó cada página; en lugar de inventarla, se indica la versión del software a la que corresponde.

> [PENDIENTE: tarea 10 — comprobar que todos los enlaces siguen activos y anotar la fecha de consulta de la documentación técnica antes de entregar.]

## 14.1 Normativa y estándares

- Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016, relativo a la protección de las personas físicas en lo que respecta al tratamiento de datos personales y a la libre circulación de estos datos (Reglamento general de protección de datos). *Diario Oficial de la Unión Europea*, L 119, 4 de mayo de 2016. https://eur-lex.europa.eu/eli/reg/2016/679/oj — Citado en el ADR‑0005 y en RNF-12.
- Real Decreto 1007/2023, de 5 de diciembre, por el que se aprueba el Reglamento que establece los requisitos que deben adoptar los sistemas y programas informáticos o electrónicos que soporten los procesos de facturación de empresarios y profesionales, y la estandarización de formatos de los registros de facturación. *Boletín Oficial del Estado*. — Citado en los capítulos 1, 2 y 13 y en la decisión D12. [PENDIENTE: tarea 10 — completar con el número del BOE tras consultarlo; en el proyecto solo se consultó el Real Decreto‑ley 15/2025, que lo modifica.]
- Real Decreto‑ley 15/2025, disposición final primera. *Boletín Oficial del Estado*, n.º 290, 3 de diciembre de 2025. BOE‑A‑2025‑24446. https://www.boe.es/buscar/act.php?id=BOE-A-2025-24446 (consultado el 21/10/2026).
- World Wide Web Consortium (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*. Recomendación del W3C. https://www.w3.org/TR/WCAG22/ — Nivel AA como objetivo (OE‑6, RNF-10).

## 14.2 Métodos y referencias académicas

- Brooke, J. (1996). SUS: A "quick and dirty" usability scale. En P. W. Jordan, B. Thomas, B. A. Weerdmeester e I. L. McClelland (Eds.), *Usability Evaluation in Industry* (pp. 189‑194). Taylor & Francis. — Cuestionario SUS del guion de pruebas con usuarios (capítulo 12).
- Clegg, D. y Barker, R. (1994). *Case Method Fast-Track: A RAD Approach*. Addison‑Wesley. — Origen de la priorización MoSCoW usada en el backlog (capítulo 3).
- Nygard, M. (2011). *Documenting Architecture Decisions*. Cognitect. https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions — Formato de los ADR (capítulo 6, §6.2).
- Sandhu, R. S., Coyne, E. J., Feinstein, H. L. y Youman, C. E. (1996). Role-Based Access Control Models. *IEEE Computer*, 29(2), 38‑47. — Control de acceso basado en roles (capítulo 6, §6.3).
- Sauro, J. y Dumas, J. S. (2009). Comparison of three one-question, post-task usability questionnaires. En *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '09)* (pp. 1599‑1608). ACM. — Pregunta SEQ tras cada tarea (capítulo 12).

## 14.3 Documentación técnica

Versión usada en el proyecto entre paréntesis (capítulo 7, §7.1).

*Tabla 14.1. Documentación técnica consultada.*

| Tecnología | Documentación oficial | Temas consultados |
|------------|-----------------------|-------------------|
| Laravel (12.70) | https://laravel.com/docs/12.x | Sanctum en modo SPA, *policies* y autorización, *Form Requests* y validación, limitación de peticiones, API *Resources*, transacciones, recuperación de contraseña |
| Pest (3.8) | https://pestphp.com/docs | *Datasets*, pruebas de *feature* |
| PHP (8.2) | https://www.php.net/manual/es/ | Enumerados (*backed enums*), aritmética entera |
| MariaDB (10.4) | https://mariadb.com/kb/en/ | `SELECT … FOR UPDATE`, tipos `DECIMAL` |
| React (19.3) | https://react.dev/ | `lazy`, `Suspense`, límites de errores |
| React Router (8.5) | https://reactrouter.com/ | Rutas anidadas y carga diferida |
| TanStack Query (5) | https://tanstack.com/query/latest | Claves de caché e invalidación |
| React Hook Form (7.90) y Zod (3.25) | https://react-hook-form.com/ · https://zod.dev/ | Formularios y esquemas de validación |
| Vite (8.3) | https://vite.dev/ | Proxy de desarrollo, división en *chunks* |
| Tailwind CSS (4.3) | https://tailwindcss.com/docs | Variables de tema |
| Radix UI | https://www.radix-ui.com/primitives | Diálogos, menús y pestañas accesibles |
| three.js (0.186) | https://threejs.org/docs/ | Geometría, materiales, liberación de recursos |
| React Three Fiber (9.8) y drei (10.7) | https://r3f.docs.pmnd.rs/ · https://drei.docs.pmnd.rs/ | `frameloop="demand"`, `dpr`, `Lightformer` |
| Recharts (3.10) | https://recharts.org/ | Gráficos de la analítica |
| Vitest (4.1) y Playwright (1.64) | https://vitest.dev/ · https://playwright.dev/ | Pruebas de cliente y extremo a extremo |
| axe-core | https://github.com/dequelabs/axe-core | Auditoría automática de accesibilidad (prevista) |
| Mermaid (11.4) | https://mermaid.js.org/ | Sintaxis de los diagramas de esta memoria |
| Conventional Commits (1.0.0) | https://www.conventionalcommits.org/es/v1.0.0/ | Formato de los mensajes de commit |
| Claude Code (Anthropic) | https://docs.anthropic.com/en/docs/claude-code | Asistente de programación usado en el desarrollo (capítulo 3, §3.2) |

- endoflife.date. *PHP, Node.js, Laravel*. https://endoflife.date/ (consultado el 21/10/2026). — Fechas de fin de soporte de la decisión D15 (capítulo 2, §2.5).

## 14.4 Fuentes del análisis de competencia

Todas consultadas el **21/10/2026** por el agente de producto. Los precios y valoraciones del capítulo 2 son los publicados ese día.

**Aplicaciones para particulares**

- Drivvo. https://www.drivvo.com/ · Precios: https://www.drivvo.com/en/pricing · App Store España: https://apps.apple.com/es/app/drivvo-gesti%C3%B3n-de-veh%C3%ADculos/id1206041425
- Fuelio (Sygic). https://www.fuel.io/ · App Store España: https://apps.apple.com/es/app/fuelio-gas-tracker-mpg/id1487753318
- Simply Auto. https://www.simplyauto.app/
- AUTODOC CLUB (Autodoc SE). App Store España: https://apps.apple.com/es/app/id1462874968
- Dirección General de Tráfico. *miDGT*. https://sede.dgt.gob.es/export/sites/dgt/es/appmidgt/index.html · *Consulta los datos de tus vehículos*. https://www.dgt.es/nuestros-servicios/tu-vehiculo/tus-vehiculos/consulta-los-datos-de-tus-vehiculos/
- Mapfre (11/11/2025). *5 apps para el mantenimiento del coche*. https://www.motor.mapfre.es/consejos-practicos/consejos-de-mantenimiento/5-apps-para-el-mantenimiento-del-coche/ — Solo como fuente secundaria; las aplicaciones que menciona no se verificaron.

**Software de gestión de talleres**

- Tekmetric. Precios: https://www.tekmetric.com/pricing
- Shopmonkey. Precios: https://www.shopmonkey.io/pricing
- Garage Hive. Precios: https://garagehive.co.uk/pricing/
- TallerMatic. https://www.tallermatic.com/
- Programa Taller. https://www.programa-taller.es/

## 14.5 Documentación interna del proyecto

No es bibliografía externa, pero es la fuente de la mayoría de las afirmaciones de esta memoria:

*Tabla 14.2. Documentación interna del proyecto.*

| Documento | Ruta |
|-----------|------|
| Documentación de producto original (20/10/2026) | `Car_Care_Documentacion/` |
| Contrato de la API v1 y su historial de cambios | `docs/api/contrato-v1.md` |
| Decisiones de arquitectura ADR‑0001 a 0006 | `docs/arquitectura/` |
| Registro de decisiones de producto D1‑D17 | `CarCare/03_decisiones/registro-decisiones.md` |
| Backlog, riesgos y plan | `CarCare/02_backlog/`, `CarCare/01_plan/` |
| Informes de los agentes, con sus evidencias | `docs/equipo/informes/` |
| Documentación de diseño del 21/10/2026 | `docs/tfg/01…08` |
