"""Minimal reader for VFP DBF tables with FPT/SCT/FRT memo files."""
import struct, os, sys

def read_memo(memo_bytes, block_size, ptr):
    if ptr == 0:
        return b''
    off = ptr * block_size
    typ, ln = struct.unpack('>II', memo_bytes[off:off + 8])
    return memo_bytes[off + 8: off + 8 + ln]

def read_table(path, memo_ext=None, encoding='cp1252'):
    data = open(path, 'rb').read()
    nrec = struct.unpack('<I', data[4:8])[0]
    hlen = struct.unpack('<H', data[8:10])[0]
    rlen = struct.unpack('<H', data[10:12])[0]
    fields, pos, off = [], 32, 1
    while data[pos] != 0x0D:
        d = data[pos:pos + 32]
        name = d[:11].split(b'\0')[0].decode('ascii', 'replace')
        ftype, flen, fdec = chr(d[11]), d[16], d[17]
        fields.append((name, ftype, off, flen, fdec))
        off += flen
        pos += 32
    memo, bs = None, 64
    if memo_ext:
        base = os.path.splitext(path)[0]
        for ext in (memo_ext.lower(), memo_ext.upper()):
            if os.path.exists(base + '.' + ext):
                memo = open(base + '.' + ext, 'rb').read()
                bs = struct.unpack('>H', memo[6:8])[0] or 64
                break
    rows = []
    nrec = min(nrec, (len(data) - hlen) // rlen)
    for i in range(nrec):
        r = data[hlen + i * rlen: hlen + (i + 1) * rlen]
        if not r or r[0:1] == b'*':
            continue
        row = {}
        for name, ft, o, fl, fd in fields:
            raw = r[o:o + fl]
            if ft in 'MGW' and memo is not None:
                ptr = struct.unpack('<I', raw)[0] if fl == 4 else int(raw.strip() or 0)
                row[name] = read_memo(memo, bs, ptr).decode(encoding, 'replace')
            elif ft == 'C':
                row[name] = raw.decode(encoding, 'replace').rstrip()
            else:
                row[name] = raw
        rows.append(row)
    return fields, rows

def props(text):
    out = {}
    for line in text.replace('\r', '').split('\n'):
        if '=' in line:
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip()
    return out

if __name__ == '__main__':
    f, rows = read_table(sys.argv[1], 'sct')
    for r in rows:
        print(r.get('BASECLASS'), r.get('OBJNAME'), '|', r.get('PARENT'))
        print('   ', props(r.get('PROPERTIES', '')))
