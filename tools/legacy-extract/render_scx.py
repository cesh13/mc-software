"""Render VFP .scx forms to static HTML approximations (layout only, no logic)."""
import sys, os, base64, glob, html
sys.path.insert(0, os.path.dirname(__file__))
from vfp import read_table, props

def unq(v):
    if v is None: return ''
    v = v.strip()
    if v.startswith('(') and v.endswith(')'): v = v[1:-1].strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'': v = v[1:-1]
    return v.replace('\\<', '')

def num(v, d=0):
    try: return int(float(v))
    except: return d

def rgb(v, d=None):
    if not v: return d
    p = v.split(',')
    return f'rgb({p[0]},{p[1]},{p[2]})' if len(p) == 3 else d

def img(folder, name, cache={}):
    name = unq(name)
    if not name: return ''
    key = (folder, name.lower())
    if key in cache: return cache[key]
    path = os.path.join(folder, name)
    if not os.path.exists(path):
        stem, ext = os.path.splitext(name)
        pref = stem.split('~')[0]
        hits = [h for h in glob.glob(os.path.join(folder, pref + '*' + ext))]
        path = hits[0] if hits else None
    uri = ''
    if path and os.path.exists(path):
        mime = 'image/png' if path.lower().endswith('png') else 'image/bmp'
        uri = f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()
    cache[key] = uri
    return uri

def render(scx):
    folder = os.path.dirname(scx)
    _, rows = read_table(scx, 'sct')
    objs = {}
    for r in rows:
        if not r.get('OBJNAME'): continue
        full = (r['PARENT'] + '.' if r['PARENT'] else '') + r['OBJNAME']
        objs[full.lower()] = (r['BASECLASS'].lower(), props(r.get('PROPERTIES', '')), r['PARENT'].lower())
    forms = [k for k, v in objs.items() if v[0] == 'form']
    out = []
    for fk in forms:
        _, fp, _ = objs[fk]
        W, H = num(fp.get('Width'), 400), num(fp.get('Height'), 300)
        bg = rgb(fp.get('BackColor'), '#ece9d8')
        pic = img(folder, fp.get('Picture', ''))
        bgimg = f"background-image:url({pic});" if pic else ''
        cap = html.escape(unq(fp.get('Caption', fk)))
        out.append(f'<div class="win" style="width:{W}px"><div class="title">{cap}'
                   f'<span class="tb">_ □ ✕</span></div>'
                   f'<div class="body" style="width:{W}px;height:{H}px;background:{bg};{bgimg}">')
        def absxy(key):
            x = y = 0
            while key and key in objs and key != fk:
                bc, p, parent = objs[key]
                if bc not in ('page',):
                    x += num(p.get('Left')); y += num(p.get('Top'))
                key = parent
            return x, y
        for k, (bc, p, parent) in objs.items():
            if not k.startswith(fk + '.') or str(p.get('Visible', '.T.')) == '.F.': continue
            x, y = absxy(parent) if parent != fk else (0, 0)
            L, T = x + num(p.get('Left')), y + num(p.get('Top'))
            w, h = num(p.get('Width')), num(p.get('Height'))
            font = f"font-size:{num(p.get('FontSize'),8)+3}px;{'font-weight:bold;' if p.get('FontBold')=='.T.' else ''}"
            fc = rgb(p.get('ForeColor'), '#000')
            st = f'left:{L}px;top:{T}px;width:{w}px;height:{h}px;{font}color:{fc};'
            if bc == 'label':
                bgc = '' if p.get('BackStyle') == '0' else f"background:{rgb(p.get('BackColor'),'transparent')};"
                out.append(f'<div class="o lbl" style="{st}{bgc}">{html.escape(unq(p.get("Caption","")))}</div>')
            elif bc in ('textbox', 'editbox', 'spinner'):
                v = unq(p.get('Value', '')) or unq(p.get('ControlSource', ''))
                out.append(f'<div class="o txt" style="{st}" title="{html.escape(v)}"></div>')
            elif bc == 'combobox':
                out.append(f'<div class="o txt cbo" style="{st}">{html.escape(unq(p.get("Value","")))}<b>▾</b></div>')
            elif bc == 'checkbox':
                out.append(f'<div class="o lbl" style="{st}">☐ {html.escape(unq(p.get("Caption","")))}</div>')
            elif bc in ('commandbutton',):
                out.append(button(folder, p, st, ''))
            elif bc in ('commandgroup', 'optiongroup'):
                n = num(p.get('ButtonCount'), 0)
                for i in range(1, n + 1):
                    pre = ('Command' if bc == 'commandgroup' else 'Option') + str(i) + '.'
                    sub = {kk[len(pre):]: vv for kk, vv in p.items() if kk.startswith(pre)}
                    bl, bt = L + num(sub.get('Left')), T + num(sub.get('Top'))
                    bst = f"left:{bl}px;top:{bt}px;width:{num(sub.get('Width'))}px;height:{num(sub.get('Height'))}px;font-size:11px;"
                    if bc == 'optiongroup':
                        out.append(f'<div class="o lbl" style="{bst}">◯ {html.escape(unq(sub.get("Caption","")))}</div>')
                    else:
                        out.append(button(folder, sub, bst, ''))
            elif bc == 'grid':
                out.append(f'<div class="o grid" style="{st}background:#fff">')
                cols = sorted([(num(objs[c][1].get('ColumnOrder'), 0), c) for c in objs if objs[c][2] == k and objs[c][0] == 'column'])
                out.append('<div class="ghead">')
                for _, c in cols:
                    cw = num(objs[c][1].get('Width'), 75)
                    hdr = next((unq(objs[h][1].get('Caption', '')) for h in objs if objs[h][2] == c and objs[h][0] == 'header'), '')
                    out.append(f'<span style="width:{cw}px">{html.escape(hdr)}</span>')
                out.append('</div></div>')
            elif bc == 'shape':
                bgc = rgb(p.get('BackColor')) if p.get('BackStyle') != '0' else 'transparent'
                out.append(f'<div class="o" style="{st}border:1px solid {rgb(p.get("BorderColor"),"#888")};background:{bgc};border-radius:{num(p.get("Curvature"))}px;z-index:0"></div>')
            elif bc == 'line':
                out.append(f'<div class="o" style="{st}border-top:1px solid #888;height:0"></div>')
            elif bc == 'image':
                u = img(folder, p.get('Picture', ''))
                if u: out.append(f'<img class="o" style="{st}object-fit:contain" src="{u}">')
            elif bc == 'pageframe' and p.get('Tabs', '.T.') != '.F.':
                out.append(f'<div class="o" style="{st}border:1px solid #999;z-index:0"></div>')
        out.append('</div></div>')
    return '\n'.join(out)

