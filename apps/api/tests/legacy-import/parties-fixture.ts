import path from 'node:path'
import { writeDbf, type FieldSpec } from './dbf-writer.js'

const C = (name: string, length: number): FieldSpec => ({ name, type: 'C', length })
const L = (name: string): FieldSpec => ({ name, type: 'L', length: 1 })

// Synthetic MCERP root (all names and numbers invented). Expected grouping:
//   nrc:12345-6  CCCLI01 C001 + CONTAC P01 + IVA64 CLIENTES + INV64 0P01 (both roles; one name differs)
//   nrc:777-7    CCCLI01 C003 + C004 (same source; C004's name is cut) + CONTAC P02 (both roles; name differs)
//   nrc:55-5     IVA64 CONTRIBU 55-5 + CONTAC P03, joined by NIT (P03 has no NRC)
//   nrc:99-9     IVA64 CONTRIBU 99-9, joins a party captured in the platform
//   alone        C002 (inactive, DUI), P04 (code C002 taken), P05 (NRC with letters)
// INV64 CONTRIBU and CLIENTES are missing. CCCLI01 has one deleted row.
export function writeMcerp(root: string): void {
  const at = (...p: string[]) => path.join(root, ...p)
  writeDbf(at('cxc64', 'dbf', 'CCCLI01.DBF'), [
    C('fcta', 10), C('fncli', 70), C('ncomercial', 100), C('nsociedad', 100), C('fregiva', 10), C('fnit', 18),
    C('cedula', 12), C('act_eco', 10), C('email', 80), C('ftel', 15), C('fdcli', 90), C('fdep', 2), C('fmun', 3),
    C('cod_pais', 4), L('inactivo'), C('fres', 100),
  ], [
    { values: ['C001', 'Ferreteria Uno S.A. de C.V.', 'La Uno', '', '12345-6', '0614-150190-101-1', '', '46510', 'uno@example.com', '2222-0001', 'Calle 1', '06', '14', '9300', false, ''] },
    { values: ['C002', 'Persona Dos', '', '', '', '', '01234567-8', '', '', '', '', '', '', '', true, ''] },
    { values: ['C003', 'Tienda Tres', '', '', '777-7', '', '', '', '', '', '', '', '', '9411', false, 'Comercial Tres S.A.'] },
    { values: ['C004', 'Comercial Tres', '', '', '7777', '', '', '', '', '', '', '', '', '', false, ''] },
    { values: ['C005', 'Borrado', '', '', '888-8', '', '', '', '', '', '', '', '', '', false, ''], deleted: true },
  ])
  const prov = [C('provedor', 10), C('nombre', 70), C('registro', 10), C('nit', 17), C('dui', 12), C('direccion', 70), C('telefono', 25), C('email', 10)]
  writeDbf(at('CONTAC', 'dbf', 'PROVEDOR.DBF'), prov, [
    { values: ['P01', 'FERRETERIA UNO SA DE CV', '123456', '06141501901011', '', '', '', ''] },
    { values: ['P02', 'Otro Nombre', '777-7', '', '', '', '', ''] },
    { values: ['P03', 'Servicios Tres', '', '0614-010101-001-0', '', '', '', ''] },
    { values: ['C002', 'Proveedor Cuatro', '', '', '', '', '', ''] },
    { values: ['P05', 'Proveedor Cinco', 'ABC', '', '', '', '', ''] },
  ])
  writeDbf(at('INV64', 'dbf', 'provedor.DBF'), prov, [
    { values: ['0P01', 'Ferreteria Uno S.A. de C.V.', '12345-6', '', '', 'Otra calle', '', ''] },
  ])
  const iva = [C('fregi', 14), C('fnom', 60), C('fnit', 17), C('fdirec', 50), C('fdep', 2), C('fmun', 2), C('dui', 15), C('act_eco', 10)]
  writeDbf(at('IVA64', 'dbf', 'CONTRIBU.DBF'), iva, [
    { values: ['55-5', 'Servicios Tres', '06140101010010', '', '', '', '', ''] },
    { values: ['99-9', 'Capturado Manual', '', '', '', '', '', ''] },
  ])
  writeDbf(at('IVA64', 'dbf', 'CLIENTES.DBF'), [...iva, C('ftel', 25)], [
    { values: ['12345-6', 'Ferretería Número Uno', '', '', '', '', '', '', ''] },
  ])
}
