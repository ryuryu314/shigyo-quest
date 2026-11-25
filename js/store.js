/* 士業ドパミンクエスト — 記録（このブラウザの localStorage だけに保存）とレベル・称号 */
(function () {
  'use strict';
  const SQ = window.SQ;
  const KEY = 'shigyo-quest-v1';
  const DEF_SET = { vol: 60, fx: true, voice: true, oralTimer: true, examTimer: false, goal: 20 };
  const fresh = () => ({ v: 1, xp: 0, days: {}, stats: {}, roads: {}, best: {}, targets: {}, set: Object.assign({}, DEF_SET), created: Date.now() });

  let S = fresh();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        S = Object.assign(fresh(), d);
        S.set = Object.assign({}, DEF_SET, d.set || {});
      }
    } catch (e) { S = fresh(); }
    return S;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 容量不足などでも遊びは止めない */ } }

  SQ.store = {
    load, save,
    get S() { return S; },
    reset() { S = fresh(); save(); },
    exportText() { return JSON.stringify(S, null, 1); },
    importText(text) {
      const d = JSON.parse(text);
      if (!d || typeof d !== 'object' || d.v !== 1) throw new Error('士業クエストの記録ファイルではありません');
      S = Object.assign(fresh(), d); S.set = Object.assign({}, DEF_SET, d.set || {}); save();
    }
  };

  /* ---------- レベルと称号 ---------- */
  SQ.TITLES = [
    [1, '受験ひよこ'], [3, '条文さんぽ'], [5, '六法めくり'], [8, '答練の常連'], [11, '短答の狩人'],
    [15, '論証の職人'], [20, '口述の胆力'], [25, '合格圏の住人'], [30, '士業見習い'], [40, '士業の星'], [50, '四冠の賢者']
  ];
  SQ.need = lv => 60 + (lv - 1) * 30;
  SQ.levelOf = xp => {
    let lv = 1, rest = Math.max(0, Math.floor(xp));
    while (rest >= SQ.need(lv)) { rest -= SQ.need(lv); lv++; }
    return { lv, into: rest, need: SQ.need(lv) };
  };
  SQ.titleOf = lv => { let t = SQ.TITLES[0][1]; for (const [l, name] of SQ.TITLES) if (lv >= l) t = name; return t; };

  /* ---------- 解答の記録 ---------- */
  SQ.record = function (qid, score) {
    const st = S.stats[qid] || (S.stats[qid] = { n: 0, ok: 0, last: 0, ts: 0 });
    st.n++; if (score >= 0.999) st.ok++; st.last = score; st.ts = Date.now();
    const d = SQ.today(); S.days[d] = (S.days[d] || 0) + 1;
  };
  SQ.todayCount = () => S.days[SQ.today()] || 0;
  SQ.streak = function () {
    let n = 0;
    const d = new Date();
    if (!S.days[SQ.today()]) d.setDate(d.getDate() - 1);
    for (;;) {
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!S.days[k]) break;
      n++; d.setDate(d.getDate() - 1);
    }
    return n;
  };
  // 直近の解答が満点でなかった問題
  SQ.weakIds = examId => Object.keys(S.stats).filter(id => S.stats[id].last < 0.999 && SQ.byId[id] && (!examId || SQ.byId[id].exam === examId));
  SQ.examStats = function (examId) {
    const ids = SQ.Q.filter(q => q.exam === examId).map(q => q.id);
    let n = 0, ok = 0, seen = 0;
    ids.forEach(id => { const s = S.stats[id]; if (s) { seen++; n += s.n; ok += s.ok; } });
    return { total: ids.length, seen, n, ok, rate: n ? ok / n : 0 };
  };
})();
