# Seguimiento del proyecto

Este archivo guarda **solo el estado que no está escrito en otro documento**. Todo lo demás (pasos de la fase 0,
módulos, preguntas, lo que falta conseguir, documentos y versiones) se lee de los documentos del repositorio.

Para ver el tablero: `pnpm tracker` y abrir [seguimiento.html](seguimiento.html).

Reglas:

- Una pregunta se da por respondida cuando su línea en `open-questions.md` lleva ✅ o dice "decidido", "decidida",
  "resuelta" o "respondida". Para las que viven en una tabla (P1–P30, M1–M3) o para corregir lo que se detecta, use
  la tabla **Respuestas**.
- Estados válidos. Preguntas: `abierta`, `parcial`, `respondida`. Módulos y tareas: `pendiente`, `en curso`, `hecho`,
  `bloqueado`, `retirado`. Por conseguir: `por conseguir`, `pedido`, `conseguido`.
- La columna **Pregunta** usa el número de PREGUNTAS.md (`P3`, `M1`) o `<MÓDULO> <n>` como en la columna Fuente
  (`INV 44`, `PLAN 3.1`, `CONTAC 7`).

## Respuestas

| Pregunta | Estado | Fecha | Nota |
|---|---|---|---|
| P3 | parcial | 2026-11-12 | El programa es `factura-electronica-mc` (ver dte/). Falta confirmar desde qué fecha cada cliente está en producción. |

## Módulos

Sobrescribe el estado que se deduce de `modulos-y-orden.md` ("(hecho)") y de `fase-0.md`.

| Módulo | Estado | Nota |
|---|---|---|
| parties | hecho | Fase 0, paso 9. Sin pantalla todavía. |
| reports | retirado | Deja de ser un módulo (modulos-y-orden §1.4). |

## Por conseguir

La columna **Ítem** es un texto que aparece en el punto de PREGUNTAS.md §2.

| Ítem | Estado | Fecha | Nota |
|---|---|---|---|
| programa externo de factura electrónica | conseguido | 2026-11-12 | Es `factura-electronica-mc`, documentado en docs/legacy/dte/. |

## Tareas

Tareas que no salen de ningún otro documento.

| Tarea | Estado | Módulo | Nota |
|---|---|---|---|
| Revisar P1–P30 con el contador | pendiente | | Una sola ronda; "de acuerdo" es una respuesta válida. |
