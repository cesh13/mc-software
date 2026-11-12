# plan64 — Modelo de datos

Marcas: **[V]** verificado en el código, **[D]** verificado en los datos (solo estructura, conteos y rangos), **[I]** inferido.
**No se copió ningún dato de empleados, empresas ni importes.** "Vivas" = filas no marcadas como borradas en el DBF.

## 1. Tablas legadas

### 1.1 Dónde están
- `MCERP/plan64/dbf` — 262 archivos: las tablas del módulo, respaldos (`*.BAK`), comprimidos (`DBFPLAN.RAR`, `DBFin.rar`, `*.zip`) y temporales. La carpeta **está en uso**: la tabla de planilla se actualizó por última vez el 2023-08 y `VALORES` en 2025-04 [D].
- `MCERP/plan64/fuente` — código (1,878 archivos) más tablas de sistema: `EMPRESAS` (1 fila; `CAMINO`, `CAMINO2`, `CAMINOIVA`), `USUARIOS` (2 vivas), `USREMP` (9 vivas), `PERFIL` (266 vivas) y los archivos `.MEM` (`CONFIG.MEM`, `MESACT.MEM`, `PORVACA.MEM`, `MESES.MEM`, `EMPRESA.MEM`…). Hay además unas 60 tablas de trabajo (`AA`, `JJ` con 100,000 filas, `PP`, `SS`, `X`…) y exportes `.XLS`/`.TXT`: **no se migran** [D].
- Tablas de **otros módulos** que el código abre sin ruta (por `SET PATH`): `CATALOGO`, `PARTIDAS`, `DETAPART`, `TIPOPAR`, `SALDOS` (CONTAC). No hay datos de CONTAC en `plan64/dbf` (solo copias `DPROVV*`/`PPROVV*` de partidas generadas, 1 encabezado cada una) [D]. **Bancos no se usa** [V].

### 1.2 Tablas del módulo

Claves por nombre de campo y tipo (C = carácter, N = numérico, L = lógico, D = fecha, M = memo). Conteos de la copia (vivas / total si difiere).

**Empleados y estructura**

| Tabla | Contenido | Campos clave | Conteo |
|---|---|---|---|
| `MAESTRO` | Empleado (145 campos) | `CODIGO` C15; `CODEMP` C3; `DIVISION` C2; `CCOSTO` C6; `CARGO` C2; `TIPO_SAL` N1; `SALARIO_M`/`SALARIO_H` N9.2; `COTIZAR` N; `CUALAFP` C2; banderas (§2.1 de business-rules); cuentas contables `CTA*` C14; fechas `FECHAIN`, `FECHALI`, `FINACTIVO`, `ULTVACA`, `FECHAAG`, `FECHAIND`; datos personales (nombre, documentos, dirección, contacto, salud, beneficiarios) | 23 filas, 20 con código; 6 liquidados; ingresos 2018-12 a 2023-07 |
| `EMPRESA2` | Patrono | `CODIGO` C3; razón social, NIT, giro, `ISSSPAT` C15, cuentas `CTA*` | 1 |
| `DIVISION` | Departamento | `CODEMP`+`DIVISION`; `CTASANTICI`, `CTASLIQUID` | 2 |
| `CCOSTOS` | Centro de costo de planilla | `CODEMP`+`DIVISION`+`CCOSTO` C6; 7 cuentas | 2 |
| `CARGOS`, `AGRUPA`, `PROFESIO`, `ESTATUS`, `BANCOS`, `ALCALDIA`, `AFP` | catálogos | ver business-rules §2.2 | 1, 3, 9, 3, 2, 70, 4 |
| `RECORI` | Ingresos/renta previos y acumulados del año | `EMPLEADO` C15 + `ANO` C4 | 37 (2021–2023) |
| `AUMENTOS`, `PAUMENTO` | Aumento y programación de revisión salarial | `CODIGO`; `SALFEC` | 0, 0 |
| `EMPLREC` | Empleados "por recibo" (honorarios) | `CODIGO` | 2 |

**Corrida de planilla**

