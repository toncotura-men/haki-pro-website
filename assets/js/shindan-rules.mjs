/* =========================================================
   健康経営かんたん診断：質問と、決まった計算での診断
   ブラウザ（download.js）とサーバー（api/shindan.js）の両方で使う。
   AI が使えないとき・失敗したときは、ここの ruleDiagnose の結果を出す。
   ========================================================= */

export const CHECKS = [
  { id: "c1", text: "健康診断で「要再検査」「要精密検査」の人がいる", cat: "system" },
  { id: "c2", text: "肩こり・腰痛を訴える人が多い", cat: "body" },
  { id: "c3", text: "座りっぱなし・立ちっぱなしの仕事が多い", cat: "body" },
  { id: "c4", text: "運動の習慣がある社員は少ないと思う", cat: "move" },
  { id: "c5", text: "「疲れが取れない」「眠れない」という声がある", cat: "mind" },
  { id: "c6", text: "ストレスや気分の落ち込みで休む人がいた", cat: "mind" },
  { id: "c7", text: "この1年で、体調を理由に辞めた人がいた", cat: "people" },
  { id: "c8", text: "社員の平均年齢が上がってきている", cat: "system" },
  { id: "c9", text: "採用の募集を出しても、人が集まりにくい", cat: "people" },
  { id: "c10", text: "健康づくりの担当者が決まっていない", cat: "system" },
];

export const CONTEXT = {
  industry: ["製造", "建設", "運輸・物流", "小売・飲食・サービス", "医療・介護・福祉", "IT・事務・専門サービス", "その他"],
  workstyle: ["デスクワークが中心", "立ち仕事・現場作業が中心", "車の運転が多い", "いろいろ混ざっている"],
  age: ["20〜30代が中心", "40代が中心", "50代以上が多い", "年代はばらばら"],
  status: ["まだ何もしていない", "健康診断だけしている", "健康宣言をした", "健康経営優良法人の認定を目指している", "認定を受けている"],
};

const CATS = {
  body: {
    title: "体の負担（肩・腰・姿勢）",
    reason: "肩こりや腰痛は、仕事の集中と作業の速さに直接ひびきます。",
    action: "月1回の運動指導で、肩・腰をほぐす体操と、座り方・立ち方を全員で覚えます。",
    themes: ["肩こり", "腰痛", "姿勢"],
  },
  move: {
    title: "運動の習慣",
    reason: "運動の習慣が少ないと、体力の落ちに気づきにくくなります。",
    action: "最初の体力測定で今の体を数字にし、毎日3分でできる運動から始めます。",
    themes: ["体力測定", "柔軟", "筋力"],
  },
  mind: {
    title: "疲れ・睡眠・ストレス",
    reason: "疲れや眠りの不調は、休みや退職のきっかけになりやすいところです。",
    action: "眠りの質を上げる過ごし方と、呼吸でできるリラックスの方法を取り入れます。",
    themes: ["睡眠", "ストレス", "柔軟"],
  },
  people: {
    title: "人の定着と採用",
    reason: "体調を理由にした退職や採用の苦戦は、残った社員の負担を重くします。",
    action: "健康づくりに会社で取り組んでいることを、社内と採用の場で伝えられる形にします。",
    themes: ["体力測定", "ストレス", "家でも続ける"],
  },
  system: {
    title: "健康づくりの体制",
    reason: "担当者や仕組みがないと、健康診断の結果がそのままになりがちです。",
    action: "担当者を決め、健康宣言に申し込み、年2回の体力測定で変化を記録します。",
    themes: ["体力測定", "姿勢", "睡眠"],
  },
};

const INDUSTRY_NOTE = {
  "製造": "製造の現場では、同じ姿勢と重い物の扱いが続きやすく、腰とひざへの負担が出やすい傾向があります。",
  "建設": "建設の現場では、重い物の扱いと中腰の作業で、腰とひざへの負担が出やすい傾向があります。",
  "運輸・物流": "運輸・物流では、長い時間の運転と荷物の積み下ろしで、腰と肩への負担が出やすい傾向があります。",
  "小売・飲食・サービス": "小売・飲食・サービスでは、立ちっぱなしの時間が長く、足腰の疲れがたまりやすい傾向があります。",
  "医療・介護・福祉": "医療・介護・福祉では、人を支える動きが多く、腰への負担と心の疲れが重なりやすい傾向があります。",
  "IT・事務・専門サービス": "事務の仕事では、座りっぱなしの時間が長く、肩こりと運動不足が起きやすい傾向があります。",
};

