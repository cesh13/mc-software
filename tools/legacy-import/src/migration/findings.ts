import type { Finding, FindingSeverity } from '@accounting/shared'
import type { ImportReport, WarningBucket } from '../contac/types.js'
import type { ParityReport } from '../contac/parity.js'
import type { PartiesImportReport } from '../parties/types.js'

// Turns the importers' own reports into standard findings (docs/sistema/migracion.md).

type Rule = { severity: FindingSeverity; title: string; recommendation: string; questionRef?: string }

const WARNINGS: Record<string, Rule> = {
  monto_negativo: { severity: 'decidir', title: 'Líneas con monto negativo', recommendation: 'Se importan tal cual y se reportan; decidir si se corrigen antes de migrar.', questionRef: 'R7' },
  cargo_y_abono: { severity: 'decidir', title: 'Líneas con cargo y abono a la vez', recommendation: 'Se importan tal cual; el sistema anterior las ignoraba al capturar. Revisar con el contador.' },
  cuenta_no_encontrada: { severity: 'decidir', title: 'Partidas con cuentas que no existen en el catálogo', recommendation: 'Se crea una cuenta provisional; el contador debe decir cuál es la cuenta correcta.' },
  numero_vacio: { severity: 'info', title: 'Partidas sin número', recommendation: 'Se numeran al importar; se conserva la llave del sistema anterior.' },
  fecha_fuera_de_mes: { severity: 'info', title: 'Partidas con fecha fuera de su mes', recommendation: 'Se toma el mes de la partida; revisar si alguna está mal fechada.' },
  meses_mixtos: { severity: 'info', title: 'Meses con partidas cerradas y abiertas', recommendation: 'El estado del mes sale de su primera partida, como en el sistema anterior.' },
  tabla_faltante: { severity: 'decidir', title: 'Tablas opcionales faltantes', recommendation: 'Se importa sin ellas; confirmar que el cliente no las usa.' },
  varias_empresas: { severity: 'decidir', title: 'Hay varias empresas en la copia', recommendation: 'Indique las siglas de la empresa a importar.' },
  catalogo_alterno: { severity: 'info', title: 'El sistema anterior indica un catálogo alterno', recommendation: 'No se migra: la plataforma tiene un solo catálogo por empresa.' },
  presupuesto_cuenta_no_encontrada: { severity: 'info', title: 'Presupuestos de cuentas que no existen', recommendation: 'Se omiten; casi todos vienen en cero.' },
  sin_nombre: { severity: 'decidir', title: 'Terceros sin nombre', recommendation: 'Completar el nombre en el sistema anterior o después de importar.' },
  llave_repetida_o_vacia: { severity: 'info', title: 'Llaves repetidas o vacías', recommendation: 'Se usa el número de registro como llave.' },
}

const DEFAULT: Rule = { severity: 'info', title: '', recommendation: 'Revisar el detalle en el informe.' }

function fromWarnings(prefix: string, warnings: Record<string, WarningBucket>): Finding[] {
  return Object.entries(warnings).map(([code, b]) => {
    const rule = WARNINGS[code] ?? { ...DEFAULT, title: code.replace(/_/g, ' ') }
    return { key: `${prefix}:${code}`, ...rule, count: b.count, samples: b.messages.slice(0, 20) }
  })
}

const push = (out: Finding[], f: Omit<Finding, 'samples'> & { samples?: string[] }) => {
  if (f.count > 0) out.push({ ...f, samples: (f.samples ?? []).slice(0, 20) })
}

