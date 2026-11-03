/* ボタンの文字を1字ずつに分け、動きの準備をする（見た目は assets/css/btn2.css）
   2026-11-03 オーナー指示「縦に大きすぎる・もっとかっこいいボタンに・他のとこも」
   2026-11-03 HAKI pro・PUMPS も同じ作りに（オーナー指示「全てこのボタンに統一」）。3サイトで同じ中身のファイルを置く。直すときは3つとも
   ・読み上げ（スクリーンリーダー）には元の文がそのまま読まれるよう aria-label を付ける
   ・スマホは押した瞬間に文字が流れる（kb-roll）
   ・画面に入ると1字ずつ立ち上がる（kb-wait → kb-in） */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var sel = ".x-btn, .btn, .float-entry, .nav-cta, .drawer-cta, .fab";

  function split(text) {
    var t = document.createElement("span");
    t.className = "kb-t"; t.setAttribute("aria-hidden", "true");
    Array.from(text.replace(/\u200b/g, "").trim()).forEach(function (ch, i) {
      var c = document.createElement("span");
      if (ch === " " || ch === "　") { c.className = "kb-sp"; t.appendChild(c); return; }
      c.className = "kb-c"; c.style.setProperty("--i", i);
      c.innerHTML = "<span></span><span></span>";
      c.firstChild.textContent = ch; c.lastChild.textContent = ch;
      t.appendChild(c);
    });
    return t;
  }
  function arrow(el) {
    var a = el || document.createElement("span");
    a.classList.add("kb-a"); a.setAttribute("aria-hidden", "true");
    a.innerHTML = "<span>→</span><span>→</span>";
    return a;
  }

  document.querySelectorAll(sel).forEach(function (el) {
    if (el.classList.contains("kb")) return;
    var arr = el.querySelector("i, .arr");
    var small = el.querySelector("small");
    var full = el.textContent.replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
    if (!full) return;
    el.setAttribute("aria-label", small ? full.replace(small.textContent.trim(), "（" + small.textContent.trim() + "）").replace(/\s+（/, "（") : full);

    // 文字の入れ物（span）があれば、その中身を1字ずつに（入れ物の見た目の決まりはそのまま残す）
    var labels = Array.from(el.children).filter(function (c) { return c.tagName === "SPAN" && !c.classList.contains("arr"); });
    if (labels.length) labels.forEach(function (l) { var tx = l.textContent; l.textContent = ""; l.appendChild(split(tx)); });
    else {
      var tx = Array.from(el.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join("");
      Array.from(el.childNodes).forEach(function (n) { if (n.nodeType === 3) n.remove(); });
      el.insertBefore(split(tx), el.firstChild);
    }
    if (arr) { arrow(arr); el.appendChild(arr); }
    else if (!small) el.appendChild(arrow());

    el.classList.add("kb");
    if (el.classList.contains("x-btn-lg")) el.classList.add("kb-lg");
    if (el.classList.contains("float-entry") || el.classList.contains("fab")) el.classList.add("kb-f");
    else if (el.classList.contains("nav-cta")) el.classList.add("kb-n");
    else if (el.classList.contains("drawer-cta")) el.classList.add("kb-d");
    el.classList.add("kb-p");

    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || reduce) return;
      el.classList.add("kb-roll");
      setTimeout(function () { el.classList.remove("kb-roll"); }, 700);
    });

    if (!reduce && "IntersectionObserver" in window && !el.classList.contains("kb-f") && !el.classList.contains("kb-d")) {
      el.classList.add("kb-wait");
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          el.classList.add("kb-in");
          requestAnimationFrame(function () { el.classList.remove("kb-wait"); });
          setTimeout(function () { el.classList.remove("kb-in"); }, 1600);
          io.disconnect();
        });
      }, { threshold: 0.4 });
      io.observe(el);
    }
  });
})();
