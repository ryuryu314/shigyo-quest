/* 士業ドパミンクエスト — 画面と進行
 * 画面: home / exam（本試験ロード）/ run（挑戦中）/ result / records。設定・使い方・一時停止はモーダル。
 * 簿記ドパミンクエストの本番模試モードに合わせる:
 *   - 制限時間・カウントダウンはない。かかった時間（止まっている間は数えない）を結果に出す
 *   - 「解答を見る」で、問題の隣（スマホは問題の下）に解答を出したままにする。見た問題は記録に入れない
 *   - 「かんたんに言うと」はいつも表示
 *   - 2分間操作がなければ一時停止。中断した挑戦はこのブラウザに保存して、ホームから続きを解ける
 *   - 下に固定したマークシートで、スクロールせずに解答して次の問題へ
 * 本試験モード: 「次へ進む」で答え合わせして次へ。結果でロードが進む。
 * 練習モード  : 1問ごとに解説。ロードは進まない。
 */
(function () {
  'use strict';
  const SQ = window.SQ, FX = SQ.fx, esc = SQ.esc;
  const app = document.getElementById('app'), modalRoot = document.getElementById('modal-root');
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const $ = s => document.querySelector(s);
  const wide = window.matchMedia('(min-width: 801px)');
  const IDLE = 120000;
  let S = SQ.store.load();
  let view = { name: 'home', p: {} };
  let run = null, last = null, pendingStart = null, modalDismiss = null;
  let autoTimer = 0, lastTick = Date.now(), idleAt = Date.now(), saveTick = 0;

  /* ================= 画面遷移 ================= */
  function go(name, p, replace) {
    view = { name, p: p || {} };
    try { replace ? history.replaceState({ name, p: view.p }, '') : history.pushState({ name, p: view.p }, ''); } catch (e) { /* file:// などでも動かす */ }
    render();
  }
  function render() {
    if (view.name === 'run') return renderRun('top');
    const fn = SCREENS[view.name] || SCREENS.home;
    app.innerHTML = fn(view.p);
    const sh = app.querySelector('.shell'); if (sh) sh.scrollTop = 0;
    after();
  }
  addEventListener('popstate', ev => {
    if (run && !run.finished && view.name === 'run') {
      try { history.pushState({ name: 'run', p: {} }, ''); } catch (e) { /* noop */ }
      pause('manual');
      return;
    }
    const st = ev.state || { name: 'home', p: {} };
    closeModal(false);
    view = { name: st.name === 'run' ? 'home' : st.name, p: st.p || {} };
    render();
  });

  function hdr(back) {
    return `<header class="hdr">
      <button class="brand" data-act="home" aria-label="ホームへ"><span class="mark">士</span><span class="bname">士業ドパミンクエスト</span></button>
      <div class="tools">${back ? '<button data-act="home">ホーム</button>' : '<span class="pill">骨子版 v' + SQ.VERSION + '</span>'}<button data-act="settings">設定</button></div>
    </header>`;
  }
  function foot() {
    return `<footer class="foot">
      <p>本アプリは非公式の学習用ゲームです。法務省・公認会計士・監査審査会・特許庁など、試験の実施機関とは関係ありません。問題はすべて独自に作成したもので、2026年11月時点の法令・基準をもとにしていますが、正確さや最新性は保証しません。配点・合格点は公表資料をもとにした目安で、本番の採点を再現するものではありません。受験の際は必ず公式の情報を確認してください。</p>
      <p>外部通信・広告なし。記録はこのブラウザの中だけに保存されます（設定から書き出せます）。</p>
    </footer>`;
  }
  const daysUntil = d => { const t = new Date(d + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((t - n) / 86400000); };
  const fmtPts = v => (Math.round(v * 10) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  const span = sec => { const m = Math.round(sec / 60); return sec < 60 ? '1分未満' : m < 60 ? m + '分' : Math.floor(m / 60) + '時間' + (m % 60 ? m % 60 + '分' : ''); };

  /* ================= 中断した挑戦のカード ================= */
  function suspendedInfo() {
    const d = S.suspended;
    if (!d) return null;
    const name = d.stage ? SQ.exam(d.exam).short + ' · ' + SQ.stage(d.exam, d.stage).name + (d.mode === 'road' ? '（本試験モード）' : '（練習）') : d.label;
    return { d, name, done: d.items.filter(i => i.done).length, total: d.ids.length };
  }
  function resumeCard(examId) {
    const s = suspendedInfo();
    if (!s || (examId && s.d.exam !== examId)) return '';
    return `<div class="panel resume"><div><strong>中断した挑戦があります</strong><p class="muted">${esc(s.name)} · 解答済み ${s.done} / ${s.total}問 · ここまで ${span(s.d.elapsed || 0)}</p></div>
      <div class="actions"><button class="primary" data-act="resumeRun">続きを解く →</button><button data-act="discardRun">破棄</button></div></div>`;
  }

  /* ================= ホーム ================= */
  function stageState(e, r, i) {
    if (i < r.stage) return (r.exempt[e.stages[i].id] || 0) > 0 ? 'ex' : 'done';
    return i === r.stage ? 'now' : 'lock';
  }
  function examCard(e, i) {
    const r = SQ.road(e.id), cur = e.stages[r.stage];
    const path = e.stages.map((s, k) => `<span class="node ${stageState(e, r, k)}">${esc(s.name)}</span>`).join('<span class="lnk">→</span>') +
      `<span class="lnk">→</span><span class="node goal ${r.wins ? 'won' : ''}">🏆${r.wins ? '×' + r.wins : ''}</span>`;
    const n = SQ.Q.filter(q => q.exam === e.id).length;
    return `<button class="ecard" data-act="exam" data-id="${e.id}" style="--ec:${e.color};--et:${e.tint};animation-delay:${i * 0.05}s">
      <span class="eicon">${esc(e.icon)}</span><span class="arrow">↗</span>
      <strong class="ename">${esc(e.name)}</strong>
      <small class="egoal">${esc(e.goal)}</small>
      <span class="path">${path}</span>
      <small class="emeta">第${r.year}回目の挑戦 · 次は <b>${esc(cur.name)}</b> · 収録 ${n}問</small>
    </button>`;
  }
  function scrHome() {
    const L = SQ.levelOf(S.xp), today = SQ.todayCount(), goal = S.set.goal, streak = SQ.streak();
    const weak = SQ.weakIds().length;
    return `<div class="shell"><div class="wrap">
      ${hdr(false)}
      <section class="hero">
        <div>
          <p class="kicker">STUDY · STAGE · PASS</p>
          <h1>本番の流れで、<br><em>一段ずつ</em>合格へ。</h1>
          <p class="sub">予備試験・公認会計士・司法書士・弁理士。短答から口述まで、本試験の段階をそのままステージにした練習ゲーム · 非公式</p>
        </div>
        <div class="panel lvcard">
          <div class="lvtop">
            <div class="orb"><small>LEVEL</small><b>${L.lv}</b></div>
            <div class="lvinfo"><small class="muted">いまの称号</small><strong>${esc(SQ.titleOf(L.lv))}</strong>
              <div class="meter"><i style="width:${(L.into / L.need * 100).toFixed(1)}%"></i></div>
              <small class="muted">次のレベルまで ${L.need - L.into} XP</small></div>
          </div>
          <div class="goalrow ${today >= goal ? 'done' : ''}"><span>今日の目標 <b>${today}</b> / ${goal} 問</span><span><b>${streak}</b> 日継続</span></div>
        </div>
      </section>
      ${resumeCard()}
      <div class="sectitle"><h2>本試験ロード</h2><span class="muted">収録 ${SQ.Q.length}問 · 骨子版</span></div>
      <div class="exams">${SQ.EXAMS.map(examCard).join('')}</div>
      <div class="sectitle"><h2>トレーニング</h2></div>
      <div class="cards">
        <button class="card featured" data-act="drill"><span class="icon">✦</span><strong>一問一答ラッシュ</strong><small>択一からランダムに10問。解説つきでテンポよく。</small><span class="arrow">↗</span></button>
        <button class="card" data-act="weak" ${weak ? '' : 'disabled'}><span class="icon">↻</span><strong>苦手をほどく</strong><small>${weak ? '間違えた ' + weak + ' 問を、次の得点へ。' : 'まだ間違えた問題はありません。'}</small><span class="arrow">↗</span></button>
        <button class="card" data-act="records"><span class="icon">▥</span><strong>学習の記録</strong><small>正答率・挑戦の歴史・合格証。</small><span class="arrow">↗</span></button>
        <button class="card" data-act="help"><span class="icon">？</span><strong>使い方</strong><small>遊び方と、収録内容についての注意。</small><span class="arrow">↗</span></button>
      </div>
      ${foot()}
    </div></div>`;
  }

  /* ================= 本試験ロード（試験ごとの画面） ================= */
  function stagePanel(e, s, i, r) {
    const pool = SQ.poolOf(e.id, s.id);
    const chips = s.sections.map(sec => {
      const n = SQ.poolOf(e.id, s.id, sec.id).length;
      const pts = s.kind === 'oral' ? '' : ' <b>' + sec.points + '</b>';
      return `<span class="chip ${n ? '' : 'off'}">${esc(sec.name)}${pts}${n ? ' <i>' + n + '問</i>' : ' <i>準備中</i>'}</span>`;
    }).join('');
    const best = S.best[e.id + '.' + s.id];
    const state = stageState(e, r, i);
    const label = { done: '突破', ex: '免除中', now: '挑戦中', lock: '未到達' }[state];
    return `<div class="panel stage ${state}" style="--ec:${e.color};--et:${e.tint}">
      <div class="sthead"><span class="sno">STAGE ${i + 1}</span><h3>${esc(s.name)}</h3><span class="when">${esc(s.when)}</span><span class="stbadge ${state}">${label}</span></div>
      <p class="lead">${esc(s.lead)}</p>
      <div class="chips">${chips}</div>
      <p class="rule"><b>合格ライン</b> ${esc(s.rule.label)}</p>
      <p class="mini">収録 ${pool.length}問 · 時間制限なし${best ? ' · ベスト ' + Math.round(best.ratio * 100) + '%' + (best.pass ? '（合格判定）' : '') : ''}</p>
      <details class="facts"><summary>本番データ</summary><ul>${s.facts.map(f => '<li>' + esc(f) + '</li>').join('')}</ul></details>
      <div class="actions"><button data-act="practice" data-exam="${e.id}" data-stage="${s.id}" ${pool.length ? '' : 'disabled'}>練習モード（解説つき）</button></div>
    </div>`;
  }
  function roadLog(e, r) {
    if (!r.log.length) return '<p class="muted empty">まだ挑戦の記録はありません。まずは STAGE 1 から。</p>';
    const years = {};
    r.log.forEach(l => { (years[l.year] = years[l.year] || []).push(l); });
    return '<div class="loglist">' + Object.keys(years).sort((a, b) => b - a).slice(0, 8).map(y => {
      const row = years[y].map(l => {
        const st = e.stages.find(s => s.id === l.stage);
        const sc = l.abc ? l.abc : fmtPts(l.score) + (l.of ? ' / ' + l.of : '');
        return `<span class="lg ${l.pass ? 'ok' : 'ng'}">${esc(st ? st.name : l.stage)} ${esc(sc)} ${l.pass ? '◯' : '✕'}</span>`;
      }).join('<span class="lnk">→</span>');
      return `<div class="logrow"><b>第${y}回</b>${row}</div>`;
    }).join('') + '</div>';
  }
  function scrExam(p) {
    const e = SQ.exam(p.id);
    if (!e) return scrHome();
    const r = SQ.road(e.id), cur = e.stages[r.stage];
    const target = S.targets[e.id] || '';
    const dd = target ? daysUntil(target) : null;
    const nodes = e.stages.map((s, i) => `<div class="rnode ${stageState(e, r, i)}"><span class="rno">STAGE ${i + 1}</span><b>${esc(s.name)}</b><small>${esc(s.when)}</small></div>`).join('<span class="rlink"></span>') +
      `<span class="rlink"></span><div class="rnode goal ${r.wins ? 'won' : ''}"><span class="rno">GOAL</span><b>🏆</b><small>${r.wins ? '合格 ' + r.wins + '回' : esc(e.badge)}</small></div>`;
    const ex = SQ.exemptText(e.id);
    return `<div class="shell"><div class="wrap">
      ${hdr(true)}
      ${resumeCard(e.id)}
      <section class="ehero panel" style="--ec:${e.color};--et:${e.tint}">
        <p class="kicker">ROAD · ${esc(e.org)}</p>
        <h1><span class="eicon">${esc(e.icon)}</span>${esc(e.name)}</h1>
        <p class="sub">${esc(e.goal)}</p>
        <div class="roadline">${nodes}</div>
        <p class="roadstat">第${r.year}回目の挑戦${r.wins ? ' · これまでの合格 ' + r.wins + '回' : ''}${ex ? ' · ' + esc(ex) : ''}</p>
        <button class="primary big" data-act="road" data-exam="${e.id}">▶ STAGE ${r.stage + 1}「${esc(cur.name)}」に挑む<small>本試験モード · 時間制限なし · 結果でロードが進む</small></button>
        <div class="target"><label>受験予定日 <input type="date" data-act="target" data-exam="${e.id}" value="${esc(target)}"></label>
          <span class="${dd != null && dd >= 0 && dd <= 30 ? 'soon' : ''}">${dd == null ? '日付を入れると、本番までの日数を出します' : dd > 0 ? '本番まで あと <b>' + dd + '</b> 日' : dd === 0 ? '<b>本番当日</b>' : '予定日を過ぎています'}</span></div>
      </section>
      <div class="sectitle"><h2>ステージ</h2><span class="muted">本番の段階・配点・合格ラインを再現</span></div>
      <div class="stages">${e.stages.map((s, i) => stagePanel(e, s, i, r)).join('')}</div>
      <div class="sectitle"><h2>挑戦の記録</h2></div>
      <div class="panel">${roadLog(e, r)}</div>
      ${foot()}
    </div></div>`;
  }

  /* ================= 挑戦中 ================= */
  const cur = () => run.items[run.idx];
  const FORM = { one: '5肢択一', combo: '組合せ', count: '個数問題', pick: '計算', tf: '各肢の正誤' };
  const diamonds = lv => '◆'.repeat(lv || 1);
  const road = () => run.mode === 'road';
  const isLast = () => run.idx === run.items.length - 1;
  function runTitle() { return run.stage ? SQ.exam(run.exam).short + ' · ' + SQ.stage(run.exam, run.stage).name : run.label; }
  function comboTier() { return run.combo >= 10 ? 3 : run.combo >= 5 ? 2 : run.combo >= 3 ? 1 : 0; }
  function tagOf(q, kindName) {
    const sec = SQ.secOf(q);
    const ex = run.stage ? '' : SQ.exam(q.exam).short + ' · ';
    return ex + [q.subj || (sec ? sec.name : ''), kindName, diamonds(q.lv)].filter(Boolean).join(' · ');
  }
  const easyBox = q => `<div class="easy"><p class="eh">🔰 かんたんに言うと</p><p>${esc(SQ.easyOf(q))}</p></div>`;

  function scrRun() {
    const it = cur(), e = SQ.exam(it.q.exam);
    const docked = it.revealed && it.dock && !it.done;
    const chips = run.items.map((s, i) => {
      let c = i === run.idx ? 'cur ' : '';
      if (s.done) c += s.score >= 0.999 ? 'ok' : s.score > 0 ? 'mid' : 'ng';
      else if (s.flag) c += 'flag';
      return `<button class="qc ${c}" data-act="nav" data-i="${i}" aria-label="問${i + 1}">${i + 1}</button>`;
    }).join('');
    let secnav = '';
    if (run.stage) {
      const stage = SQ.stage(run.exam, run.stage);
      secnav = '<div class="secnav">' + stage.sections.map(sec => {
        const its = run.items.map((s, i) => [s, i]).filter(([s]) => s.q.sec === sec.id);
        if (!its.length) return '';
        const done = its.filter(([s]) => s.done).length;
        return `<button class="${it.q.sec === sec.id ? 'on' : ''}" data-act="nav" data-i="${its[0][1]}">${esc(sec.name)} <small>${stage.kind === 'oral' ? '' : sec.points + '点 '}${done}/${its.length}</small></button>`;
      }).join('') + '</div>';
    }
    const answered = run.items.filter(s => s.done).length;
    return `<div class="shell runshell ${run.mode}"><div class="wrap runwrap ${docked ? 'docked' : ''}">
      <div class="runhdr">
        <div class="rl"><b>${esc(runTitle())}</b><small>${road() ? '本試験モード ·「次へ進む」で答え合わせ' : '練習モード · 1問ごとに解説'}</small></div>
        <div class="rr"><span class="qno">Q <b>${run.idx + 1}</b>/${run.items.length}</span><span class="done">解答 ${answered}</span><span class="get">GET <b id="get">${fmtPts(run.get)}</b></span><span class="combo" id="combo" data-tier="${comboTier()}">COMBO <b>${run.combo}</b></span><button class="small" data-act="pause">中断</button></div>
      </div>
      ${secnav}
      <div class="qnav">${chips}</div>
      ${lastJudgeHtml()}
      <div class="quizgrid ${docked ? 'docked' : ''}">
        <section class="qpanel kind-${it.q.kind}" id="qpanel" style="--ec:${e.color};--et:${e.tint}">${itemHtml(it)}</section>
        ${docked ? `<aside class="dock" id="dock" style="--ec:${e.color};--et:${e.tint}">${dockHtml(it)}</aside>` : ''}
      </div>
      <div class="markbar" id="markbar" style="--ec:${e.color};--et:${e.tint}">${markbarHtml(it)}</div>
    </div></div>`;
  }
  function itemHtml(it) {
    if (it.q.kind === 'case') return caseHtml(it);
    if (it.q.kind === 'oral') return oralHtml(it);
    return mcqHtml(it);
  }

  /* ---------- 直前の問題の正誤（本試験モード） ---------- */
  function lastJudgeHtml() {
    const j = run.lastJudge;
    if (!road() || !j || j.idx !== run.idx - 1) return '';
    const cls = j.score >= 0.999 ? 'ok' : j.score > 0 ? 'part' : 'ng';
    const what = j.kind === 'mcq' ? '' : j.kind === 'case' ? ' 答案' : ' 口述';
    const head = cls === 'ok' ? `◎ Q${j.idx + 1}${what} 正解${j.kind === 'mcq' ? ' <small>+' + fmtPts(j.got) + '点</small>' : ''}`
      : cls === 'part' ? `△ Q${j.idx + 1}${what} ${j.kind === 'mcq' ? '部分点 <small>+' + fmtPts(j.got) + ' / ' + fmtPts(j.pts) + '点</small>' : Math.round(j.score * 100) + '%'}`
        : `✕ Q${j.idx + 1}${what} ${j.kind === 'mcq' ? '不正解' : '0%'}`;
    return `<div class="lastjudge ${cls}" role="status"><b>${head}</b>${cls !== 'ok' && j.ans ? `<span class="lastans">正解 ▸ ${esc(j.ans)}</span>` : ''}<button class="small" data-act="nav" data-i="${j.idx}">解説を見る</button></div>`;
  }
  function answerText(q) {
    if (q.kind !== 'mcq') return '';
    if (q.form === 'tf') return q.st.map(s => s[0] + (s[2] ? '1' : '2')).join(' ');
    const k = SQ.mcqKey(q), c = k.choices[k.answer];
    return c.no + '　' + c.text;
  }

  /* ---------- 択一 ---------- */
  function canCommit(it) {
    if (it.q.form === 'tf') return Array.isArray(it.ans) && it.q.st.every((s, i) => typeof it.ans[i] === 'boolean');
    return it.ans != null;
  }
  function mcqHtml(it) {
    const q = it.q, key = SQ.mcqKey(q), done = it.done;
    let body = '';
    if (q.form === 'tf') {
      body = '<ol class="stl tf">' + q.st.map((s, i) => {
        const a = it.ans ? it.ans[i] : undefined;
        const res = done ? (a === s[2] ? 'ok' : 'ng') : '';
        return `<li class="${res}"><div class="sttext"><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>
          <div class="tfbtns"><button class="tfb ${a === true ? 'on' : ''}" data-act="tf" data-i="${i}" data-v="1" ${done ? 'disabled' : ''}>1 正しい</button><button class="tfb ${a === false ? 'on' : ''}" data-act="tf" data-i="${i}" data-v="0" ${done ? 'disabled' : ''}>2 誤り</button></div>
          ${done ? `<p class="stnote"><b>${s[2] ? '正しい' : '誤り'}</b>　${esc(s[3] || '')}</p>` : ''}</li>`;
      }).join('') + '</ol>';
    } else {
      if (q.form === 'combo' || q.form === 'count') body += '<ol class="stl">' + q.st.map(s => `<li><div class="sttext"><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div></li>`).join('') + '</ol>';
      body += `<div class="choices ${q.form === 'one' ? 'long' : 'short'}">` + key.choices.map((c, i) => {
        let cls = it.ans === i ? 'sel' : '';
        if (done) cls += i === key.answer ? ' right' : it.ans === i ? ' wrong' : '';
        return `<button class="choice ${cls}" data-act="pick" data-i="${i}" ${done ? 'disabled' : ''}><b>${c.no}</b><span>${esc(c.text)}</span></button>`;
      }).join('') + '</div>';
    }
    return `<p class="qtag">${esc(tagOf(q, FORM[q.form]))}</p><h3 class="qtitle">${esc(q.title)}</h3>
      <p class="qtext ${q.en ? 'en' : ''}">${esc(q.q)}</p>
      ${easyBox(q)}
      ${body}
      <div class="fbhost" id="fb">${done ? feedbackMcq(it) : ''}</div>`;
  }
  function mcqKeyHtml(q) {
    const key = SQ.mcqKey(q);
    let h = `<p class="ans">正解：${esc(answerText(q))}</p>`;
    if (q.form !== 'pick') h += '<ul class="notes">' + q.st.map((s, i) => `<li><b>${esc(key.labels[i])}</b><span class="tfmark ${s[2] ? 'o' : 'x'}">${s[2] ? '◯' : '✕'}</span><span>${esc(s[3] || '')}</span></li>`).join('') + '</ul>';
    if (q.e) h += `<p class="exp">${esc(q.e)}</p>`;
    return h;
  }
  function feedbackMcq(it) {
    const ok = it.score >= 0.999, mid = !ok && it.score > 0;
    return `<div class="feedback ${ok ? '' : 'wrong'}"><h4>${ok ? '正解！' : mid ? '惜しい！ 部分点' : '伸びしろ発見'}</h4>${mcqKeyHtml(it.q)}</div>`;
  }

  /* ---------- 論文・記述 ---------- */
  function sheetLine(s, a) {
    if (s.type === 'multi') return (a || []).map(i => s.options[i][0]).join('／') || '（なし）';
    return a != null ? s.options[a][0] : '';
  }
  const markOf = sc => sc == null ? '' : `<span class="mk ${sc >= 0.999 ? 'ok' : sc > 0 ? 'mid' : 'ng'}">${sc >= 0.999 ? '◯' : sc > 0 ? '△' : '✕'}</span>`;
  function canStep(it) {
    const s = it.q.steps[it.step], a = it.stepAns[it.step];
    return s.type === 'multi' ? Array.isArray(a) && a.length > 0 : a != null;
  }
  function caseHtml(it) {
    const q = it.q;
    const kindName = q.stage === 'ronbun' ? '論文式' : '記述式';
    const reviewing = it.stepView === 'review';
    const stepper = q.steps.map((s, i) => `<span class="stp ${i < it.step || it.done ? 'done' : ''} ${i === it.step && !it.done ? 'cur' : ''}">${i + 1} ${esc(s.label)}</span>`).join('');
    const upto = it.done ? q.steps.length : it.step + (reviewing ? 1 : 0);
    const sheet = q.steps.slice(0, upto).map((s, i) => `<p><b>${esc(s.label)}</b><span class="sl">${esc(sheetLine(s, it.stepAns[i]))}</span>${markOf(it.stepScore[i])}</p>`).join('');
    let card = '';
    if (!it.done) {
      const s = q.steps[it.step], a = it.stepAns[it.step];
      const opts = s.options.map((o, i) => {
        const on = s.type === 'multi' ? (a || []).includes(i) : a === i;
        let cls = on ? 'on' : '';
        if (reviewing) cls += o[1] ? (on ? ' right' : ' missed') : (on ? ' wrong' : '');
        const note = reviewing && o[2] ? `<small class="onote">${esc(o[2])}</small>` : '';
        return `<button class="opt ${s.type === 'one' ? 'one' : ''} ${cls}" data-act="opt" data-i="${i}" ${reviewing ? 'disabled' : ''}><span class="box"></span><span class="otext">${esc(o[0])}${note}</span></button>`;
      }).join('');
      card = `<div class="stepcard" id="stepcard"><p class="prompt"><b>${esc(s.label)}</b>${esc(s.prompt)}${s.type === 'multi' ? '<small>当てはまるものをすべて選ぶ</small>' : ''}</p><div class="opts">${opts}</div></div>`;
    }
    return `<p class="qtag">${esc(tagOf(q, kindName))}</p><h3 class="qtitle">${esc(q.title)}</h3>
      ${easyBox(q)}
      <div class="factbox"><p class="fl">【事案】</p><p>${nl(q.facts)}</p><p class="fl">【設問】</p><p>${nl(q.ask)}</p></div>
      <div class="stepper">${stepper}</div>
      ${card}
      <div class="sheet"><p class="paperhead">答案用紙</p>${sheet || '<p class="blank">選んだ内容が、ここに答案の骨組みとして書き込まれていく。</p>'}</div>
      <div class="fbhost" id="fb">${it.done ? feedbackCase(it) : ''}</div>`;
  }
  function caseKeyHtml(q) {
    return q.steps.map(s => `<div class="rvstep"><p><b>${esc(s.label)}</b> ${esc(s.prompt)}</p><ul class="notes">${s.options.filter(o => o[1]).map(o => `<li><span class="tfmark o">◯</span><span>${esc(o[0])}${o[2] ? '<br><small>' + esc(o[2]) + '</small>' : ''}</span></li>`).join('')}</ul></div>`).join('') +
      `<p class="fl">答案の骨子（模範）</p><p class="model">${nl(q.model || '')}</p>`;
  }
  function feedbackCase(it) {
    const ok = it.score >= 0.999;
    return `<div class="feedback ${ok ? '' : 'wrong'}"><h4>${ok ? '満点答案！' : '答案の得点 ' + Math.round(it.score * 100) + '%'}</h4>
      <p class="fl">答案の骨子（模範）</p><p class="model">${nl(it.q.model || '')}</p></div>`;
  }

  /* ---------- 口述 ---------- */
  function examiner(name, cls, talking) { return `<div class="ex ${cls} ${talking ? 'talk' : ''}"><span>${name}</span></div>`; }
  function oralHtml(it) {
    const q = it.q;
    const head = `<p class="qtag">${esc(tagOf(q, '口述'))}</p><h3 class="qtitle">${esc(q.title)}</h3>${easyBox(q)}`;
    const facts = q.facts ? `<div class="factbox small"><p class="fl">【事例】</p><p>${nl(q.facts)}</p></div>` : '';
    if (!it.started) {
      return head + `<div class="oral"><div class="examiners">${examiner('主査', 'main', true)}${examiner('副査', 'sub', false)}</div>
        <div class="bubble main">${esc(q.intro)}</div>${facts}
        <p class="mini">質問は ${q.turns.length} つ。時間制限はありません。間違えると副査が助け舟を出します（助け舟のあとの正解は半分の評価）。</p></div>`;
    }
    if (it.done) {
      const rows = q.turns.map((t, i) => `<li>${markOf(it.turnScore[i])}<span>${esc(t.q.replace(/^主査「|」$/g, ''))}<br><small>正解：${esc(t.options.find(o => o[1])[0])}</small></span></li>`).join('');
      return head + `<div class="oral"><div class="examiners">${examiner('主査', 'main', true)}${examiner('副査', 'sub', false)}</div>
        <div class="bubble main">主査「以上で終わります。お疲れさまでした。」</div>
        <ul class="turnlist">${rows}</ul></div>`;
    }
    const t = q.turns[it.turn], ph = it.oralPhase;
    const opts = t.options.map((o, i) => {
      let cls = '';
      if (ph === 'hint' && it.wrongPick === i) cls = 'wrong';
      if (ph === 'review') cls = o[1] ? 'right' : (it.lastPick === i || it.wrongPick === i) ? 'wrong' : '';
      const dis = ph === 'review' || (ph === 'hint' && it.wrongPick === i);
      return `<button class="opt one ${cls}" data-act="oralPick" data-i="${i}" ${dis ? 'disabled' : ''}><span class="box"></span><span class="otext">${esc(o[0])}</span></button>`;
    }).join('');
    // 事例を先に置き、質問と選択肢をひと続きにする（質問が変わったら #turnhead が画面の上に来る）
    return head + facts + `<div class="oral"><div class="turnhead" id="turnhead"><div class="examiners small">${examiner('主査', 'main', ph !== 'hint')}${examiner('副査', 'sub', ph === 'hint')}</div><p class="turnno">質問 ${it.turn + 1} / ${q.turns.length}</p></div>
      <div class="bubble main">${esc(t.q)}</div>
      ${ph === 'hint' ? `<div class="bubble sub">${esc(t.hint || '副査「落ち着いて、もう一度考えてみてください。」')}</div>` : ''}
      ${ph === 'review' ? `<div class="bubble main react">${esc(it.react || '')}</div>` : ''}
      <div class="opts">${opts}</div>
      <div class="fbhost" id="fb">${ph === 'review' && t.e ? `<div class="feedback ${it.turnScore[it.turn] >= 0.999 ? '' : 'wrong'}"><p class="exp">${esc(t.e)}</p></div>` : ''}</div></div>`;
  }
  function oralKeyHtml(q) {
    return q.turns.map((t, i) => `<div class="rvstep"><p><b>質問${i + 1}</b> ${esc(t.q)}</p><p class="ans">正解：${esc(t.options.find(o => o[1])[0])}</p>${t.e ? `<p class="exp">${esc(t.e)}</p>` : ''}</div>`).join('');
  }

  /* ---------- 解答を見る（PCは問題の隣、スマホは問題の下に出したまま） ---------- */
  function dockHtml(it) {
    const q = it.q;
    const body = q.kind === 'mcq' ? mcqKeyHtml(q) : q.kind === 'case' ? caseKeyHtml(q) : oralKeyHtml(q);
    return `<section class="panel answerdock"><header class="dockhead"><h3>解答です</h3><button class="small" data-act="closeDock" aria-label="解答を閉じる">×</button></header>${body}
      <p class="mini">解答を見た問題は、学習記録とXPに入りません。${road() ? '本試験モードでは、この挑戦が参考記録になります（ロードは進みません）。' : ''}</p></section>`;
  }

  /* ---------- 下に固定したマークシート ---------- */
  function markbarHtml(it) {
    const q = it.q, rd = road();
    const nextBtn = isLast() && rd ? `<button class="primary" data-act="next">提出する</button>` :
      `<button class="primary" data-act="next">${rd ? '次へ進む →' : run.items.every(s => s.done) ? '結果を見る ▶' : '次へ →'}</button>`;
    let marks = '', primary = '';
    if (q.kind === 'mcq') {
      if (q.form === 'tf') {
        marks = q.st.map((s, i) => {
          const a = it.ans ? it.ans[i] : undefined;
          const res = it.done ? (a === s[2] ? ' right' : ' wrong') : '';
          return `<span class="mgroup"><b>${esc(s[0])}</b><button class="mb ${a === true ? 'on' : ''}${a === true ? res : ''}" data-act="tf" data-i="${i}" data-v="1" ${it.done ? 'disabled' : ''} aria-label="${esc(s[0])}は正しい">1</button><button class="mb ${a === false ? 'on' : ''}${a === false ? res : ''}" data-act="tf" data-i="${i}" data-v="0" ${it.done ? 'disabled' : ''} aria-label="${esc(s[0])}は誤り">2</button></span>`;
        }).join('');
      } else {
        const key = SQ.mcqKey(q);
        marks = key.choices.map((c, i) => {
          let cls = it.ans === i ? 'on' : '';
          if (it.done) cls += i === key.answer ? ' right' : it.ans === i ? ' wrong' : '';
          return `<button class="mb ${cls}" data-act="pick" data-i="${i}" ${it.done ? 'disabled' : ''} aria-label="${c.no}番">${c.no}</button>`;
        }).join('');
      }
      primary = rd || it.done ? nextBtn : `<button class="primary" data-act="commit" ${canCommit(it) ? '' : 'disabled'}>解答する</button>`;
    } else if (q.kind === 'case') {
      const lastStep = it.step === q.steps.length - 1;
      if (it.done) primary = nextBtn;
      else if (it.stepView === 'review') primary = `<button class="primary" data-act="stepNext">${lastStep ? '答案を仕上げる' : '次の段落へ →'}</button>`;
      else primary = `<button class="primary" data-act="commitStep" ${canStep(it) ? '' : 'disabled'}>${rd && lastStep ? (isLast() ? '書いて提出へ' : '書いて次へ進む →') : 'この内容で書く'}</button>`;
    } else {
      if (it.done) primary = nextBtn;
      else if (!it.started) primary = `<button class="primary" data-act="oralStart">口述をはじめる</button>`;
      else if (it.oralPhase === 'review') primary = `<button class="primary" data-act="oralNext">${it.turn < q.turns.length - 1 ? '次の質問へ →' : '口述を終える'}</button>`;
      else primary = `<span class="mhint">答えをタップ</span>`;
    }
    const reveal = it.done ? '' : `<button class="${it.revealed && it.dock ? 'on' : ''}" data-act="reveal">${it.revealed && it.dock ? '解答を閉じる' : '解答を見る'}</button>`;
    const flag = it.done ? '' : `<button class="${it.flag ? 'on' : ''}" data-act="flag" aria-label="あとで見直す">⚑${it.flag ? ' 見直し' : ''}</button>`;
    return `${marks ? `<div class="marks">${marks}</div>` : ''}<div class="mnav"><button data-act="prev" ${run.idx === 0 ? 'disabled' : ''} aria-label="前の問題">←</button>${flag}${reveal}${primary}</div>`;
  }

  /* ================= 進行 ================= */
  let shownIdx = -1;
  function renderRun(scroll) {
    const sh0 = app.querySelector('.shell'), y = sh0 ? sh0.scrollTop : 0;
    app.innerHTML = scrRun();
    // 問題が変わったときだけ入場の動きをつける（マークを押すたびに揺れないように）
    if (run.idx !== shownIdx) { const w = app.querySelector('.runwrap'); if (w) w.classList.add('enter'); shownIdx = run.idx; }
    const sh = app.querySelector('.shell');
    if (sh) sh.scrollTop = scroll === 'top' ? 0 : y;
    // 自動のスクロールは一瞬で（なめらかスクロールは裏のタブで止まることがあり、目の前で動き続けるのも疲れる）
    const jump = (sel, block) => { const el = $(sel); if (el) el.scrollIntoView({ block, behavior: 'auto' }); };
    if (scroll === 'fb') jump('#fb .feedback', 'nearest');
    if (scroll === 'step') jump('#stepcard', 'start');
    if (scroll === 'turn') jump('#turnhead', 'start');
    if (scroll === 'dock' && !wide.matches) jump('#dock', 'start');
  }
  function startRun(opt) {
    if (S.suspended) { pendingStart = opt; return conflictModal(); }
    stopAll();
    const r = SQ.newRun(opt);
    if (!r.items.length) { toast('まだ問題が収録されていません'); return; }
    run = r;
    shownIdx = -1;
    lastTick = idleAt = Date.now();
    FX.clear();
    persist();
    go('run');
    FX.play('start');
    FX.banner(road() ? 'GAME START' : 'PRACTICE', 'go', runTitle());
  }
  function persist() {
    if (!run || run.finished) return;
    S.suspended = SQ.saveRun(run);
    SQ.store.save();
  }
  function stopAll() { clearTimeout(autoTimer); FX.fever(false); FX.hush(); }
  function goIdx(i, scroll) {
    clearTimeout(autoTimer); FX.hush();
    run.idx = SQ.clamp(i, 0, run.items.length - 1);
    persist();
    const it = cur(), midOral = it.q.kind === 'oral' && it.started && !it.done;
    renderRun(scroll || (midOral ? 'turn' : 'top'));
    if (midOral && it.oralPhase !== 'review') FX.speak(it.q.turns[it.turn].q);
  }
  function nextUndone() {
    const n = run.items.length;
    for (let k = 1; k <= n; k++) { const i = (run.idx + k) % n; if (!run.items[i].done) return i; }
    return -1;
  }
  // 練習モードの「次へ」：まだ解いていない次の問題へ。全部解いたら結果へ。
  function advance() { const i = nextUndone(); if (i < 0) finish(); else goIdx(i); }

  // 正誤の状態更新（コンボ・GET・XP）。演出は playFx で、描き直したあとに出す。
  function applyScore(it, score, pts, small) {
    const ok = score >= 0.999, mid = !ok && score > 0, before = run.combo;
    if (ok && !it.revealed) { run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo); } else run.combo = 0;
    run.get += pts;
    let xp = 0;
    if (!it.revealed) {
      xp = ok ? 8 + 4 * ((it.q.lv || 1) - 1) + Math.min(run.combo, 10) : mid ? 4 : 1;
      if (small) xp = Math.ceil(xp / 2);
      if (ok && run.combo >= 5) xp = Math.round(xp * 1.5);
    }
    return { ok, mid, pts, xp, combo: run.combo, prev: before, broke: before >= 5 && !ok };
  }
  function panelPoint() {
    const p = $('#qpanel');
    if (!p) return [innerWidth / 2, innerHeight / 2];
    const r = p.getBoundingClientRect();
    return [r.left + r.width / 2, Math.max(120, Math.min(innerHeight * 0.55, r.top + 140))];
  }
  function playFx(info, word, stampHost) {
    if (info.xp) gainXp(info.xp);
    const [x, y] = panelPoint();
    if (info.ok) {
      FX.play('ok', info.combo); FX.burst(x, y, null, 26, 8); FX.ring(x, y, '#ffb300'); FX.haptic(12);
      if (info.combo === 3) FX.banner('3 COMBO', 'combo', 'いい流れ');
      if (info.combo === 5) { FX.play('fever'); FX.banner('FEVER!!', 'fever', 'XP 1.5倍'); }
      if (info.combo === 10) FX.banner('10 COMBO', 'combo', '合格者の手つき');
    } else if (info.mid) { FX.play('partial'); FX.burst(x, y, '#29a3f0', 12, 5); }
    else { FX.play('ng'); const p = $('#qpanel'); if (p) { p.classList.remove('wobble'); void p.offsetWidth; p.classList.add('wobble'); } }
    FX.fever(run.combo >= 5);
    if (info.broke) FX.pop(info.prev + ' COMBO までいった！', x, y - 40, 'cheer');
    if (info.pts > 0) FX.pop('+' + fmtPts(info.pts) + (run.stage ? '点' : ''), x, y, info.ok ? 'xp' : '');
    if (road()) FX.judge(info.ok ? 'ok' : info.mid ? 'mid' : 'ng', word || (info.ok ? '正解' : info.mid ? '部分点' : '伸びしろ'));
    else if (stampHost) FX.stamp(stampHost, info.ok, info.ok ? '正解' : info.mid ? '部分点' : '伸びしろ');
    const g = $('#get'); if (g) FX.bump(g);
    const c = $('#combo'); if (c) FX.bump(c);
  }
  function gainXp(x) {
    const before = S.xp;
    S.xp += x; run.xp += x;
    FX.xpGain(x, before, S.xp);
    SQ.store.save();
  }
  function recordItem(it) {
    if (it.revealed) return;
    const before = SQ.todayCount();
    SQ.record(it.q.id, it.score);
    if (before < S.set.goal && SQ.todayCount() >= S.set.goal) setTimeout(() => FX.banner('今日の目標達成!', 'record', S.set.goal + '問クリア'), 600);
    SQ.store.save();
  }
  function setLastJudge(it, i) {
    run.lastJudge = { idx: i, kind: it.q.kind, score: it.score, got: it.score * it.max, pts: it.max, ans: answerText(it.q) };
  }

  // 択一の答え合わせ（状態だけ）。演出情報を返す
  function gradeMcq(it) {
    const j = SQ.judgeMcq(it.q, it.ans);
    it.score = j.score; it.done = true; it.flag = false; it.dock = false;
    const info = applyScore(it, j.score, j.score * it.max);
    recordItem(it);
    return info;
  }
  // 練習モード「解答する」
  function commitMcq() {
    const it = cur();
    if (it.done || !canCommit(it)) return;
    const info = gradeMcq(it);
    persist();
    renderRun('fb');
    playFx(info, null, $('#fb .feedback'));
  }
  // 本試験モード「次へ進む」：入力があれば採点して固定し、次の問題へ（正誤は次の画面で出す）
  function nextRoad() {
    const it = cur(), i = run.idx;
    let info = null;
    if (it.q.kind === 'mcq' && !it.done && canCommit(it)) { info = gradeMcq(it); setLastJudge(it, i); }
    if (isLast()) { persist(); if (info) { renderRun('keep'); playFx(info); } return submit(); }
    goIdx(i + 1);
    if (info) playFx(info);
  }
  function submit() {
    const left = run.items.filter(s => !s.done).length;
    if (!left) return finish();
    modal(`<div class="sheethead"><h2>提出しますか？</h2><button data-act="closeModal">戻る</button></div>
      <p class="muted">まだ答え合わせをしていない問題が ${left} 問あります。提出すると、その問題は0点として採点します。</p>
      <div class="actions"><button class="primary" data-act="submitNow">提出して採点</button><button data-act="closeModal">戻って解く</button></div>`);
  }

  /* ---------- 論文・記述の進行 ---------- */
  function commitStep() {
    const it = cur(), s = it.q.steps[it.step];
    if (it.done || it.stepView === 'review' || !canStep(it)) return;
    const j = SQ.judgeStep(s, it.stepAns[it.step]);
    it.stepScore[it.step] = j.score;
    const tot = it.q.steps.reduce((a, x) => a + x.pts, 0);
    const info = applyScore(it, j.score, j.score * s.pts / tot * it.max, true);
    const word = s.label + (j.score >= 0.999 ? ' ◯' : j.score > 0 ? ' △' : ' ✕');
    if (!road()) {
      it.stepView = 'review';
      persist();
      renderRun('keep');
      playFx(info, word, $('#stepcard'));
      return;
    }
    if (it.step < it.q.steps.length - 1) {
      it.step++;
      persist();
      renderRun('step');
      playFx(info, word);
      return;
    }
    // 本試験モードの最後の段落：答案を仕上げて次の問題へ
    const i = run.idx;
    finishCase(it);
    setLastJudge(it, i);
    persist();
    if (isLast()) { renderRun('keep'); playFx(info, word); return submit(); }
    goIdx(i + 1);
    playFx(info, word);
  }
  function finishCase(it) {
    it.done = true; it.stepView = null; it.dock = false;
    it.score = SQ.caseScore(it.q, it.stepScore);
    recordItem(it);
    if (it.score >= 0.999) setTimeout(() => FX.banner('満点答案', 'crit', it.q.title), 400);
  }
  function stepNext() {
    const it = cur();
    if (it.stepView !== 'review') return;
    it.stepView = null;
    if (it.step < it.q.steps.length - 1) { it.step++; persist(); renderRun('step'); return; }
    finishCase(it);
    persist();
    renderRun('fb');
  }

  /* ---------- 口述の進行（制限時間なし。間違えると助け舟） ---------- */
  function oralBegin() {
    const it = cur();
    it.started = true; it.turn = 0; it.tries = 0; it.oralPhase = 'ask'; it.wrongPick = null;
    persist();
    renderRun('turn');
    FX.speak(it.q.turns[0].q);
  }
  function oralAnswer(i) {
    const it = cur();
    if (!it || it.q.kind !== 'oral' || it.done || !it.started || it.oralPhase === 'review') return;
    const t = it.q.turns[it.turn];
    const ok = t.options[i] && t.options[i][1];
    let info;
    if (ok) {
      const sc = it.tries === 0 ? 1 : 0.5;
      it.turnScore[it.turn] = sc; it.lastPick = i; it.oralPhase = 'review';
      it.react = sc === 1 ? '主査「はい、結構です。」' : '主査「そうですね。では、先に進みます。」';
      info = applyScore(it, sc, 0, true);
    } else if (it.tries === 0) {
      it.tries = 1; it.wrongPick = i; it.oralPhase = 'hint';
      persist();
      renderRun('turn');
      FX.play('ng');
      FX.speak(t.hint || '');
      return;
    } else {
      it.turnScore[it.turn] = 0; it.lastPick = i; it.oralPhase = 'review';
      it.react = '主査「……分かりました。次の質問に移ります。」';
      info = applyScore(it, 0, 0, true);
    }
    persist();
    renderRun('keep');
    playFx(info, info.ok ? (it.tries ? '助け舟で正解' : '正解') : '伸びしろ');
    FX.speak(it.react);
    if (road()) { clearTimeout(autoTimer); autoTimer = setTimeout(() => { if (run && !run.paused && cur() === it) oralNext(); }, 1300); }
  }
  function oralNext() {
    const it = cur();
    if (!it || it.q.kind !== 'oral' || it.done) return;
    clearTimeout(autoTimer);
    if (it.turn < it.q.turns.length - 1) {
      it.turn++; it.tries = 0; it.wrongPick = null; it.lastPick = null; it.oralPhase = 'ask';
      persist();
      renderRun('turn');
      FX.speak(it.q.turns[it.turn].q);
      return;
    }
    const i = run.idx;
    it.done = true; it.dock = false; it.score = SQ.oralScore(it.q, it.turnScore);
    recordItem(it);
    persist();
    if (road()) {
      setLastJudge(it, i);
      if (isLast()) { renderRun('keep'); return submit(); }
      autoTimer = setTimeout(() => { if (run && !run.paused && run.idx === i) goIdx(i + 1); }, 700);
    }
    renderRun('keep');
  }

  /* ---------- 一時停止・中断・再開 ---------- */
  function pause(reason) {
    if (!run || run.finished || run.paused) return;
    run.paused = true; run.interrupted = true;
    clearTimeout(autoTimer); FX.hush(); FX.fever(false);
    persist();
    modal(`<div class="sheethead"><h2>一時停止</h2></div>
      <p class="muted">${reason === 'idle' ? '2分間操作がなかったので、一時停止しました。<br>' : ''}解答はこのブラウザに保存しました。止まっている間の時間は数えません。ホームに戻っても、あとで続きから解けます。</p>
      <div class="actions"><button class="primary" data-act="resumeClock">続ける</button><button data-act="leave">ホームへ戻る</button>${road() ? '<button data-act="submitNow">ここで提出して採点</button>' : ''}</div>`, resumeClock);
  }
  function resumeClock() {
    if (!run || run.finished) return;
    run.paused = false; lastTick = idleAt = Date.now();
    FX.fever(run.combo >= 5);
  }
  function leave() {
    closeModal(false);
    persist();
    stopAll();
    const ex = run && run.exam;
    run = null;
    ex ? go('exam', { id: ex }, true) : go('home', {}, true);
    toast('中断しました。ホームの「続きを解く」から再開できます');
  }
  function resumeSaved() {
    const r = SQ.loadRun(S.suspended);
    if (!r) { S.suspended = null; SQ.store.save(); toast('中断データを読み込めませんでした'); render(); return; }
    stopAll(); closeModal(false);
    run = r; run.interrupted = true;
    shownIdx = -1;
    lastTick = idleAt = Date.now();
    FX.clear();
    go('run');
    const it = cur();
    if (it.q.kind === 'oral' && it.started && !it.done) renderRun('turn');
    FX.banner('RESUME', 'go', runTitle());
  }

  /* ---------- 終了と採点 ---------- */
  function finish() {
    if (!run || run.finished) return;
    stopAll(); closeModal(false);
    run.items.forEach(it => {
      if (it.done) return;
      if (it.q.kind === 'case') it.score = SQ.caseScore(it.q, it.stepScore);
      else if (it.q.kind === 'oral') it.score = SQ.oralScore(it.q, it.turnScore);
      else it.score = 0;
    });
    run.finished = true;
    S.suspended = null;
    const res = SQ.evalRun(run);
    const reference = road() && run.peeked > 0;
    let event = null, bonus = 0;
    if (run.stage && !reference) {
      const k = run.exam + '.' + run.stage, b = S.best[k];
      if (!b || res.ratio > b.ratio) S.best[k] = { ratio: res.ratio, pass: !!res.pass, at: Date.now() };
      if (road()) event = SQ.roadApply(run.exam, run.stage, res);
      if (res.pass) bonus = event === 'final' ? 300 : road() ? 80 : 30;
    }
    last = { run, res, event, bonus, reference };
    if (bonus) { S.xp += bonus; run.xp += bonus; }
    SQ.store.save();
    go('result', {}, true);
  }

  /* ================= 結果 ================= */
  const RANKMSG = { S: '文句なし。合格者の答案。', A: '安定して合格圏。', B: 'あと一押しで合格圏。', C: '土台はできている。', D: '伸びしろしかない。' };
  function scrResult() {
    if (!last) return scrHome();
    const { run: r, res, event, reference } = last;
    const e = r.exam ? SQ.exam(r.exam) : null, stage = r.stage ? SQ.stage(r.exam, r.stage) : null;
    const color = e ? e.color : '#7c4dff', tint = e ? e.tint : '#f1ebfc';
    const chips = [r.interrupted ? '中断あり' : '', r.peeked ? '解答を見た問題 ' + r.peeked : '', reference ? '参考記録' : ''].filter(Boolean).map(c => `<span class="rchip">${esc(c)}</span>`).join('');
    let hero;
    if (stage) {
      const scoreTxt = res.abc ? `<b class="abc">${esc(res.abc)}</b>` : `<b id="cnt" data-to="${res.score}">0</b><small> / ${fmtPts(res.of)}${res.unit && res.unit !== '点' ? ' ' + esc(res.unit) : ''}</small>`;
      const lineLabel = stage.rule.type === 'benri' ? '基準 ' + res.line : stage.rule.type === 'abc' ? '' : '合格 ' + fmtPts(res.line);
      const bar = res.line != null ? `<div class="passbar"><i style="--w:${Math.min(1, res.score / res.of)}"></i><em style="left:${(res.lineRatio * 100).toFixed(1)}%" data-l="${esc(lineLabel)}"></em></div>` : '';
      hero = `<p class="kicker">RESULT · ${esc(e.short)} ${esc(stage.name)}${r.mode === 'road' ? ' · 本試験モード' : ' · 練習'}</p>
        <div class="rank r-${res.rank}">${res.rank}</div>
        <div class="score">${scoreTxt}</div>
        ${bar}
        <div class="seal ${res.pass ? 'pass' : 'fail'}">${reference ? '参考' : res.pass ? '合格' : '不合格'}</div>
        <p class="rankmsg">${esc(RANKMSG[res.rank])}${r.mode === 'practice' ? '（練習のため、ロードは進みません）' : ''}</p>`;
    } else {
      hero = `<p class="kicker">RESULT · ${esc(r.label)}</p>
        <div class="rank r-${res.rank}">${res.rank}</div>
        <div class="score"><b id="cnt" data-to="${res.perfect}">0</b><small> / ${res.total} 問正解</small></div>
        <p class="rankmsg">${esc(RANKMSG[res.rank])}</p>`;
    }
    let roadMsg = '';
    if (reference) {
      roadMsg = `<div class="roadmsg fail"><b>参考記録</b><p>解答を見た問題があるため、合否は参考です（判定は「${res.pass ? '合格' : '不合格'}」相当）。ロードは進みません。本番どおりに、もう一度挑んでみよう。</p>
        <div class="actions"><button class="primary" data-act="road" data-exam="${e.id}">▶ もう一度挑む</button><button data-act="exam" data-id="${e.id}">ロードに戻る</button></div></div>`;
    } else if (event === 'next') {
      const rr = SQ.road(r.exam), nx = e.stages[rr.stage];
      roadMsg = `<div class="roadmsg ok"><b>STAGE CLEAR</b><p>次は「${esc(nx.name)}」（${esc(nx.when)}）。この勢いで挑む？</p>
        <div class="actions"><button class="primary" data-act="road" data-exam="${e.id}">▶ ${esc(nx.name)}に挑む</button><button data-act="exam" data-id="${e.id}">ロードに戻る</button></div></div>`;
    } else if (event === 'final') {
      roadMsg = `<div class="roadmsg final"><b>🏆 ${esc(e.badge)}</b><p>本試験のすべての段階を突破しました。合格証を「学習の記録」に追加しました。</p>
        <div class="actions"><button class="primary" data-act="records">合格証を見る</button><button data-act="exam" data-id="${e.id}">ロードに戻る</button></div></div>`;
    } else if (event === 'fail') {
      const rr = SQ.road(r.exam), nx = e.stages[rr.stage], ex = SQ.exemptText(e.id);
      roadMsg = `<div class="roadmsg fail"><b>第${rr.year}回目の挑戦へ</b><p>次の年は「${esc(nx.name)}」から。${ex ? esc(ex) + '。' : ''}解説で伸びしろを回収してから、もう一度。</p>
        <div class="actions"><button class="primary" data-act="road" data-exam="${e.id}">▶ 次の年に挑む</button><button data-act="exam" data-id="${e.id}">ロードに戻る</button></div></div>`;
    }
    const secRows = res.secs ? res.secs.map(s => {
      if (!s.included) return `<div class="secrow off"><span>${esc(s.sec.name)}</span><span class="muted">準備中（判定外）</span></div>`;
      const val = s.grade && stage.rule.type === 'abc' ? s.grade + '評価（' + Math.round(s.ratio * 100) + '%）' : s.grade ? s.grade : fmtPts(s.show) + ' / ' + fmtPts(s.of);
      const fl = s.floor != null ? `<em style="left:${(s.floor * 100).toFixed(1)}%"></em>` : '';
      return `<div class="secrow ${s.ok === false ? 'bad' : ''}"><span>${esc(s.sec.name)}</span><b>${esc(val)}</b>
        <div class="secbar"><u style="--w:${s.ratio}"></u>${fl}</div>${s.ok === false ? '<small class="badtxt">' + esc(s.floorLabel ? s.floorLabel + 'に届かず' : '足切りライン未満') + '</small>' : ''}</div>`;
    }).join('') : '';
    return `<div class="shell"><div class="wrap">
      ${hdr(true)}
      <section class="result" style="--ec:${color};--et:${tint}">
        <div class="panel rhero ${stage ? (reference ? 'fail' : res.pass ? 'pass' : 'fail') : ''}">${hero}${chips ? `<div class="rchips">${chips}</div>` : ''}</div>
        ${roadMsg}
        <div class="summary">
          <div class="panel stat"><small>満点の問題</small><strong>${res.perfect}<small>/${res.total}</small></strong></div>
          <div class="panel stat"><small>かかった時間</small><strong>${span(r.elapsed)}</strong></div>
          <div class="panel stat"><small>最大コンボ</small><strong>${r.maxCombo}</strong></div>
          <div class="panel stat xp"><small>獲得XP</small><strong>+${r.xp}</strong></div>
        </div>
        ${secRows ? `<div class="sectitle"><h2>区分別</h2><span class="muted">${esc(stage.rule.label)}</span></div><div class="panel secrows">${secRows}</div>` : ''}
        ${res.notes && res.notes.length ? `<ul class="notesbox">${res.notes.map(n => '<li>' + esc(n) + '</li>').join('')}</ul>` : ''}
        <div class="actions center">
          ${e ? `<button data-act="exam" data-id="${e.id}">ロードに戻る</button>` : ''}
          ${stage ? `<button data-act="practice" data-exam="${e.id}" data-stage="${stage.id}">同じ段階を練習</button>` : `<button data-act="drill">もう一度ラッシュ</button>`}
          <button data-act="home">ホーム</button>
        </div>
        <div class="sectitle"><h2>解答と解説</h2><span class="muted">タップで開く</span></div>
        <div class="reviews">${r.items.map(reviewHtml).join('')}</div>
      </section>
      ${foot()}
    </div></div>`;
  }
  function reviewHtml(it, i) {
    const q = it.q, sc = it.score || 0;
    const mark = sc >= 0.999 ? '◯' : sc > 0 ? '△' : '✕';
    let body = `<div class="easy small"><p class="eh">🔰 かんたんに言うと</p><p>${esc(SQ.easyOf(q))}</p></div>`;
    if (q.kind === 'mcq') {
      const key = SQ.mcqKey(q);
      const mine = q.form === 'tf' ? (it.ans ? q.st.map((s, k) => s[0] + (it.ans[k] === true ? '1' : it.ans[k] === false ? '2' : '-')).join(' ') : '未解答')
        : (it.ans != null ? key.choices[it.ans].no + '　' + key.choices[it.ans].text : '未解答');
      body += `<p class="qtext small">${esc(q.q)}</p><p class="ans">あなた：${esc(mine)}<br>正解：${esc(answerText(q))}</p>` +
        (q.st && q.form !== 'pick' ? '<ul class="notes">' + q.st.map((s, k) => `<li><b>${esc(key.labels[k])}</b><span class="tfmark ${s[2] ? 'o' : 'x'}">${s[2] ? '◯' : '✕'}</span><span>${esc(s[1])}<br><small>${esc(s[3] || '')}</small></span></li>`).join('') + '</ul>' : '') +
        (q.e ? `<p class="exp">${esc(q.e)}</p>` : '');
    } else if (q.kind === 'case') {
      body += `<p class="qtext small">${nl(q.facts)}<br><b>${esc(q.ask)}</b></p>` + q.steps.map((s, k) => {
        const a = it.stepAns[k];
        const right = s.options.filter(o => o[1]).map(o => o[0]).join('／');
        return `<div class="rvstep"><p><b>${esc(s.label)}</b> ${markOf(it.stepScore[k])} ${esc(s.prompt)}</p><p class="ans">あなた：${esc(a == null || (Array.isArray(a) && !a.length) ? '未解答' : sheetLine(s, a))}<br>正解：${esc(right)}</p></div>`;
      }).join('') + `<p class="fl">答案の骨子（模範）</p><p class="model">${nl(q.model || '')}</p>`;
    } else {
      body += (q.facts ? `<p class="qtext small">${nl(q.facts)}</p>` : '') + q.turns.map((t, k) => {
        const right = t.options.find(o => o[1])[0];
        return `<div class="rvstep"><p>${markOf(it.turnScore[k])} ${esc(t.q)}</p><p class="ans">正解：${esc(right)}</p>${t.e ? `<p class="exp">${esc(t.e)}</p>` : ''}</div>`;
      }).join('');
    }
    return `<details class="panel review"><summary><span class="mk ${sc >= 0.999 ? 'ok' : sc > 0 ? 'mid' : 'ng'}">${mark}</span><span class="rvno">${i + 1}</span><span class="rvt">${esc(q.title)}${it.revealed ? ' <i class="peek">解答を見た</i>' : ''}</span><small>${esc(SQ.exam(q.exam).short)} · ${esc((SQ.secOf(q) || {}).name || '')}</small></summary><div class="rvbody">${body}</div></details>`;
  }

  /* ================= 学習の記録 ================= */
  function scrRecords() {
    const L = SQ.levelOf(S.xp);
    const total = Object.values(S.stats).reduce((a, s) => a + s.n, 0);
    const days = Object.keys(S.days).length;
    const certs = SQ.EXAMS.filter(e => SQ.road(e.id).wins > 0).map(e => {
      const r = SQ.road(e.id);
      return `<div class="cert" style="--ec:${e.color}"><small>合 格 証</small><b>${esc(e.badge)}</b><span>${r.wins}回 · ${new Date(r.lastWin).toLocaleDateString('ja-JP')}</span></div>`;
    }).join('');
    const quad = SQ.EXAMS.every(e => SQ.road(e.id).wins > 0);
    const rows = SQ.EXAMS.map(e => {
      const st = SQ.examStats(e.id), r = SQ.road(e.id);
      const bests = e.stages.map(s => { const b = S.best[e.id + '.' + s.id]; return `<span class="chip ${b ? '' : 'off'}">${esc(s.name)} <b>${b ? Math.round(b.ratio * 100) + '%' : '—'}</b></span>`; }).join('');
      return `<div class="panel recexam" style="--ec:${e.color};--et:${e.tint}">
        <div class="sthead"><span class="eicon">${esc(e.icon)}</span><h3>${esc(e.name)}</h3><span class="stbadge now">第${r.year}回目</span></div>
        <div class="recgrid"><div><small>解いた問題</small><b>${st.seen}<small>/${st.total}</small></b></div><div><small>正答率</small><b>${st.n ? Math.round(st.rate * 100) + '%' : '—'}</b></div><div><small>合格</small><b>${r.wins}回</b></div></div>
        <div class="chips">${bests}</div>
        ${roadLog(e, r)}
      </div>`;
    }).join('');
    return `<div class="shell"><div class="wrap">
      ${hdr(true)}
      <div class="stephead"><p class="kicker">RECORDS</p><h1>学習の記録</h1></div>
      <div class="summary">
        <div class="panel stat"><small>レベル</small><strong>${L.lv}</strong></div>
        <div class="panel stat"><small>総解答数</small><strong>${total}</strong></div>
        <div class="panel stat"><small>学習日数</small><strong>${days}</strong></div>
        <div class="panel stat"><small>連続</small><strong>${SQ.streak()}<small>日</small></strong></div>
      </div>
      <div class="sectitle"><h2>合格証</h2>${quad ? '<span class="quad">四冠達成</span>' : ''}</div>
      <div class="certs">${certs || '<p class="muted empty">本試験ロードで最終合格すると、ここに合格証が並びます。</p>'}</div>
      <div class="sectitle"><h2>試験別</h2></div>
      <div class="recexams">${rows}</div>
      ${foot()}
    </div></div>`;
  }

  const SCREENS = { home: scrHome, exam: scrExam, result: scrResult, records: scrRecords };

  /* ================= 描画後の処理（結果画面の演出） ================= */
  function after() {
    if (view.name !== 'result' || !last || last.shown) return;
    last.shown = true;
    const { res, event, run: r, reference } = last;
    const el = $('#cnt');
    if (el) FX.countUp(el, Number(el.dataset.to), 1000, r.stage && !res.abc ? (Number.isInteger(Math.round(res.score * 10) / 10) ? 0 : 1) : 0);
    const bar = $('.passbar i'); if (bar) requestAnimationFrame(() => bar.classList.add('go'));
    document.querySelectorAll('.secbar u').forEach(u => requestAnimationFrame(() => u.classList.add('go')));
    setTimeout(() => {
      const seal = $('.seal'); if (seal) seal.classList.add('go');
      if (!r.stage) { FX.play(res.ratio >= 0.65 ? 'pass' : 'fail'); if (res.ratio >= 0.65) FX.confetti(70); return; }
      if (reference) { FX.play('fail'); FX.banner('参考記録', 'sad', '解答を見たため'); return; }
      if (res.pass) {
        FX.play('pass'); FX.confetti(event === 'final' ? 220 : 110);
        FX.banner(event === 'final' ? '最終合格' : '合格', 'pass', event === 'final' ? SQ.exam(r.exam).badge : SQ.stage(r.exam, r.stage).name + ' 突破');
        if (last.bonus) setTimeout(() => FX.xpGain(last.bonus, S.xp - last.bonus, S.xp), 900);
      } else { FX.play('fail'); FX.banner('不合格', 'sad', 'でも、伸びしろが見えた'); }
    }, 1050);
  }

  /* ================= モーダル ================= */
  function modal(html, onDismiss) {
    modalDismiss = onDismiss || null;
    modalRoot.innerHTML = `<div class="overlay" data-act="closeModal"><div class="sheetbox" role="dialog" aria-modal="true">${html}</div></div>`;
  }
  // dismiss=false のときは閉じたときの処理（一時停止の解除など）を呼ばない
  function closeModal(dismiss) {
    const fn = modalDismiss;
    modalDismiss = null;
    modalRoot.innerHTML = '';
    if (dismiss !== false && fn) fn();
  }
  function settingsModal() {
    const s = S.set;
    const chk = k => `<input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}>`;
    modal(`<div class="sheethead"><h2>設定</h2><button data-act="closeModal">閉じる</button></div>
      <div class="settings">
        <label class="setting"><span>効果音の音量 <b id="volv">${s.vol}</b></span><input type="range" min="0" max="100" step="10" value="${s.vol}" data-set="vol"></label>
        <label class="setting"><span>演出（紙吹雪・揺れ・フィーバー）</span>${chk('fx')}</label>
        <label class="setting"><span>口述で試験官の質問を読み上げる</span>${chk('voice')}</label>
        <label class="setting"><span>1日の目標</span><select data-set="goal">${[10, 20, 30, 50].map(n => `<option value="${n}" ${s.goal === n ? 'selected' : ''}>${n}問</option>`).join('')}</select></label>
      </div>
      <h3>記録のバックアップ</h3>
      <p class="muted">記録はこのブラウザの中だけに保存されています。端末を変えるときや念のために、ファイルへ書き出せます。</p>
      <div class="actions"><button data-act="export">書き出す</button><label class="filebtn">読み込む<input type="file" accept="application/json,.json" data-act="import"></label><button class="danger" data-act="reset">記録をすべて消す</button></div>`);
  }
  function helpModal() {
    modal(`<div class="sheethead"><h2>使い方</h2><button data-act="closeModal">閉じる</button></div>
      <div class="help">
        <h3>本試験ロード</h3>
        <p>4つの試験それぞれが、本番の段階（短答 → 論文 → 口述など）をステージにした1本の道になっています。「本試験モード」で挑むと、本番と同じ科目構成・配点・合格ラインで判定され、合格すると次のステージへ、不合格なら次の年の挑戦へ進みます。公認会計士の短答（2年）、弁理士の短答・論文（各2年）、司法書士の筆記（次回）は、本番と同じように免除が残ります。</p>
        <h3>解き方</h3>
        <p>制限時間はありません（かかった時間は結果に出ます）。画面の下のマークシートで番号を選び、「次へ進む」で答え合わせをして次の問題へ。直前の問題の正誤は、次の問題の上に小さく残ります。「解答を見る」を押すと、PCでは問題の隣、スマホでは問題の下に解答が出たままになります。解答を見た問題は学習記録に入らず、本試験モードではその挑戦が参考記録になります。</p>
        <h3>中断と再開</h3>
        <p>「中断」を押すか、2分間操作がないと一時停止します。止まっている間の時間は数えません。ホームに戻っても、解答はこのブラウザに残っていて、「続きを解く」から再開できます。</p>
        <h3>形式</h3>
        <p><b>短答・択一</b>：本番の出題形式（5肢択一・組合せ・個数・各肢の正誤・計算）。<br><b>論文・記述</b>：答案を書く代わりに「論点 → 規範 → 結論」や「登記の目的 → 原因 → 添付情報 → 登録免許税」を選び、答案用紙に骨組みを書き込みます。<br><b>口述</b>：試験官の質問に答えます。間違えると副査が助け舟を出します（その後の正解は半分の評価）。</p>
        <h3>この版について</h3>
        <p>いまは骨子版で、各試験にサンプル問題を少しずつ収録しています。収録のない科目は「準備中」と表示し、合否の判定から外しています。問題はすべて独自作成です。法令・基準の改正や年度ごとの合格点の変動があるため、必ず公式の情報で確認してください。</p>
      </div>`);
  }
  function drillModal() {
    const opts = [['all', 'すべての試験', SQ.Q.filter(q => q.kind === 'mcq').length]].concat(SQ.EXAMS.map(e => [e.id, e.name, SQ.Q.filter(q => q.kind === 'mcq' && q.exam === e.id).length]));
    modal(`<div class="sheethead"><h2>一問一答ラッシュ</h2><button data-act="closeModal">閉じる</button></div>
      <p class="muted">択一からランダムに最大10問。1問ごとに解説が出ます。</p>
      <div class="list">${opts.map(([id, name, n]) => `<button class="row" data-act="drillGo" data-exam="${id}"><strong>${esc(name)}</strong><small>${n}問から</small></button>`).join('')}</div>`);
  }
  function conflictModal() {
    const s = suspendedInfo();
    modal(`<div class="sheethead"><h2>中断した挑戦があります</h2><button data-act="closeModal">やめる</button></div>
      <p class="muted">${esc(s.name)} · 解答済み ${s.done} / ${s.total}問。新しく始めると、中断した挑戦の解答は消えます（学習記録は残ります）。</p>
      <div class="actions"><button class="primary" data-act="resumeRun">続きを解く</button><button class="danger" data-act="startAnyway">破棄して新しく始める</button></div>`);
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    const d = document.createElement('div'); d.textContent = msg; t.appendChild(d);
    clearTimeout(toastTimer); setTimeout(() => d.remove(), 2700);
  }
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ================= 操作 ================= */
  const ACT = {
    home() { if (run && !run.finished && view.name === 'run') return pause('manual'); closeModal(false); go('home'); },
    exam(d) { closeModal(false); go('exam', { id: d.id }); },
    settings() { settingsModal(); },
    help() { helpModal(); },
    closeModal(d, el, ev) { if (el.classList.contains('overlay') && ev.target !== el) return; closeModal(); },
    road(d) { closeModal(false); const r = SQ.road(d.exam), e = SQ.exam(d.exam); startRun({ exam: d.exam, stage: e.stages[r.stage].id, mode: 'road' }); },
    practice(d) { closeModal(false); startRun({ exam: d.exam, stage: d.stage, mode: 'practice' }); },
    drill() { drillModal(); },
    drillGo(d) {
      const pool = SQ.Q.filter(q => q.kind === 'mcq' && (d.exam === 'all' || q.exam === d.exam));
      closeModal(false);
      startRun({ ids: shuffle(pool).slice(0, 10).map(q => q.id), mode: 'practice', label: '一問一答ラッシュ', exam: d.exam === 'all' ? null : d.exam });
    },
    weak() { const ids = shuffle(SQ.weakIds()).slice(0, 20); if (!ids.length) return toast('間違えた問題はまだありません'); startRun({ ids, mode: 'practice', label: '苦手をほどく' }); },
    records() { closeModal(false); go('records'); },
    resumeRun() { pendingStart = null; resumeSaved(); },
    discardRun() {
      modal(`<div class="sheethead"><h2>中断データを破棄</h2><button data-act="closeModal">やめる</button></div>
        <p class="muted">中断した挑戦の解答を削除します。学習記録は残ります。</p>
        <div class="actions"><button class="danger" data-act="confirmDiscard">破棄する</button><button data-act="closeModal">やめる</button></div>`);
    },
    confirmDiscard() { S.suspended = null; SQ.store.save(); closeModal(false); render(); toast('中断データを破棄しました'); },
    startAnyway() { const opt = pendingStart; pendingStart = null; S.suspended = null; SQ.store.save(); closeModal(false); if (opt) startRun(opt); },
    pause() { pause('manual'); },
    resumeClock() { closeModal(); },
    leave() { leave(); },
    submit() { submit(); },
    submitNow() { closeModal(false); finish(); },
    nav(d) { goIdx(Number(d.i)); },
    prev() { goIdx(run.idx - 1); },
    next() { if (road()) nextRoad(); else advance(); },
    flag() { const it = cur(); it.flag = !it.flag; persist(); renderRun('keep'); },
    pick(d) { const it = cur(); if (it.done) return; it.ans = Number(d.i); FX.play('pick'); persist(); renderRun('keep'); FX.bump($('#markbar .mb.on')); },
    tf(d) {
      const it = cur(); if (it.done) return;
      it.ans = it.ans || []; it.ans[Number(d.i)] = d.v === '1';
      FX.play('pick'); persist(); renderRun('keep');
      FX.bump(document.querySelector(`#markbar [data-act="tf"][data-i="${d.i}"][data-v="${d.v}"]`));
    },
    commit() { commitMcq(); },
    opt(d) {
      const it = cur();
      if (it.done || it.stepView === 'review') return;
      const s = it.q.steps[it.step], i = Number(d.i);
      if (s.type === 'multi') { const a = it.stepAns[it.step] || []; it.stepAns[it.step] = a.includes(i) ? a.filter(x => x !== i) : a.concat(i).sort((x, y) => x - y); }
      else it.stepAns[it.step] = i;
      FX.play('pick'); persist(); renderRun('keep');
    },
    commitStep() { commitStep(); },
    stepNext() { stepNext(); },
    oralStart() { oralBegin(); },
    oralPick(d) { oralAnswer(Number(d.i)); },
    oralNext() { oralNext(); },
    reveal() {
      const it = cur();
      if (it.revealed && it.dock) { it.dock = false; persist(); return renderRun('keep'); }
      if (!it.revealed) {
        it.revealed = true; run.peeked++; run.combo = 0; FX.fever(false);
        if (road() && run.peeked === 1) toast('解答を見たので、この挑戦は参考記録になります');
      }
      it.dock = true;
      persist();
      renderRun('dock');
    },
    closeDock() { cur().dock = false; persist(); renderRun('keep'); },
    export() {
      const blob = new Blob([SQ.store.exportText()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'shigyo-quest-record-' + SQ.today() + '.json';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('記録を書き出しました');
    },
    reset() {
      if (!confirm('すべての記録（レベル・成績・ロード・合格証・中断データ）を消します。元に戻せません。よろしいですか？')) return;
      SQ.store.reset(); S = SQ.store.S; closeModal(false); go('home', {}, true); toast('記録を消しました');
    }
  };
  const OWN_SOUND = { closeModal: 1, pick: 1, tf: 1, opt: 1, oralPick: 1, commit: 1, commitStep: 1, road: 1, practice: 1, drillGo: 1, weak: 1, next: 1, resumeRun: 1 };
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    if (run && run.paused && view.name === 'run' && !el.closest('#modal-root')) return;
    if (!OWN_SOUND[el.dataset.act]) FX.play('tap');
    fn(el.dataset, el, ev);
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.set) {
      const k = el.dataset.set;
      S.set[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' || k === 'goal' ? Number(el.value) : el.value;
      if (k === 'vol') FX.setVol();
      if (k === 'fx') document.body.classList.toggle('lite', !S.set.fx);
      SQ.store.save();
      return;
    }
    if (el.dataset.act === 'target') { S.targets[el.dataset.exam] = el.value; SQ.store.save(); render(); return; }
    if (el.dataset.act === 'import' && el.files && el.files[0]) {
      const fr = new FileReader();
      fr.onload = () => { try { SQ.store.importText(String(fr.result)); S = SQ.store.S; closeModal(false); go('home', {}, true); toast('記録を読み込みました'); } catch (e) { toast('読み込めませんでした：' + e.message); } };
      fr.readAsText(el.files[0]);
    }
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.set === 'vol') { S.set.vol = Number(el.value); const v = $('#volv'); if (v) v.textContent = el.value; FX.setVol(); }
  });
  document.addEventListener('keydown', ev => {
    if (modalRoot.innerHTML) { if (ev.key === 'Escape') closeModal(); return; }
    if (view.name !== 'run' || !run || run.paused || ev.target.closest('input,select,textarea')) return;
    const it = cur(), n = Number(ev.key);
    if (n >= 1 && n <= 9) {
      if (it.q.kind === 'mcq' && it.q.form !== 'tf' && !it.done && n <= SQ.mcqKey(it.q).choices.length) return ACT.pick({ i: n - 1 });
      if (it.q.kind === 'case' && !it.done && it.stepView !== 'review' && n <= it.q.steps[it.step].options.length) return ACT.opt({ i: n - 1 });
      if (it.q.kind === 'oral' && it.started && !it.done && it.oralPhase !== 'review' && n <= it.q.turns[it.turn].options.length) return oralAnswer(n - 1);
    }
    if (ev.key === 'Enter') {
      const b = document.querySelector('#markbar .mnav .primary:not([disabled])');
      if (b) { ev.preventDefault(); b.click(); }
    }
    if (ev.key === 'ArrowLeft' && run.idx > 0) goIdx(run.idx - 1);
    if (ev.key === 'ArrowRight' && run.idx < run.items.length - 1) goIdx(run.idx + 1);
  });
  wide.addEventListener && wide.addEventListener('change', () => { if (view.name === 'run' && run) renderRun('keep'); });

  /* ================= 時間（制限なし）と、2分の無操作で一時停止 ================= */
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, () => { idleAt = Date.now(); }, { capture: true, passive: true }));
  setInterval(() => {
    const now = Date.now(), d = now - lastTick;
    lastTick = now;
    if (!run || run.finished || run.paused || view.name !== 'run') return;
    if (!document.hidden && d < 5000) run.elapsed += d / 1000;
    const speaking = window.speechSynthesis && speechSynthesis.speaking;
    if (speaking) idleAt = now;
    else if (now - idleAt >= IDLE) pause('idle');
    if (now - saveTick > 10000) { saveTick = now; persist(); }
  }, 500);

  /* ================= 起動 ================= */
  document.body.classList.toggle('lite', !S.set.fx);
  const errs = SQ.validate();
  if (errs.length && /[?&]check\b/.test(location.search)) {
    const box = document.createElement('pre');
    box.className = 'dataerr'; box.textContent = 'データの問題 ' + errs.length + '件\n' + errs.join('\n');
    document.body.appendChild(box);
  }
  try { history.replaceState({ name: 'home', p: {} }, ''); } catch (e) { /* noop */ }
  render();
  SQ.debug = { get run() { return run; }, get last() { return last; }, finish, go, pause, idle: ms => { idleAt = Date.now() - ms; } };
})();
