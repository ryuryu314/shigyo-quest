/* 士業ドパミンクエスト — ドパミン演出（合成効果音・粒子・バナー・ハンコ・XPゲージ・読み上げ）
 * 動きは transform / opacity と canvas だけ。「演出」オフや「視差効果を減らす」では揺れ・点滅を出さない。
 */
(function () {
  'use strict';
  const SQ = window.SQ;
  const $ = s => document.querySelector(s);
  const set = () => SQ.store.S.set;
  const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = () => !set().fx || (motion && motion.matches);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ================= 効果音（WebAudio で合成） ================= */
  let ac = null, master = null;
  function audio() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ac.createGain();
    master.connect(comp); comp.connect(ac.destination);
    setVol();
    return ac;
  }
  function setVol() { if (master) master.gain.value = (set().vol / 100) * 0.55; }
  function unlock() {
    const a = audio();
    if (a && a.state !== 'running') a.resume().catch(() => {});
    hint();
  }
  function hint() { const h = $('#sound-hint'); if (h) h.classList.toggle('show', !!ac && set().vol > 0 && ac.state !== 'running'); }
  const live = () => ac && ac.state === 'running' && set().vol > 0;
  function tone(f, dur, type, vol, when, slide) {
    if (!live()) return;
    const t = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, when, freq, type) {
    if (!live()) return;
    const t = ac.currentTime + (when || 0);
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = type || 'bandpass'; f.frequency.value = freq || 1200;
    g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  const st = (f, s) => f * Math.pow(2, s / 12);
  const SFX = {
    tap() { tone(880, 0.05, 'triangle', 0.07); },
    pick() { tone(988, 0.06, 'triangle', 0.09); tone(1319, 0.05, 'triangle', 0.05, 0.03); },
    ok(combo) {
      const b = st(523, Math.min(combo || 0, 12));
      [0, 4, 7, 12].forEach((s, i) => tone(st(b, s), 0.16, 'square', 0.07, i * 0.055));
      [0, 1, 2].forEach(i => tone(rand(2600, 4200), 0.08, 'sine', 0.035, 0.22 + i * 0.05));
      if (combo >= 5) tone(st(b, -12), 0.3, 'sawtooth', 0.05, 0);
    },
    partial() { [0, 4, 7].forEach((s, i) => tone(st(587, s), 0.14, 'triangle', 0.08, i * 0.06)); },
    ng() { tone(392, 0.2, 'sine', 0.14, 0, 0.62); tone(523, 0.12, 'triangle', 0.07, 0.17); tone(659, 0.22, 'triangle', 0.07, 0.25); },
    stamp() { noise(0.09, 0.28, 0, 700, 'lowpass'); tone(120, 0.14, 'sine', 0.3, 0, 0.5); },
    start() {
      noise(0.35, 0.06, 0, 2000, 'highpass');
      [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(st(392, s), 0.12, 'square', 0.06, 0.08 + i * 0.06));
      tone(st(392, 24), 0.5, 'sawtooth', 0.05, 0.5);
    },
    level() { [0, 4, 7, 12, 16].forEach((s, i) => tone(st(659, s), 0.18, 'square', 0.07, i * 0.07)); tone(st(659, 24), 0.6, 'triangle', 0.06, 0.4); },
    pass() {
      const seq = [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.52], [12, 0.64]];
      seq.forEach(([s, w]) => { tone(st(523, s), 0.22, 'square', 0.07, w); tone(st(262, s), 0.22, 'triangle', 0.06, w); });
      [0, 4, 7, 12].forEach(s => tone(st(523, s), 1.1, 'sawtooth', 0.025, 0.85));
      noise(1.2, 0.05, 0.85, 6000, 'highpass');
    },
    fail() { [0, 3, 7, 10, 12].forEach((s, i) => tone(st(440, s), 0.16, 'triangle', 0.07, i * 0.09)); },
    tick() { tone(1500, 0.025, 'square', 0.04); },
    coin() { tone(1319, 0.06, 'square', 0.05); tone(1760, 0.12, 'square', 0.05, 0.05); },
    fever() { [0, 5, 7, 12, 17, 19, 24].forEach((s, i) => tone(st(440, s), 0.1, 'square', 0.06, i * 0.04)); }
  };
  function play(name, ...args) { if (!ac) return; try { SFX[name](...args); } catch (e) { /* 音が出なくても操作は止めない */ } }

  /* ================= 粒子（#fx canvas） ================= */
  const cv = $('#fx'), cx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, P = [], raf = 0;
  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  resize(); addEventListener('resize', resize);
  const HUES = ['#7c4dff', '#ff3d9a', '#ffb300', '#29a3f0', '#2ecc71', '#ff7a00'];
  function add(p) { if (P.length < 700) P.push(p); if (!raf) raf = requestAnimationFrame(loop); }
  function burst(x, y, color, n, spd) {
    if (calm()) n = Math.min(n || 20, 8);
    for (let i = 0; i < (n || 24); i++) { const a = rand(0, 6.283), v = rand(1.5, spd || 8); add({ k: 'd', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.18, r: rand(2, 5), life: 1, dec: rand(0.015, 0.03), c: color || HUES[i % HUES.length] }); }
  }
  function stars(x, y, n) { for (let i = 0; i < (calm() ? 4 : n || 10); i++) { const a = rand(0, 6.283), v = rand(2, 7); add({ k: 's', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.1, r: rand(5, 10), rot: rand(0, 6), vr: rand(-0.2, 0.2), life: 1, dec: rand(0.015, 0.025), c: HUES[i % HUES.length] }); } }
  function confetti(n) {
    if (calm()) n = Math.min(n || 120, 30);
    for (let i = 0; i < (n || 120); i++) add({ k: 'c', x: rand(0, W), y: rand(-H * 0.4, -10), vx: rand(-1.2, 1.2), vy: rand(2, 5), g: 0.04, w: rand(6, 11), h: rand(3, 6), rot: rand(0, 6), vr: rand(-0.15, 0.15), life: 1, dec: rand(0.003, 0.006), c: HUES[i % HUES.length] });
  }
  function clear() { P = []; if (raf) cancelAnimationFrame(raf); raf = 0; cx.clearRect(0, 0, W, H); }
  function ring(x, y, color) { add({ k: 'r', x, y, r: 8, vr: 9, life: 1, dec: 0.035, c: color || '#ffb300' }); }
  function starPath(r) { cx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } cx.closePath(); }
  function loop() {
    cx.clearRect(0, 0, W, H);
    P = P.filter(p => {
      p.life -= p.dec;
      if (p.life <= 0 || p.y > H + 40) return false;
      cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      if (p.k === 'r') { p.r += p.vr; p.vr *= 0.93; cx.strokeStyle = p.c; cx.lineWidth = 4 * p.life; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.stroke(); return true; }
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99;
      cx.fillStyle = p.c;
      if (p.k === 'd') { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
      else { p.rot += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); if (p.k === 's') { starPath(p.r); cx.fill(); } else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); }
      return true;
    });
    cx.globalAlpha = 1;
    raf = P.length ? requestAnimationFrame(loop) : 0;
    if (!raf) cx.clearRect(0, 0, W, H);
  }

  /* ================= DOM 演出 ================= */
  function pop(text, x, y, cls) {
    const el = document.createElement('div');
    el.className = 'pop ' + (cls || ''); el.textContent = text; el.setAttribute('aria-hidden', 'true');
    el.style.left = (x == null ? W / 2 : x) + 'px'; el.style.top = (y == null ? H * 0.42 : y) + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
  }
  // 同時に起きた節目は重ねず、順番に見せる
  const queue = []; let showing = false;
  function banner(text, cls, sub) { queue.push({ text, cls, sub }); if (queue.length > 4) queue.splice(0, queue.length - 4); if (!showing) next(); }
  function next() {
    const b = queue.shift();
    if (!b) { showing = false; return; }
    showing = true;
    const el = document.createElement('div');
    el.className = 'banner ' + (b.cls || ''); el.setAttribute('aria-hidden', 'true');
    el.innerHTML = SQ.esc(b.text) + (b.sub ? '<small>' + SQ.esc(b.sub) + '</small>' : '');
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); next(); }, calm() ? 900 : 1400);
  }
  function flash(color) { if (calm()) return; const f = $('#flash'); f.style.background = color || '#fff'; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  function shake(el, big) { if (calm() || !el) return; const c = big ? 'shake2' : 'shake'; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); }
  function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  // 画面中央の正誤マーク（本試験モード）
  let judgeEl = null;
  function judge(kind, word, sub) {
    if (judgeEl) judgeEl.remove();
    const el = document.createElement('div');
    el.className = 'judge ' + kind; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<b>' + (kind === 'ok' ? '◯' : kind === 'mid' ? '△' : '✕') + '</b><span>' + SQ.esc(word || '') + '</span>' + (sub ? '<small>' + SQ.esc(sub) + '</small>' : '');
    document.body.appendChild(el); judgeEl = el;
    setTimeout(() => { if (judgeEl === el) { el.remove(); judgeEl = null; } }, 900);
  }
  // ハンコ：正解は朱色、不正解はオレンジの「伸びしろ」
  function stamp(host, ok, text) {
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'stamp ' + (ok ? 'ok' : 'ng'); el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<b>' + SQ.esc(text || (ok ? '正解' : '伸びしろ')) + '</b>';
    host.appendChild(el);
    play('stamp');
  }
  function fever(on) { document.body.classList.toggle('fever', !!on && !calm()); }
  function countUp(el, to, ms, digits) {
    if (!el) return;
    const d = digits || 0;
    if (calm()) { el.textContent = to.toFixed(d); return; }
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / (ms || 900)), e = 1 - Math.pow(1 - k, 3); el.textContent = (to * e).toFixed(d); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ================= XPゲージ ================= */
  let xpTimer = 0;
  function xpGain(gain, before, after) {
    const el = $('#xpbar');
    const a = SQ.levelOf(before), b = SQ.levelOf(after);
    el.querySelector('.xl b').textContent = b.lv;
    el.querySelector('.xg').textContent = '+' + gain + ' XP';
    const u = el.querySelector('u');
    if (b.lv > a.lv) { u.style.transform = 'scaleX(1)'; setTimeout(() => { u.style.transition = 'none'; u.style.transform = 'scaleX(0)'; void u.offsetWidth; u.style.transition = ''; u.style.transform = 'scaleX(' + (b.into / b.need) + ')'; }, 300); }
    else u.style.transform = 'scaleX(' + (b.into / b.need) + ')';
    el.classList.add('show'); el.classList.toggle('lvup', b.lv > a.lv);
    clearTimeout(xpTimer); xpTimer = setTimeout(() => el.classList.remove('show', 'lvup'), 1800);
    if (b.lv > a.lv) {
      play('level'); confetti(60);
      const t = SQ.titleOf(b.lv), up = t !== SQ.titleOf(a.lv);
      banner('LEVEL UP', 'lv', 'Lv.' + b.lv + (up ? '　称号「' + t + '」' : ''));
    }
  }

  /* ================= 読み上げ（口述の試験官） ================= */
  function speak(text) {
    if (!set().voice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/^(主査|副査)「|」$/g, ''));
      u.lang = 'ja-JP'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find(v => /ja/i.test(v.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* 読み上げできない端末では黙って続ける */ }
  }
  function hush() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* noop */ } }
  // 一度もタップされていないページで振動を呼ぶとブラウザが警告を出すので、操作があった後だけ
  function haptic(ms) {
    const ua = navigator.userActivation;
    if (!set().fx || !navigator.vibrate || (ua && !ua.hasBeenActive)) return;
    try { navigator.vibrate(ms || 10); } catch (e) { /* noop */ }
  }

  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, unlock, { passive: true }));

  SQ.fx = { play, setVol, unlock, burst, stars, confetti, ring, clear, pop, banner, flash, shake, bump, judge, stamp, fever, countUp, xpGain, speak, hush, haptic, calm };
})();
