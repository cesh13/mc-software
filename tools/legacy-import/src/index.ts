// DBF → SQLite importers for the legacy MCERP system.
export { openDbf, findFile, decodeText, guessEncoding } from './dbf/index.js'
export type { DbfTable, DbfRecord, DbfValue, DbfField, Encoding } from './dbf/index.js'
export { importContac } from './contac/import.js'
export { ImportRefusedError } from './contac/empresa.js'
export { checkContacParity } from './contac/parity.js'
export type { ParityReport, ParityTable, Mismatch, MismatchCause, ParityOptions } from './contac/parity.js'
export type { ImportOptions, ImportReport, SqlHandle, SqlStatement } from './contac/types.js'