| Tabla | Contenido | Clave | Conteo |
|---|---|---|---|
| `PLANILLA` | Una fila por empleado y quincena, ~130 columnas fijas (días, horas extras, ingresos, ISSS/IVM/FSV/AFP/renta empleado y patrono, descuentos, totales, banderas `CALCULO`/`IMPRESO`/`MODIFICADO`, ~45 columnas por tipo de ingreso/descuento) | `FECPLA` C7 (`AAAAMMQ`) + `CODEMP` + `CODIGO` | 495 vivas / 498; 48 quincenas **2021-07-1 a 2023-07-2**; 6 a 14 empleados por quincena; 33 filas sin código |
| `MOVDESC` | Descuentos aplicados en la corrida (incl. préstamo) | `TIPOPLAN`+`FECPLA`+`CODIGO` | 216 |
| `MOVING` | Ingresos adicionales aplicados | igual | 282 |
| `VALORES` | Temporal para la boleta (tipo 1 ingreso, 2 descuento) | — | 10 |
| `ACTIVAS` | Selección de divisiones/centros que se imprimen ("Que imprimir") | | 15 |
| `RENTA` | Salida del archivo de renta mensual (se llena y se exporta) | `FECPLA`+NIT | 14 (2023-07-1) |

**Instrucciones recurrentes**

| Tabla | Contenido | Clave | Conteo |
|---|---|---|---|
| `DESCUENT` | Descuento programado: `CODDES`, `NUMDES`/`NUMDEE` (cuotas totales/hechas), `VALOR1`, `QI1`/`QI2`, `PROGRAMADO`, `DESACTIVAR`, `ISSS`, `RENTA`, `REFERENCIA` C20, `CUENTA`, 7 columnas de llaves | `CODIGO`+`CODDES`+`REFERENCIA` | 31 |
| `INGRESOS` | Ingreso adicional recurrente: `TIPO`, `PERIODO`, `INGRESO` C2, `VALOR`, `RENTA`, `ISSS`, `CUOTAS`, `CUENTA`, llaves | `CODIGO`+`INGRESO`+`NUMERO` | 10 |
| `PRESTAMO` | Préstamo: monto, cuotas, interés, `CUOTA`, `ULT_CUOTA`, `SALDO`, `PROX_CUOTA`, fechas | `CODIGO`+`PRESTAMO` | 0 |
| `NOMDESC`, `TIPOING` | Tipos de descuento / ingreso con `CODIGOD` / `CODIGOI` = nombre de columna de `PLANILLA` | `CODDES` / `INGRESO` | 12 / 8 |
| `TABLAD`, `TABLAI` | Descripción de esos códigos de columna | | 4 / 8 |
| `AUSENCIA` (+memo) | Ausencias y permisos con descuento por días o minutos | `CODIGO`+`SALFEC` | 0 |
| `CONTROLD` | Asistencia diaria | `CODIGO`+`FECHAA` | 4 |

**Prestaciones**

| Tabla | Contenido | Clave | Conteo |
|---|---|---|---|
| `VACACION` | Vacación generada (sueldo, % , días, `REMVAC`, `SUELDOA`, `TOTVAC`, fechas) | `CODIGO`+`SALFEC`+`QUINCENA` | 0 |
| `PVACA` | Programación de vacaciones | | 0 |
| `AGUINALD` | Aguinaldo del año: `SALARIO_M`, `AGUINALDO`, `RENTA`, `RENTAA`, `LIQUIDO`, `VPROCU`, `DIAA` | `PERIODO`+`CODEMP`+`DIVISION`+`CCOSTO`+`CODIGO` | 7 (2021) |
| `INDEMNI` | Liquidación: tiempo, sueldo base, indemnización/vacación/aguinaldo, ISSS/AFP/renta, estados | `CODIGO`+`YEAR`+`MES` | 16 (2016–2017) |
| `PINDEMNI` | Cuotas de pago de la liquidación | `CODIGO`+`YEAR`+`MES`+`CORREC` | 3 |
| `RECIBOE` | Recibos de honorarios | `CORRELA`; `SALFEC` | 0 |

**Oficiales (salidas guardadas)**

| Tabla | Contenido | Clave | Conteo |
|---|---|---|---|
| `PLISSS` | Planilla de ISSS del mes: **`CODIGO` es C10 y el maestro usa C15** (riesgo de truncar) | `SALFEC` + `CODIGO` | 2,187 vivas / 3,031; 27 meses distintos, último 2023-07 |
| `RENTAPL` | F910 anual por NIT: 12 meses × 3 columnas (`M*`, `R*`, `A*`) | `YEAR` + `NIT` | 339; años 2013–2019 |
| `ISSS` (`fuente/isss.DBF`) | copia de trabajo de ISSS | | 21 |

