#!/usr/bin/env python3
"""HAKI pro サイトの HTML を作る。

ヘッダー・フッターを全ページで共通にするための小さな組み立て役。
文章を直したらこのファイルを編集して `python3 _build/build.py` を実行する。
出力はリポジトリ直下の各フォルダの index.html（GitHub Pages がそのまま公開する）。
"""
import re
from pathlib import Path

import budoux  # 日本語を「言葉のまとまり」で折り返すため（pip install budoux）

_PHRASE = budoux.load_default_japanese_parser()
_PHRASE_CLASSES = ("lead", "hero-lead", "scrub", "voice", "serif", "h1", "h2", "h3")


def _phrase(inner):
    """文の中に、言葉の切れ目（ゼロ幅スペース）を入れる。CSS の keep-all と組で使う。"""
    out = _PHRASE.translate_html_string(inner)
    return re.sub(r'^<span style="word-break: keep-all; overflow-wrap: anywhere;">(.*)</span>$', r"\1", out, flags=re.S)


# 写真の「顔の位置」。切り抜かれても顔が見切れないよう、ここを中心に表示する
FOCUS = {
    "abe-1.webp": "84% 30%",
    "abe-2.webp": "80% 32%",
    "abe-talk.webp": "62% 30%",
    "abe-portrait-wide.webp": "66% 35%",
    "abe-seminar.webp": "62% 30%",
    "shimosada.webp": "70% 30%",
    "baseball-class.webp": "45% 40%",
}


def focus_images(html):
    def fix(m):
        tag = m[0]
        name = m[1]
        pos = FOCUS.get(name)
        if not pos:
            return tag
        if 'style="' in tag:
            return tag.replace('style="', f'style="object-position:{pos};', 1)
        return tag.replace("<img ", f'<img style="object-position:{pos}" ', 1)

    return re.sub(r'<img [^>]*?src="[^"]*?/?([\w-]+\.webp)"[^>]*>', fix, html)


def phrase_breaks(html):
    """見出し（h1〜h3）と、リード文などの段落だけ、変な所で改行しないようにする。"""
    main = re.search(r"<main id=\"main\">.*</main>", html, flags=re.S)
    if not main:
        return html

    def heading(m):
        return f"<{m[1]}{m[2]}>{_phrase(m[3])}</{m[1]}>"

    def para(m):
        attrs = m[1]
        cls = re.search(r'class="([^"]*)"', attrs)
        names = cls[1].split() if cls else []
        if not cls and not m[3]:
            return m[0]
        if cls and not any(n in _PHRASE_CLASSES for n in names) and not m[3]:
            return m[0]
        return f"<p{attrs}>{_phrase(m[2])}</p>"

    body = main[0]
    body = re.sub(r"<(h[1-3])((?:\s[^>]*)?)>(.*?)</\1>", heading, body, flags=re.S)
    # 「そのためには」の連続文（.chain の中の p）も対象
    body = re.sub(r'(<div class="chain">)(.*?)(</div>)', lambda m: m[1] + re.sub(r"<p((?:\s[^>]*)?)>(.*?)</p>", lambda q: f"<p{q[1]}>{_phrase(q[2])}</p>", m[2], flags=re.S) + m[3], body, flags=re.S)
    body = re.sub(r"<p((?:\s[^>]*)?)>(.*?)</p>()", lambda m: f"<p{m[1]}>{_phrase(m[2])}</p>" if "\u200b" not in m[2] else m[0], body, flags=re.S)
    body = re.sub(r"<(li|dd)((?:\s[^>]*)?)>(.*?)</\1>", lambda m: f"<{m[1]}{m[2]}>{_phrase(m[3])}</{m[1]}>", body, flags=re.S)
    body = re.sub(r'(<span class="(?:member-copy|member-role)"[^>]*>)(.*?)(</span>)', lambda m: m[1] + _phrase(m[2]) + m[3], body, flags=re.S)
    return html[: main.start()] + body + html[main.end():]

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://haki-pro.com"
SCHOOL = "/pumps/"  # 野球スクール PUMPS（中身は company-website。vercel.json で haki-pro.com/pumps/ に取り込む）
HEROS = "/heros-cup/"  # 少年野球大会 HERO's CUP（同じく haki-pro.com/heros-cup/ に取り込む）
MAIL = "info@haki-pro.com"
SCHOOL_FORM = "https://pro.form-mailer.jp/fms/39ce6285355128"  # PUMPS サイトのお問い合わせフォーム

NAV = [
    ("company", "会社概要", "COMPANY"),
    ("project", "プロジェクト", "PROJECT"),
    ("health-management", "健康経営", "WELLNESS"),
    ("raise-children", "組織コーチング", "COACHING"),
    ("specialist", "スペシャリスト", "MEMBER"),
]

ICON = {
    "food": '<path d="M12 7c-2-2-6-1.5-6 3 0 4 3 8 6 8s6-4 6-8c0-4.5-4-5-6-3z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
    "stress": '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1.2"/>',
    "move": '<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>',
    "doctor": '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="12" r="2"/>',
    "chat": '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 10h8"/>',
    "mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    "flame": '<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-4 2 2 4 5 4 8 0 3-3 6-8 6z"/>',
    "badge": '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
    "event": '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "team": '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7 0"/>',
    "academy": '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5c2 2 2 9 0 11M17.5 6.5c-2 2-2 9 0 11"/>',
    "heart": '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
}


def icon(name):
    return f'<span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">{ICON[name]}</svg></span>'


def arrow(ext=False):
    d = "M7 17L17 7M9 7h8v8" if ext else "M5 12h14M13 6l6 6-6 6"
    return f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{d}"/></svg>'


def page(slug, title, desc, body, *, scene=False, dark_top=True):
    depth = 0 if slug == "" else slug.count("/") + 1
    pre = "../" * depth
    url = f"{SITE}/{slug + '/' if slug else ''}"
    cur = slug.split("/")[0]
    nav = "".join(
        f'<a href="{pre}{s}/"{" aria-current=page" if cur == s else ""}>{ja}</a>' for s, ja, _ in NAV
    )
    drawer = "".join(f'<a href="{pre}{s}/">{ja}<small>{en}</small></a>' for s, ja, en in NAV)
    full_title = f"{title}｜株式会社HAKI pro" if slug else "株式会社HAKI pro｜個性を社会の可能性に"
    scene = scene or "data-scene=" in body
    importmap = (
        f'<script type="importmap">{{"imports":{{"three":"{pre or "./"}assets/vendor/three.module.min.js"}}}}</script>\n'
        f'  <script type="module" src="{pre}assets/js/scene.js?v=4"></script>'
        if scene
        else ""
    )
    fab = "" if slug == "contact" else f'<a class="fab" href="{pre}contact/"><i aria-hidden="true"></i>相談してみる</a>'
    html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{full_title}</title>
  <meta name="description" content="{desc}" />
  <link rel="canonical" href="{url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="株式会社HAKI pro" />
  <meta property="og:title" content="{full_title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{SITE}/assets/img/og.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#070a14" />
  <link rel="icon" href="{pre}assets/img/mark.png" />
  <link rel="apple-touch-icon" href="{pre}assets/img/mark.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;800&family=Shippori+Mincho+B1:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="{pre}assets/css/site.css?v=6" />
  {importmap}
  <script src="{pre}assets/js/site.js?v=4" defer></script>
