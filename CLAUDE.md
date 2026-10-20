# HAKI pro ウェブサイト — 引き継ぎメモ

haki-pro.com（株式会社HAKI pro）の作り直し。旧サイトは WordPress（テーマ massive_tcd084）。
**個人情報（子どもの氏名・保護者のメールアドレス等）はここに書かない。**

## オーナーへの回答スタイル
- 日本語・敬語。専門用語は避け、使うときは（）で説明。結論から短く、やることは番号付き
- 「誰がやるか」「やることは1つ」「やるとどうなるか」をセットで。選択肢を並べない
- 作業を始める前に、何をするかを日本語で伝える

## 構成
- ビルド不要の静的サイト。文章は `_build/build.py` を直して `python3 _build/build.py` で各ページの index.html を作り直す（事前に `pip install budoux`。日本語を言葉の切れ目で折り返すため）
- 写真の顔の位置は build.py の `FOCUS`。新しい写真を足したらここにも足す
- 3D は `assets/js/scene.js`（Three.js 0.160 を `assets/vendor/` に同梱）。モード：ring（ロゴの6色の H）/ loop / pulse / network / orbit（締め）/ ball
- ロゴの H は形を変えない（2026-10 オーナー指示）。`LOGO` の座標は元のロゴ画像（img-junkan3.png）から写し取ったもの。色の丸め（トーンマッピング）は使わない
- 導入実績（取引先名）は載せない。講演実績は「約200回」（オーナー申告）
- 動き `assets/js/site.js`、見た目 `assets/css/site.css`。動きは transform / opacity のみ、動きを減らす設定に対応
- AI で作った画像は使わない（2026-10 オーナー指示）。写真は旧サイトの本物の写真だけ
- 野球スクール（PUMPS）と少年野球大会 HERO's CUP は、リポジトリ company-website の中身を `vercel.json` の rewrites で
  **haki-pro.com/pumps/** と **haki-pro.com/heros-cup/** に取り込んで表示している（2026-10 オーナー指示：URL に toncotura-men.github.io を出さない）。
  中身を直すときは company-website 側を直す（こちらへのコピーは不要、自動で最新になる）。HERO's CUP の参加要項が読む
  `../assets/img/logo-haki.png` のため、同じ画像を `assets/img/logo-haki.png` に置いている。pumps.haki-pro.com は使わない。github.io の住所で開いた人は company-website 側のスクリプトで haki-pro.com へ移る（2026-10-20）
- スペシャリストは安部・下定の2名。伊藤・舩木のページと写真は 2026-10 オーナー指示で削除（再掲載しない）

## お問い合わせ（2026-10 オーナー決定）
- 通常のお問い合わせは info@haki-pro.com（入力内容でメールを作る方式）
- 野球スクールのお問い合わせは PUMPS サイトのフォーム https://pro.form-mailer.jp/fms/39ce6285355128

## 旧サイトのアドレス
- スペシャリストの日本語アドレス・/news/ 以下などは `404.html` の対応表で新しいページへ送る。`?page_id=39`（活動状況）は site.js でトップの #activity へ