**Sistema y varios:** `USUARIOS`, `USREMP`, `PERFIL`, `PERIODO` (1), `LLAVE` (10), `ARCHIVOS` (57, lista de tablas para reindexar), `MSGERR` (40, textos de error), `ERROR` (706), `CAPACITA`/`INSTITU`/`MOVCAPA`/`CAPAPR` (capacitaciones), `FUNCION`, `FIRMAS`, `FIRMAFI`, `AMONESTA`, `PERMI`, `SEMINA`, `TRASLADO`, `VALE`, `PREMIO`, `ESCALAS`, `NIVELES`, `RAZONES`, `TCOSTOS`, `VENMEN`: o bien de sistema, o de RR. HH. vacías [D].

### 1.3 Relaciones (sin llaves foráneas declaradas)

```
EMPRESA2 (codemp) 1─* DIVISION 1─* CCOSTOS
EMPRESA2 1─* MAESTRO *─1 CARGOS / AFP / ESTATUS / BANCOS / ALCALDIA / PROFESIO
MAESTRO 1─* PLANILLA (por quincena) 1─* MOVDESC / MOVING (movimientos de esa quincena)
MAESTRO 1─* DESCUENT / INGRESOS / PRESTAMO / AUSENCIA / VACACION / AGUINALD / INDEMNI 1─* PINDEMNI
NOMDESC.CODIGOD / TIPOING.CODIGOI ──nombre de columna──> PLANILLA.<columna>
PLANILLA (mes) ──agrega──> PLISSS (ISSS) , RENTA (mensual) , RENTAPL (anual)
PLANILLA ──(sin vínculo)──> CONTAC.PARTIDAS / DETAPART  (la cuenta sale de MAESTRO.CTA*, TIPOING.CUENTA, DESCUENT.CUENTA)
```

Dos "centros de costo": `CCOSTOS.CCOSTO` C6 (planilla, cuelga de patrono y división) y `MAESTRO.CTACOSTO` C3 (el del libro mayor) [V].

### 1.4 Datos y uso
- **¿La empresa en disco usa el módulo? Sí, de forma activa pero pequeña:** 20 empleados mensualizados, 1 patrono, 2 divisiones, 2 centros, 2 AFP en uso, 48 quincenas cerradas casi todas (2021-07 a 2023-07; la última quincena quedó abierta con 14 empleados) [D].
- **No contabiliza desde el módulo** (todas las cuentas del maestro y de los catálogos están vacías) ni paga con cheque; sí produce planilla de ISSS (hasta 2023-07), boletas, archivo de renta mensual (2023-07) y banco en Excel [D].
- Lo no usado en la copia: horas extras de 4 de las 6 clases, vacaciones, préstamos, ausencias, aumentos, honorarios, liquidaciones recientes (las 16 son de 2016–2017), aguinaldo salvo 2021.

## 2. Reglas que moldean el modelo nuevo

1. Una **línea de corrida por empleado** con **conceptos normalizados** (una fila por concepto), no ~130 columnas.
2. Los **conceptos** (ingresos/descuentos) llevan sus banderas (gravable renta, base ISSS/AFP, cuenta) en el catálogo, no en cada movimiento.
3. Tasas, topes y tablas de renta con **vigencia**, por empresa; la corrida referencia las versiones usadas.
4. La corrida es **inmutable al cerrar**; los ajustes son nuevas corridas.
5. Cada corrida cerrada se publica al libro mayor una sola vez (`source = 'nomina'`), con vínculo real.
6. Salarios y datos personales con permiso propio y bitácora de lectura de pantallas sensibles.

## 3. Modelo propuesto (prefijo `pay_`, todas con `empresa_id`, `created_at`, `updated_at`, `is_active`; dinero `TEXT` decimal)

Los montos son cadenas con dos decimales (`'1234.50'`) y se operan con `decimal.js`; tasas como cadenas con 6 decimales (`'0.075000'`) para no perder las tasas con más de dos decimales de porcentaje que el sistema viejo truncaba.