</head>
<body>
  <a class="skip" href="#main">本文へスキップ</a>
  <header class="header{' is-dark' if dark_top else ''}">
    <div class="wrap header-inner">
      <a class="brand" href="{pre or './'}" aria-label="株式会社HAKI pro トップへ">
        <img class="logo-dark" src="{pre}assets/img/logo.png" alt="株式会社HAKI pro" width="200" height="39" />
        <img class="logo-white" src="{pre}assets/img/logo-white.png" alt="" width="200" height="39" />
      </a>
      <nav class="nav" aria-label="メインメニュー">
        {nav}
        <a href="{SCHOOL}">野球スクール</a>
        <a href="{HEROS}">HERO's CUP</a>
        <a class="nav-cta" href="{pre}contact/">お問い合わせ</a>
      </nav>
      <button class="menu-btn" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="drawer"><span></span><span></span></button>
    </div>
    <div class="progress" aria-hidden="true"></div>
  </header>
  <div class="drawer" id="drawer" aria-hidden="true">
    <a href="{pre or './'}">トップ<small>HOME</small></a>
    {drawer}
    <a href="{SCHOOL}">野球スクール PUMPS<small>SCHOOL</small></a>
    <a href="{HEROS}">HERO's CUP<small>TOURNAMENT</small></a>
    <a class="drawer-cta" href="{pre}contact/">お問い合わせ</a>
  </div>
  <main id="main">
{body}
  </main>
  {fab}
  <footer class="footer" data-dark>
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <img class="footer-logo" src="{pre}assets/img/logo-white.png" alt="株式会社HAKI pro" width="200" height="39" />
          <p class="slogan">no HAKI<br />no LIFE</p>
          <p class="addr">株式会社HAKI pro<br />〒733-0001 広島市西区大芝2丁目9-2</p>
        </div>
        <nav aria-label="フッターメニュー">
          <a href="{pre or './'}">トップ</a>
          {''.join(f'<a href="{pre}{s}/">{ja}</a>' for s, ja, _ in NAV)}
          <a href="{pre}news/">お知らせ</a>
          <a href="{SCHOOL}">野球スクール PUMPS</a>
          <a href="{HEROS}">HERO's CUP</a>
          <a href="{pre}contact/">お問い合わせ</a>
        </nav>
      </div>
      <div class="copy"><span>&copy; <span id="year">2026</span> HAKI pro Inc.</span><span>Life innovation</span></div>
    </div>
  </footer>
