/* =========================================================
   健康経営のページ：かんたん診断 ＋ 資料の無料ダウンロード
   必須項目と同意を確かめ、/api/shindan に送る（AI で診断し、申込みと一緒に保存）。
   サーバーにつながらないときは、この端末で決まった計算の診断を出し、申込みを Supabase に直接保存する。
   ========================================================= */
import { CHECKS, ruleDiagnose, cleanInput } from "./shindan-rules.mjs";

const form = document.getElementById("dl-form");
if (form) {
  const SUPABASE = "https://vazmvcuxmfbhbiakdfoc.supabase.co/rest/v1/haki_download_requests";
  // 公開してよい「書き込みだけ」の鍵（表の権限で読み取りはできない）
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhem12Y3V4bWZiaGJpYWtkZm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzQ0OTgsImV4cCI6MjA5MzExMDQ5OH0.W7Un2MLjgnZn-PXk-Rb02-NwviVxXgtACk5Wu24AkrQ";
  const PDF = form.dataset.pdf;
  const FILE = "HAKIpro_kenko-keiei_hajimeno-ippo.pdf";
  const msg = form.querySelector(".dl-msg");
  const btn = form.querySelector('button[type="submit"]');

  const val = (n) => (form.elements[n].value || "").trim();
  const mark = (el, bad) => { el.closest(".field").classList.toggle("bad", bad); return !bad; };

  const check = () => {
    let ok = true;
    for (const n of ["industry", "workstyle", "age", "status", "company", "name", "employees"]) ok = mark(form.elements[n], !val(n)) && ok;
    ok = mark(form.elements.email, !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("email"))) && ok;
    ok = mark(form.elements.phone, !/^[0-9０-９+()（）\- ー－]*$/.test(val("phone"))) && ok;
    ok = mark(form.elements.consent, !form.elements.consent.checked) && ok;
    return ok;
  };

  const payload = () => ({
    industry: val("industry"), workstyle: val("workstyle"), age: val("age"), status: val("status"),
    checks: CHECKS.filter((q) => form.elements[q.id].checked).map((q) => q.id), concern: val("concern"),
    company: val("company"), name: val("name"), email: val("email"), employees: val("employees"),
    department: val("department"), phone: val("phone"), consent: true, website: val("website"),
  });

  // 文字はすべて textContent で入れる（AI の文をそのまま HTML にしない）
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  // 文章は「。」の後で改行する（文字は textContent のまま）
  const para = (cls, text) => { const e = el("p", cls); String(text).split(/(?<=。)/).filter(Boolean).forEach((t, i) => { if (i) e.append(document.createElement("br")); e.append(t); }); return e; };

  const showResult = (d, n) => {
    const box = el("div", "sd-result");
    const head = el("div", "sd-head");
    head.append(el("p", "sd-k", "診断結果"), el("p", "sd-level sd-" + ({ 良好: "ok", 注意: "warn", 要対策: "bad" }[d.level] || "warn"), d.level));
    box.append(head, el("p", "sd-headline", d.headline), para("sd-sum", d.summary), el("p", "sd-count", `セルフチェック：10問中 ${n}問 当てはまり`));
    box.append(el("p", "sd-sub", "優先して手を打つこと"));
    const ol = el("ol", "sd-pri");
    d.priorities.forEach((p) => { const li = el("li"); li.append(el("b", null, p.title), el("span", null, p.reason), el("span", "sd-act", p.action)); ol.append(li); });
    box.append(ol, el("p", "sd-sub", "最初の3か月のおすすめ"));
    const months = el("ul", "sd-months");
    d.first3months.forEach((m) => months.append(el("li", null, m)));
    box.append(months, el("p", "sd-sub", "健康経営優良法人に向けて"), para("sd-cert", d.certification));
    const row = el("div", "sd-btns");
    const dl = el("a", "btn btn-rainbow", "ガイドをダウンロード"); dl.href = PDF; dl.download = FILE;
    const talk = el("a", "btn btn-ghost", "この結果で相談する"); talk.href = form.dataset.contact;
    row.append(dl, talk);
    box.append(row, el("p", "sd-note", "この診断は、ご回答をもとにした目安です。医療の診断ではありません。"));
    form.replaceChildren(box);
    form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  // サーバーにつながらないときの予備：この端末で計算し、申込みを直接保存する
  const fallback = async (p) => {
    const a = cleanInput(p);
    const diagnosis = ruleDiagnose(a);
    const r = await fetch(SUPABASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY, Prefer: "return=minimal" },
      body: JSON.stringify({
        company: p.company, name: p.name, email: p.email, employees: p.employees, department: p.department || null, phone: p.phone || null,
        consent: true, user_agent: (navigator.userAgent || "").slice(0, 400), answers: a, check_count: a.checks.length, diagnosis, diagnosis_by: "rule",
      }),
    });
    if (!r.ok) throw new Error(r.status);
    return { diagnosis, n: a.checks.length };
  };

  form.addEventListener("input", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("bad"); });
  form.addEventListener("change", (e) => { const f = e.target.closest(".field"); if (f) f.classList.remove("bad"); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.hidden = true;
    if (!check()) {
      const first = form.querySelector(".field.bad input, .field.bad select");
      if (first) first.focus();
      return;
    }
    const p = payload();
    if (p.website) { showResult(ruleDiagnose(p), cleanInput(p).checks.length); return; }
    btn.disabled = true;
    btn.firstChild.textContent = "診断しています（20秒ほど）";
    try {
      let out;
      try {
        const r = await fetch("/api/shindan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
        if (r.status === 400) throw Object.assign(new Error("invalid"), { invalid: true });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        out = { diagnosis: j.diagnosis, n: cleanInput(p).checks.length };
      } catch (err) {
        if (err.invalid) throw err;
        out = await fallback(p);
      }
      showResult(out.diagnosis, out.n);
    } catch (err) {
      btn.disabled = false;
      btn.firstChild.textContent = "診断して、ガイドを受け取る ";
      msg.hidden = false;
      msg.className = "dl-msg bad";
      msg.textContent = err.invalid
        ? "入力内容を確かめて、もう一度お試しください。"
        : "送信できませんでした。時間をおいてもう一度お試しいただくか、info@haki-pro.com までご連絡ください。";
    }
  });
}
