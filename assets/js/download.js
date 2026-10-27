/* =========================================================
   健康経営のページ：資料の無料ダウンロード
   必須項目と同意を確かめ、申込みを Supabase（haki_download_requests）に保存してから PDF を渡す。
   この鍵は公開してよい「書き込みだけ」の鍵（表の権限で読み取りはできない）。
   ========================================================= */
(function () {
  var form = document.getElementById("dl-form");
  if (!form) return;
  var API = "https://vazmvcuxmfbhbiakdfoc.supabase.co/rest/v1/haki_download_requests";
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhem12Y3V4bWZiaGJpYWtkZm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzQ0OTgsImV4cCI6MjA5MzExMDQ5OH0.W7Un2MLjgnZn-PXk-Rb02-NwviVxXgtACk5Wu24AkrQ";
  var PDF = form.dataset.pdf;
  var FILE = "HAKIpro_kenko-keiei_hajimeno-ippo.pdf";
  var msg = form.querySelector(".dl-msg");
  var btn = form.querySelector('button[type="submit"]');

  var val = function (n) { return (form.elements[n].value || "").trim(); };
  var mark = function (el, bad) { el.closest(".field").classList.toggle("bad", bad); return !bad; };

  var check = function () {
    var ok = true;
    ok = mark(form.elements.company, !val("company")) && ok;
    ok = mark(form.elements.name, !val("name")) && ok;
    ok = mark(form.elements.email, !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("email"))) && ok;
    ok = mark(form.elements.employees, !val("employees")) && ok;
    ok = mark(form.elements.phone, !/^[0-9０-９+()（）\- ー－]*$/.test(val("phone"))) && ok;
    ok = mark(form.elements.consent, !form.elements.consent.checked) && ok;
    return ok;
  };

  var download = function () {
    var a = document.createElement("a");
    a.href = PDF; a.download = FILE; document.body.appendChild(a); a.click(); a.remove();
  };

  var done = function () {
    form.innerHTML = '<div class="dl-done"><p class="t">お申し込みありがとうございます。</p>' +
      '<p>資料のダウンロードが始まります。始まらない場合は、下のボタンを押してください。</p>' +
      '<a class="btn btn-rainbow" href="' + PDF + '" download="' + FILE + '">資料をダウンロード</a></div>';
    download();
  };

  form.addEventListener("input", function (e) { var f = e.target.closest(".field"); if (f) f.classList.remove("bad"); });
  form.addEventListener("change", function (e) { var f = e.target.closest(".field"); if (f) f.classList.remove("bad"); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    msg.hidden = true;
    if (!check()) {
      var first = form.querySelector(".field.bad input, .field.bad select");
      if (first) first.focus();
      return;
    }
    // ロボットだけが埋める見えない欄に入力があれば、保存せずに終える
    if (val("website")) { done(); return; }
    btn.disabled = true;
    var body = {
      company: val("company"), name: val("name"), email: val("email"), employees: val("employees"),
      department: val("department") || null, phone: val("phone") || null, consent: true,
      user_agent: (navigator.userAgent || "").slice(0, 400)
    };
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY, Prefer: "return=minimal" },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      done();
    }).catch(function () {
      btn.disabled = false;
      msg.hidden = false;
      msg.className = "dl-msg bad";
      msg.innerHTML = "送信できませんでした。時間をおいてもう一度お試しいただくか、info@haki-pro.com までご連絡ください。";
    });
  });
})();
