import path from 'node:path'
import { writeDbf, type Cell, type FieldSpec } from './dbf-writer.js'

const C = (name: string, length: number): FieldSpec => ({ name, type: 'C', length })
const N = (name: string, length: number, decimals = 0): FieldSpec => ({ name, type: 'N', length, decimals })
const D = (name: string): FieldSpec => ({ name, type: 'D', length: 8 })
const L = (name: string): FieldSpec => ({ name, type: 'L', length: 1 })

const SALDO_FIELDS = [C('salfec', 6), C('cuenta', 14), N('saldoant', 12, 2), N('cargos', 12, 2), N('abonos', 12, 2), N('saldo', 12, 2), N('saldomes', 12, 2)]

// Legacy SALDOS rows that match the synthetic ledger below.
export const GOOD_SALDOS: Cell[][] = [
  ['202401', '11', null, '115.50', '0.00', '115.50', '115.50'],
  ['202401', '1', null, '115.50', '0.00', '115.50', '115.50'],
  ['202401', '21', null, '0.00', '105.50', '105.50', '105.50'],
  ['202401', '2', null, '0.00', '105.50', '105.50', '105.50'],
  ['202401', '31', null, '0.00', '5.00', '5.00', '5.00'],
  ['202401', '3', null, '0.00', '5.00', '5.00', '5.00'],
  ['202401', '99', null, '1.00', '0.00', '1.00', '1.00'],
  ['202402', '11', '115.50', '20.00', '0.00', '135.50', '20.00'],
  ['202402', '1', '115.50', '20.00', '0.00', '135.50', '20.00'],
  ['202402', '21', '105.50', '0.00', '20.00', '125.50', '20.00'],
  ['202402', '2', '105.50', '0.00', '20.00', '125.50', '20.00'],
]

// Builds a small synthetic CONTAC folder (dbf/ + fuente/EMPRESAS.DBF).
// Ledger: 2024-01 has one balanced entry, one unbalanced entry (diff 6.00), one entry
// with a header and a line on an unknown account (99), and entry 02|000001 whose header
// is missing; 2024-02 has one balanced entry. One deleted line and one deleted header.
export function writeContac(root: string, saldos: Cell[][] = GOOD_SALDOS): void {
  const dbf = (name: string) => path.join(root, 'dbf', name)
  writeDbf(path.join(root, 'fuente', 'EMPRESAS.DBF'), [C('empresa', 60), C('siglas', 8), N('moneda', 1), L('grande')], [
    { values: ['Empresa Sintetica', 'TS', '2', false] },
    { values: ['Empresa Borrada', 'XX', '1', false], deleted: true },
  ])
  writeDbf(dbf('CATALOGO.DBF'), [C('cuenta', 14), C('nombrecta', 45), N('tipocta', 1), C('anterior', 14), L('es_detalle'), N('nivel', 1), C('union', 14), L('pcosto'), C('codigoa', 3)], [
    { values: ['1', 'Activo', '1', '0', false, '1', '', false, ''] },
    { values: ['11', 'Caja', '1', '1', true, '2', '', false, ''] },
    { values: ['2', 'Pasivo', '2', '0', false, '1', '', false, ''] },
    { values: ['21', 'Proveedores', '2', '2', true, '2', '', true, ''] },
    { values: ['3', 'Capital', '3', '0', false, '1', '', false, ''] },
    { values: ['31', 'Capital social', '3', '3', true, '2', '', false, ''] },
  ])
  writeDbf(dbf('AGRUPA.DBF'), [C('codigoa', 3), C('descripa', 50)], [])
  writeDbf(dbf('TIPOPAR.DBF'), [C('tipopar', 2), C('nombre', 25), L('bancos'), N('numero', 7)], [
    { values: ['01', 'Diario', false, '5'] },
  ])
  writeDbf(dbf('CCOSTO.DBF'), [C('codigo', 3), C('descrip', 50)], [{ values: ['001', 'Centro uno'] }])
  writeDbf(dbf('PERIODO.DBF'), [C('periodo', 10), C('nombre', 40), N('inicio', 2), N('anio', 4), N('fin', 2), N('anio2', 4), N('largo', 2), C('cata', 8), C('ccosto', 3)], [
    { values: ['2018', 'Periodo', '1', '2018', '12', '2018', '12', '', '001'] },
  ])
  writeDbf(dbf('PRESUP.DBF'), [C('cuenta', 14), ...Array.from({ length: 12 }, (_, i) => N(`pmes${i + 1}`, 12, 2)), C('periodo', 10), C('ccosto', 3)], [
    { values: ['11', '100.00', '0.00', ...Array(10).fill('0.00'), '2024', ''] },
    { values: ['777', '50.00', ...Array(11).fill('0.00'), '2024', ''] }, // unknown account → skipped
  ])
  const hdr = [C('tipopar', 2), C('numero', 7), C('concepto', 120), D('fecha'), C('salfec', 6), L('cerrado'), N('generado', 2)]
  writeDbf(dbf('PARTIDAS.DBF'), hdr, [
    { values: ['01', '000001', 'Entrada uno', '20240105', '202401', true, '0'] },
    { values: ['01', '000002', 'Entrada descuadrada', '20240110', '202401', true, '0'] },
    { values: ['01', '000003', 'Entrada cuenta desconocida', '20240112', '202401', true, '0'] },
    { values: ['01', '000009', 'Entrada borrada', '20240113', '202401', true, '0'], deleted: true },
    { values: ['01', '000001', 'Entrada febrero', '20240210', '202402', true, '0'] },
  ])
  const line = (s: string, t: string, n: string, acct: string, dr: string | null, cr: string | null, cc = '', date = '20240105'): Cell[] =>
    [s, t, n, acct, 'Detalle', dr, cr, null, date, cc, null]
  writeDbf(dbf('DETAPART.DBF'), [C('salfec', 6), C('tipopar', 2), C('numero', 7), C('cuenta', 14), C('detalle', 200), N('cargo', 12, 2), N('abono', 12, 2), N('tipomov', 1), D('fecha'), C('ccosto', 3), D('fcobro')], [
    { values: line('202401', '01', '000001', '11', '100.50', null) },
    { values: line('202401', '01', '000001', '21', null, '100.50', '001') },
    { values: line('202401', '01', '000002', '11', '10.00', null, '', '20240110') },
    { values: line('202401', '01', '000002', '21', null, '4.00', '001', '20240110') },
    { values: line('202401', '02', '000001', '11', '5.00', null, '', '20240120') },
    { values: line('202401', '02', '000001', '31', null, '5.00', '', '20240121') },
    { values: line('202401', '01', '000003', '99', '1.00', null, '', '20240112') },
    { values: line('202401', '01', '000003', '21', null, '1.00', '001', '20240112') },
    { values: line('202401', '01', '000009', '11', '77.00', null), deleted: true },
    { values: line('202402', '01', '000001', '11', '20.00', null, '', '20240210') },
    { values: line('202402', '01', '000001', '21', null, '20.00', '001', '20240210') },
  ])
  writeDbf(dbf('SALDOS.DBF'), SALDO_FIELDS, saldos.map((values) => ({ values })))
}
