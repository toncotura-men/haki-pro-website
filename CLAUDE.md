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
- 3D は `assets/js/scene.js`（Three.js 0.160 を `assets/vendor/` に同梱）。モード：ring（ロゴの6色の H）/ loop / pulse / network / ball
- 動き `assets/js/site.js`、見た目 `assets/css/site.css`。動きは transform / opacity のみ、動きを減らす設定に対応
- AI で作った画像は使わない（2026-10 オーナー指示）。写真は旧サイトの本物の写真だけ
- 野球スクール（PUMPS）は別サイト https://toncotura-men.github.io/company-website/index.html（リポジトリ company-website）。トップに入口カードあり。
  pumps.haki-pro.com は 2026-10 時点で開けなかったため使わない（オーナー指摘）
- スペシャリストは安部・下定の2名。伊藤・舩木のページと写真は 2026-10 オーナー指示で削除（再掲載しない）

## お問い合わせ（2026-10 オーナー決定）
- 通常のお問い合わせは info@haki-pro.com（入力内容でメールを作る方式）
- 野球スクールのお問い合わせは PUMPS サイトのフォーム https://pro.form-mailer.jp/fms/39ce6285355128

## 旧サイトのアドレス
- スペシャリストの日本語アドレス・/news/ 以下などは `404.html` の対応表で新しいページへ送る。`?page_id=39`（活動状況）は site.js でトップの #activity へ