</body>
</html>
"""
    out = ROOT / slug / "index.html" if slug else ROOT / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(focus_images(phrase_breaks(html)), encoding="utf-8")


def hero(eyebrow, title_html, lead, scene, *, crumbs=None, extra="", sub=True):
    cr = ""
    if crumbs:
        cr = '<nav class="crumbs reveal" aria-label="現在地">' + crumbs + "</nav>"
    return f"""    <section class="hero{' hero-sub' if sub else ''}" data-dark data-stage-host>
      <canvas class="stage" data-scene="{scene}" aria-hidden="true"></canvas>
      <div class="wrap hero-inner">
        {cr}
        <p class="eyebrow reveal">{eyebrow}</p>
        <h1 class="hero-title split">{title_html}</h1>
        <p class="hero-lead reveal" style="--i:3">{lead}</p>
        {extra}
      </div>
    </section>"""


def crumbs(pre, *items):
    parts = [f'<a href="{pre}">ホーム</a>']
    for label, href in items:
        parts.append('<span aria-hidden="true">/</span>')
        parts.append(f'<a href="{href}">{label}</a>' if href else f"<span>{label}</span>")
    return "".join(parts)


def cta(pre):
    return f"""    <section class="sec cta night" data-dark data-stage-host>
      <div class="wrap">
        <div class="cta-mark" aria-hidden="true"><canvas class="stage" data-scene="orbit"></canvas></div>
        <p class="eyebrow reveal" style="justify-content:center">LET'S START</p>
        <h2 class="h1 split">さあ、一緒に歩み出そう</h2>
        <p class="lead reveal" style="margin:20px auto 0">トップアスリートと一緒に、健全な未来へ。<br />講演・イベント・健康経営・組織コーチング、まずはお気軽にご相談ください。</p>
        <div class="btn-row reveal" style="justify-content:center;margin-top:32px">
          <a class="btn btn-light magnetic" href="{pre}contact/">お問い合わせ <span class="arr">{arrow()}</span></a>
        </div>
      </div>
    </section>"""


MEMBERS = [
    ("tomohiro-abe", "安部 友裕", "代表取締役 CPO（チーフパフォーマンスオフィサー）", "あなたにしかできない、あなたの強みを。", "abe-2.webp"),
    ("shimosada-hirokazu", "下定 弘和", "クリエイティブディレクター", "イベント力が会社を救う", "shimosada.webp"),
]


def member_cards(pre, skip=None):
    out = []
    for i, (slug, name, role, copy, img) in enumerate(MEMBERS):
        if slug == skip:
            continue
        out.append(
            f"""<a class="member tilt reveal" style="--i:{i}" href="{pre}specialist/{slug}/">
          <img src="{pre}assets/img/{img}" alt="{name}" loading="lazy" width="1400" height="933" />
          <span class="member-copy" aria-hidden="true">{copy}</span>
          <span class="member-body"><span class="member-role">{role}</span><span class="member-name">{name}</span></span>
          <span class="go" aria-hidden="true">{arrow()}</span>
        </a>"""
        )
    return '<div class="members">' + "".join(out) + "</div>"


# ======================================================================
# トップ
# ======================================================================
def build_home():
    pre = ""
    ticker = "".join(
        f"<span>{t}</span>"
        for t in [
            "企業の健康経営と組織コーチング",
            "“からだ”と“こころ”、真のWell-beingへ",
            "「自分ならできる」から「自分たちならできる」へ",
            "「働きやすさ」から「働きがい」へ",
        ]
    )
    pulse_svg = """<svg class="viz-pulse" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <circle class="ring" cx="200" cy="200" r="150" stroke="#e60312" style="--k:0"/>
              <circle class="ring" cx="200" cy="200" r="150" stroke="#b30281" style="--k:1"/>
              <circle class="ring" cx="200" cy="200" r="150" stroke="#1d2286" style="--k:2"/>
              <circle class="ring" cx="200" cy="200" r="150" stroke="#0881cb" style="--k:3"/>
              <circle class="ring" cx="200" cy="200" r="150" stroke="#42af38" style="--k:4"/>
              <circle class="ring" cx="200" cy="200" r="150" stroke="#fee003" style="--k:5"/>
              <path class="ecg" d="M40 200h90l20-40 25 90 25-130 25 110 15-30h120"/>
            </svg>"""
    import math, random
    random.seed(7)
    pts = [(200 + 150 * math.cos(a) * r, 200 + 150 * math.sin(a) * r) for a, r in ((random.random() * 6.283, 0.25 + random.random() * 0.75) for _ in range(22))]
    lines, k = [], 0
    for i, (x1, y1) in enumerate(pts):
        for x2, y2 in pts[i + 1:]:
            if math.hypot(x2 - x1, y2 - y1) < 95:
                lines.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" style="--k:{k}"/>')
                k += 1
    cols = ["#e60312", "#b30281", "#1d2286", "#0881cb", "#42af38", "#fee003", "#ffffff"]
    dots = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="6" fill="{cols[i % 7]}" style="--k:{i}"/>' for i, (x, y) in enumerate(pts))
    net_svg = f'<svg class="viz-net" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{"".join(lines)}{dots}</svg>'

    body = f"""    <section class="hero" data-dark data-stage-host>
      <canvas class="stage" data-scene="ring" data-layout="home" aria-hidden="true"></canvas>
      <div class="wrap hero-inner">
        <p class="eyebrow reveal">Life innovation</p>
        <h1 class="hero-title split">個性を、<br />社会の可能性に。</h1>
        <div class="ticker reveal" style="--i:4" aria-live="off">{ticker}</div>
        <div class="btn-row reveal" style="--i:6">
          <a class="btn btn-light magnetic" href="#business">事業を見る <span class="arr">{arrow()}</span></a>
          <a class="btn btn-ghost magnetic" href="contact/">お問い合わせ</a>
        </div>
      </div>
      <div class="scroll-cue" aria-hidden="true">SCROLL</div>
    </section>

    <div class="marquee" aria-hidden="true"><div class="marquee-track">
      <span>no HAKI no LIFE <i></i> <em class="stroke">Life innovation</em> <i></i></span>
      <span>no HAKI no LIFE <i></i> <em class="stroke">Life innovation</em> <i></i></span>
    </div></div>

    <section class="sec">
      <div class="wrap-narrow">
        <p class="eyebrow reveal">MIRAI WO TSUNAGU</p>
        <h2 class="h2 split">ミライをつなぐ</h2>
        <p class="lead reveal" style="margin-top:16px">企業の健康経営と組織コーチングで導く、パーパス駆動型プロジェクト</p>
        <p class="scrub" style="margin-top:48px">HAKI proは、健康経営事業と組織コーチング事業を通じて、企業の従業員さまの「からだ」と「こころ」の健康や、運動に対する意欲を向上させ、一人ひとりが目的、役割を理解し確かなpieceとなって、より良い社会を創造していくことを目的としています。</p>
        <a class="link-arrow reveal" href="project/" style="margin-top:32px">HAKI proのコンセプト <span class="circle">{arrow()}</span></a>
      </div>
    </section>

    <section class="sec bg-2" id="business" style="padding-top:clamp(64px,8vw,120px)">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">BUSINESS</p>
          <h2 class="h2 split">3つの事業で、会社を元気に</h2>
        </div>
        <div class="stack">
          <a class="stack-card" href="health-management/">
            <div class="stack-body">
              <div>
                <p class="stack-num"><b>01</b> / 03</p>
                <p class="stack-en" style="margin-top:28px">WELLNESS</p>
                <h3 class="stack-title">企業の健康経営</h3>
                <p class="muted" style="margin-top:16px">従業員等の健康管理を、将来の収益につながる経営的な視点で考えた、戦略的健康推進の実践。</p>
              </div>
              <span class="link-arrow">まずは従業員の健康から <span class="circle">{arrow()}</span></span>
            </div>
            <div class="stack-visual">{pulse_svg}</div>
          </a>
          <a class="stack-card" href="raise-children/">
            <div class="stack-body">
              <div>
                <p class="stack-num"><b>02</b> / 03</p>
                <p class="stack-en" style="margin-top:28px">FUTURE</p>
                <h3 class="stack-title">組織コーチング</h3>
                <p class="muted" style="margin-top:16px">社員の潜在能力を解放し、組織全体のシナジーを最大化する。今こそ、あなたの会社を「働きたい」から「輝きたい」場所へ。</p>
              </div>
              <span class="link-arrow">明日のリーダーを、今日から <span class="circle">{arrow()}</span></span>
            </div>
            <div class="stack-visual">{net_svg}</div>
          </a>
          <a class="stack-card" href="specialist/">
            <div class="stack-body">
              <div>
                <p class="stack-num"><b>03</b> / 03</p>
                <p class="stack-en" style="margin-top:28px">SPECIALIST</p>
                <h3 class="stack-title">よりそうスペシャリスト</h3>
                <p class="muted" style="margin-top:16px">運動の重要性、健康な職場づくりを、数々の困難やプレッシャーと戦い続けてきたトップアスリートと同じ視点で考える。</p>
              </div>
              <span class="link-arrow">トップアスリートの視点で <span class="circle">{arrow()}</span></span>
            </div>
            <div class="stack-visual"><img src="assets/img/abe-1.webp" alt="代表 安部友裕" loading="lazy" width="1600" height="1067" /></div>
          </a>
        </div>
      </div>
    </section>

    <section class="sec" id="school">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">BASEBALL SCHOOL</p>
          <h2 class="h2 split">HAKI proの野球スクール</h2>
          <p class="lead reveal">元プロ野球選手と大学が共同開発した、スポーツ科学で「打つ・投げる・走る」を測って伸ばすスクールです。</p>
        </div>
        <a class="school reveal" href="{SCHOOL}" data-dark>
          <div class="school-body">
            <img class="school-logo" src="assets/img/pumps-logo-white.png" alt="PUMPS" width="300" height="120" loading="lazy" />
            <p class="en" style="font-size:12px;letter-spacing:.2em;color:rgba(255,255,255,.6);margin:0">BASEBALL SCIENCE LAB</p>
            <h3 class="school-title">才能を、<br /><span class="accent">科学する。</span></h3>
            <div class="school-meta"><span>データ計測</span><span>1年設計のプログラム</span><span>比治山大学と連携</span><span>無料体験あり</span></div>
            <span class="school-go">野球スクールのサイトを見る <span class="circle">{arrow(True)}</span></span>
          </div>
          <div class="school-stage">
            <canvas data-scene="ball" aria-label="指で回せる硬式球"></canvas>
            <span class="hint">DRAG TO SPIN</span>
          </div>
        </a>
      </div>
    </section>

    <section class="sec-tight" id="heros-cup" style="padding-top:0">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">TOURNAMENT</p>
          <h2 class="h2 split">子どもが主役の全員野球大会</h2>
          <p class="lead reveal">補欠をつくらず、大人が指示を出さず、子どもたち自身の手で試合をつくる少年野球大会です。</p>
        </div>
        <a class="heros reveal" href="{HEROS}">
          <div class="heros-body">
            <p class="heros-en">ALL-PLAYERS BASEBALL TOURNAMENT</p>
            <h3 class="heros-title">次は、<br /><span>きみだ！</span></h3>
            <p class="heros-lead">すべての子どもに、ヒーローになる瞬間を。</p>
            <ul class="heros-rules">
              <li><b>補欠なし</b>登録選手は全員出場</li>
              <li><b>大人立入禁止</b>指示は出さない</li>
              <li><b>技術 ＜ 姿勢</b>HERO審査制度</li>
              <li><b>模擬甲子園演出</b>アナウンス・応援歌</li>
            </ul>
            <p class="heros-next"><span>第1回大会 in 三原</span>2026年11月28日・29日／16チーム限定</p>
            <span class="school-go">HERO's CUP のサイトを見る <span class="circle heros-circle">{arrow()}</span></span>
          </div>
          <div class="heros-visual" aria-hidden="true">
            <div class="heros-rays"></div>
            <img src="assets/img/heros-logo.png" alt="" width="560" height="375" loading="lazy" />
          </div>
        </a>
      </div>
    </section>

    <section class="sec bg-2" id="activity">
      <div class="wrap">
        <div class="sec-head split-2" style="align-items:end">
          <div>
            <p class="eyebrow reveal">ACTIVITY</p>
            <h2 class="h2 split">元プロアスリートの<br />苦悩、葛藤を覗いてみませんか？</h2>
          </div>
          <p class="lead reveal">企業さまでの経営セミナー、健康セミナー、地域のイベント参加など、さまざまな活動を始めました。ぜひ一緒にミライの健康について考えませんか？</p>
        </div>
        <div class="talks">
          <div class="talk-stat reveal">
            <p class="k">LECTURES</p>
            <p class="talk-num"><span class="pre">約</span><span class="num" data-count="200">200</span><span class="unit">回</span></p>
            <p class="talk-label">講演会の実績</p>
            <ul class="talk-tags">
              <li>経営セミナー</li><li>健康セミナー</li><li>覇氣セミナー</li><li>地域のイベント</li>
            </ul>
            <a class="link-arrow" href="contact/?kind=talk">講演のご依頼 <span class="circle">{arrow()}</span></a>
          </div>
          <figure class="talk-photo reveal" style="--i:1"><div class="ph"><img src="assets/img/abe-seminar.webp" alt="覇氣セミナーで話す安部友裕" loading="lazy" width="800" height="533" /></div><figcaption>覇氣セミナー</figcaption></figure>
          <figure class="talk-photo reveal" style="--i:2"><div class="ph"><img src="assets/img/baseball-class.webp" alt="子どもたちへの野球指導" loading="lazy" width="1600" height="1044" /></div><figcaption>子どもたちへの野球教室</figcaption></figure>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head split-2" style="align-items:end">
          <div>
            <p class="eyebrow reveal">with SPECIALIST</p>
            <h2 class="h2 split">トップアスリートと一緒に</h2>
          </div>
          <div>
            <p class="lead reveal">私たちは単なるサービス提供者ではなく、皆さまと社会の真のパートナーとなることを目指します。トップアスリート経験豊富なメンバーだからこそ、見えない部分に着目し、誰にも真似できない健康経営＆組織コーチングを創出していきます。</p>
          </div>
        </div>
        {member_cards(pre)}
        <div class="reveal" style="margin-top:32px"><a class="link-arrow" href="specialist/">参画スペシャリスト一覧 <span class="circle">{arrow()}</span></a></div>
      </div>
    </section>

    <section class="sec-tight bg-2">
      <div class="wrap">
        <div class="sec-head" style="margin-bottom:32px">
          <p class="eyebrow reveal">INFORMATION</p>
          <h2 class="h2 split">お知らせ</h2>
        </div>
        <div class="news reveal">
          <a href="news/hp-open/"><time datetime="2023-11-01" class="num">2023.11.01</time><span class="cat">新着情報</span><span class="t">ホームページを公開しました</span><span class="link-arrow"><span class="circle">{arrow()}</span></span></a>
        </div>
        <div class="reveal" style="margin-top:24px"><a class="link-arrow" href="news/">お知らせ一覧 <span class="circle">{arrow()}</span></a></div>
      </div>
    </section>
{cta(pre)}"""
    page("", "", "株式会社HAKI proは、元プロアスリートが企業の健康経営と組織コーチングを支える広島の会社です。からだとこころの健康から、働きがいのある組織へ。", body, scene=True)


# ======================================================================
# 会社概要
# ======================================================================
def build_company():
    pre = "../"
    futures = [
        ("01", "個性が交わる未来", "一人ひとりの個性が認められ、異なる才能が出会うことで、新たな価値が生まれ続ける社会を創ります。"),
        ("02", "選択が広がる未来", "既存の枠を超えて、誰もが自分らしい選択ができる、可能性に満ちた社会を実現します。"),
        ("03", "共に育つ未来", "世代や立場を超えて、人と人が響き合い、持続的に成長できる社会を築きます。"),
    ]
    missions = [
        ("1", "個性を活かす、未来を拓く", "私たちは一人ひとりの個性を最大限に活かせるビジネスモデルと組織づくりを支援します。", ["独自の強みを活かしたビジネス戦略の構築", "個人の才能が開花する組織文化の醸成", "多様な価値観が共存するチーム作り"]),
        ("2", "選択肢を創る、可能性を広げる", "既存の枠組みにとらわれない、新しい選択肢と可能性を提供します。", ["革新的なビジネスソリューションの開発", "柔軟で多様な働き方の実現", "持続可能な成長モデルの確立"]),
        ("3", "人と人を紡ぎ、価値を創造する", "意味ある出会いと協働を通じて、新たな価値を生み出します。", ["業界や組織を超えた協創の促進", "世代を超えた知見の継承と革新", "地域社会との持続的な共生"]),
    ]
    values = [("R", "Respect", "尊重", "すべての人の個性と可能性を大切にする", "#e60312"), ("C", "Connect", "繋ぐ", "人と人、知恵と知恵を紡ぎ合わせる", "#b30281"), ("C", "Create", "創造", "既存の枠を超えた新しい価値を生み出す", "#0881cb"), ("E", "Evolve", "進化", "常に学び、成長し続ける", "#42af38"), ("I", "Impact", "影響", "社会に持続的なポジティブインパクトを与える", "#fee003")]
    body = hero("COMPANY", "人を紡ぎ、<br />未来へ繋ぐ。", "株式会社HAKI proの想い（VISION）と使命（MISSION）、会社の情報です。", "ring", crumbs=crumbs(pre, ("会社概要", None))) + f"""
    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">VISION ＝ 想い</p>
          <h2 class="h2 split">私たちが描く、3つの未来</h2>
        </div>
        <div class="grid-3" data-stagger>
          {''.join(f'<div class="card reveal"><span class="big-k" aria-hidden="true">{n}</span><div class="bar"></div><p class="k">FUTURE {n}</p><h3 class="h3">{t}</h3><p class="muted">{d}</p></div>' for n, t, d in futures)}
        </div>
      </div>
    </section>

    <section class="sec night" data-dark>
      <div class="wrap-narrow" style="text-align:center">
        <p class="eyebrow reveal" style="justify-content:center">OUR PROMISE</p>
        <h2 class="h2 split">私たちの約束</h2>
        <div style="margin-top:48px" data-stagger>
          <p class="serif reveal" style="font-size:clamp(20px,3vw,32px);line-height:1.8;margin:0">すべての出会いを、価値ある物語へ</p>
          <p class="serif reveal" style="font-size:clamp(20px,3vw,32px);line-height:1.8;margin:0">すべての個性を、未来への原動力へ</p>
          <p class="serif reveal" style="font-size:clamp(20px,3vw,32px);line-height:1.8;margin:0">すべての挑戦を、確かな一歩へ</p>
        </div>
        <p class="lead reveal" style="margin:40px auto 0">人と人との出会いが紡ぐストーリーが、より良い未来への架け橋となる。<br />それが、私たちの信じる未来です。</p>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">MISSION ＝ 使命</p>
          <h2 class="h2 split">個性が輝き、可能性が広がる社会の創造</h2>
        </div>
        <div class="grid-3" data-stagger>
          {''.join(f'<div class="card reveal"><span class="big-k" aria-hidden="true">{n}</span><div class="bar"></div><p class="k">MISSION {n}</p><h3 class="h3">『{t}』</h3><p class="muted">{d}</p><ul class="list-dot">{"".join(f"<li>{x}</li>" for x in li)}</ul></div>' for n, t, d, li in missions)}
        </div>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">CODE OF CONDUCT</p>
          <h2 class="h2 split">行動指針</h2>
        </div>
        <div class="values">
          {''.join(f'<div class="value reveal" style="--i:{i};--c:{c}"><span class="L" aria-hidden="true">{L}</span><b>{en}</b><span>{ja}｜{d}</span><i></i></div>' for i, (L, en, ja, d, c) in enumerate(values))}
        </div>
        <div class="card reveal" style="margin-top:16px">
          <p class="k">OUR PROMISE</p>
          <ul class="list-check" data-stagger style="margin-top:16px">
            <li>一人ひとりの声に真摯に耳を傾けます</li>
            <li>常に新しい可能性を追求し続けます</li>
            <li>結果にこだわり、確実な成果を届けます</li>
            <li>社会との調和の中で、持続的な成長を実現します</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap-narrow">
        <p class="eyebrow reveal">CHALLENGE</p>
        <div class="chain">
          <p>そのためには、個性について深く考える。</p>
          <p>そのためには、社会の現状を正しくとらえる。</p>
          <p>そのためには、多様性を認める社会をつくる。</p>
          <p>そのためには、常識と過去にとらわれない。</p>
          <p>そのためには、努力と工夫を惜しまない。</p>
          <p class="last">だから、私たちは挑戦をやめない。</p>
        </div>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap split-2">
        <div>
          <p class="eyebrow reveal">PROFILE</p>
          <h2 class="h2 split">会社概要</h2>
          <div class="photo reveal-img" style="margin-top:32px"><img src="{pre}assets/img/abe-portrait-wide.webp" alt="代表取締役 安部友裕" loading="lazy" width="1600" height="1067" /></div>
        </div>
        <dl class="dl reveal">
          <div><dt>会社名</dt><dd>株式会社 HAKI pro</dd></div>
          <div><dt>代表者</dt><dd>安部 友裕</dd></div>
          <div><dt>所在地</dt><dd>〒733-0001<br />広島市西区大芝2丁目9-2</dd></div>
          <div><dt>資本金</dt><dd>300万円</dd></div>
          <div><dt>事業内容</dt><dd>健康経営サポート事業<br />組織コーチング事業<br />SNSマーケティング＆AIコンサル事業<br />イベント企画運営<br />野球スクール（<a href="{SCHOOL}" style="text-decoration:underline">PUMPS</a>）</dd></div>
          <div><dt>設立</dt><dd>2023年3月</dd></div>
          <div><dt>取引銀行</dt><dd>広島信用金庫</dd></div>
        </dl>
      </div>
    </section>
{cta(pre)}"""
    page("company", "会社概要", "株式会社HAKI proの想い（VISION）・使命（MISSION）・行動指針と会社概要。人を紡ぎ、未来へ繋ぐ。", body, scene=True)


# ======================================================================
# プロジェクト
# ======================================================================
def build_project():
    pre = "../"
    biz = [
        ("heart", "健康経営サポート事業", "「企業のチームトレーナー」として、企業さまにとって一番の財産である従業員に対して健康プログラムを作成し、ストレス管理や栄養指導等を提供します。従業員の健康促進をサポートすることにより、企業さまの生産性を向上させます。", ["テラスホールディングス", "桑原組", "御池鐵工所"]),
        ("event", "イベント企画運営事業", "商業施設での運動教室やトークショーなど、幅広い世代の方々を対象としたイベントを、企画から運営までトータルでサポートいたします。", ["イオンモール広島府中", "レクト"]),
        ("team", "組織コーチング事業", "広島に所縁のあるプロアスリートたちが、講演活動やイベント参加を通じて、自らの経験を還元します。", ["テラスホールディングス"]),
        ("academy", "アカデミー事業", "子どもたちを対象とした野球教室から、高齢者向けの健康体操まで、幅広い年齢の皆さまに健康プログラムの作成と指導をお届けします。", ["住田学園", "山陽高校女子野球部"]),
    ]
    extra = '<div class="reveal" style="--i:5;display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><span class="chips" style="margin:0"><span style="background:rgba(42,163,255,.18);color:#bfe3ff">● 企業の健康経営</span><span style="background:rgba(91,214,74,.18);color:#cdf5c6">● 子どもの健全なミライ</span></span></div>'
    body = hero("PROJECT", "ミライを<br />つなぐ。", "企業の健康経営と、こどもの健全なミライをつなぐ循環型プロジェクト。", "loop", crumbs=crumbs(pre, ("プロジェクト", None)), extra=extra) + f"""
    <section class="sec">
      <div class="wrap-narrow">
        <p class="scrub">HAKI proは、健康経営事業とこども育成事業を通じて、企業の従業員さまと地域のこどもたちの「からだ」と「こころ」の健康や、運動に対する意欲を向上させることで、社会をより豊かにしていくことを目的としています。</p>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap split-2">
        <div class="photo tall reveal-img"><img src="{pre}assets/img/abe-1.webp" alt="代表 安部友裕" loading="lazy" width="1600" height="1067" /></div>
        <div>
          <p class="eyebrow reveal">FOR COMPANIES</p>
          <h2 class="h2 split">企業の健康は、一人ひとりの従業員の健康で支えられている</h2>
          <p class="reveal" style="margin-top:24px">HAKI proは、持続可能な企業活動をするために、従業員一人ひとりの健康を第一に考えています。人間の健康問題は普遍で、社会情勢に関係なく取り組まなくてはなりません。</p>
          <p class="reveal">企業の社長さまだけでは把握しきれない従業員の健康（心の健康も含む）に、幾多の苦境や逆境を乗り越えてきたアスリートたちの“覇氣”をお届けすることによって、一度きりの人生を心身共に健康で、笑顔あふれる人生にします。</p>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap split-2 rev">
        <div class="photo tall reveal-img"><img src="{pre}assets/img/abe-2.webp" alt="セミナーで話す安部友裕" loading="lazy" width="1600" height="1067" /></div>
        <div>
          <p class="eyebrow reveal">FOR EMPLOYEES</p>
          <h2 class="h2 split">従業員さまに「とびっきり」の原動力を</h2>
          <p class="reveal" style="margin-top:24px">個人の輝きを最大限に引き出します。そして、一人ひとりの想いや考えを丁寧に言葉にすることで、チーム内の相互理解を深め、強固な信頼関係を構築していきます。</p>
        </div>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap split-2">
        <div class="photo tall reveal-img"><img src="{pre}assets/img/baseball-class.webp" alt="子どもたちへの野球指導" loading="lazy" width="1600" height="1044" /></div>
        <div>
          <p class="eyebrow reveal">FOR CHILDREN</p>
          <h2 class="h2 split">子どもの健全育成のために</h2>
          <p class="reveal" style="margin-top:24px">覇氣プロジェクトは、企業の健康経営と同時に子どもの健全育成を考え、各種スポーツ競技の発展に伴う少年少女に対する専門的技術指導や、成長期に必要なカラダ作りのための基礎トレーニング、それに伴う栄養（食育）指導を行い、スポーツ育成現場に必須である各種コンテンツを提供します。</p>
          <p class="reveal">昨今、特定のスポーツを行っていない（スマホ、テレビゲームなどに没頭している）子どもたちも増えてきており、将来の健康面も不安視されています。そんな子どもたちのためにカラダを動かす機会と環境を提供し、日頃の運動不足を解消してもらうための取り組みを提供します。</p>
          <a class="link-arrow reveal" href="{SCHOOL}" style="margin-top:8px">野球スクール PUMPS <span class="circle">{arrow(True)}</span></a>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">BUSINESS</p>
          <h2 class="h2 split">事業内容</h2>
        </div>
        <div class="grid-2" data-stagger>
          {''.join(f'<div class="card tilt reveal" data-tilt="4"><span class="big-k" aria-hidden="true">0{i + 1}</span>{icon(ic)}<h3 class="h3">{t}</h3><p class="muted">{d}</p></div>' for i, (ic, t, d, ch) in enumerate(biz))}
        </div>
      </div>
    </section>
{cta(pre)}"""
    page("project", "プロジェクト", "企業の健康経営と、こどもの健全なミライをつなぐ循環型プロジェクト。健康経営サポート・イベント企画運営・組織コーチング・アカデミー事業。", body, scene=True)


# ======================================================================
# 健康経営
# ======================================================================
def build_health():
    pre = "../"
    merits = [
        ("01", "生産性向上", "従業員が十分なパフォーマンスを発揮するには、心身ともに健康であることが何より重要です。心身が健康なら、欠勤などの勤怠不良が少なくなるのはもちろん、社内の雰囲気が良くなり、モチベーション向上につながります。", ""),
        ("02", "人材の定着・確保・採用コスト低減", "健康経営は、退職者の低減につながります。また、健康経営の取り組みを社会へアピールすることで優秀な人材を採用しやすくなるほか、採用コストの低減にもつながります。",
         '<div class="compare" role="img" aria-label="離職率の比較：全国平均11.3%、健康経営優良法人2020の企業2.7%"><div class="row"><span>全国平均</span><span class="track"><span class="fill" style="--v:1"></span></span><b class="num"><span data-count="11.3">11.3</span>%</b></div><div class="row good"><span>健康経営優良法人2020</span><span class="track"><span class="fill" style="--v:.239"></span></span><b class="num"><span data-count="2.7">2.7</span>%</b></div><p class="note" style="margin:0">離職率の比較</p></div>'),
        ("03", "企業イメージの向上", "健康経営に取り組み、審査に通ればホームページや名刺に認定マークを付けることができます。こうした対外的な好印象は信用力そのもので、ブランド力強化に直結します。", ""),
        ("04", "企業負担の医療費軽減", "健康経営によって、従業員が病気にかかる頻度・期間が減少します。そのため、企業が所属する健康保険組合による医療費軽減が見込まれます。逆に従業員の疾病が頻出すると、健康保険組合の財政を圧迫し、組合費の高騰につながります。", ""),
    ]
    progs = [
        ("food", "栄養調査", "栄養調査アプリに入力後、当社契約の栄養調査機関（大学研究室）にて評価し、結果表をオンラインで返信します。回を追うごとに推移が分かるので、その後の食事内容にお役立ていただけます。（年4回実施）"),
        ("stress", "ストレスチェック", "自己診断疲労度チェックリストに記入後、身体的・精神的・総合評価の3項目の結果をオンラインでフィードバックします。ストレスリスクが高い従業員さまは、御社のご担当者に個別にご報告します。（年4回実施）"),
        ("move", "出張運動指導", "当社専属の経験豊富な運動指導者が、御社の会議室やセミナールームで運動指導を実施します。肩こり・腰痛やメタボ対策、ダイエット、姿勢改善など各種プログラムを実施します。"),
        ("doctor", "産業医選定", "当社にて産業医の選任をさせていただきます。医師の職場巡視、または健康問題のある従業員さまに対し、当社にて一元管理が可能になります。"),
        ("chat", "健康・メンタルヘルス LINE相談窓口", "健康とメンタルヘルスに関するご相談を、リアルタイムにLINEでお受けします。看護師、薬剤師、理学療法士、管理栄養士など各種専門家が、健康面のさまざまな質問にお答えします。"),
        ("mic", "健康セミナー", "運動・食事を中心に、従業員さまの健康を語る上で必ず知っておいてほしい、健康経営コンサルタントによるセミナーです。ご家族にも共有できる、すぐに実践できる健康法を講義＋実技でわかりやすくご説明します。"),
        ("flame", "覇氣セミナー", "安部友裕が従業員さまに「覇氣」を注入する特別セミナー。結果が出ない時、何をやってもダメな時、どうやってその状況を乗り越えるのか。メンタルの重要性からコンディションを整えることの重要さまで、やる気が出る唯一無二のセミナーです。"),
        ("badge", "健康経営優良法人 取得サポート", "近年取得される企業さまが増えている、経済産業省認定の健康経営優良法人。認定条件に必要な項目の実施や、どうすれば取得できるかのご相談まで、初めて取得される企業さまも、取得を検討中の企業さまもサポートします。"),
    ]
    body = hero("WELLNESS", "企業の健康は、<br />従業員の健康で<br />支えられている。", "「組織のパーソナルトレーナー」として、従業員の健康から会社の生産性を高めます。", "pulse", crumbs=crumbs(pre, ("健康経営サポート事業", None))) + f"""
    <section class="sec">
      <div class="wrap split-2" style="align-items:start">
        <div>
          <p class="eyebrow reveal">ABOUT</p>
          <h2 class="h2 split">「今を大切に、明日を最高に」</h2>
          <p class="reveal" style="margin-top:24px">「組織のパーソナルトレーナー」として、企業さまにとって一番の財産である従業員に対し、健康プログラムを作成し、ストレス管理や栄養指導等を提供します。従業員の健康促進をサポートすることにより、企業さまの生産性を向上させます。</p>
          <p class="reveal">日々の生活の中に「健康」という概念を浸透させることで、間違った食習慣の改善や運動不足の解消につなげ、健康生活のための新たな行動変容に繋げます。企業として取り組むので、1人ではなく実行する仲間がいることで頑張れて、「意識」が変わります。</p>
          <p class="reveal">企業単位、家族単位に専門家が直接携わることで、健康に関するコミュニケーションが生まれ、いつでも相談しあえる関係が自然とできあがります。</p>
        </div>
        <div>
          <p class="k en reveal" style="font-size:13px;letter-spacing:.14em;color:var(--ink-3);font-weight:700">VOICES</p>
          <div class="voices" data-stagger style="margin-top:16px">
            <p class="voice reveal">「健康診断で指導が入ったのですが、どうしたらいいですか？」</p>
            <p class="voice reveal">「日々の業務で首肩が辛かったり、慢性的な腰痛をなんとかしたい」</p>
            <p class="voice reveal">「最近なんだかストレスが溜まって……」</p>
          </div>
          <p class="h3 reveal" style="margin-top:28px">職場から、こんな声が上がっていませんか？</p>
          <p class="muted reveal">健康は、従業員と真剣に話し合えるコンテンツです。</p>
        </div>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">MERIT</p>
          <h2 class="h2 split">健康経営が企業に与えるメリット</h2>
          <p class="lead reveal">健康経営は今や国からの要請になり「実施しないといけなくなった」取り組みですが、それによって得られる大きなメリットもあります。</p>
        </div>
        <div class="grid-2" data-stagger>
          {''.join(f'<div class="card reveal"><span class="big-k" aria-hidden="true">{n}</span><div class="bar"></div><p class="k">MERIT {n}</p><h3 class="h3">{t}</h3><p class="muted">{d}</p>{x}</div>' for n, t, d, x in merits)}
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">PROGRAM</p>
          <h2 class="h2 split">健康経営 各種プログラム</h2>
        </div>
        <div class="grid-3" data-stagger>
          {''.join(f'<div class="card tilt reveal" data-tilt="4">{icon(ic)}<h3 class="h3">{t}</h3><p class="muted">{d}</p></div>' for ic, t, d in progs)}
        </div>
      </div>
    </section>
{cta(pre)}"""
    page("health-management", "健康経営サポート事業", "元プロアスリートと専門家が「組織のパーソナルトレーナー」として、栄養調査・ストレスチェック・出張運動指導・産業医選定・健康経営優良法人の取得までサポートします。", body, scene=True)


# ======================================================================
# 組織コーチング
# ======================================================================
def build_coaching():
    pre = "../"
    changes = [
        ("溢れ出す笑顔としなやかな対応力", ["明るい表情で迎える毎日の業務", "リラックスした雰囲気での会議進行", "柔軟な発想で課題解決にアプローチ", "お客さまとの自然な会話の広がり", "ストレスフリーな職場コミュニケーション"]),
        ("自然と生まれる会話の輪", ["朝の挨拶から始まる活気ある職場", "お互いを気にかけ合う声かけが日常に", "雑談から生まれる新しいアイデアの数々", "部署を超えた情報交換が活発に", "「話しやすい」と感じる風通しの良さ"]),
        ("心身ともに充実した毎日", ["活力みなぎる朝型の働き方", "自然と身につく健康習慣", "質の高い睡眠がもたらす集中力", "仕事とプライベートの心地よいバランス", "ポジティブな思考で進める業務"]),
        ("湧き出るアイデアと創造性", ["イノベーティブな提案が次々と誕生", "「できない」を「できる」に変えるマインド", "情熱を持って取り組むプロジェクト", "品質へのこだわりが生む高評価", "チャレンジを楽しむ組織文化"]),
        ("響き合う組織の一体感", ["全員で共有する明確なビジョン", "経営理念が自然と染み渡る組織風土", "お互いを高め合うチームワーク", "世代を超えた活発な意見交換", "全社一丸となって進むプロジェクト"]),
    ]
    feats = [
        ("spark", "科学的アプローチ", ["産業医と組織心理の専門家による総合診断", "データに基づく改善計画の立案", "定期的な効果測定と計画調整"]),
        ("move", "実践的プログラム", ["現場の実態に即したカスタマイズ", "すぐに実践できる具体的な施策提供", "経営層から現場までの包括的サポート"]),
        ("team", "持続可能な変革", ["社内チームの育成支援", "自走できる仕組みづくり", "継続的なフォローアップ体制"]),
    ]
    progs = [("潤化 LEADERS’ VISION", "月1回の戦略会議"), ("潤化 NAVIGATOR", "隔週1on1"), ("潤化 DIALOGUE CAFÉ", "月2回"), ("潤化 CROSS INNOVATION LAB", "四半期開催"), ("潤化 VOICE BOX", "常時受付・月1回共有"), ("潤化 INNOVATION TRIBE", "プロジェクト制"), ("潤化 FACILITATION CREW", "専門チーム"), ("潤化 DIGITAL HUB", "システム基盤")]
    acc = "".join(
        f'<div class="acc reveal" style="--i:{i}"><button type="button" aria-expanded="{"true" if i == 0 else "false"}"><span class="n">0{i + 1}</span>{t}<span class="pm" aria-hidden="true"></span></button><div class="panel"><div><ul class="list-dot">{"".join(f"<li>{x}</li>" for x in li)}</ul></div></div></div>'
        for i, (t, li) in enumerate(changes)
    ).replace('<div class="acc reveal" style="--i:0">', '<div class="acc open reveal" style="--i:0">', 1)
    body = hero("COACHING", "個性を力に。<br />組織を輝きに。", "眠れる才能を呼び覚まし、言葉で企業文化を創る。明日のリーダーを、今日から。", "network", crumbs=crumbs(pre, ("組織コーチング", None))) + f"""
    <section class="sec">
      <div class="wrap split-2" style="align-items:start">
        <div>
          <p class="eyebrow reveal">PROBLEM</p>
          <h2 class="h2 split">組織の乾燥は、<br />静かに進行する危機です。</h2>
          <p class="lead reveal" style="margin-top:24px">数字では見えにくい「社内の潤い」が、企業の持続可能性を左右します。</p>
        </div>
        <div class="card reveal">
          <p class="k">CHECK</p>
          <h3 class="h3">こんな状態が続いていませんか？</h3>
          <ul class="list-check" data-stagger style="margin-top:20px">
            <li>社員の表情が硬く、オフィスに活気がない</li>
            <li>部署間のコミュニケーションが形骸化している</li>
            <li>健康診断の数値は改善せず、休職者が増加傾向</li>
            <li>新しいアイデアや改善提案の声が上がらなくなった</li>
            <li>退職者の「職場の雰囲気」評価が年々低下</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="sec night" data-dark>
      <div class="wrap-narrow">
        <p class="eyebrow reveal">SOLUTION</p>
        <h2 class="h2 split">社内潤化プログラム</h2>
        <p class="lead reveal" style="margin-top:20px">組織に潤いを取り戻す、科学的アプローチ。私たちは「社内潤化」という新しいアプローチで、組織の活性化と社員の健康増進を実現します。</p>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap-narrow">
        <div class="sec-head">
          <p class="eyebrow reveal">5 CHANGES</p>
          <h2 class="h2 split">潤化がもたらす5つの変化</h2>
        </div>
        {acc}
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">FEATURES</p>
          <h2 class="h2 split">特徴</h2>
        </div>
        <div class="grid-3" data-stagger>
          {''.join(f'<div class="card tilt reveal" data-tilt="4">{icon(ic)}<h3 class="h3">{t}</h3><ul class="list-dot">{"".join(f"<li>{x}</li>" for x in li)}</ul></div>' for ic, t, li in feats)}
        </div>
        <a class="card reveal" href="{pre}contact/?kind=diag" style="display:block;margin-top:16px;background:var(--night);color:#fff;text-align:center">
          <p class="k" style="color:rgba(255,255,255,.6)">＼ 現在、特別キャンペーン実施中 ／</p>
          <p class="h2" style="margin:8px 0">今なら「社内潤化診断」を<span class="grad-text">無料</span>で実施</p>
          <p style="color:rgba(255,255,255,.7);margin:0">貴社の潤化スコアを見える化し、具体的な改善施策をご提案します</p>
          <span class="link-arrow" style="margin-top:16px">無料診断を申し込む <span class="circle">{arrow()}</span></span>
        </a>
      </div>
    </section>

    <section class="sec night" data-dark>
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">PROGRAM</p>
          <h2 class="h2 split">潤化 INNOVATION PROGRAM</h2>
          <p class="lead reveal">具体的な行動で実現する、組織の進化。</p>
        </div>
        <ol class="prog" data-stagger style="padding:0;margin:0">
          {''.join(f'<li class="reveal">{t}<small>{d}</small></li>' for t, d in progs)}
        </ol>
        <p class="note reveal" style="margin-top:20px;color:var(--on-night-2)">※詳細はお問い合わせください。</p>
        <p class="h1 reveal" style="margin-top:72px;line-height:1.35">今こそ、あなたの会社を<br />「働きたい」から<span class="grad-text">「輝きたい」</span>場所へ。</p>
      </div>
    </section>
{cta(pre)}"""
    page("raise-children", "組織コーチング", "「個性を力に。組織を輝きに。」社内潤化プログラムで、組織の活性化と社員の健康増進を実現します。社内潤化診断を無料で実施中。", body, scene=True)


# ======================================================================
# スペシャリスト
# ======================================================================
SPECIALISTS = {
    "tomohiro-abe": {
        "catch": "常識と過去にとらわれない<br />アイデンティティ（個性）を創り出す。",
        "eyebrow": "VISION",
        "title": "じぶん軸で創造するミライ",
        "img": "abe-2.webp",
        "photo2": "abe-portrait-wide.webp",
        "body": """<div class="letter">
          <p class="serif" style="font-size:1.3em">『人を紡ぎ、未来へ繋ぐ』</p>
          <p>私は確信しています。<br />ビジネスの真髄は、人と人との出会いが紡ぎ出す、かけがえのないストーリーにあると。</p>
          <p>一人ひとりが持つ個性。<br />それは、未来を切り拓く無限の可能性です。</p>
          <p>画一的な解決策ではなく、あなただけの選択肢を。<br />型にはまった成功ではなく、あなたらしい道のりを。</p>
          <p>私たちが提唱する「HAKI」は、そんな想いから生まれました。</p>
        </div>
        <div class="haki" data-stagger>
          <div class="reveal"><b><em>H</em>ope</b><span>希望 — 一人ひとりの可能性を信じきる</span></div>
          <div class="reveal"><b><em>A</em>ction</b><span>行動 — 独自の道を切り拓く</span></div>
          <div class="reveal"><b><em>K</em>nowledge</b><span>知識 — 新たな選択肢を創造する</span></div>
          <div class="reveal"><b><em>I</em>mpact</b><span>影響力 — かけがえのない価値を築く</span></div>
        </div>
        <div class="letter">
          <p class="serif" style="font-size:1.1em">未来への約束</p>
          <p>私たちは、答えを与えるのではなく、<br />共に考え、共に創り、共に歩む存在でありたい。</p>
          <p>皆さまが描く未来図は、十人十色。<br />その多様性こそが、イノベーションの源泉であり、<br />私たちの社会を豊かにする原動力だと信じています。</p>
          <p>「個性を活かし、選択肢を広げ、未来を紡ぐ」<br />これが私たちの変わらぬ誓いです。</p>
          <p>今この言葉に触れているあなたと、<br />新しい物語を紡ぎ出せることを、<br />心より楽しみにしています。</p>
          <p class="sign">株式会社 HAKI pro<br />代表取締役 CPO　安部 友裕</p>
        </div>""",
    },
    "shimosada-hirokazu": {
        "catch": "発見、企画、実行で<br />社会を切り拓く",
        "eyebrow": "work innovation",
        "title": "変化を素早く捉え、仮説を立て、実行に移す行動力を。",
        "img": "shimosada.webp",
        "photo2": None,
        "body": "<p>日々変わり続ける現代のビジネス環境では、変化を素早く捉え、仮説を立て、実行に移す行動力が求められます。</p><p>イベントの企画・実行を通じて社会の変化に触れることで、社内外の課題を発見する能力を身につけると共に、行動力を鍛えます。イベントに関わった従業員は、課題発見能力、コミュニケーションスキル、プロジェクトマネジメントスキルを効率よく伸ばすことができ、高いレベルのクリエイティビティを発揮できるようになります。</p><p>それが組織・個人の起爆剤となり、イノベーティブな組織文化の醸成に繋がります。</p>",
    },
}


def build_specialists():
    pre = "../"
    body = hero("SPECIALIST", "よりそう<br />スペシャリスト。", "数々の困難やプレッシャーと戦い続けてきたトップアスリートと同じ視点で、運動の重要性と健康な職場づくりを考えます。", "ring", crumbs=crumbs(pre, ("スペシャリスト", None))) + f"""
    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">MEMBER</p>
          <h2 class="h2 split">参画スペシャリスト</h2>
        </div>
        {member_cards(pre)}
      </div>
    </section>
{cta(pre)}"""
    page("specialist", "スペシャリスト", "HAKI proに参画するスペシャリスト。代表 安部友裕、クリエイティブディレクター 下定弘和。", body, scene=True)

    pre = "../../"
    for slug, name, role, copy, img in MEMBERS:
        d = SPECIALISTS[slug]
        photo2 = f'<div class="photo reveal-img" style="margin-top:40px"><img src="{pre}assets/img/{d["photo2"]}" alt="{name}" loading="lazy" /></div>' if d["photo2"] else ""
        body = f"""    <section class="hero hero-sub" data-dark>
      <img src="{pre}assets/img/{d['img']}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;opacity:.55" />
      <div class="wrap hero-inner">
        <nav class="crumbs reveal" aria-label="現在地">{crumbs(pre, ("スペシャリスト", pre + "specialist/"), (name, None))}</nav>
        <p class="eyebrow reveal">{role}</p>
        <h1 class="hero-title split">{name}</h1>
        <p class="hero-lead serif reveal" style="--i:3;font-size:clamp(18px,2.4vw,26px);color:#fff">{d['catch']}</p>
      </div>
    </section>
    <section class="sec">
      <div class="wrap-narrow">
        <p class="eyebrow reveal">{d['eyebrow']}</p>
        <h2 class="h2 split">{d['title']}</h2>
        <div class="reveal" style="margin-top:32px">{d['body']}</div>
        {photo2}
      </div>
    </section>
    <section class="sec bg-2">
      <div class="wrap">
        <div class="sec-head"><p class="eyebrow reveal">OTHER MEMBERS</p><h2 class="h2 split">ほかのスペシャリスト</h2></div>
        {member_cards(pre, skip=slug)}
      </div>
    </section>
{cta(pre)}"""
        page(f"specialist/{slug}", f"{name}（{role.split('（')[0]}）", f"{name}｜{role}。{copy}", body)


# ======================================================================
# お問い合わせ・お知らせ
# ======================================================================
def build_contact():
    pre = "../"
    kinds = ["講演会", "イベント（出演・企画・運営）", "健康経営サポート", "組織コーチング", "SNSマーケティング・AIコンサル", "社内潤化無料診断", "野球スクール", "その他"]
    body = hero("CONTACT", "HAKI proに<br />相談してみる。", "下のフォームに必要事項をご記入のうえ、送信してください。追って担当者よりお返事いたします。", "ring", crumbs=crumbs(pre, ("お問い合わせ", None))) + f"""
    <section class="sec">
      <div class="wrap-narrow">
        <a class="card reveal" href="{SCHOOL_FORM}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;background:var(--night);color:#fff">
          <span><span class="k" style="color:rgba(255,255,255,.6)">BASEBALL SCHOOL</span><span style="display:block;font-weight:700;font-size:17px;margin-top:6px">野球スクール PUMPS へのお問い合わせ</span><span style="display:block;font-size:13px;color:rgba(255,255,255,.7);margin-top:4px">スクール専用のお問い合わせフォームが開きます</span></span>
          <span class="link-arrow"><span class="circle">{arrow(True)}</span></span>
        </a>
        <form class="form card reveal" data-mailto="{MAIL}" data-school-form="{SCHOOL_FORM}" novalidate>
          <div class="field"><label for="f-name">お名前 <span class="req">必須</span></label><input id="f-name" name="name" autocomplete="name" required /><span class="err">お名前を入れてください</span></div>
          <div class="field"><label for="f-org">企業名・屋号</label><input id="f-org" name="org" autocomplete="organization" /></div>
          <div class="field"><label for="f-mail">メールアドレス <span class="req">必須</span></label><input id="f-mail" name="email" type="email" autocomplete="email" inputmode="email" required /><span class="err">メールアドレスを正しく入れてください</span></div>
          <div class="field"><label for="f-tel">電話番号 <span class="req">必須</span></label><input id="f-tel" name="tel" type="tel" autocomplete="tel" inputmode="tel" required /><span class="err">電話番号を入れてください</span></div>
          <div class="field"><label for="f-kind">お問い合わせの種類 <span class="req">必須</span></label><select id="f-kind" name="kind" required><option value="">選択してください</option>{''.join(f'<option>{k}</option>' for k in kinds)}</select><span class="err">種類を選んでください</span></div>
          <p class="note school-note" hidden style="margin:-8px 0 0;padding:14px 16px;border-radius:14px;background:var(--bg-2);color:var(--ink)">野球スクールのお問い合わせは、スクール専用のフォームで受け付けています。<a href="{SCHOOL_FORM}" target="_blank" rel="noopener" style="text-decoration:underline;font-weight:700">お問い合わせフォームを開く ↗</a></p>
          <div class="field"><label for="f-body">ご用件 <span class="req">必須</span></label><textarea id="f-body" name="body" required></textarea><span class="err">ご用件を入れてください</span></div>
          <p class="note">「送信する」を押すと、入力した内容が入ったメールが開きます。そのまま送信してください。<br />※商品やサービスの一方的な営業メールは、一切お断りいたします。</p>
          <button class="btn" type="submit" style="justify-self:start">送信する <span class="arr">{arrow()}</span></button>
          <p class="note form-done" hidden>メールが開かない場合は、<a href="mailto:{MAIL}" style="text-decoration:underline">{MAIL}</a> へ直接お送りください。</p>
        </form>
        <p class="note reveal" style="margin-top:24px;text-align:center">メールで直接：<a href="mailto:{MAIL}" style="text-decoration:underline">{MAIL}</a></p>
      </div>
    </section>
    <script>
      (function () {{
        var k = new URLSearchParams(location.search).get("kind");
        var sel = document.getElementById("f-kind");
        if (k === "diag") sel.value = "社内潤化無料診断";
        if (k === "school") sel.value = "野球スクール";
        if (k === "talk") sel.value = "講演会";
        var note = document.querySelector(".school-note");
        var sync = function () {{ note.hidden = sel.value !== "野球スクール"; }};
        sel.addEventListener("change", sync);
        sync();
      }})();
    </script>"""
    page("contact", "お問い合わせ", "講演会・イベント・健康経営サポート・組織コーチング・社内潤化無料診断などのご相談は、こちらからお気軽にどうぞ。", body, scene=True)


def build_news():
    pre = "../"
    body = f"""    <section class="hero hero-sub" data-dark style="min-height:52svh">
      <div class="wrap hero-inner">
        <nav class="crumbs reveal" aria-label="現在地">{crumbs(pre, ("お知らせ", None))}</nav>
        <p class="eyebrow reveal">INFORMATION</p>
        <h1 class="hero-title split">お知らせ</h1>
      </div>
    </section>
    <section class="sec">
      <div class="wrap">
        <div class="news reveal">
          <a href="hp-open/"><time datetime="2023-11-01" class="num">2023.11.01</time><span class="cat">新着情報</span><span class="t">ホームページを公開しました</span><span class="link-arrow"><span class="circle">{arrow()}</span></span></a>
        </div>
      </div>
    </section>"""
    page("news", "お知らせ", "株式会社HAKI proからのお知らせ。", body)
    pre = "../../"
    body = f"""    <section class="hero hero-sub" data-dark style="min-height:52svh">
      <div class="wrap hero-inner">
        <nav class="crumbs reveal" aria-label="現在地">{crumbs(pre, ("お知らせ", pre + "news/"), ("ホームページを公開しました", None))}</nav>
        <p class="eyebrow reveal"><time datetime="2023-11-01">2023.11.01</time>　新着情報</p>
        <h1 class="h1 split" style="color:#fff">ホームページを公開しました</h1>
      </div>
    </section>
    <section class="sec">
      <div class="wrap-narrow reveal">
        <p>いつもお世話になっております。</p>
        <p>企業の健康支援、組織コーチングをはじめ、日本中の皆さまの個性を活かす取り組みを行ってまいります。今後とも当社をよろしくお願いします。</p>
        <p class="sign">株式会社HAKI pro<br />代表取締役 CPO　安部友裕</p>
        <a class="link-arrow" href="../">お知らせ一覧へ <span class="circle">{arrow()}</span></a>
      </div>
    </section>"""
    page("news/hp-open", "ホームページを公開しました", "株式会社HAKI proのホームページを公開しました。", body)


def build_404():
    """旧サイトのアドレス（日本語のスペシャリスト名など）を新しいページへ送る。"""
    (ROOT / "404.html").write_text(
        """<!doctype html>