### 3.1 Configuración y vigencias
- `pay_param_sets` — id, empresa_id, `kind` (`isss_salud`, `isss_ivm`, `afp`, `ipfa`, `insaforp`, `fsv`, `renta_eventual`, `renta_extranjero`, `aguinaldo_exento`, `salario_minimo`, `incapacidad`, …), `effective_from`, `effective_to` null, y columnas de valor: `employee_rate`, `employer_rate`, `ceiling` (con `ceiling_period` = `mensual`), `fixed_amount`, `rounding` (`half_up_2`), `notes`. Única `(empresa_id, kind, effective_from)`. *Origen:* `CONFIG.MEM` (`cfg_*`).
- `pay_tax_tables` — id, empresa_id, `code` (`renta_mensual`, `renta_quincenal`, `renta_semestre_1`, `renta_semestre_2`, `aguinaldo`), `period_kind`, `effective_from`. *Origen:* `cfg_rent*`, `cfg_ren*s`, `cfg_ren*a`.
- `pay_tax_brackets` — table_id, `seq` 1–n, `from_amount`, `to_amount` (null = abierto), `fixed_amount`, `rate`. Único `(table_id, seq)`; la validación impide huecos o traslapes entre tramos.
- `pay_overtime_rates` — empresa_id, `code` (`diurna`, `nocturna`, `descanso_diurna`…), `multiplier`, `effective_from`. *Origen:* multiplicadores escritos en `plmplan4`.
- `pay_afp_funds` — empresa_id, `code`, `name`, `commission_rate` (con vigencia en `pay_param_sets` o columna `effective_from`), `superintendence_code` (de `CODSUPER`), `gl_account_id`, `is_active`. *Origen:* `AFP`.

### 3.2 Estructura y empleados
- `pay_employees` (extiende el existente): `code` (único `(empresa_id, code)`; **no usar el documento de identidad como código**), `first_names`, `last_names`, `tax_id_hash`/`tax_id` cifrado (NIT, DUI, ISSS, afiliado AFP), `hire_date`, `termination_date`, `status`, `pay_type` (`mensual`, `hora`), `pay_frequency` (`quincenal`, `mensual`), `department_id`, `position_id`, `cost_center_id` (**nullable** → `gl_cost_centers`), `pension_scheme` (`afp`, `ipfa`, `isss_ivm`, `ivm`, `ninguno`), `afp_fund_id`, `is_eventual`, `is_foreign`, `is_commission`, `skip_isss`, `skip_semester_recalc`, `retired_pensioner`, `procuraduria_applies`, `bank_id`, `bank_account` (cifrado), `email`, `vacation_anniversary`, `aguinaldo_date`, `severance_date`.
  Los datos personales extensos (dirección, salud, beneficiarios, estudios) van a `pay_employee_profile` (permiso propio) o se posponen (pregunta 1.2).
- `pay_employee_salary_history` — employee_id, `effective_from`, `monthly_salary`, `hourly_rate`, `reason`, `approved_by`. Reemplaza `SALARIO_M`/`SAL_ANT` y `AUMENTOS`. El salario usado por un cálculo es el vigente a la fecha del período.
- `pay_departments` (`DIVISION`), `pay_positions` (`CARGOS`: nombre, rango min–max), `pay_banks` (`BANCOS`, con `file_format` null), `pay_employee_prior_income` (`RECORI`: año, `prior_employer_income`, `prior_employer_tax`).
- Centros de costo: **se usan los de `gl_cost_centers`** (`CCOSTOS.CCOSTO` C6 y `ctacosto` C3 se reconcilian en la migración; pregunta 1.4).

