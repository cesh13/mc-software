// DBF header and field descriptors (dBase III / FoxPro / Visual FoxPro).

export type DbfField = {
  name: string // lower-cased
  type: string // C N F D L I Y T M ...
  offset: number // inside the record, after the deleted flag byte
  length: number
  decimals: number
}

export type DbfHeader = {
  version: number
  recordCount: number
  headerLength: number
  recordLength: number
  languageDriver: number
  fields: DbfField[]
}

export function parseHeader(data: Buffer): DbfHeader {
  if (data.length < 33) throw new Error('El archivo DBF está incompleto.')
  const fields: DbfField[] = []
  let pos = 32
  let offset = 1
  while (pos + 32 <= data.length && data[pos] !== 0x0d) {
    const nameEnd = data.indexOf(0, pos)
    const name = data.toString('latin1', pos, nameEnd < 0 || nameEnd > pos + 11 ? pos + 11 : nameEnd)
    const length = data[pos + 16]!
    fields.push({
      name: name.toLowerCase(),
      type: String.fromCharCode(data[pos + 11]!),
      offset,
      length,
      decimals: data[pos + 17]!,
    })
    offset += length
    pos += 32
  }
  return {
    version: data[0]!,
    recordCount: data.readUInt32LE(4),
    headerLength: data.readUInt16LE(8),
    recordLength: data.readUInt16LE(10),
    languageDriver: data[29]!,
    fields,
  }
}