<html lang="ja"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ページが見つかりません｜株式会社HAKI pro</title>
<script>
  (function () {
    var p = decodeURIComponent(location.pathname);
    var map = [
      [/%e8%88%a9|funaki-itsuka|kazuyuki-ito/i, "/specialist/", true],
      [/下定/, "/specialist/shimosada-hirokazu/"],
      [/^\\/news\\//, "/news/"],
      [/^\\/(feed|category|author|wp-)/, "/"]
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(map[i][2] ? location.pathname : p)) { location.replace(map[i][1]); return; }
  })();
</script>
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#070a14;color:#f4f5fa;font-family:"Noto Sans JP",system-ui,sans-serif;text-align:center;padding:24px}a{color:#fff;display:inline-block;margin-top:24px;padding:14px 26px;border-radius:999px;box-shadow:inset 0 0 0 1px #fff;text-decoration:none}</style>
</head><body><div><p style="font-size:48px;font-weight:800;margin:0;letter-spacing:-.04em">404</p><p>お探しのページは見つかりませんでした。</p><a href="/">トップページへ</a></div></body></html>
""",
        encoding="utf-8",
    )


if __name__ == "__main__":
    build_home()
    build_company()
    build_project()
    build_health()
    build_coaching()
    build_specialists()
    build_contact()
    build_news()
    build_404()
    print("built")