### 3.3 Conceptos y novedades
- `pay_concepts` — empresa_id, `code`, `name`, `kind` (`ingreso`, `descuento`, `aporte_patronal`), `is_isss_base`, `is_pension_base`, `is_tax_base`, `reduces_tax_base`, `gl_account_id` (por omisión), `sort`, `legacy_column` (nombre de la columna de `PLANILLA`, solo para migración), `is_system` (sueldo, horas extras, ISSS, AFP, renta…). Único `(empresa_id, code)`. *Origen:* `TIPOING`, `NOMDESC`, `TABLAI`, `TABLAD`.
- `pay_recurring_items` — employee_id, concept_id, `amount`, `periodicity` (`cada_quincena`, `q1`, `q2`, `mensual`, `una_vez`), `installments_total`, `installments_applied`, `reference`, `start_period`, `end_period`, `is_programmed`, `is_active`, `approved_by`/`approved_at`. *Origen:* `DESCUENT` + `INGRESOS`.
- `pay_loans` — employee_id, concept_id, `number`, `principal`, `installments`, `interest_rate`, `installment_amount`, `last_installment_amount`, `granted_on`, `first_payment_on`, `reason`, `gl_account_id`. Único `(empresa_id, number)`. Saldo = principal − aplicaciones (se calcula). *Origen:* `PRESTAMO`.
- `pay_absences` — employee_id, `kind` (`permiso_con_pago`, `permiso_sin_pago`, `incapacidad`, `ausencia`, `suspension`, `retiro`), `date_from`, `date_to`, `days`, `minutes_late`, `period_id`/`fortnight`, `deduct_in_run`, `reason`. *Origen:* `AUSENCIA`.
- `pay_attendance_days` — diferida (pregunta 1.2). *Origen:* `CONTROLD`.

### 3.4 Corridas
- `pay_periods` — empresa_id, `year`, `month`, `fortnight` (1, 2 o 0 = mes completo), `date_from`, `date_to`, `status` (`abierto`, `calculado`, `cerrado`), `closed_by`, `closed_at`. Único `(empresa_id, year, month, fortnight)`. *Origen:* `FECPLA` (`AAAAMMQ`) y `CIERRE`.
- `pay_runs` (existente, ampliado) — `period_id`, `run_type` (`planilla`, `aguinaldo`, `vacaciones`, `liquidacion`, `honorarios`, `ajuste`), `scope` (empresa, departamento, empleado), `status` (`borrador`, `calculada`, `cerrada`, `contabilizada`, `anulada`), `param_snapshot` (JSON con las versiones de tasas y tablas usadas), `total_gross`, `total_deductions`, `total_net`, `employer_cost`, `adjusts_run_id`, `journal_entry_id` (**vínculo real al libro mayor**), `calculated_at/by`, `closed_at/by`.
- `pay_run_lines` — run_id, employee_id, `days_worked`, `hours_worked`, `salary_amount`, `gross`, `deductions`, `net`, `isss_base`, `pension_base`, `tax_base`, `cost_center_id`, `department_id`, `pension_scheme`, `afp_fund_id`. Única `(run_id, employee_id)`.
- `pay_run_items` — line_id, concept_id, `kind`, `quantity` (horas/días), `amount`, `employer_amount`, `source` (`sistema`, `recurrente`, `prestamo`, `manual`, `ausencia`), `source_ref`. Aquí van sueldo, horas extras (una fila por clase), ISSS, IVM, AFP, FSV, INSAFORP, renta, aguinaldo, vacación, cada descuento.
- `pay_deduction_applications` — recurring_item_id o loan_id, run_line_id, `amount`, `balance_after`. Mantiene el saldo y la historia (reemplaza `NUMDEE`/`SALDO`/`MOVDESC`).
- `pay_ytd_tax` — employee_id, year, `taxable_income`, `tax_withheld`, `prior_income`, `prior_tax` (acumulado para el recálculo semestral o anual; puede ser vista).

### 3.5 Prestaciones y salidas
- `pay_vacations` — employee_id, `period_from`, `period_to`, `days`, `premium_rate`, `amount`, `advance_amount`, `status`, `run_id`. *Origen:* `VACACION`.
- `pay_aguinaldo_lines` — run_id (corrida tipo `aguinaldo`), employee_id, `years_service`, `days_paid`, `gross`, `tax`, `procuraduria`, `net`, `is_override`.
- `pay_severances` — employee_id, `reason`, `date_from`, `date_to`, `base_salary`, `severance`, `vacation`, `aguinaldo`, `deductions`, `net`, `status`, `approved_by`, `run_id`; `pay_severance_installments` (cuotas). *Origen:* `INDEMNI`, `PINDEMNI`.
- `pay_export_files` — empresa_id, `kind` (`isss`, `afp`, `renta_mensual`, `f910`, `banco`), `period`, `layout_version`, `generated_by`, `generated_at`, `source_run_ids`, `sha256`, `row_count`, `total_amount`. Nunca el contenido con datos personales en la tabla; el archivo se regenera.
- `pay_account_map` — empresa_id, `concept_id`, `cost_center_id` (null = general), `debit_account_id`, `credit_account_id`, `effective_from`. Reemplaza los `CTA*` por empleado.
- `pay_approvals` — diferida (pregunta 6.2): `entity`, `entity_id`, `step`, `approved_by`, `approved_at`. *Origen:* columnas de llaves.