def button(folder, p, st, extra):
    cap = html.escape(unq(p.get('Caption', '')))
    u = img(folder, p.get('Picture', ''))
    im = f'<img src="{u}">' if u else ''
    return f'<div class="o btn" style="{st}">{im}<span>{cap}</span></div>'

CSS = """body{font-family:'MS Sans Serif',Tahoma,Arial,sans-serif;background:#3a6ea5;margin:0;padding:20px}
h2{color:#fff;font:600 14px Segoe UI,sans-serif;margin:24px 0 6px}
.win{border:2px solid #0a246a;box-shadow:3px 3px 8px #0006;margin-bottom:10px;background:#ece9d8}
.title{background:linear-gradient(90deg,#0a246a,#a6caf0);color:#fff;font:bold 12px Tahoma;padding:4px 6px;display:flex;justify-content:space-between}
.body{position:relative;overflow:hidden;background-size:cover}
.o{position:absolute;box-sizing:border-box;z-index:1}
.lbl{white-space:nowrap;overflow:visible}
.txt{background:#fff;border:1px solid #000080;border-top-color:#404040;border-left-color:#404040}
.cbo{padding:2px 4px;font-size:11px;display:flex;justify-content:space-between}
.btn{border:1px solid #fff;border-right-color:#404040;border-bottom-color:#404040;background:#ece9d8;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;gap:2px}
.btn img{max-width:32px;max-height:32px}
.grid{border:1px solid #808080;overflow:hidden}
.ghead{display:flex;background:#ece9d8;border-bottom:1px solid #808080;font-size:11px;font-weight:bold}
.ghead span{border-right:1px solid #aaa;padding:2px 3px;overflow:hidden;white-space:nowrap;flex:none}"""

if __name__ == '__main__':
    out_path, files = sys.argv[1], sys.argv[2:]
    parts = [f'<!doctype html><meta charset="utf-8"><title>Pantallas legadas</title><style>{CSS}</style>']
    for f in files:
        parts.append(f'<h2>{html.escape(os.path.basename(f))}</h2>')
        parts.append(render(f))
    open(out_path, 'w', encoding='utf-8').write('\n'.join(parts))
    print('wrote', out_path)
