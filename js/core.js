/* 士業ドパミンクエスト — 共通の土台
 * 名前空間 SQ、問題の登録関数、データ検証をまとめる。データファイルより先に読み込む。
 *
 * 問題の追加方法（詳しくは README.md）:
 *   SQ.mcq('試験/段階/採点区分', {...})   択一（短答・筆記の択一）
 *   SQ.kase('試験/段階/採点区分', {...})  論文・記述（選んで組み立てる形式）
 *   SQ.oral('試験/段階/採点区分', {...})  口述（試験官の質問に答える形式）
 *   id は成績の保存に使うので、一度公開したら変えない。
 */
(function () {
  'use strict';
  const SQ = window.SQ = window.SQ || {};
  SQ.VERSION = '0.1.0';
  SQ.Q = [];
  SQ.byId = {};
  SQ.dataErrors = [];

  function register(kind, path, o) {
    const [exam, stage, sec] = String(path).split('/');
    const item = Object.assign({ kind, exam, stage, sec, lv: 1 }, o);
    if (!item.id) SQ.dataErrors.push('id がない問題: ' + path);
    else if (SQ.byId[item.id]) SQ.dataErrors.push('id の重複: ' + item.id);
    SQ.byId[item.id] = item;
    SQ.Q.push(item);
    return item;
  }
  SQ.mcq = (path, o) => register('mcq', path, o);
  SQ.kase = (path, o) => register('case', path, o);
  SQ.oral = (path, o) => register('oral', path, o);

  SQ.exam = id => SQ.EXAMS.find(e => e.id === id);
  SQ.stage = (examId, stageId) => { const e = SQ.exam(examId); return e && e.stages.find(s => s.id === stageId); };

  /* ---------- 択一の正解を記述の正誤から導く ---------- */
  const LETTERS = 'アイウエオカキク';
  // 組合せの文字列（例: 'アウ'）を記述ラベルの配列にする。弁理士式の (イ) などにも対応。
  function comboLabels(combo, labels) {
    const out = [];
    let rest = combo;
    while (rest.length) {
      const hit = labels.filter(l => l && rest.startsWith(l)).sort((a, b) => b.length - a.length)[0];
      if (!hit) return null;
      out.push(hit);
      rest = rest.slice(hit.length);
    }
    return out;
  }
  // 選択肢と正解の位置を返す。tf（各記述の正誤）は choices を持たない。
  SQ.mcqKey = function (item) {
    const want = item.want === undefined ? true : item.want;
    const st = item.st || [];
    const labels = st.map((s, i) => s[0] || (item.form === 'one' ? String(i + 1) : LETTERS[i]));
    switch (item.form) {
      case 'one': {
        const hits = st.map((s, i) => s[2] === want ? i : -1).filter(i => i >= 0);
        return { choices: st.map((s, i) => ({ no: i + 1, text: s[1] })), answer: hits.length === 1 ? hits[0] : -1, labels, hits: hits.length };
      }
      case 'combo': {
        const truth = new Set(labels.filter((l, i) => st[i][2] === want));
        const matches = [];
        const choices = item.combos.map((c, i) => {
          const ls = comboLabels(c, labels);
          if (ls && ls.length === truth.size && ls.every(l => truth.has(l))) matches.push(i);
          return { no: i + 1, text: ls ? ls.join(' ') : c, bad: !ls };
        });
        return { choices, answer: matches.length === 1 ? matches[0] : -1, labels, hits: matches.length };
      }
      case 'count': {
        const n = st.filter(s => s[2] === want).length;
        const counts = item.counts || ['1つ', '2つ', '3つ', '4つ', '5つ'];
        const label = n === 0 ? 'なし' : n + 'つ';
        const answer = counts.indexOf(label);
        return { choices: counts.map((c, i) => ({ no: i + 1, text: c })), answer, labels, hits: answer >= 0 ? 1 : 0 };
      }
      case 'pick':
        return { choices: item.choices.map((c, i) => ({ no: i + 1, text: Array.isArray(c) ? c[0] : c })), answer: item.answer, labels, hits: 1 };
      case 'tf':
        return { choices: [], answer: null, labels, hits: 1 };
      default:
        return { choices: [], answer: -1, labels, hits: 0 };
    }
  };

  /* ---------- データ検証 ---------- */
  SQ.validate = function () {
    const err = SQ.dataErrors;
    for (const q of SQ.Q) {
      const where = q.id + '：';
      const stage = SQ.stage(q.exam, q.stage);
      if (!stage) { err.push(where + '試験・段階が見つからない（' + q.exam + '/' + q.stage + '）'); continue; }
      if (!stage.sections.some(s => s.id === q.sec)) err.push(where + '採点区分が見つからない（' + q.sec + '）');
      if (!q.title) err.push(where + 'title がない');
      if (q.kind === 'mcq') {
        if (!['one', 'combo', 'count', 'pick', 'tf'].includes(q.form)) { err.push(where + 'form が不正（' + q.form + '）'); continue; }
        if (!q.q) err.push(where + '問題文 q がない');
        if (q.form !== 'pick' && (!q.st || q.st.length < 2)) err.push(where + '記述 st が足りない');
        if (q.form === 'pick' && (!q.choices || q.answer == null || !q.choices[q.answer])) err.push(where + 'choices / answer が不正');
        const key = SQ.mcqKey(q);
        if (q.form === 'combo' && key.choices.some(c => c.bad)) err.push(where + '組合せに存在しない記述ラベルがある');
        if (key.answer === -1 || key.hits !== 1) err.push(where + '正解がちょうど1つに定まらない（該当 ' + key.hits + '）');
        (q.st || []).forEach((s, i) => { if (typeof s[2] !== 'boolean') err.push(where + '記述' + (i + 1) + 'の正誤が真偽値でない'); });
      } else if (q.kind === 'case') {
        if (!q.facts || !q.steps || !q.steps.length) { err.push(where + 'facts / steps がない'); continue; }
        q.steps.forEach((s, i) => {
          const ok = (s.options || []).filter(o => o[1] === true).length;
          if (!(s.pts > 0)) err.push(where + 'ステップ' + (i + 1) + 'の pts がない');
          if (s.type === 'one' && ok !== 1) err.push(where + 'ステップ' + (i + 1) + 'の正解が1つでない');
          if (s.type === 'multi' && ok < 1) err.push(where + 'ステップ' + (i + 1) + 'に正解がない');
          if (!['one', 'multi'].includes(s.type)) err.push(where + 'ステップ' + (i + 1) + 'の type が不正');
        });
      } else if (q.kind === 'oral') {
        if (!q.turns || !q.turns.length) { err.push(where + 'turns がない'); continue; }
        q.turns.forEach((t, i) => { if ((t.options || []).filter(o => o[1] === true).length !== 1) err.push(where + '質問' + (i + 1) + 'の正解が1つでない'); });
      }
    }
    if (err.length) console.warn('[士業クエスト] データの問題:\n' + err.join('\n'));
    return err;
  };

  /* ---------- 小物 ---------- */
  SQ.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  SQ.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SQ.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  SQ.fmtTime = sec => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0'); };
  SQ.round1 = v => Math.round(v * 10) / 10;
})();
