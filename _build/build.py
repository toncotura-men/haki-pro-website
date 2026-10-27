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
    "ball-old.webp": "50% 50%",
    "ball-new.webp": "52% 48%",
    "ball-donation.webp": "50% 50%",
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
    ("ball-recycle", "硬式球再生", "RECYCLE"),
    ("specialist", "スペシャリスト", "MEMBER"),
]

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
    full_title = f"{title}｜株式会社HAKI pro" if slug else "株式会社HAKI pro｜人を紡ぎ、未来へ繋ぐ"
    scene = scene or "data-scene=" in body
    importmap = (
        f'<script type="importmap">{{"imports":{{"three":"{pre or "./"}assets/vendor/three.module.min.js"}}}}</script>\n'
        f'  <script type="module" src="{pre}assets/js/scene.js?v=11"></script>'
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
  <link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Shippori+Mincho+B1:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="{pre}assets/css/site.css?v=17" />
  {importmap}
  <script src="{pre}assets/js/site.js?v=6" defer></script>
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
        <a href="{SCHOOL}">PUMPS ホームページ</a>
        <a href="{HEROS}">HERO's CUP ホームページ</a>
        <a class="nav-cta" href="{pre}contact/">お問い合わせ</a>
      </nav>
      <button class="menu-btn" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="drawer"><span></span><span></span></button>
    </div>
    <div class="progress" aria-hidden="true"></div>
  </header>
  <div class="drawer" id="drawer" aria-hidden="true">
    <a href="{pre or './'}">トップ<small>HOME</small></a>
    {drawer}
    <a href="{SCHOOL}">PUMPS ホームページ<small>SCHOOL</small></a>
    <a href="{HEROS}">HERO's CUP ホームページ<small>TOURNAMENT</small></a>
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
          <a href="{SCHOOL}">PUMPS ホームページ</a>
          <a href="{HEROS}">HERO's CUP ホームページ</a>
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
        {f'<p class="hero-lead reveal" style="--i:3">{lead}</p>' if lead else ""}
        {extra}
      </div>
    </section>"""


def donation(pre, bg=" bg-2"):
    """企業ロゴ入りボールを学校へ寄贈する取り組み（健康経営・硬式球再生の2ページに出す）。"""
    return f"""    <section class="sec{bg}" id="donation">
      <div class="wrap split-2">
        <figure class="talk-photo wide reveal"><div class="ph"><img src="{pre}assets/img/ball-donation.webp" alt="企業ロゴ入りのサッカーボールと感謝状を持って並ぶ4人" loading="lazy" width="1600" height="1200" /></div><figcaption>企業さまのロゴ入りサッカーボールを廿日市市内の全小中学校へ寄贈し、市から感謝状が贈られました（2025年12月）</figcaption></figure>
        <div>
          <p class="eyebrow reveal">DONATION</p>
          <h2 class="h2 split">御社のロゴ入りボールを、地域の学校へ。</h2>
          <p class="reveal" style="margin-top:24px">硬式球の再生事業とあわせて、バスケットボール・サッカーボール・バレーボールなどに企業さまのロゴを入れ、地域の学校へ寄贈する取り組みも行っています。</p>
          <p class="reveal">寄贈したボールは、休み時間にも体育の授業にも使われます。子どもたちは毎日そのボールを手に取り、ロゴを見て「この会社がくれたボール」と覚えていきます。</p>
          <p class="reveal">社員の健康を大切にする会社が、地域の子どもが体を動かす場も支える。健康経営の取り組みと一緒に、社内にも地域にも伝わる活動です。</p>
          <div class="reveal" style="margin-top:28px"><a class="link-arrow" href="{pre}contact/?kind=donation">ボールの寄贈を相談する <span class="circle">{arrow()}</span></a></div>
        </div>
      </div>
    </section>
"""


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
        <p class="lead reveal" style="margin:20px auto 0">トップアスリートと一緒に、健全な未来へ。<br />講演・イベント・健康経営・硬式球の再生、まずはお気軽にご相談ください。</p>
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
            "企業の健康経営と、硬式球の再生",
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
    body = f"""    <section class="hero hero-cine" data-dark data-stage-host data-cine>
      <div class="cine-pin">
        <canvas class="stage" data-scene="cosmos" aria-hidden="true"></canvas>
        <div class="cine-shade" data-show="-1 0.12" aria-hidden="true"></div>
        <div class="wrap hero-inner" data-show="-1 0.1">
          <p class="eyebrow reveal">Life innovation</p>
          <h1 class="hero-title split">人を紡ぎ、<br />未来へ繋ぐ。</h1>
          <div class="ticker reveal" style="--i:4" aria-live="off">{ticker}</div>
          <div class="btn-row reveal" style="--i:6">
            <a class="btn btn-light magnetic" href="#business">事業を見る <span class="arr">{arrow()}</span></a>
            <a class="btn btn-ghost magnetic" href="contact/">お問い合わせ</a>
          </div>
        </div>
        <p class="cine-cap" data-show="0.17 0.34">人が、集まる。</p>
        <p class="cine-cap" data-show="0.4 0.55">力が、重なる。</p>
        <p class="cine-cap" data-show="0.6 0.72">未来へ、広がる。</p>
        <div class="scroll-cue" data-show="-1 0.9" aria-hidden="true">SCROLL</div>
      </div>
    </section>

    <div class="marquee" aria-hidden="true"><div class="marquee-track">
      <span>no HAKI no LIFE <i></i> <em class="stroke">Life innovation</em> <i></i></span>
      <span>no HAKI no LIFE <i></i> <em class="stroke">Life innovation</em> <i></i></span>
    </div></div>

    <section class="sec">
      <div class="wrap-narrow">
        <p class="eyebrow reveal">MIRAI WO TSUNAGU</p>
        <h2 class="h2 split">ミライをつなぐ</h2>
        <p class="lead reveal" style="margin-top:16px">企業の健康経営と、硬式球の再生でつなぐプロジェクト</p>
        <p class="scrub" style="margin-top:48px">HAKI proは、健康経営事業を通じて、企業の従業員さまの「からだ」と「こころ」の健康を支えています。また、練習で使い古した硬式球を集めて直し、地域の子どもたちの練習に戻す取り組みも始めました。人の健康も、ものも、大事にしながら長く続けていく。それが私たちの考える循環です。</p>
        <a class="link-arrow reveal" href="project/" style="margin-top:32px">HAKI proのコンセプト <span class="circle">{arrow()}</span></a>
      </div>
    </section>

    <section class="sec bg-2" id="business" style="padding-top:clamp(64px,8vw,120px)">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">BUSINESS</p>
          <h2 class="h2 split">3つの事業で、人と地域を元気に</h2>
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
          <a class="stack-card" href="ball-recycle/">
            <div class="stack-body">
              <div>
                <p class="stack-num"><b>02</b> / 03</p>
                <p class="stack-en" style="margin-top:28px">RECYCLE</p>
                <h3 class="stack-title">硬式球の再生</h3>
                <p class="muted" style="margin-top:16px">使い古した硬式球を集めて、就労継続支援B型の皆さんが革を張り替え、縫い直します。捨てずに直して、また練習で使ってもらう取り組みです。</p>
              </div>
              <span class="link-arrow">古いボールを、もう一度 <span class="circle">{arrow()}</span></span>
            </div>
            <div class="stack-visual xf"><img src="assets/img/ball-old.webp" alt="使い古した硬式球" loading="lazy" width="1940" height="732" /><img class="xf-new" src="assets/img/ball-new.webp" alt="" loading="lazy" width="1027" height="801" /><span class="xf-tag xf-old">BEFORE</span><span class="xf-tag xf-new">AFTER</span></div>
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
            <h3 class="school-title">才能を、<br /><span class="accent">科学する。</span></h3>
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
            <h3 class="heros-title">次は、<br /><span>きみだ！</span></h3>
            <p class="heros-lead">すべての子どもに、ヒーローになる瞬間を。</p>
            <p class="heros-next">第1回大会　2026年11月28日・29日　広島県三原市</p>
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
            <p class="lead reveal">私たちは単なるサービス提供者ではなく、皆さまと社会の真のパートナーとなることを目指します。トップアスリート経験豊富なメンバーだからこそ、見えない部分に着目し、誰にも真似できない健康経営を創出していきます。</p>
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
    page("", "", "株式会社HAKI proは、元プロアスリートが企業の健康経営を支え、使い古した硬式球の再生にも取り組む広島の会社です。", body, scene=True)


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
    body = hero("COMPANY", "人を紡ぎ、<br />未来へ繋ぐ。", "", "ring", crumbs=crumbs(pre, ("会社概要", None))) + f"""
    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="kicker reveal"><span class="kicker-en">VISION</span></p>
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
          <p class="kicker reveal"><span class="kicker-en">MISSION</span></p>
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
          <h2 class="kicker reveal"><span class="kicker-en">行動指針</span></h2>
        </div>
        <ol class="vals">
          {''.join(f'<li class="val reveal" style="--i:{i};--c:{c};--t:{"#c99a00" if c.lower() == "#fee003" else c}"><span class="val-ja">{ja}</span><span class="val-en">{en}</span><span class="val-d">{d}</span></li>' for i, (L, en, ja, d, c) in enumerate(values))}
        </ol>
        <div class="promise reveal" data-dark>
          <p class="kicker sm reveal"><span class="kicker-en">OUR PROMISE</span></p>
          <ol class="promises" data-stagger>
            <li class="reveal"><span class="pr-n">01</span>一人ひとりの声に、<br />真摯に耳を傾けます</li>
            <li class="reveal" style="--i:1"><span class="pr-n">02</span>常に新しい可能性を、<br />追求し続けます</li>
            <li class="reveal" style="--i:2"><span class="pr-n">03</span>結果にこだわり、<br />確実な成果を届けます</li>
            <li class="reveal" style="--i:3"><span class="pr-n">04</span>社会との調和の中で、<br />持続的な成長を実現します</li>
          </ol>
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
          <div><dt>事業内容</dt><dd>健康経営サポート事業<br />硬式球再生事業<br />SNSマーケティング＆AIコンサル事業<br />イベント企画運営<br />野球スクール（<a href="{SCHOOL}" style="text-decoration:underline">PUMPS</a>）</dd></div>
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
        ("recycle", "硬式球再生事業", "練習で傷んだ硬式球を集め、就労継続支援B型の皆さんが革を張り替えて縫い直します。直したボールは練習球として、地域のチームや野球教室で使ってもらいます。", []),
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
          <h2 class="h2 split">従業員さまに<br />「とびっきり」の原動力を</h2>
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
        {rows([(t, d) for ic, t, d, ch in biz])}
      </div>
    </section>
{cta(pre)}"""
    page("project", "プロジェクト", "企業の健康経営と、こどもの健全なミライをつなぐ循環型プロジェクト。健康経営サポート・イベント企画運営・硬式球再生・アカデミー事業。", body, scene=True)


# ======================================================================
# 健康経営
# ======================================================================
def build_health():
    pre = "../"
    MARK = f'<img class="row-mark" src="{pre}assets/img/kenko-mark-2024.webp" alt="健康経営優良法人2024の認定マーク" loading="lazy" width="730" height="587" />'
    merits = [
        ("01", "生産性向上", "従業員が十分なパフォーマンスを発揮するには、心身ともに健康であることが何より重要です。心身が健康なら、欠勤などの勤怠不良が少なくなるのはもちろん、社内の雰囲気が良くなり、モチベーション向上につながります。", ""),
        ("02", "人材の定着・確保・採用コスト低減", "健康経営は、退職者の低減につながります。また、健康経営の取り組みを社会へアピールすることで優秀な人材を採用しやすくなるほか、採用コストの低減にもつながります。", ""),
        ("03", "企業イメージの向上", "健康経営に取り組み、審査に通ればホームページや名刺に認定マークを付けることができます。こうした対外的な好印象は信用力そのもので、ブランド力強化に直結します。" + MARK, ""),
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
        ("badge", "健康経営優良法人を目指す企業さまへ", "経済産業省の健康経営優良法人。申請の前提となる協会けんぽ「ひろしま企業健康宣言」のお申し込みをご案内し、認定の評価項目のうち「運動機会の増進」の取り組みと記録をお引き受けします。認定の申請は企業さまご自身で行っていただきます。"),
    ]
    includes = [
        ("月1回・60分の運動指導", "肩こり・腰痛・姿勢・柔軟・筋力・睡眠など、毎月テーマを変えて行います。社員さまの体にさわる施術は行いません。"),
        ("年2回の体力測定", "握力・立ち上がり・片足立ちなどを専門の測定スタッフが測ります。結果は本人に、会社さまには名前を伏せた集計でお返しします。"),
        ("毎月の報告書", "参加人数・続けた人の割合・社員さまの声を1枚にまとめます。"),
    ]
    plans = [("〜20名", "50,000"), ("〜50名", "70,000"), ("〜100名", "100,000")]
    year = [
        ("1か月目 測定", "最初の体力測定"),
        ("2〜11か月目 指導", "毎月テーマを変えて専門家が交代で"),
        ("毎月 報告", "参加と継続を1枚に"),
        ("12か月目 測定", "もう一度測って最初と比べる"),
        ("年間報告", "1年の変化をまとめてお渡し"),
    ]
    cert = [
        ("健康宣言に申し込む", "協会けんぽ広島支部の「ひろしま企業健康宣言」へのエントリー（無料）。<br />申請の前提となる条件です。"),
        ("必須の項目を整える", "健康宣言を社内外に知らせる、経営者が健康診断を受ける、健康づくりの担当者を置く、など。"),
        ("選んで取り組む項目を進める", "このうち「運動機会の増進」を、月1回の運動指導と体力測定でお引き受けします。"),
        ("申請する", "経済産業省の「ACTION！健康経営」から、毎年8月〜10月中旬に申請します。"),
        ("認定の発表", "翌年3月。<br />認定されるとホームページや名刺に認定マークを使えます。" + MARK),
    ]
    body = hero("WELLNESS", "企業の健康は、<br />従業員の健康で<br />支えられている。", "「組織のパーソナルトレーナー」として、従業員の健康から会社の生産性を高めます。", "pulse", crumbs=crumbs(pre, ("健康経営サポート事業", None))) + f"""
    <section class="sec">
      <div class="wrap split-2" style="align-items:start">
        <div>
          <p class="eyebrow reveal">ABOUT</p>
          <h2 class="h2 split">「今を大切に、明日を最高に」</h2>
          <p class="reveal" style="margin-top:24px">「組織のパーソナルトレーナー」として、企業さまにとって一番の財産である従業員に対し、健康プログラムを作成し、ストレス管理や栄養指導等を提供します。<br />従業員の健康促進をサポートすることにより、企業さまの生産性を向上させます。</p>
          <p class="reveal">日々の生活の中に「健康」という概念を浸透させることで、間違った食習慣の改善や運動不足の解消につなげ、健康生活のための新たな行動変容に繋げます。<br />企業として取り組むので、1人ではなく実行する仲間がいることで頑張れて、「意識」が変わります。</p>
          <p class="reveal">企業単位、家族単位に専門家が直接携わることで、健康に関するコミュニケーションが生まれ、いつでも相談しあえる関係が自然とできあがります。</p>
        </div>
        <div>
          <p class="k en reveal" style="font-size:13px;letter-spacing:.14em;color:var(--ink-3);font-weight:700">VOICES</p>
          <div class="voices" data-stagger style="margin-top:20px">
            <figure class="voice reveal"><p class="voice-b">「健康診断で指導が入ったのですが、<br />どうしたらいいですか？」</p><figcaption class="voice-who">50代・男性　管理職</figcaption></figure>
            <figure class="voice f reveal"><p class="voice-b">「日々の業務で首肩が辛かったり、<br />慢性的な腰痛をなんとかしたい」</p><figcaption class="voice-who">30代・女性　事務職</figcaption></figure>
            <figure class="voice reveal"><p class="voice-b">「最近なんだか<br />ストレスが溜まって……」</p><figcaption class="voice-who">20代・男性　営業職</figcaption></figure>
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
        <div class="split-2 merit-wrap">
          <div class="stat compare reveal" role="img" aria-label="1年間で会社を辞めた人の割合（離職率）：日本全体の平均11.4%、健康経営優良法人に認定された会社5.4%">
            <p class="stat-k">1年間で会社を辞めた人の割合（離職率）</p>
            <div class="cmp-row" style="--c:var(--h-red)"><span class="cmp-l">日本全体の平均</span><b class="cmp-v num"><span data-count="11.4">11.4</span><small>%</small></b><span class="cmp-bar"><span class="cmp-fill" style="--v:.114"></span></span></div>
            <div class="cmp-row" style="--c:var(--h-green)"><span class="cmp-l">健康経営優良法人に<br />認定された会社</span><b class="cmp-v num"><span data-count="5.4">5.4</span><small>%</small></b><span class="cmp-bar"><span class="cmp-fill" style="--v:.054"></span></span></div>
            <p class="stat-note">健康経営に取り組む会社は、辞める人が日本全体の半分以下です。</p>
            <p class="stat-src">出典：経済産業省「健康経営の推進について」（2021年10月）</p>
          </div>
          {rows([(t, d) for n, t, d, x in merits])}
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">MONTHLY PLAN</p>
          <h2 class="h2 split">月1回、専門家が会社に来る。</h2>
          <p class="lead reveal">元プロ野球球団のトレーナー、ヨガ講師、鍼灸師、セラピストなど、分野のちがう専門家が毎月交代で60分の運動指導を行います。年2回の体力測定で、社員の体の変化を数字でお返しします。</p>
        </div>
        {rows([(t, d) for t, d in includes])}
        <div class="plans" data-stagger>
          {''.join(f'<div class="plan reveal"><p class="plan-k">{k}</p><p class="plan-p"><span class="num">{p}</span><span class="yen">円〜</span><small>/ 月</small></p></div>' for k, p in plans)}
        </div>
        <p class="note reveal">税別・交通費別。最低契約期間12か月。お試し1回 33,000円（30名まで）は、ご契約いただくと初月の料金から差し引きます。</p>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">ONE YEAR</p>
          <h2 class="h2 split">測って、続けて、もう一度測る。</h2>
          <p class="lead reveal">ご契約の月から数えて、最初と12か月目の測定を比べ、1年間の取り組みの成果を報告書にまとめます。</p>
        </div>
        {track(year, light=True)}
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">CERTIFICATION</p>
          <h2 class="h2 split">健康経営優良法人の取り方</h2>
          <p class="lead reveal">認定の評価項目のうち「運動機会の増進」の部分を、HAKI proがお引き受けします。<br />健康宣言がまだの企業さまには、お申し込みの方法からご案内します。</p>
        </div>
        {rows([(t, d) for t, d in cert])}
        <p class="note reveal">中小規模法人部門の場合。<br />申請は毎年8月〜10月中旬、認定の発表は翌年3月です。<br />来年秋の申請に向けて、1年分の取り組みの記録を残せます。<br />認定の可否は審査によって決まります。</p>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">PROGRAM</p>
          <h2 class="h2 split">健康経営 各種プログラム</h2>
        </div>
        {rows([(t, d) for ic, t, d in progs])}
      </div>
    </section>

    <section class="sec night dl" id="download" data-dark>
      <div class="wrap split-2">
        <div class="dl-pages" aria-hidden="true">
          <img src="{pre}assets/img/shiryo-p7.webp" alt="" loading="lazy" width="960" height="540" />
          <img src="{pre}assets/img/shiryo-p5.webp" alt="" loading="lazy" width="960" height="540" />
          <img src="{pre}assets/img/shiryo-p1.webp" alt="" loading="lazy" width="960" height="540" />
        </div>
        <div>
          <p class="kicker reveal"><span class="kicker-en">DOWNLOAD</span></p>
          <h2 class="h2 split">ご案内資料を、<br />無料でダウンロード。</h2>
          <p class="lead reveal" style="margin-top:20px">社内での検討や、ご担当者さまへの共有にお使いください。</p>
          <ul class="dl-list reveal">
            <li>健康経営のメリットと離職率のデータ</li>
            <li>月額プランの中身と料金</li>
            <li>1年の流れ</li>
            <li>健康経営優良法人の取り方</li>
          </ul>
          <div class="btn-row reveal" style="margin-top:32px">
            <a class="btn btn-light magnetic" href="{pre}assets/doc/haki-pro-kenko-keiei.pdf" download="HAKIpro_kenko-keiei_guide.pdf">無料でダウンロード <span class="arr">{arrow()}</span></a>
          </div>
          <p class="dl-note reveal">PDF・10ページ・約730KB　お名前などの入力は不要です。</p>
        </div>
      </div>
    </section>
{donation(pre)}{cta(pre)}"""
    page("health-management", "健康経営サポート事業", "元プロアスリートと専門家が「組織のパーソナルトレーナー」として、月1回の運動指導の月額プラン（月50,000円から）・体力測定・栄養調査・ストレスチェックなどで、企業の健康経営を支えます。", body, scene=True)


# ======================================================================
# 番号つきの横長リスト（アイコンのカードの代わり）・ボールが転がる流れ
# ======================================================================
ROW_COLORS = ["#e60312", "#b30281", "#1d2286", "#0881cb", "#42af38"]
NIGHT_COLORS = ["#e60312", "#b30281", "#0881cb", "#42af38", "#fee003"]  # 暗い背景では紺が見えにくいので外す


def rows(items, href=None, start=1, colors=ROW_COLORS):
    """大きな番号＋見出し＋説明の行。マウスを乗せると色の帯が走り、光がカーソルについてくる。"""
    out = []
    for i, it in enumerate(items):
        title, desc = it[0], it[1]
        tag, attrs = ("a", f' href="{href}"') if href else ("div", "")
        go = f'<span class="row-go" aria-hidden="true">{arrow()}</span>' if href else ""
        out.append(
            f'<li class="reveal" style="--c:{colors[i % len(colors)]}" data-row="{i}"><{tag} class="row" data-spot{attrs}>'
            f'<span class="row-n" aria-hidden="true">{i + start:02d}</span>'
            f'<span class="row-b"><span class="row-t">{title}</span><span class="row-d">{desc}</span></span>{go}</{tag}></li>'
        )
    return '<ol class="rows" data-stagger>' + "".join(out) + "</ol>"


BALL_MINI = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="#f6f2ea"/><path d="M10 7c7 8 7 22 0 30M34 7c-7 8-7 22 0 30" fill="none" stroke="#d2232a" stroke-width="2.2" stroke-dasharray="2.2 2.4"/></svg>'


def track(steps, light=False):
    """工程の線の上をボールが転がる。画面に入ると01から順に進み、工程にマウスを乗せるとそこへ転がる。
    light=True は明るい背景用（白い札・濃い文字。黄色と白は読めないので外す）。"""
    cols = ROW_COLORS if light else ["#e60312", "#b30281", "#0881cb", "#42af38", "#fee003", "#ffffff"]
    li = "".join(
        f'<li class="tk-step" style="--c:{cols[i % len(cols)]}"><span class="tk-dot" aria-hidden="true"></span>'
        f'<span class="tk-n">{i + 1:02d}</span><span class="tk-t">{t}</span><span class="tk-d">{d}</span></li>'
        for i, (t, d) in enumerate(steps)
    )
    return f'<div class="track{" light" if light else ""}" style="--n:{len(steps)}" data-track><span class="tk-line" aria-hidden="true"><i></i></span><span class="tk-ball" aria-hidden="true">{BALL_MINI}</span><ol class="tk-steps">{li}</ol></div>'


# ======================================================================
# 硬式球再生
# ======================================================================
def cycle_svg(pre):
    """使う → 集める → 直す → また使う の輪。輪はロゴの6色を細く、真ん中には回る硬式球（scene.js の ball）を重ねる。"""
    import math
    c, r = 200, 150
    full = 2 * math.pi * r
    arc = full / 6
    rings = "".join(
        f'<circle cx="{c}" cy="{c}" r="{r}" stroke="{col}" stroke-dasharray="{arc:.1f} {full - arc:.1f}" stroke-dashoffset="{-i * arc:.1f}"/>'
        for i, col in enumerate(["#e60312", "#b30281", "#1d2286", "#0881cb", "#42af38", "#fee003"])
    )
    # 進む向き（時計回り）を示す小さな矢印。各言葉の間に1つずつ
    chev = ""
    for deg in (45, 135, 225, 315):
        a_ = math.radians(deg - 90)
        x, y = c + r * math.cos(a_), c + r * math.sin(a_)
        chev += f'<path class="cyc-chev" d="M-4 -6 L4 0 L-4 6" transform="translate({x:.1f} {y:.1f}) rotate({deg})"/>'
    nodes = [
        ("使う", "練習で", c, c - r, "middle", 0, -44),
        ("集める", "古い球を", c + r, c, "start", 22, -6),
        ("直す", "張り替え・縫い直し", c, c + r, "middle", 0, 40),
        ("また使う", "地域のチームへ", c - r, c, "end", -22, -6),
    ]
    node = "".join(
        f'<g class="cyc-node" data-node="{i}" style="--c:{NIGHT_COLORS[i]}"><circle class="cyc-dot" cx="{x}" cy="{y}" r="7"/>'
        f'<text x="{x + dx}" y="{y + dy}" text-anchor="{anc}" class="t">{t}</text><text x="{x + dx}" y="{y + dy + 22}" text-anchor="{anc}" class="s">{sub}</text></g>'
        for i, (t, sub, x, y, anc, dx, dy) in enumerate(nodes)
    )
    return f"""<svg class="cycle" viewBox="-70 -50 540 500" role="img" aria-label="使う、集める、直す、また使う、をくり返す輪">
          <g class="cyc-ring" transform="rotate(-90 {c} {c})">{rings}</g>
          {chev}
          <g class="cyc-run"><circle cx="{c}" cy="{c - r}" r="4"/></g>
          {node}
        </svg>"""


def build_ball():
    pre = "../"
    steps = [
        ("集める", "使わなくなった硬式球を、チームや学校から引き取ります。"),
        ("仕分ける", "芯の状態を一球ずつ見て、直せるものを選びます。"),
        ("革を張り替える", "古い革と糸をはずし、新しい革をかぶせます。"),
        ("縫う", "赤い糸で、108の縫い目を一針ずつ縫います。"),
        ("確かめる", "形と縫い目を見て、問題のないものだけを出します。"),
        ("届ける", "練習球として、地域のチームや野球教室へ届けます。"),
    ]
    cycle = [
        ("使う", "チームや学校の練習で、ボールは毎日使われます。"),
        ("集める", "汚れたり糸が切れたりしたボールを引き取ります。"),
        ("直す", "就労継続支援B型の皆さんが、革を張り替えて縫い直します。"),
        ("また使う", "地域の少年野球チームや野球教室で使ってもらいます。古くなったら、また01へ。"),
    ]
    asks = [
        ("硬式球の回収", "チーム・学校・スクールで使わなくなった硬式球を回収します。回収の方法は、数量と場所に合わせてご提案します。"),
        ("再生球の販売", "張り替え・縫い直しを済ませた硬式球を、練習球として販売しています。数量に応じてお見積りします。"),
        ("回収拠点パートナー", "店舗や企業さまに、ボールの回収拠点としてご参加いただけます。環境や地域への取り組みとして発信いただけます。"),
    ]
    body = hero("BALL RECYCLE", "古いボールを、<br />もう一度グラウンドへ。", "練習で使い古した硬式球を集めて直し、また使えるボールにしています。", "loop", crumbs=crumbs(pre, ("硬式球再生", None))) + f"""
    <section class="sec">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">BEFORE / AFTER</p>
          <h2 class="h2 split">使い古したボールも、<br />直せばまた使えます。</h2>
        </div>
        <div class="before-after">
          <figure class="reveal"><div class="photo reveal-img"><img src="{pre}assets/img/ball-old.webp" alt="使い古して汚れた硬式球" loading="lazy" width="1940" height="732" /></div><figcaption><b>BEFORE</b>集まったボール</figcaption></figure>
          <span class="ba-arrow reveal" aria-hidden="true">{arrow()}</span>
          <figure class="reveal" style="--i:1"><div class="photo reveal-img"><img src="{pre}assets/img/ball-new.webp" alt="革を張り替えて縫い直した硬式球" loading="lazy" width="1027" height="801" /></div><figcaption><b>AFTER</b>直したボール</figcaption></figure>
        </div>
        <div class="wrap-narrow" style="margin:48px 0 0;padding:0">
          <p class="reveal">硬式球は、練習で使ううちに汚れたり、縫い糸が切れたりします。そうなると練習でも使いにくくなり、倉庫にしまったままになるか、捨てられることが多くなります。</p>
          <p class="reveal">ただ、中の芯までだめになっていることはあまりありません。外の革を張り替えて縫い直せば、また練習で使えます。</p>
        </div>
      </div>
    </section>

    <section class="sec night" data-dark>
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">FLOW</p>
          <h2 class="h2 split">ボールが戻ってくるまで</h2>
          <p class="lead reveal">手作業なので、一度にたくさんは仕上がりません。そのぶん、一球ずつ確かめてから届けます。</p>
        </div>
        {track(steps)}
      </div>
    </section>

    <section class="sec">
      <div class="wrap split-2" style="align-items:center">
        <figure class="stitch reveal" style="margin:0">
          <div class="photo zoom reveal-img"><img src="{pre}assets/img/ball-new.webp" alt="赤い糸で縫い直した硬式球の縫い目" loading="lazy" width="1027" height="801" /></div>
          <figcaption>縫い目は、ボール1球で108か所。<br />一針ずつ、同じ力で糸を引いて仕上げます。</figcaption>
        </figure>
        <div>
          <p class="eyebrow reveal">MAKERS</p>
          <h2 class="h2 split">縫っているのは、<br />就労継続支援B型の皆さんです。</h2>
          <p class="reveal" style="margin-top:24px">就労継続支援B型（しゅうろうけいぞくしえん・ビーがた）は、障がいや病気のある方が、体調に合わせて自分のペースで働ける場所です。</p>
          <p class="reveal">ボールの縫い直しは、一針ずつ同じ力で糸を引く、根気のいる作業です。急がず、ていねいに向き合える方の手で、一球ずつ仕上げてもらっています。</p>
          <p class="reveal">作業した分は工賃（はたらいた分のお金）になります。ボールが一球戻るたびに、地域に仕事がひとつ生まれます。</p>
        </div>
      </div>
    </section>

    <section class="sec night" data-dark>
      <div class="wrap split-2" style="align-items:center">
        <div class="cycle-wrap reveal">{cycle_svg(pre)}<canvas class="cycle-ball" data-scene="ball" data-spin="1.6" data-light="plain" aria-label="指で回せる硬式球"></canvas></div>
        <div>
          <p class="eyebrow reveal">CYCLE</p>
          <h2 class="h2 split">使って、直して、<br />また使う。</h2>
          <div style="margin-top:32px" data-cycle-rows>{rows(cycle, colors=NIGHT_COLORS)}</div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap-narrow">
        <p class="eyebrow reveal">WHY</p>
        <h2 class="h2 split">ものを大切にすることも、<br />野球から覚えてほしい。</h2>
        <p class="reveal" style="margin-top:24px">硬式球は、コルクとゴムの芯に毛糸を何重にも巻き、牛の革で包んで縫い上げたものです。小さな一球に、たくさんの材料と手間がかかっています。</p>
        <p class="reveal">まだ使えるのに捨ててしまうのは、もったいない。グラブを手入れして長く使うように、ボールも直して使い続けたいと考えています。</p>
        <p class="reveal">直したボールを子どもたちに使ってもらうことで、道具や資源を大切にする気持ちも一緒に渡していけたら。HAKI proがこの取り組みを始めたのは、そんな思いからです。</p>
      </div>
    </section>

    <section class="sec bg-2">
      <div class="wrap">
        <div class="sec-head">
          <p class="eyebrow reveal">SERVICE</p>
          <h2 class="h2 split">サービス内容</h2>
        </div>
        {rows(asks, href=pre + "contact/?kind=ball")}
        <p class="note reveal" style="margin-top:20px">※直した硬式球は練習用です。公式戦ではお使いいただけません。回収・お見積りのご依頼は、お問い合わせからお受けしています。</p>
      </div>
    </section>
{donation(pre, bg="")}{cta(pre)}"""
    page("ball-recycle", "硬式球再生", "練習で使い古した硬式球を集め、就労継続支援B型の皆さんが革を張り替えて縫い直し、また練習で使えるボールにする取り組みです。", body, scene=True)


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
    kinds = ["講演会", "イベント（出演・企画・運営）", "健康経営サポート", "硬式球の回収・再生球のご購入", "企業ロゴ入りボールの寄贈", "SNSマーケティング・AIコンサル", "野球スクール", "その他"]
    body = hero("CONTACT", "HAKI proに<br />相談してみる。", "下のフォームに必要事項をご記入のうえ、送信してください。追って担当者よりお返事いたします。", "ring", crumbs=crumbs(pre, ("お問い合わせ", None))) + f"""
    <section class="sec">
      <div class="wrap-narrow">
        <a class="card reveal" href="{SCHOOL_FORM}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;background:var(--night);color:#fff">
          <span><span class="k" style="color:rgba(255,255,255,.6)">BASEBALL SCHOOL</span><span style="display:block;font-weight:700;font-size:clamp(13px,3.7vw,17px);white-space:nowrap;margin-top:6px">野球スクール PUMPS へのお問い合わせ</span><span style="display:block;font-size:13px;color:rgba(255,255,255,.7);margin-top:4px"><span style="display:inline-block">スクール専用の</span><span style="display:inline-block">お問い合わせフォームが開きます</span></span></span>
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
        if (k === "ball") sel.value = "硬式球の回収・再生球のご購入";
        if (k === "school") sel.value = "野球スクール";
        if (k === "donation") sel.value = "企業ロゴ入りボールの寄贈";
        if (k === "talk") sel.value = "講演会";
        var note = document.querySelector(".school-note");
        var sync = function () {{ note.hidden = sel.value !== "野球スクール"; }};
        sel.addEventListener("change", sync);
        sync();
      }})();
    </script>"""
    page("contact", "お問い合わせ", "講演会・イベント・健康経営サポート・硬式球の回収や再生球のご購入などのご相談は、こちらからお気軽にどうぞ。", body, scene=True)


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
<style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#070a14;color:#f4f5fa;font-family:"Zen Kaku Gothic New","Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic Medium","Meiryo",sans-serif;text-align:center;padding:24px}a{color:#fff;display:inline-block;margin-top:24px;padding:14px 26px;border-radius:999px;box-shadow:inset 0 0 0 1px #fff;text-decoration:none}</style>
</head><body><div><p style="font-size:48px;font-weight:800;margin:0;letter-spacing:-.04em">404</p><p>お探しのページは見つかりませんでした。</p><a href="/">トップページへ</a></div></body></html>
""",
        encoding="utf-8",
    )


if __name__ == "__main__":
    build_home()
    build_company()
    build_project()
    build_health()
    build_ball()
    build_specialists()
    build_contact()
    build_news()
    build_404()
    print("built")
