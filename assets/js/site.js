/* =========================================================
   HAKI pro — 画面の動き（3D 以外）
   見出しの1文字ずつの出現・幕上げ・時間差・ヘッダーの出し入れ・
   読了ライン・スクロールで濃くなる文・積み上がるカード・傾きと光・
   メニュー・開閉・お問い合わせ（メール作成）
   ========================================================= */
(function () {
  "use strict";
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* 旧サイト（WordPress）のアドレスから来た人を新しいページへ */
  if (/[?&]page_id=39\b/.test(location.search)) location.replace(location.pathname + "#activity");

  /* ---------- 見出しを1文字ずつに分ける ---------- */
  $$(".split").forEach(function (el) {
    var i = 0;
    /* 1文字ずつ動かすが、折り返しは言葉のまとまり（ゼロ幅スペースの所）だけにする */
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          var word = null;
          Array.from(n.textContent).forEach(function (ch) {
            if (ch === "\n" || ch === "\t") return;
            if (ch === "\u200b") { word = null; frag.appendChild(document.createTextNode("\u200b")); return; }
            if (ch === " ") { word = null; var sp = document.createElement("span"); sp.className = "sp"; sp.textContent = "\u00a0"; frag.appendChild(sp); return; }
            if (!word) { word = document.createElement("span"); word.className = "word"; frag.appendChild(word); }
            var s = document.createElement("span");
            s.className = "ch"; s.textContent = ch; s.style.setProperty("--i", i++);
            word.appendChild(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    el.setAttribute("aria-label", el.textContent.replace(/\u200b/g, "").replace(/\s+/g, " ").trim());
    walk(el);
    $$(".ch, .sp", el).forEach(function (c) { c.setAttribute("aria-hidden", "true"); });
  });

  /* ---------- 画面に入ったら .in ---------- */
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
  $$(".split, .mask, .reveal, .reveal-img, .card, .icon, .compare, .values, [data-in]").forEach(function (el) { io.observe(el); });
  /* 時間差：同じ親の中で順番に */
  $$("[data-stagger]").forEach(function (p) {
    Array.prototype.slice.call(p.children).forEach(function (c, i) { c.style.setProperty("--i", i); });
  });
  /* 最初の画面の見出しはすぐ出す */
  requestAnimationFrame(function () {
    $$(".hero .split, .hero .mask, .hero .reveal").forEach(function (el) { el.classList.add("in"); });
  });

  /* ---------- ヘッダー：暗い所では白、下にスクロールで隠す ---------- */
  var header = $(".header");
  var progress = $(".progress");
  var fab = $(".fab");
  var darks = $$("[data-dark]");
  var lastY = scrollY, ticking = false;
  var onScroll = function () {
    var y = scrollY;
    var hh = header.offsetHeight;
    header.classList.toggle("is-solid", y > 8);
    var dark = darks.some(function (s) { var r = s.getBoundingClientRect(); return r.top <= hh / 2 && r.bottom >= hh / 2; });
    header.classList.toggle("is-dark", dark);
    if (!document.body.classList.contains("menu-open")) {
      header.classList.toggle("is-hidden", y > lastY && y > 240);
    }
    var max = root.scrollHeight - innerHeight;
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    if (fab) fab.classList.toggle("show", y > innerHeight * 0.6 && (max - y) > 280);
    scrubUpdate();
    chainUpdate();
    stackUpdate();
    lastY = y;
    ticking = false;
  };
  addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);

  /* ---------- スクロールで文字が濃くなる ---------- */
  var scrubs = $$(".scrub");
  scrubs.forEach(function (el) {
    var text = el.textContent.trim();
    el.setAttribute("aria-label", text.replace(/\u200b/g, ""));
    el.textContent = "";
    Array.from(text).forEach(function (ch) {
      var w = document.createElement("span");
      w.className = "w";
      w.textContent = ch;
      w.setAttribute("aria-hidden", "true");
      el.appendChild(w);
    });
  });
  function scrubUpdate() {
    scrubs.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var p = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35);
      p = Math.max(0, Math.min(1, p));
      var ws = el.children, n = Math.round(p * ws.length);
      for (var i = 0; i < ws.length; i++) ws[i].classList.toggle("on", i < n);
    });
  }

  /* ---------- 「そのためには」：画面の真ん中を通った行から点く ---------- */
  var chains = $$(".chain p");
  function chainUpdate() {
    chains.forEach(function (p) {
      var r = p.getBoundingClientRect();
      p.classList.toggle("on", r.top < innerHeight * 0.62);
    });
  }

  /* ---------- 積み上がるカード：次が来たら少し縮んで奥へ ---------- */
  var stack = $$(".stack-card");
  function stackUpdate() {
    if (reduced) return;
    stack.forEach(function (c, i) {
      var next = stack[i + 1];
      if (!next) { c.style.transform = ""; return; }
      var rc = c.getBoundingClientRect(), rn = next.getBoundingClientRect();
      var p = 1 - Math.max(0, Math.min(1, (rn.top - rc.top) / rc.height));
      c.style.transform = "scale(" + (1 - p * 0.06) + ")";
      c.style.filter = "brightness(" + (1 - p * 0.35) + ")";
    });
  }

  /* ---------- キャッチコピーが入れかわる ---------- */
  $$(".ticker").forEach(function (tk) {
    var items = $$("span", tk);
    if (items.length < 2) return;
    var k = 0;
    items[0].classList.add("on");
    if (reduced) return;
    setInterval(function () {
      if (document.hidden) return;
      var cur = items[k];
      cur.classList.remove("on"); cur.classList.add("off");
      setTimeout(function () { cur.classList.remove("off"); }, 700);
      k = (k + 1) % items.length;
      items[k].classList.add("on");
    }, 3600);
  });

  /* ---------- 傾き＋光（マウスの端末だけ） ---------- */
  if (canHover && !reduced) {
    $$(".tilt").forEach(function (el) {
      if (!$(".glare", el)) { var g = document.createElement("span"); g.className = "glare"; el.appendChild(g); }
      var max = parseFloat(el.dataset.tilt || "6");
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.transition = "transform .15s linear";
        el.style.transform = "perspective(900px) rotateX(" + ((0.5 - y) * max) + "deg) rotateY(" + ((x - 0.5) * max) + "deg)";
        el.style.setProperty("--mx", x * 100 + "%");
        el.style.setProperty("--my", y * 100 + "%");
      });
      el.addEventListener("pointerleave", function () { el.style.transition = ""; el.style.transform = ""; });
    });
    /* 吸い付くボタン */
    $$(".magnetic").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.28 + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------- 写真の横スクロール：マウスでつかんで動かす ---------- */
  $$(".gallery").forEach(function (g) {
    if (!canHover) return;
    var down = null;
    g.addEventListener("pointerdown", function (e) { down = { x: e.clientX, s: g.scrollLeft }; g.style.scrollSnapType = "none"; });
    addEventListener("pointermove", function (e) { if (down) g.scrollLeft = down.s - (e.clientX - down.x); });
    addEventListener("pointerup", function () { if (down) { down = null; g.style.scrollSnapType = ""; } });
  });

  /* ---------- 数字が数え上がる ---------- */
  var countIO = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      var el = e.target, to = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length;
      if (reduced) { el.textContent = to.toFixed(dec); return; }
      var t0 = performance.now(), dur = 1400;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur), e2 = 1 - Math.pow(2, -10 * p);
        el.textContent = (to * (p >= 1 ? 1 : e2)).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach(function (el) { countIO.observe(el); });

  /* ---------- 横長リスト：光がカーソルについてくる ---------- */
  if (canHover) {
    $$("[data-spot]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--mx", e.clientX - r.left + "px");
        el.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });
  }

  /* ---------- 循環の輪：リストに乗せた行の丸を光らせる ---------- */
  $$("[data-cycle-rows]").forEach(function (box) {
    var svg = box.closest("section").querySelector(".cycle");
    if (!svg) return;
    $$("[data-row]", box).forEach(function (li) {
      var node = svg.querySelector('[data-node="' + li.dataset.row + '"]');
      var on = function () { node && node.classList.add("hl"); };
      var off = function () { node && node.classList.remove("hl"); };
      li.addEventListener("pointerenter", on);
      li.addEventListener("pointerleave", off);
    });
  });

  /* ---------- ボールが工程の線の上を転がる ---------- */
  $$("[data-track]").forEach(function (tr) {
    var steps = $$(".tk-step", tr), dots = $$(".tk-dot", tr);
    var line = $(".tk-line", tr), fill = $("i", line), ball = $(".tk-ball", tr);
    var cur = 0, pts = [], timer = 0, user = false;
    var size = function () { return ball.offsetWidth; };
    var measure = function () {
      var r0 = tr.getBoundingClientRect();
      pts = dots.map(function (d) { var r = d.getBoundingClientRect(); return { x: r.left - r0.left + r.width / 2, y: r.top - r0.top + r.height / 2 }; });
      var a = pts[0], b = pts[pts.length - 1], horiz = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
      tr.dataset.dir = horiz ? "x" : "y";
      line.style.left = (horiz ? a.x : a.x - 1) + "px";
      line.style.top = (horiz ? a.y - 1 : a.y) + "px";
      line.style.width = (horiz ? b.x - a.x : 2) + "px";
      line.style.height = (horiz ? 2 : b.y - a.y) + "px";
    };
    var go = function (i) {
      cur = i;
      var a = pts[0], p = pts[i], b = pts[pts.length - 1], s = size();
      var dist = Math.abs(p.x - a.x) + Math.abs(p.y - a.y), total = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) || 1;
      var horiz = tr.dataset.dir === "x", k = dist / total;
      fill.style.setProperty("--sx", horiz ? k : 1);
      fill.style.setProperty("--sy", horiz ? 1 : k);
      /* 転がった距離のぶんだけ回す（円周 = 直径 × π） */
      ball.style.transform = "translate(" + (p.x - s / 2) + "px," + (p.y - s / 2) + "px) rotate(" + (dist / (Math.PI * s)) * 360 + "deg)";
      steps.forEach(function (st, j) { st.classList.toggle("done", j <= i); st.classList.toggle("on", j === i); });
    };
    var play = function () {
      if (reduced) { go(steps.length - 1); return; }
      var i = 0;
      clearInterval(timer);
      go(0);
      timer = setInterval(function () {
        if (user || ++i >= steps.length) { clearInterval(timer); return; }
        go(i);
      }, 850);
    };
    measure();
    ball.style.transition = "none";
    go(0);
    requestAnimationFrame(function () { ball.style.transition = ""; });
    new IntersectionObserver(function (ents, ob) {
      if (!ents[0].isIntersecting) return;
      ob.disconnect();
      play();
    }, { threshold: 0.45 }).observe(tr);
    steps.forEach(function (st, i) {
      st.addEventListener("pointerenter", function () { user = true; go(i); });
      st.addEventListener("click", function () { user = true; go(i); });
    });
    new ResizeObserver(function () { measure(); ball.style.transition = "none"; go(cur); requestAnimationFrame(function () { ball.style.transition = ""; }); }).observe(tr);
  });

  /* ---------- メニュー ---------- */
  var btn = $(".menu-btn");
  if (btn) {
    $$(".drawer a").forEach(function (a, i) { a.style.setProperty("--i", i); });
    var setMenu = function (open) {
      document.body.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
      $(".drawer").setAttribute("aria-hidden", open ? "false" : "true");
      header.classList.remove("is-hidden");
    };
    btn.addEventListener("click", function () { setMenu(!document.body.classList.contains("menu-open")); });
    $$(".drawer a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  /* ---------- 開閉（動いている途中でも押し直せる） ---------- */
  $$(".acc button").forEach(function (b) {
    b.addEventListener("click", function () {
      var acc = b.closest(".acc"), open = !acc.classList.contains("open");
      acc.classList.toggle("open", open);
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------- お問い合わせ：入力内容でメールを作る ---------- */
  $$("form[data-mailto]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$(".field", form).forEach(function (f) {
        var input = $("input, select, textarea", f);
        var school = form.elements.kind && form.elements.kind.value === "野球スクール";
        var bad = input.required && !input.value.trim() && !(school && input.name !== "kind");
        if (input.type === "email" && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) bad = true;
        f.classList.toggle("bad", bad);
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) return;
      /* 野球スクールは PUMPS のお問い合わせフォームへ */
      if (form.dataset.schoolForm && form.elements.kind && form.elements.kind.value === "野球スクール") {
        window.open(form.dataset.schoolForm, "_blank", "noopener");
        return;
      }
      var lines = $$(".field", form).map(function (f) {
        var label = $("label", f).firstChild.textContent.trim();
        var v = $("input, select, textarea", f).value.trim();
        return "【" + label + "】\n" + (v || "（未記入）");
      });
      var kind = (form.elements.kind && form.elements.kind.value) || "お問い合わせ";
      var subject = "【HAKI pro】" + kind + "のお問い合わせ";
      location.href = "mailto:" + form.dataset.mailto + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent("HAKI pro ウェブサイトからのお問い合わせ\n\n" + lines.join("\n\n"));
      var done = $(".form-done", form.parentNode);
      if (done) done.hidden = false;
    });
  });

  var y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
  onScroll();
})();
