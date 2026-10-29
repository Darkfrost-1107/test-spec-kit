# Accessibility Checklist: TurnoYa v1 (T045 · Principio III · SC-007)

**Purpose**: verificar la accesibilidad básica exigida por la constitución.
**Created**: 2026-10-29
**Feature**: [spec.md](../spec.md)

Verificación automática: `tests/integration/a11y-security.test.js` (estructura de todas las pantallas
por rol) y `tests/unit/contrast.test.js` (contraste WCAG AA de cada par de colores).

## Estructura y semántica

- [x] `lang="es"`, un único `h1` por pantalla y navegación con `aria-label` (probado en 16 pantallas, una por ruta y rol)
- [x] Enlace "Saltar al contenido" como primer elemento enfocable
- [x] Todo `input`/`select` visible tiene `label for` asociado (probado)
- [x] Toda tabla tiene `caption` y encabezados `th scope="col"` (probado)
- [x] Las tablas anchas se desplazan en un contenedor con foco de teclado (`role="region"`, `tabindex="0"`)

## Formularios y errores

- [x] Errores de validación en texto junto al campo, con `role="alert"` y `aria-describedby` (probado en registro)
- [x] Mensajes de negocio (flash) con `role="alert"` (error) o `role="status"` (éxito)
- [x] Los estados de una cita se muestran con texto ("Activa", "Cancelada", "Asistió", "No asistió"), no solo con color

## Teclado y contraste

- [x] Solo elementos nativos interactivos (enlaces, botones, campos); no hay controles que dependan del ratón
- [x] Foco visible de 3 px en enlaces, botones, campos y contenedores desplazables
- [x] Contraste ≥ 4.5:1 en texto principal, secundario, marca, éxito y error (probado, 11 pares)
- [x] La aplicación funciona sin JavaScript en el navegador

## Notas

- Verificación manual de lectores de pantalla pendiente (no se ejecutó en esta iteración).
- Capturas de la UI real: `capturas/07-app-v1/` (incluye vista móvil 390 px).