const STATUS_NOTE = {
  "まだ何もしていない": "まずは協会けんぽの「健康宣言」への申し込み（無料）から始めると、健康経営優良法人の申請に必要な土台ができます。",
  "健康診断だけしている": "健康診断に加えて「健康宣言」に申し込むと、健康経営優良法人の申請に必要な土台ができます。",
  "健康宣言をした": "健康宣言は済んでいます。次は「運動機会の増進」などの取り組みを記録に残すと、申請書を書きやすくなります。",
  "健康経営優良法人の認定を目指している": "申請は毎年8月〜10月中旬です。それまでの取り組みの記録をそろえておくと、申請書を書きやすくなります。",
  "認定を受けている": "認定を続けるには毎年の申請が必要です。測定の数字で、取り組みの効果を示せるようにしておくと安心です。",
};

/** 入力を整える（知らない値は捨てる） */
export function cleanInput(raw) {
  const checks = Array.isArray(raw && raw.checks) ? raw.checks.filter((c) => CHECKS.some((q) => q.id === c)) : [];
  const pick = (k) => (CONTEXT[k].includes(raw && raw[k]) ? raw[k] : "");
  const concern = String((raw && raw.concern) || "").replace(/\s+/g, " ").trim().slice(0, 300);
  return { checks: [...new Set(checks)], industry: pick("industry"), workstyle: pick("workstyle"), age: pick("age"), status: pick("status"), concern };
}

/** 決まった計算での診断。AI と同じ形で返す */
export function ruleDiagnose(input) {
  const a = cleanInput(input);
  const score = { body: 0, move: 0, mind: 0, people: 0, system: 0 };
  CHECKS.forEach((q) => { if (a.checks.includes(q.id)) score[q.cat] += 2; });
  if (a.workstyle === "デスクワークが中心" || a.workstyle === "車の運転が多い") { score.body += 1; score.move += 1; }
  if (a.workstyle === "立ち仕事・現場作業が中心") score.body += 2;
  if (a.age === "50代以上が多い") { score.system += 1; score.body += 1; }
  if (a.status === "まだ何もしていない") score.system += 1;

  const n = a.checks.length;
  const level = n <= 2 ? "良好" : n <= 5 ? "注意" : "要対策";
  const order = ["body", "mind", "people", "move", "system"];
  const top = order.slice().sort((x, y) => score[y] - score[x] || order.indexOf(x) - order.indexOf(y)).slice(0, 3);

  const headline = level === "良好"
    ? "大きな課題は少なく、良い状態を保つ段階です。"
    : `「${CATS[top[0]].title}」と「${CATS[top[1]].title}」に、早めの手当てが必要な状態です。`;
  const summary = [
    `セルフチェックで当てはまったのは10問中${n}問です。`,
    INDUSTRY_NOTE[a.industry] || "",
    level === "要対策" ? "会社として取り組みを始める時期です。" : level === "注意" ? "課題が出始めているので、今のうちに手を打てます。" : "今の良い状態を、仕組みにして続けることが大切です。",
  ].filter(Boolean).join("");

  const themes = [];
  top.forEach((c) => CATS[c].themes.forEach((t) => { if (!themes.includes(t)) themes.push(t); }));
  const first3 = ["体力測定", ...themes.filter((t) => t !== "体力測定")].slice(0, 3)
    .map((t, i) => `${i + 1}か月目：${t}`);

  return {
    level,
    headline,
    summary,
    priorities: top.map((c) => ({ title: CATS[c].title, reason: CATS[c].reason, action: CATS[c].action })),
    first3months: first3,
    certification: STATUS_NOTE[a.status] || STATUS_NOTE["まだ何もしていない"],
  };
}