### 3.6 Reglas del modelo
- Sin DELETE: anular con `is_active = 0` o `status = 'anulada'`. El número de aguinaldo/liquidación anulado no se reutiliza.
- Una corrida cerrada no se modifica; `pay_run_lines`/`pay_run_items` de una corrida cerrada son de solo lectura (validación en el servicio y, si es posible, trigger).
- `pay_runs.journal_entry_id` es único (una corrida, una partida) y la partida lleva `source = 'nomina'` y `source_ref = pay_runs.id`. Hace falta **agregar `'nomina'` a `GL_ENTRY_SOURCES`** (hoy: `manual`, `bancos`, `iva`, `cierre`, `importado`) y a `ENTRY_SOURCES` en el schema del libro mayor.
- Las cuentas del libro mayor se referencian por `coa_accounts.id` (stub en `refs.ts`); los centros de costo por `gl_cost_centers.id`. Ningún módulo escribe tablas de otro: la publicación se hace por el servicio del libro mayor.
- El pago bancario (si se usa Bancos) se pide al módulo `banking` mediante contrato; el módulo guarda `pay_run_lines.payment_status` y la referencia.

## 4. Qué cambiar en el esqueleto actual (`modules/payroll`)

| Archivo | Hoy | Cambiar |
|---|---|---|
| `schema.ts` | `pay_employees` (id, name, email, salary, payType `salary/hourly`, isActive) y `pay_runs` (periodStart/End, totalGross/Net, status `draft/approved/posted`, journalEntryId) **sin `empresa_id`** | agregar `empresa_id` (FK vía `refs.ts` a `core_empresas`) a todo; separar en archivos < 200 líneas (`schema/employees.ts`, `schema/runs.ts`, …); `pay_type` → `mensual/hora`; ampliar estados de corrida; `journal_entry_id` único con FK al libro mayor por stub; índices por `(empresa_id, …)`; crear las tablas de §3 |
| `manifest.ts` | `dependsOn: ['general-ledger']`; permisos `owner/admin/member`; una página | los permisos de plataforma son `capture`, `reports`, `supervise`: agregar **`salary`** (ver sueldos) y `close` (cerrar/reabrir corrida); `dependsOn` además de `banking` solo si se integra el pago; navegación con las pantallas de §4 de README |
| `routes.ts` | comentario con `GET/POST /employees`, `/runs`, `/runs/:id/approve` | rutas por recurso con `requirePermission`, bitácora (`audit`) en cada alta/cambio/cierre dentro de la transacción, mensajes en español |
| contrato compartido | no existe | crear `packages/shared/src/payroll.ts` (Zod): empleado, corrida, conceptos, parámetros, archivos de salida |
| `packages/shared/src/gl.ts` | `GL_ENTRY_SOURCES` sin nómina | agregar `'nomina'` |

## 5. Notas de migración

### 5.1 Qué migrar
- **Sí:** catálogos (patrono, divisiones, centros, cargos, AFP, bancos, tipos de ingreso/descuento), `MAESTRO` (estructura, no `NOAFP`), historial salarial si lo hay, descuentos/ingresos/préstamos **vigentes**, y el **histórico de `PLANILLA`** (48 quincenas × ≤14 empleados) como corridas **cerradas e importadas** (solo lectura), junto a `MOVDESC`/`MOVING` como líneas de concepto.
- **Para consulta y declaraciones:** `AGUINALD`, `INDEMNI`/`PINDEMNI`, `RENTAPL`, `RECORI` (acumulados de renta previos al sistema nuevo).
- **No migrar:** tablas de trabajo y respaldos, `PLISSS`, `RENTA`/`RENTAPL` como tablas intermedias (se regeneran desde las corridas), `VALORES`, `ERROR`, `MSGERR`, `ARCHIVOS`, RR. HH. vacías, `FOXUSER`, `.BAK`, `.XLS` y `.TXT` sueltos.
- Empleado cuyas líneas de planilla no existen en `MAESTRO` (1 código) y 33 filas sin código: se reportan y no se importan.
- Los parámetros de `CONFIG.MEM` se importan **como una versión inicial con la fecha de la primera corrida cargada**; un parámetro que haya cambiado a lo largo del histórico no se puede reconstruir (no hay historial): las corridas importadas guardan los importes calculados, no se recalculan.