export function contacFindings(r: ImportReport, parity: ParityReport | null): Finding[] {
  const out = fromWarnings('contac', r.warnings)
  push(out, {
    key: 'contac:partida_descuadrada', severity: 'decidir', title: 'Partidas descuadradas', count: r.unbalancedEntries.length,
    samples: r.unbalancedEntries.map((e) => `${e.key} (${e.difference})`),
    recommendation: 'Se importan marcadas; el contador decide qué cifra vale.', questionRef: 'P15',
  })
  push(out, {
    key: 'contac:linea_sin_encabezado', severity: 'info', title: 'Líneas sin encabezado de partida', count: r.orphanHeaders.length,
    samples: r.orphanHeaders.map((h) => `${h.key} (${h.lines} líneas)`), recommendation: 'El importador crea el encabezado.',
  })
  push(out, {
    key: 'contac:cuenta_provisional', severity: 'decidir', title: 'Cuentas provisionales creadas', count: r.placeholders.accounts.length,
    samples: r.placeholders.accounts, recommendation: 'Asignar la cuenta correcta o confirmarla en el catálogo.',
  })
  push(out, {
    key: 'contac:catalogo', severity: 'decidir', title: 'Inconsistencias del catálogo', count: r.catalogFindings.length,
    samples: r.catalogFindings.map((c) => `${c.code}: ${c.kind}`), recommendation: 'Revisar el catálogo con el contador.',
  })
  if (parity) {
    for (const [name, t] of [['saldos', parity.saldos], ['saldocc', parity.saldocc]] as const) {
      if (!t) continue
      push(out, {
        key: `contac:paridad_${name}_sin_explicar`, severity: 'decidir', title: `Diferencias sin explicar contra ${name.toUpperCase()}`,
        count: t.byCause.other, samples: t.first.filter((m) => m.cause === 'other').map((m) => `${m.period} ${m.account} ${m.field}: ${m.legacy} / ${m.computed}`),
        recommendation: 'Comparar esos meses contra los reportes impresos del sistema anterior.', questionRef: 'P15',
      })
      const explained = t.rowsWithMismatch - t.byCause.other
      push(out, {
        key: `contac:paridad_${name}_explicada`, severity: 'info', title: `Diferencias explicadas contra ${name.toUpperCase()}`,
        count: explained, samples: Object.entries(t.byCause).filter(([c, n]) => c !== 'other' && n > 0).map(([c, n]) => `${c}: ${n}`),
        recommendation: 'Esperadas por cómo el sistema anterior guarda sus saldos; no fallan la paridad.',
      })
    }
  }
  return out
}

export function partiesFindings(r: PartiesImportReport): Finding[] {
  const out = fromWarnings('parties', r.warnings)
  const conflicts = (kind: keyof PartiesImportReport['conflictsSummary']) =>
    r.conflicts.filter((c) => c.kind === kind).map((c) => c.key)
  push(out, {
    key: 'parties:nombre_distinto', severity: 'decidir', title: 'Mismo NRC o NIT con nombres distintos',
    count: r.conflictsSummary.nombre_distinto, samples: conflicts('nombre_distinto'),
    recommendation: 'Se unen en un tercero; el negocio revisa la lista y separa los que no son el mismo.', questionRef: 'M3',
  })
  push(out, {
    key: 'parties:nit_distinto', severity: 'decidir', title: 'Mismo NRC con NIT distinto',
    count: r.conflictsSummary.nit_distinto, samples: conflicts('nit_distinto'),
    recommendation: 'Se conserva el primer NIT; confirmar cuál es el correcto.', questionRef: 'M3',
  })
  push(out, {
    key: 'parties:nit_compartido', severity: 'decidir', title: 'Un NIT compartido por varios NRC',
    count: r.conflictsSummary.mismo_nit_distinto_nrc + r.conflictsSummary.nit_en_varios_nrc,
    samples: [...conflicts('mismo_nit_distinto_nrc'), ...conflicts('nit_en_varios_nrc')],
    recommendation: 'No se unen; revisar si son sucursales o un error de captura.', questionRef: 'M3',
  })
  push(out, {
    key: 'parties:fuente_faltante', severity: 'info', title: 'Tablas de terceros no encontradas',
    count: r.missingSources.length, samples: r.missingSources, recommendation: 'Se importa con las que hay.',
  })
  return out
}
