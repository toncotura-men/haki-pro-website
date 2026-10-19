# 株式会社HAKI pro ウェブサイト（haki-pro.com）

WordPress の旧サイトを、ビルド不要の静的サイトに作り直したもの（2026-10）。

- 文章を直す：`_build/build.py` を編集 → `python3 _build/build.py` で各ページの index.html を作り直す
- 3D：`assets/js/scene.js`（Three.js。ロゴの6色の H が組み上がる輪・∞の循環・心拍の輪・人のつながり・硬式球）
- 画面の動き：`assets/js/site.js`、見た目：`assets/css/site.css`
- 写真は旧サイトの本物の写真だけを使用（AI 画像は不使用）
- お問い合わせは入力内容でメール（info@haki-pro.com）を作る方式
- 旧サイトのアドレス（スペシャリストの日本語アドレス、?page_id=39）は 404.html と site.js で新しいページへ送る