### 5.2 Codificación y formato
- Tablas `0x03` (`PLANILLA`, `PLISSS`, catálogos) = Windows-1252; `MAESTRO`, `AUSENCIA`, `CARGOS`, `PERMI`… son `0xF5` (FoxPro 2.x con memo `.FPT`) y varias tablas `0x30`: el importador detecta la marca y convierte a UTF-8 (cp1252 o cp850 según marca) [D].
- `C` con espacios a la derecha: recortar. Fechas vacías son `{}`/`00/00/00`. Los códigos de mes en `FECPLA` son `AAAAMMQ`; convertir a `year`, `month`, `fortnight`.
- `PLISSS.CODIGO` C10 vs `MAESTRO.CODIGO` C15: empatar por prefijo y reportar los que se pierdan.
- Lógicos: `T`/`F`/vacío (blank = falso).

### 5.3 Datos sucios a reportar
- 3 filas de `MAESTRO` sin código; 1 código de `PLANILLA` ausente de `MAESTRO`; 33 filas de `PLANILLA` sin código; 2 filas con `totingreso − totdes − horasdes ≠ salneto`.
- Tablas con muchas filas borradas (`PLISSS` 844 de 3,031; `PLANILLA` 3 de 498) → no se importan las borradas.
- `PLANILLA.OFICIAL` vacío en 7 filas; `RENEXT` vacío en 464 (lógico sin valor).
- `RENTAPL.YEAR` vacío en 4 filas; códigos de renta `01/11/33/60/70` (mapear a un catálogo).
- Filas de `AGUINALD`, `INDEMNI`: varios años de antigüedad; ninguna liquidación aplicada.
- Posible: valores mágicos de código de país (`9300`).

### 5.4 Controles de paridad (por corrida, contra `PLANILLA` y las salidas del sistema anterior)
Totales **por quincena y por patrono** (y luego por división y centro de costo) de: `sueldo_m`, horas extras (6 clases), `ing_adi`+`ingreso`, `totingreso`; `isss`, `isssivm`, `fsv`, `afp_empl`, `renta`, cada columna de descuento, `totdes`, `horasdes`; `salneto`; aportes patronales `isss_pat`, `isssivmp`, `afp_pat`, `insa`.
Además: (a) planilla de ISSS del mes contra `PLISSS` (`salario`, `padicion`, `montovac`, `diast`) y contra el archivo de 102 posiciones de muestra; (b) F910 de un año contra `RENTAPL` y la suma mensual contra `RENTA`; (c) aguinaldo contra `AGUINALD`; (d) saldos de descuentos y préstamos contra `DESCUENT.NUMDEE`/`PRESTAMO.SALDO`.
**Dos advertencias:** (1) el sistema viejo hace aritmética sin redondear y guarda a 2 decimales; el nuevo debe reproducir **cuándo** redondea cada fórmula (por eso las pruebas de paridad deben correrse **con tolerancia de ±0.01 por empleado y reportar cada diferencia**, no ocultarla); (2) mientras no se tengan los valores de `CONFIG.MEM` del cliente (§3 de business-rules), el cálculo no se puede probar de punta a punta: solo se puede comparar el **resultado almacenado** contra el nuevo cálculo con esos mismos parámetros.

### 5.5 Importador (propuesta)
Mismo patrón que CONTAC: lector DBF → validaciones y reporte de datos sucios → transformación a las tablas `pay_*` → paridad. Lee `CONFIG.MEM` aparte (formato de variables de VFP). Corre con la API detenida y con `--replace` por empresa. Los datos personales se importan solo a la base cifrada del cliente; los reportes del importador usan códigos, nunca nombres ni documentos.
