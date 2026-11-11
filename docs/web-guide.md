# Guía para construir pantallas

Reglas para todo el código de `apps/web`.

## Reglas fijas

- **Next.js 15 en exportación estática** (`output: 'export'`): sin componentes de servidor que
  consulten datos, sin `middleware.ts` y **sin segmentos dinámicos** (`[id]`). Los parámetros van
  en la query (`?id=…`) con `useSearchParams` dentro de un `<Suspense>`.
- React 18, Tailwind 3, TanStack Query 5, iconos de `lucide-react`. **No hay shadcn ni Radix**:
  se usan los componentes propios de `src/components/ui`. No agregar dependencias.
- **Todo texto visible en español**, formal y corto. Código, nombres y comentarios en inglés.
- Los usuarios vienen del sistema anterior: pantallas densas, mismo flujo, uso con teclado.
- **Montos:** siempre cadenas exactas (`'1234.50'`). Nunca `Number()` ni `parseFloat` sobre un
  monto. Mostrar con `formatMoney`, capturar con `MoneyInput`, sumar con `addMoney`/`subMoney`
  de `@accounting/shared`.
- **Ningún archivo de más de 200 líneas**: dividir en componentes y hooks.
- Tipos y contratos desde `@accounting/shared` (`coa.ts`, `gl.ts`). Nunca importar
  `@accounting/shared/server`.

## Piezas que hay que reutilizar

| Qué | Dónde |
|---|---|
| Llamadas a la API | `lib/api.ts`: `apiFetch(path, { json, method })`, `qs({...})`, `ApiError` (`status`, `code`, `body`), `errorMessage(err)` |
| Usuario y permisos | `lib/session.ts`: `useCurrentUser()` → `{ user, can('capture' \| 'reports' \| 'supervise') }` |
| Empresa activa | `lib/empresa.tsx`: `useEmpresa()` → `{ empresa, empresas }` |
| Mes de trabajo | `lib/work-period.ts`: `useWorkPeriod()` → `[period, setPeriod]` (`AAAA-MM`) |
| Formato | `lib/format.ts`: `formatMoney`, `parseMoneyInput`, `formatDate` |
| Rutas del menú | `lib/nav.ts` (cada pantalla vive en la ruta que ahí aparece) |
| Botones y campos | `components/ui/button.tsx` (`Button`, `cx`), `form.tsx` (`Input`, `Select`, `Field`, `Checkbox`, `inputClass`) |
| Diálogos y avisos | `components/ui/feedback.tsx`: `Alert`, `Dialog`, `ConfirmDialog`, `PageHeader`, `Loading` |
| Barra de acciones | `components/ui/toolbar.tsx`: `ActionToolbar` (Agregar F2, Buscar F3, Modificar F4, Copiar F6, Eliminar F8, Imprimir F9, Grabar F10, Cancelar Esc, Anterior/Siguiente Re Pág/Av Pág). Un handler `undefined` deshabilita el botón. |
| Tablas | `components/ui/table.tsx`: `Table`, `Th`, `Td`, `MoneyTd`, `rowClass`, `selectedRowClass` |
| Mes | `components/ui/month-picker.tsx`: `MonthPicker` (ENERO…DICIEMBRE) |
| Monto | `components/ui/money-input.tsx`: `MoneyInput` |
| Cuentas | `components/contabilidad/AccountPicker.tsx` y `components/contabilidad/coa/use-coa.ts` (`useAccounts()`) |

Pantalla de referencia: `components/contabilidad/coa/CatalogScreen.tsx`.

## Calidad

- Toda query key incluye el id de la empresa (`useEmpresa().empresa.id`).
- Estados de carga, vacío y error en cada pantalla. Los errores de la API ya vienen en español.
- Después de un cambio, invalidar las queries afectadas.
- Accesible: campos con etiqueta, foco visible, el foco vuelve a su lugar al cerrar un diálogo.
- Impresión con `window.print()`: el layout ya oculta menú, barra superior y barras de acciones
  (`print:hidden`). Agregar un encabezado solo de impresión con empresa, título y período.

## Verificación

- `pnpm type-check` en `apps/web`.
- `pnpm build` en `apps/web` debe generar la exportación estática sin errores.
