/* 士業ドパミンクエスト — 採点と本試験ロードの進行
 * 問題の正解・配点は乱数で加工しない。
 * 1問ごとの配点は本番どおり（予備試験 2点・3点、会計士 5点・6点、司法書士 3点、弁理士 1点）。
 * 採点区分ごとの得点率に本番の配点を掛けて「本番換算」する（収録問題は本番より少ないため）。
 * 収録問題がない採点区分は判定から外し、その旨を結果画面に出す。
 */
(function () {
  'use strict';
  const SQ = window.SQ;

  SQ.poolOf = (examId, stageId, secId) => SQ.Q.filter(q => q.exam === examId && q.stage === stageId && (!secId || q.sec === secId));
  SQ.secOf = q => { const st = SQ.stage(q.exam, q.stage); return st && st.sections.find(s => s.id === q.sec); };
  SQ.paperOf = q => { const st = SQ.stage(q.exam, q.stage); return (st && st.paper) || null; };
  SQ.styleOf = q => { const p = SQ.paperOf(q); return p ? p.style : ''; };

  /* ---------- 1問の配点（本番の問題冊子に書かれる点数） ---------- */
  SQ.ptsOf = function (q) {
    if (q.pts) return q.pts;
    if (q.kind !== 'mcq') return 0; // 論文・記述・口述は採点区分の配点を問題数で割る（newRun）
    switch (SQ.styleOf(q)) {
      case 'yobi': return q.sec === 'kyoyo' ? 3 : (q.form === 'tf' && q.st.length >= 3 ? 3 : 2);
      case 'cpa': return q.sec === 'zaimu' ? 6 : q.sec === 'kanri' ? (q.form === 'pick' ? 6 : 5) : 5;
      case 'shoshi': return 3;
      case 'benri': return 1;
      default: return 1;
    }
  };

  /* ---------- 1回分の挑戦（ラン）を作る ---------- */
  // opt: { exam, stage, mode: 'road' | 'practice', ids?: [...], label? }
  SQ.newRun = function (opt) {
    const stage = opt.stage ? SQ.stage(opt.exam, opt.stage) : null;
    const paper = stage && stage.paper;
    let qs;
    if (opt.ids) qs = opt.ids.map(id => SQ.byId[id]).filter(Boolean);
    else if (paper) qs = paperOrder(stage);
    else qs = stage.sections.flatMap(sec => SQ.poolOf(opt.exam, stage.id, sec.id));

    // 時限（本番の時間割）。収録問題がある時限だけを残す
    let periods = [];
    const pidOf = q => (q.period && paper.periods.some(p => p.id === q.period)) ? q.period : (paper.periods.find(p => p.secs.includes(q.sec)) || paper.periods[0]).id;
    if (paper) {
      periods = paper.periods.filter(p => qs.some(q => pidOf(q) === p.id)).map(p => Object.assign({}, p, { from: -1, to: -1 }));
    }
    const slots = qs.map(q => Object.assign({ id: q.id, q, pno: 0, no: 0, boxes: [], pts: 0, max: 1 }, blankItem()));
    slots.forEach((it, i) => {
      if (paper) {
        it.pno = periods.findIndex(p => p.id === pidOf(it.q));
        const p = periods[it.pno];
        if (p.from < 0) p.from = i;
        p.to = i;
      }
    });
    numberItems(slots, periods, !!paper);

    // 配点：択一は本番の1問の点数、論文・口述は採点区分の配点を収録問題数で割る
    const count = {};
    slots.forEach(it => { const k = it.q.exam + '/' + it.q.stage + '/' + it.q.sec; count[k] = (count[k] || 0) + 1; });
    slots.forEach(it => {
      const sec = SQ.secOf(it.q), k = it.q.exam + '/' + it.q.stage + '/' + it.q.sec;
      it.pts = SQ.ptsOf(it.q) || (sec ? sec.points / count[k] : 1);
    });
    // 本番換算の重み：採点区分の配点を、収録問題の配点の比で分ける
    if (stage) {
      const sum = {};
      slots.forEach(it => { sum[it.q.sec] = (sum[it.q.sec] || 0) + it.pts; });
      slots.forEach(it => { const sec = SQ.secOf(it.q); it.max = sec.points * it.pts / sum[it.q.sec]; });
    }
    // 一般教養の選択：本番は44題から20題。収録数に比例させて選ぶ題数を決める（最低1題）
    const select = {};
    periods.forEach(p => {
      if (!p.select) return;
      p.secs.forEach(secId => {
        const k = slots.filter(it => it.q.sec === secId).length;
        if (k) select[secId] = Math.max(1, Math.min(k, Math.round(k * p.select.pick / p.select.of)));
      });
    });

    // 制限時間はない。elapsed は止まっていない間だけ数えた秒数（結果画面に出す）。pElapsed は時限ごと。
    // opened: 表紙（注意事項）を閉じて解き始めた時限。本試験モードでは curP より前の時限は回収済み（解き直せない）
    const road = opt.mode === 'road';
    return {
      exam: opt.exam || null, stage: stage ? stage.id : null, mode: opt.mode || 'practice', label: opt.label || '',
      items: slots, idx: 0, started: Date.now(), elapsed: 0,
      periods, select, opened: periods.map(() => !road), pElapsed: periods.map(() => 0), curP: 0,
      combo: 0, maxCombo: 0, get: 0, xp: 0, peeked: 0, interrupted: false, paused: false, lastJudge: null, finished: false
    };
  };

  // 本番の冊子の順：時限 → その時限の科目の順 → 会計士の管理会計論・財務会計論は理論問題が先 → 収録順
  function paperOrder(stage) {
    const out = [];
    const seen = new Set();
    stage.paper.periods.forEach(p => {
      p.secs.forEach(secId => {
        let qs = SQ.poolOf(SQ.examOfStage(stage), stage.id, secId).filter(q => !q.period || q.period === p.id);
        if (stage.paper.style === 'cpa') qs = qs.filter(q => q.form !== 'pick').concat(qs.filter(q => q.form === 'pick'));
        qs.forEach(q => { if (!seen.has(q.id)) { seen.add(q.id); out.push(q); } });
      });
    });
    // どの時限にも入らない問題（データの誤り）も落とさない
    stage.sections.forEach(sec => SQ.poolOf(SQ.examOfStage(stage), stage.id, sec.id).forEach(q => { if (!seen.has(q.id)) { seen.add(q.id); out.push(q); } }));
    return out;
  }
  SQ.examOfStage = stage => (SQ.EXAMS.find(e => e.stages.includes(stage)) || {}).id;

  // 問題番号と解答欄番号（本番の冊子の付け方）
  //   予備試験  ：時限の冊子ごとに〔第1問〕から通し番号。解答欄［No.］も時限ごとに1から。各記述の正誤（tf）は記述ごとに1欄
  //   会計士    ：科目（時限）ごとに 問題1 から
  //   司法書士  ：部ごとに 第1問 から。記述式は 第36問・第37問（問題に no を書く）
  //   弁理士    ：科目ごとに【特許・実用新案】1 から
  //   ドリルなど：出題順の通し番号
  function numberItems(slots, periods, byPaper) {
    const box = {}, cnt = {};
    slots.forEach((it, i) => {
      const q = it.q, style = SQ.styleOf(q);
      if (!byPaper) {
        it.no = i + 1;
        const b = (box.all = (box.all || 0));
        const n = q.kind === 'mcq' && q.form === 'tf' ? q.st.length : 1;
        it.boxes = Array.from({ length: n }, (_, k) => b + k + 1);
        box.all = b + n;
        return;
      }
      const key = style === 'benri' ? 'sec:' + q.sec : 'p:' + it.pno;
      if (q.no) it.no = q.no;
      else { cnt[key] = (cnt[key] || 0) + 1; it.no = cnt[key]; }
      const bk = 'p:' + it.pno, b = box[bk] || 0;
      const n = q.kind === 'mcq' && q.form === 'tf' ? q.st.length : 1;
      it.boxes = Array.from({ length: n }, (_, k) => b + k + 1);
      box[bk] = b + n;
    });
  }

  const ITEM_KEYS = ['ans', 'score', 'done', 'flag', 'step', 'stepAns', 'stepScore', 'stepView', 'turn', 'tries', 'turnScore', 'started', 'oralPhase', 'wrongPick', 'lastPick', 'react', 'revealed', 'sel'];
  function blankItem() {
    return { ans: null, score: null, done: false, flag: false, step: 0, stepAns: [], stepScore: [], stepView: null, turn: 0, tries: 0, turnScore: [], started: false, oralPhase: null, wrongPick: null, lastPick: null, react: '', revealed: false, sel: false };
  }

  /* ---------- 中断と再開（このブラウザに保存） ---------- */
  const RUN_KEYS = ['exam', 'stage', 'mode', 'label', 'idx', 'started', 'elapsed', 'combo', 'maxCombo', 'get', 'xp', 'peeked', 'interrupted', 'lastJudge', 'opened', 'pElapsed', 'curP'];
  SQ.saveRun = function (run) {
    const d = { v: 1, ids: run.items.map(it => it.id), items: run.items.map(it => { const o = {}; ITEM_KEYS.forEach(k => { o[k] = it[k]; }); return o; }) };
    RUN_KEYS.forEach(k => { d[k] = run[k]; });
    return JSON.parse(JSON.stringify(d));
  };
  // 問題が消えていたり、構成が変わっていたら null（再開できない）
  SQ.loadRun = function (d) {
    try {
      if (!d || d.v !== 1 || !Array.isArray(d.ids) || !d.ids.length || d.ids.some(id => !SQ.byId[id])) return null;
      if (d.stage && !SQ.stage(d.exam, d.stage)) return null;
      const run = SQ.newRun({ exam: d.exam, stage: d.stage, mode: d.mode, ids: d.ids, label: d.label });
      RUN_KEYS.forEach(k => { if (d[k] !== undefined) run[k] = d[k]; });
      run.items.forEach((it, i) => { const o = d.items[i] || {}; ITEM_KEYS.forEach(k => { if (o[k] !== undefined) it[k] = o[k]; }); });
      const n = run.periods.length;
      const fix = (a, def) => Array.from({ length: n }, (_, i) => (Array.isArray(a) && a[i] !== undefined ? a[i] : def));
      run.opened = fix(run.opened, run.mode !== 'road');
      run.pElapsed = fix(run.pElapsed, 0).map(v => (Number.isFinite(v) && v >= 0 ? v : 0));
      run.idx = SQ.clamp(Math.floor(run.idx) || 0, 0, run.items.length - 1);
      run.curP = SQ.clamp(Math.floor(run.curP) || 0, 0, Math.max(0, n - 1));
      // 時限のなかった版（v0.2.0）で中断した挑戦：開いていた問題の時限を「今の時限」にし、それより前の時限は解き始めた扱いにする
      if (n && run.mode === 'road') {
        const p = run.items[run.idx].pno;
        if (d.curP === undefined) run.curP = p;
        run.curP = Math.max(run.curP, p);
        if (!Array.isArray(d.opened)) run.opened = run.opened.map((v, i) => i < run.curP);
      }
      run.elapsed = Number.isFinite(run.elapsed) && run.elapsed >= 0 ? run.elapsed : 0;
      run.paused = false; run.finished = false;
      return run;
    } catch (e) { return null; }
  };

  /* ---------- 採点 ---------- */
  // 各記述の正誤（tf）は、全部合えば満点。部分点は予備試験の「正解及び配点」（令和8年）どおり、3点の問題で
  //   解答欄3つ → 2つ正解で1点（3分の1）、解答欄4つ → 3つ正解で2点（3分の2）。それ以外は0点。
  //   部分点の基準は本番でも問題文には書かれない。
  SQ.TF_PARTIAL = { 3: { 2: 1 / 3 }, 4: { 3: 2 / 3 } };
  SQ.judgeMcq = function (q, ans) {
    if (q.form === 'tf') {
      const n = q.st.length;
      let ok = 0;
      q.st.forEach((s, i) => { if (ans && ans[i] === s[2]) ok++; });
      const part = (SQ.TF_PARTIAL[n] || {})[ok];
      return { score: ok === n ? 1 : (part || 0), ok, n };
    }
    const key = SQ.mcqKey(q);
    return { score: ans === key.answer ? 1 : 0, correct: key.answer };
  };

  SQ.judgeStep = function (step, ans) {
    if (step.type === 'one') return { score: step.options[ans] && step.options[ans][1] ? 1 : 0 };
    // 正解の拾い率から、余計に選んだ割合を引く（全部選ぶと0点、1つ正解・1つ余計なら部分点）
    const correct = step.options.filter(o => o[1]).length;
    const others = step.options.length - correct;
    const picked = ans || [];
    const hits = picked.filter(i => step.options[i][1]).length;
    const wrong = picked.length - hits;
    const score = Math.max(0, hits / correct - (others ? wrong / others : 0));
    return { score: score > 0.999 ? 1 : score, hits, wrong, total: correct };
  };

  SQ.caseScore = (q, stepScore) => {
    const tot = q.steps.reduce((a, s) => a + s.pts, 0);
    return q.steps.reduce((a, s, i) => a + s.pts * (stepScore[i] || 0), 0) / tot;
  };
  SQ.oralScore = (q, turnScore) => q.turns.reduce((a, t, i) => a + (turnScore[i] || 0), 0) / q.turns.length;

  // 一般教養の選択：選択欄にマークした問題のうち、問題番号の小さい方から指定題数までを採点する
  SQ.countedSet = function (run, secId) {
    const S = run.select[secId];
    if (!S) return null;
    const sel = run.items.filter(it => it.q.sec === secId && it.sel).sort((a, b) => a.no - b.no);
    return new Set(sel.slice(0, S));
  };

  /* ---------- 段階の合否判定 ---------- */
  const oral60 = r => r >= 0.999 ? 63 : r >= 0.8 ? 62 : r >= 0.66 ? 61 : r >= 0.5 ? 60 : r >= 0.33 ? 59 : r >= 0.16 ? 58 : r > 0 ? 57 : 56;
  const abc = r => r >= 0.8 ? 'A' : r >= 0.5 ? 'B' : 'C';
  SQ.rankOf = r => r >= 0.9 ? 'S' : r >= 0.8 ? 'A' : r >= 0.65 ? 'B' : r >= 0.5 ? 'C' : 'D';

  SQ.evalRun = function (run) {
    const answered = run.items.filter(it => it.done);
    const raw = run.items.reduce((a, it) => a + (it.score || 0), 0) / Math.max(1, run.items.length);
    // 素点：収録問題での本番どおりの点数（一般教養は採点される問題だけ）
    let rawGot = 0, rawMax = 0;
    const counted = {};
    Object.keys(run.select || {}).forEach(secId => { counted[secId] = SQ.countedSet(run, secId); });
    run.items.forEach(it => {
      const set = counted[it.q.sec];
      if (set) return;
      rawGot += (it.score || 0) * it.pts; rawMax += it.pts;
    });
    Object.keys(counted).forEach(secId => {
      const set = counted[secId], S = run.select[secId];
      const pts = (run.items.find(it => it.q.sec === secId) || {}).pts || 0;
      set.forEach(it => { rawGot += (it.score || 0) * it.pts; });
      rawMax += S * pts;
    });
    const base = {
      raw, answered: answered.length, total: run.items.length, rawGot, rawMax,
      perfect: run.items.filter(it => (it.score || 0) >= 0.999).length
    };
    if (!run.stage) return Object.assign(base, { practiceOnly: true, ratio: raw, rank: SQ.rankOf(raw) });

    const stage = SQ.stage(run.exam, run.stage), rule = stage.rule;
    const notes = [];
    const secs = stage.sections.map(sec => {
      const its = run.items.filter(it => it.q.sec === sec.id);
      if (!its.length) return { sec, included: false };
      const set = counted[sec.id];
      if (set) {
        const S = run.select[sec.id], pts = its[0].pts;
        const got = Array.from(set).reduce((a, it) => a + (it.score || 0) * pts, 0);
        const nsel = its.filter(it => it.sel).length;
        notes.push(sec.name + '：' + its.length + '題中' + S + '題を選んで解答（本番は' + stage.paper.periods.find(p => p.secs.includes(sec.id)).select.of + '題中' + stage.paper.periods.find(p => p.secs.includes(sec.id)).select.pick + '題）。選択欄にマークしたのは' + nsel + '題' +
          (nsel > S ? '。指定題数を超えたので、問題番号の小さい方から' + S + '題を採点しました。' : nsel < S ? '。選んでいない分は0点です。' : '。'));
        return { sec, included: true, ratio: got / (S * pts), got, max: S * pts, n: its.length, sel: nsel };
      }
      const max = its.reduce((a, it) => a + it.max, 0);
      const got = its.reduce((a, it) => a + (it.score || 0) * it.max, 0);
      return { sec, included: true, ratio: got / max, got, max, n: its.length };
    });
    const inc = secs.filter(s => s.included);
    const P = inc.reduce((a, s) => a + s.sec.points, 0);
    const E = inc.reduce((a, s) => a + s.ratio * s.sec.points, 0);
    const ratio = P ? E / P : 0;
    const fullPts = stage.sections.reduce((a, s) => a + s.points, 0);
    const res = Object.assign(base, { secs, ratio, rank: SQ.rankOf(ratio), missing: secs.filter(s => !s.included).map(s => s.sec.name), notes });

    switch (rule.type) {
      case 'total': {
        res.of = rule.of; res.score = ratio * rule.of; res.line = rule.line; res.lineRatio = rule.line / rule.of;
        res.pass = res.score >= rule.line;
        res.unit = '点';
        inc.forEach(s => { s.show = s.ratio * s.sec.points; s.of = s.sec.points; });
        break;
      }
      case 'ratio': {
        const of = rule.of || fullPts;
        const lineRatio = rule.lineAbs ? rule.lineAbs / of : rule.line;
        res.of = of; res.score = ratio * of; res.line = lineRatio * of; res.lineRatio = lineRatio; res.unit = '点';
        let floorsOk = true;
        inc.forEach(s => {
          s.show = s.ratio * s.sec.points; s.of = s.sec.points;
          if (rule.floor != null) { s.floor = rule.floor; s.ok = s.ratio >= rule.floor; if (!s.ok) floorsOk = false; }
        });
        res.pass = ratio >= lineRatio && floorsOk;
        if (!floorsOk) res.notes.push('満点の' + Math.round(rule.floor * 100) + '%に届かない科目があります（足切り）。');
        break;
      }
      case 'parts': {
        let partsOk = true;
        inc.forEach(s => {
          const part = rule.parts.find(p => p.sec === s.sec.id);
          s.show = s.ratio * s.sec.points; s.of = s.sec.points;
          if (part) { s.floor = part.line / part.of; s.floorLabel = '基準点 ' + part.line; s.ok = s.show >= part.line; if (!s.ok) partsOk = false; }
        });
        res.of = rule.total.of; res.score = ratio * rule.total.of; res.line = rule.total.line; res.lineRatio = rule.total.line / rule.total.of; res.unit = '点';
        res.pass = partsOk && res.score >= rule.total.line;
        if (!partsOk) res.notes.push('基準点に届かない部があります。合計点が高くても不合格です。');
        break;
      }
      case 'oral60': {
        let sum = 0;
        inc.forEach(s => { s.show = oral60(s.ratio); s.of = 63; s.grade = s.show + '点'; sum += s.show; });
        const line = rule.line * inc.length / stage.sections.length;
        res.of = 63 * inc.length; res.score = sum; res.line = line; res.lineRatio = line / res.of; res.unit = '点';
        res.pass = sum >= line;
        res.notes.push('各科目は60点を基準に、57〜63点で評価（本アプリの換算）。');
        break;
      }
      case 'benri': {
        let wsum = 0, w = 0, floorOk = true;
        inc.forEach(s => {
          s.show = s.ratio * 100; s.of = 100; s.floor = rule.floor / 100; s.floorLabel = rule.floor + '点';
          s.ok = s.show >= rule.floor; if (!s.ok) floorOk = false;
          wsum += s.show * (s.sec.weight || 1); w += (s.sec.weight || 1);
        });
        res.of = 100; res.score = w ? wsum / w : 0; res.line = rule.line; res.lineRatio = rule.line / 100; res.unit = '点（平均）';
        res.pass = res.score >= rule.line && floorOk;
        if (!floorOk) res.notes.push(rule.floor + '点未満の科目があります。');
        break;
      }
      case 'abc': {
        let cs = 0;
        inc.forEach(s => { s.grade = abc(s.ratio); s.show = s.ratio * 100; s.of = 100; s.ok = s.grade !== 'C'; if (s.grade === 'C') cs++; });
        res.of = 100; res.score = ratio * 100; res.line = null; res.unit = '%';
        res.pass = cs < 2;
        res.abc = inc.map(s => s.grade).join(' ');
        res.notes.push('C評価が2科目以上あると不合格。C評価は ' + cs + ' 科目。');
        break;
      }
    }
    if (res.missing.length) res.notes.push('収録問題がまだない区分（' + res.missing.join('・') + '）は判定から外しています。');
    return res;
  };

  /* ---------- 本試験ロード ---------- */
  // road = { year, stage, exempt: {段階id: 残り年数}, pending: {...}, log: [...], wins, best }
  SQ.road = function (examId) {
    const S = SQ.store.S;
    if (!S.roads[examId]) S.roads[examId] = { year: 1, stage: 0, exempt: {}, pending: {}, log: [], wins: 0, best: -1 };
    return S.roads[examId];
  };
  const isExempt = (r, exam, i) => i < exam.stages.length - 1 && (r.exempt[exam.stages[i].id] || 0) > 0;
  function skipExempt(r, exam, i) { while (isExempt(r, exam, i)) i++; return i; }
  function newYear(r, exam) {
    r.year++;
    Object.keys(r.exempt).forEach(k => { r.exempt[k] = Math.max(0, r.exempt[k] - 1); if (!r.exempt[k]) delete r.exempt[k]; });
    Object.assign(r.exempt, r.pending || {});
    r.pending = {};
    r.stage = skipExempt(r, exam, 0);
  }

  // 本試験モードの結果をロードに反映し、起きたこと（'next' / 'final' / 'fail'）を返す
  SQ.roadApply = function (examId, stageId, res) {
    const exam = SQ.exam(examId), r = SQ.road(examId);
    const i = exam.stages.findIndex(s => s.id === stageId);
    r.log.push({ year: r.year, stage: stageId, pass: !!res.pass, score: SQ.round1(res.score || 0), of: res.of, abc: res.abc || null, at: Date.now() });
    if (r.log.length > 200) r.log.splice(0, r.log.length - 200);
    if (res.pass) {
      r.best = Math.max(r.best, i);
      if (exam.carry && exam.carry[stageId]) r.pending[stageId] = exam.carry[stageId];
      if (i === exam.stages.length - 1) {
        r.wins++; r.lastWin = Date.now();
        r.exempt = {}; r.pending = {}; r.year++; r.stage = 0;
        return 'final';
      }
      r.stage = skipExempt(r, exam, i + 1);
      return 'next';
    }
    newYear(r, exam);
    return 'fail';
  };
  SQ.exemptText = function (examId) {
    const exam = SQ.exam(examId), r = SQ.road(examId);
    return Object.keys(r.exempt).filter(k => r.exempt[k] > 0).map(k => {
      const st = exam.stages.find(s => s.id === k);
      return (st ? st.name : k) + ' 免除（あと' + r.exempt[k] + '年）';
    }).join('・');
  };
})();
