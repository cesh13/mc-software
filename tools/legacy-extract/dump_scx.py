"""Dump a VFP form's controls (caption/controlsource) and method code as text."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from vfp import read_table, props

KEEP = ('Caption', 'ControlSource', 'RowSource', 'InputMask', 'Format', 'RecordSource', 'Value')

def dump(scx):
    _, rows = read_table(scx, 'sct')
    out = [f'######## {os.path.basename(scx)}']
    for r in rows:
        name = r.get('OBJNAME')
        if not name: continue
        p = props(r.get('PROPERTIES', ''))
        info = {k: v for k, v in p.items() if k.split('.')[-1] in KEEP}
        out.append(f"== {r['BASECLASS']} {r['PARENT']}.{name} {info if info else ''}")
        code = (r.get('METHODS') or '').replace('\r', '').strip()
        if code:
            out.append(code)
    return '\n'.join(out)

if __name__ == '__main__':
    out_dir = sys.argv[1]
    for f in sys.argv[2:]:
        base = os.path.splitext(os.path.basename(f))[0].lower()
        with open(os.path.join(out_dir, base + '.txt'), 'w', encoding='utf-8') as fh:
            fh.write(dump(f))
        print(base, os.path.getsize(os.path.join(out_dir, base + '.txt')))
