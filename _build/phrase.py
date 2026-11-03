# 言葉の途中で改行しないための仕上げ（2026-11-03 オーナー指示「改行おかしいところ全部直して」）
# HTML の本文の文に、言葉の区切り（BudouX）・句読点の後・かっこの前ごとに「見えない区切り」U+200B を入れる。
# CSS の body { word-break: keep-all; overflow-wrap: anywhere; } と組で使う（区切りと空白でだけ改行する）。
# 数字・英字の間には入れない。script / style / svg などの中は触らない。何度かけても同じ結果になる（最初に古い区切りを消す）。
# 使い方: python3 phrase.py ページ.html ...（pip install budoux が必要）
import re, sys, html
import budoux
P = budoux.load_default_japanese_parser()
ZW = "​"
EXTRA = {"指導者スイングスピードダービー": ["指導者", "スイングスピード", "ダービー"], "指導者スイングスピード対決": ["指導者", "スイングスピード", "対決"], "お問い合わせ・エントリーフォーム": ["お問い合わせ・", "エントリー", "フォーム"], "ブラスバンド風応援歌": ["ブラスバンド風", "応援歌"], "自転車エルゴメーター": ["自転車", "エルゴメーター"], "等尺性最大筋力測定装置": ["等尺性", "最大筋力", "測定装置"]}
INLINE = {"a","span","b","strong","em","i","small","mark","time","abbr","sup","sub","u","s","q","cite","label","code"}
SKIP = {"script","style","svg","noscript","textarea","title","head","select","option"}
TAG = re.compile(r"<!--.*?-->|<[^>]+>", re.S)
ALNUM = re.compile(r"[A-Za-z0-9０-９Ａ-Ｚａ-ｚ'’.,:%/&+\-]")
JA = re.compile(r"[぀-ヿ㐀-鿿！-｠ー々〆]")
def tagname(t):
    m = re.match(r"</?\s*([a-zA-Z0-9]+)", t); return m.group(1).lower() if m else ""
def process(src):
    src = src.replace(ZW, "")
    bstart = src.find("<body"); bstart = src.find(">", bstart) + 1
    head, body = src[:bstart], src[bstart:]
    toks = []; pos = 0
    for m in TAG.finditer(body):
        if m.start() > pos: toks.append(["t", body[pos:m.start()]])
        toks.append(["g", m.group(0)]); pos = m.end()
    if pos < len(body): toks.append(["t", body[pos:]])
    skip = []; runs = []; cur = []
    def flush():
        nonlocal cur
        if cur: runs.append(cur); cur = []
    for k, (kind, s) in enumerate(toks):
        if kind == "g":
            n = tagname(s)
            if s.startswith("<!--"): continue
            closing = s.startswith("</"); selfc = s.endswith("/>")
            if n in SKIP:
                if not closing and not selfc: skip.append(n)
                elif closing and skip and skip[-1] == n: skip.pop()
                flush(); continue
            if skip: continue
            if n in INLINE and "data-count" not in s: continue
            flush()
        else:
            if skip: continue
            cur.append(k)
    flush()
    for run in runs:
        # 文字 → (トークン, 元の位置)
        plain = []; where = []
        for k in run:
            s = toks[k][1]; i = 0
            while i < len(s):
                m = re.match(r"&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);", s[i:])
                if m: ch = html.unescape(m.group(0)); L = len(m.group(0))
                else: ch = s[i]; L = 1
                plain.append(ch); where.append((k, i)); i += L
        text = "".join(plain)
        if not JA.search(text): continue
        cuts = []; idx = 0
        for ph in P.parse(text)[:-1]:
            idx += len(ph); cuts.append(idx)
        # 句読点の後・かっこの前でも必ず区切る
        for m in re.finditer(r"[、。・／]", text):
            if 0 < m.end() < len(text): cuts.append(m.end())
        for m in re.finditer(r"[「『（]", text):
            if m.start() > 0: cuts.append(m.start())
        # 長いカタカナ語の区切り（BudouX が1つにまとめてしまうもの）
        for w, parts in EXTRA.items():
            for m in re.finditer(re.escape(w), text):
                o = m.start()
                for q in parts[:-1]:
                    o += len(q); cuts.append(o)
        cuts = sorted(set(c for c in cuts if 0 < c < len(text)))
        ins = {}
        for c in cuts:
            a, b = text[c-1], text[c]
            if a.isspace() or b.isspace(): continue
            if ALNUM.match(a) and ALNUM.match(b): continue
            if not (JA.search(a) or JA.search(b)): continue
            k, off = where[c]; ins.setdefault(k, []).append(off)
        for k, offs in ins.items():
            s = toks[k][1]
            for off in sorted(set(offs), reverse=True): s = s[:off] + ZW + s[off:]
            toks[k][1] = s
    return head + "".join(t[1] for t in toks)
if __name__ == "__main__":
  for f in sys.argv[1:]:
    s = open(f, encoding="utf-8").read(); o = process(s)
    if o != s: open(f, "w", encoding="utf-8").write(o); print(f, o.count(ZW))
