/* Tarsi CSE Reviewer. Vanilla JS, no build step. Progress lives in this browser's localStorage. */
(function () {
  'use strict';

  /* ---------- Exam facts ---------- */
  // Date, scope and passing grade: CSC Examination Announcement No. 06, s. 2026.
  const EXAM_DATE = '2027-03-14';
  const ANNOUNCEMENT = 'https://csc.gov.ph/phocadownload/userupload/erpo/announcements/2026/ExamAnn_2026_06_Conduct%20of%2014%20March%202027%20CSE-PPT%20orig%20signed.pdf';
  const PASS = 80;
  // The announcement does not state item count or time. These follow third-party reports.
  const MOCKS = {
    full: { name: 'Full mock exam', items: 170, mins: 190 },
    mini: { name: 'Mini mock', items: 50, mins: 56 },
  };
  const UNITS = [
    { id: 'general', name: 'General Information', blurb: 'Constitution, ethics law, human rights and environment', skills: [['constitution', 'Philippine Constitution'], ['ra6713', 'Code of Conduct (R.A. 6713)'], ['peace-rights', 'Peace and Human Rights'], ['environment', 'Environment Management and Protection']] },
    { id: 'verbal', name: 'Verbal Ability', blurb: 'English and Filipino language skills', skills: [['word-meaning', 'Word meaning'], ['sentence-completion', 'Sentence completion'], ['error-recognition', 'Error recognition'], ['sentence-structure', 'Sentence structure'], ['paragraph-organization', 'Paragraph organization'], ['reading-comprehension', 'Reading comprehension']] },
    { id: 'analytical', name: 'Analytical Ability', blurb: 'Reasoning, logic and reading data', skills: [['word-analogy', 'Word analogy'], ['symbolic-logic', 'Symbolic logic and abstract reasoning'], ['assumptions-conclusions', 'Assumptions and conclusions'], ['data-interpretation', 'Data interpretation']] },
    { id: 'numerical', name: 'Numerical Ability', blurb: 'Computation without a calculator', skills: [['basic-operations', 'Basic operations'], ['number-sequence', 'Number sequence'], ['word-problems', 'Word problems']] },
  ];
  const LESSON_SIZE = 6;
  const HEARTS = 5;
  const DAILY_GOAL = 30;

  /* ---------- Data ---------- */
  const QUESTIONS = Array.isArray(window.CSE_QUESTIONS) ? window.CSE_QUESTIONS : [];
  const BY_ID = new Map(QUESTIONS.map(q => [q.id, q]));
  const skillName = id => { for (const u of UNITS) for (const [s, n] of u.skills) if (s === id) return n; return id; };
  const unitOf = id => UNITS.find(u => u.id === id);

  function buildLessons() {
    const list = [];
    for (const unit of UNITS) for (const [skill, name] of unit.skills) {
      const qs = QUESTIONS.filter(q => q.subject === unit.id && q.skill === skill);
      if (!qs.length) continue;
      const n = Math.max(1, Math.round(qs.length / LESSON_SIZE));
      for (let i = 0; i < n; i++) {
        const ids = qs.slice(Math.floor(i * qs.length / n), Math.floor((i + 1) * qs.length / n)).map(q => q.id);
        list.push({ id: `${skill}-${i + 1}`, unit: unit.id, skill, name, part: i + 1, parts: n, ids });
      }
    }
    return list;
  }
  const LESSONS = buildLessons();

  /* ---------- Storage ---------- */
  const KEY = 'tarsi-cse-v1';
  const fresh = () => ({ v: 1, xp: 0, streak: 0, lastDay: null, days: {}, lessons: {}, q: {}, flags: {}, mock: null, mocks: [] });
  let store = fresh();
  let storageOk = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(fresh(), JSON.parse(raw));
  } catch (e) { storageOk = false; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); storageOk = true; } catch (e) { storageOk = false; }
  }

  /* ---------- Dates ---------- */
  const dayStr = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const today = () => dayStr(new Date());
  const shiftDay = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dayStr(new Date(y, m - 1, d + n)); };
  function daysToExam() {
    const [y, m, d] = EXAM_DATE.split('-').map(Number);
    const now = new Date();
    return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  }
  const currentStreak = () => (store.lastDay === today() || store.lastDay === shiftDay(today(), -1)) ? store.streak : 0;
  function addXp(n) {
    const t = today();
    if (store.lastDay !== t) {
      store.streak = store.lastDay === shiftDay(t, -1) ? store.streak + 1 : 1;
      store.lastDay = t;
    }
    store.xp += n;
    store.days[t] = (store.days[t] || 0) + n;
    save();
  }

  /* ---------- Question stats ---------- */
  const CLEAR_AFTER = 2; // right answers, in separate sessions, needed to leave the mistakes list
  function record(id, ok) {
    const s = store.q[id] || (store.q[id] = { seen: 0, right: 0, wrong: 0, bin: false, clear: 0 });
    s.seen++;
    if (ok) {
      s.right++;
      if (s.bin && ++s.clear >= CLEAR_AFTER) { s.bin = false; s.clear = 0; }
    } else {
      s.wrong++; s.bin = true; s.clear = 0;
    }
    save();
  }
  const mistakes = () => Object.keys(store.q).filter(id => store.q[id].bin && BY_ID.has(id));
  function skillStats(unit, skill) {
    let seen = 0, right = 0, tried = 0, total = 0;
    for (const q of QUESTIONS) if (q.subject === unit && q.skill === skill) {
      total++;
      const s = store.q[q.id];
      if (s && s.seen) { tried++; seen += s.seen; right += s.right; }
    }
    return { seen, right, tried, total, pct: seen ? Math.round(right / seen * 100) : null };
  }

  /* ---------- DOM helpers ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }
  function svgEl(markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  }
  const P = {
    flame: '<path fill="currentColor" d="M12.7 2c.6 3.3-1 5-2.6 6.8C8.5 10.500 6.500 12.300 6.500 15.300 6.500 19 9 22 12.300 22c3.400 0 5.900-2.700 5.900-6.300 0-3.900-2.600-6.200-3.700-8.700-.3 1.400-.9 2.400-1.900 3.200.4-2.800.3-5.700.1-8.200z"/>',
    bolt: '<path fill="currentColor" d="M13.500 2 4.800 13.300c-.4.500 0 1.200.6 1.200h5.100l-1.300 7c-.1.800.9 1.200 1.400.6l8.700-11.300c.4-.5 0-1.200-.6-1.200h-5.100l1.300-7c.1-.8-.9-1.200-1.400-.6z"/>',
    heart: '<path fill="currentColor" d="M12 21.300s-9.500-5.800-9.500-12.300C2.500 5.700 5 3.500 7.800 3.500c1.800 0 3.300.9 4.200 2.400.9-1.500 2.400-2.400 4.200-2.400 2.800 0 5.300 2.200 5.300 5.500 0 6.500-9.500 12.300-9.500 12.300z"/>',
    star: '<path fill="currentColor" d="m12 2.500 2.900 6.200 6.700.8-5 4.600 1.400 6.700L12 17.400l-6 3.400 1.400-6.700-5-4.600 6.700-.8z"/>',
    check: '<path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="m4.500 12.500 5 5 10-11"/>',
    x: '<path fill="none" stroke="currentColor" stroke-width="3.500" stroke-linecap="round" d="M5.500 5.500 18.500 18.500M18.500 5.500 5.500 18.500"/>',
    path: '<path fill="currentColor" d="M12 2.800 2.500 8 12 13.200 21.500 8zM5.500 12.300v4.300c0 1.700 3 3.700 6.500 3.700s6.500-2 6.500-3.700v-4.300L12 15.900z"/>',
    target: '<circle cx="12" cy="12" r="9.500" fill="none" stroke="currentColor" stroke-width="2.500"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.500"/><circle cx="12" cy="12" r="1.800" fill="currentColor"/>',
    clock: '<circle cx="12" cy="12" r="9.500" fill="none" stroke="currentColor" stroke-width="2.500"/><path fill="none" stroke="currentColor" stroke-width="2.500" stroke-linecap="round" d="M12 6.500V12l3.500 2.500"/>',
    user: '<circle cx="12" cy="8" r="4.500" fill="currentColor"/><path fill="currentColor" d="M3.500 21c.6-4.700 4-7.300 8.500-7.300s7.900 2.600 8.500 7.300z"/>',
    flag: '<path fill="currentColor" d="M5 2.500c.6 0 1 .4 1 1V4h12.500c.7 0 1.100.8.700 1.400L16.500 9.500l2.700 4.100c.4.600 0 1.400-.7 1.400H6v6.500c0 .6-.4 1-1 1s-1-.4-1-1v-18c0-.6.4-1 1-1z"/>',
    grid: '<path fill="currentColor" d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>',
    pause: '<path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
    refresh: '<path fill="none" stroke="currentColor" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round" d="M20 11a8 8 0 1 0-2.300 6.300M20 4.500V11h-6.500"/>',
    calendar: '<path fill="currentColor" d="M7 2h2v2.500h6V2h2v2.500h2.500c.8 0 1.500.7 1.500 1.500v14.500c0 .8-.7 1.500-1.500 1.500h-15c-.8 0-1.500-.7-1.500-1.500V6c0-.8.700-1.500 1.500-1.500H7zM5 10v10h14V10z"/>',
    book: '<path fill="currentColor" d="M4 3.500h6.500c.7 0 1.100.2 1.500.6.400-.4.800-.6 1.500-.6H20c.6 0 1 .4 1 1V19c0 .6-.4 1-1 1h-6c-.8 0-1.200.2-1.300.8h-1.400c-.1-.6-.5-.8-1.300-.8H4c-.6 0-1-.4-1-1V4.500c0-.6.4-1 1-1z"/>',
  };
  const icon = (name, cls) => svgEl(`<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`);

  function mascot(mood, cls) {
    const mouth = { happy: '<path d="M53 101q7 7 14 0" fill="#7d3c26" stroke="#5a3a1e" stroke-width="2.500" stroke-linejoin="round"/>', ok: '<path d="M54 102q6 4 12 0" fill="none" stroke="#5a3a1e" stroke-width="3" stroke-linecap="round"/>', sad: '<path d="M54 105q6-5 12 0" fill="none" stroke="#5a3a1e" stroke-width="3" stroke-linecap="round"/>' }[mood] || '';
    const brows = mood === 'sad' ? '<path d="M15 34l24-6M105 34l-24-6" stroke="#5a3a1e" stroke-width="4" stroke-linecap="round"/>' : '';
    return svgEl(`<svg class="mascot ${cls || ''}" viewBox="0 0 120 124" role="img" aria-label="Tarsi the tarsier"><ellipse cx="60" cy="119" rx="28" ry="4.500" fill="#000" opacity=".12"/><path d="M26 44C8 38 2 16 12 7c11-8 28 7 31 24zM94 44c18-6 24-28 14-37-11-8-28 7-31 24z" fill="#a9743f"/><path d="M26 37C15 33 10 20 16 14c7-5 18 5 21 16zM94 37c11-4 16-17 10-23-7-5-18 5-21 16z" fill="#f2b8a0"/><ellipse cx="60" cy="68" rx="46" ry="46" fill="#c08a52"/><ellipse cx="60" cy="97" rx="15" ry="13" fill="#ecd3ae"/><circle cx="36" cy="60" r="27" fill="#fff"/><circle cx="84" cy="60" r="27" fill="#fff"/><circle cx="37" cy="61" r="23" fill="#c9761d"/><circle cx="83" cy="61" r="23" fill="#c9761d"/><circle cx="38" cy="62" r="15" fill="#21140a"/><circle cx="82" cy="62" r="15" fill="#21140a"/><circle cx="44" cy="55" r="5.500" fill="#fff"/><circle cx="88" cy="55" r="5.500" fill="#fff"/>${brows}<ellipse cx="60" cy="92" rx="3" ry="2.200" fill="#7d4a2c"/>${mouth}</svg>`);
  }

  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const app = document.getElementById('app');
  let keyHandler = null;
  let ticker = null;
  function mount(...nodes) {
    clearInterval(ticker); ticker = null; keyHandler = null;
    app.replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }
  function toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2600);
  }
  function modal(title, body, actions) {
    const prevFocus = document.activeElement;
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc, true); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const acts = actions.map(a => h('button', { class: 'btn ' + (a.cls || ''), onclick: () => { const keep = a.fn && a.fn(); if (keep !== true) close(); } }, a.label));
    const bg = h('div', { class: 'modal-bg', onclick: e => { if (e.target === bg) close(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', null, title), body, h('div', { class: 'acts' }, acts)));
    document.body.append(bg);
    document.addEventListener('keydown', esc, true);
    acts[0] && acts[0].focus();
  }
  const modalOpen = () => !!document.querySelector('.modal-bg');
  document.addEventListener('keydown', e => {
    if (!keyHandler || modalOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(TEXTAREA|INPUT|SUMMARY)$/.test(e.target.tagName)) return;
    keyHandler(e);
  });

  /* ---------- Shell ---------- */
  const TABS = [['learn', 'Learn', 'path'], ['practice', 'Practice', 'target'], ['mock', 'Mock', 'clock'], ['me', 'Progress', 'user'], ['guide', 'Guide', 'book']];
  function shell(tab, ...content) {
    const links = () => TABS.map(([id, label, ic]) => h('a', { class: 'tab' + (tab === id ? ' on' : ''), href: '#/' + id, 'aria-current': tab === id ? 'page' : null }, icon(ic), label));
    const streak = currentStreak();
    return h('div', { class: 'shell' },
      h('aside', { class: 'side side-only' }, h('div', { class: 'brand' }, mascot('happy'), 'Tarsi'), h('nav', { class: 'tabs', 'aria-label': 'Main' }, links())),
      h('div', { class: 'main' },
        h('div', { class: 'topstats' },
          h('span', { class: 'stat flame' + (streak ? '' : ' off'), title: 'Day streak' }, icon('flame'), h('span', { 'aria-label': `${streak} day streak` }, streak)),
          h('span', { class: 'stat xp', title: 'Total XP' }, icon('bolt'), h('span', { 'aria-label': `${store.xp} XP` }, store.xp)),
          h('span', { class: 'stat days', title: 'Days to the exam' }, icon('calendar'), h('span', { 'aria-label': `${daysToExam()} days to the exam` }, `${Math.max(0, daysToExam())}d`))),
        h('main', { class: 'wrap' }, content)),
      h('nav', { class: 'tabs mobile-tabs', 'aria-label': 'Main' }, links()));
  }

  /* ---------- Learn ---------- */
  const OFFSETS = [0, 46, 72, 46, 0, -46, -72, -46];
  function viewLearn() {
    if (!QUESTIONS.length) return mount(shell('learn', h('div', { class: 'card' }, h('h3', null, 'Questions did not load'), h('p', { class: 'muted' }, 'Reload the page. If this keeps happening, questions.js is missing.'))));
    const nextId = (LESSONS.find(l => !store.lessons[l.id]) || {}).id;
    const content = [];
    if (!storageOk) content.push(h('div', { class: 'notice' }, h('b', null, 'Progress is not being saved. '), 'This browser is blocking storage, so your progress ends when you close the tab.'));
    let n = 0, unitNo = 0;
    for (const unit of UNITS) {
      unitNo++;
      const section = h('section', { class: 'c-' + unit.id });
      section.append(h('div', { class: 'unit' }, h('small', null, `Unit ${unitNo}`), h('h2', null, unit.name), h('p', null, unit.blurb)));
      for (const [skill, name] of unit.skills) {
        const ls = LESSONS.filter(l => l.skill === skill && l.unit === unit.id);
        if (!ls.length) continue;
        section.append(h('div', { class: 'skillhead' }, h('span', null, name)));
        const path = h('div', { class: 'path' });
        for (const l of ls) {
          const done = !!store.lessons[l.id], cur = l.id === nextId;
          const x = OFFSETS[n % OFFSETS.length];
          const wrap = h('div', { class: 'nodewrap' + (cur ? ' current' : ''), style: `--x:${x}px` },
            cur ? h('div', { class: 'bubble' }, done ? 'AGAIN' : 'START') : null,
            h('button', { class: 'node' + (done ? ' done' : '') + (cur ? ' current' : ''), 'aria-label': `${name}, lesson ${l.part} of ${l.parts}${done ? ', completed' : ''}`, 'data-lesson': l.id, onclick: () => startLesson(l) }, icon(done ? 'check' : 'star')));
          if (n % 8 === 2) wrap.append(mascot('ok', 'sidekick l'));
          if (n % 8 === 6) wrap.append(mascot('happy', 'sidekick r'));
          path.append(wrap);
          n++;
        }
        section.append(path);
      }
      content.push(section);
    }
    content.push(h('p', { class: 'fine', style: 'text-align:center;margin-top:30px' }, 'Unofficial personal study tool. Not affiliated with or endorsed by the Civil Service Commission.'));
    mount(shell('learn', content));
    const cur = document.querySelector('.nodewrap.current');
    if (cur && Object.keys(store.lessons).length) cur.scrollIntoView({ block: 'center' });
  }

  /* ---------- Question rendering ---------- */
  function renderStem(q) {
    const nodes = [];
    if (q.passage) nodes.push(h('div', { class: 'passage' }, q.passage));
    if (q.table) nodes.push(h('div', { class: 'tablewrap' }, h('table', null,
      q.table.caption ? h('caption', null, q.table.caption) : null,
      h('thead', null, h('tr', null, q.table.headers.map(c => h('th', { scope: 'col' }, c)))),
      h('tbody', null, q.table.rows.map(r => h('tr', null, r.map(c => h('td', null, c))))))));
    nodes.push(h('h1', { class: 'question' }, q.question));
    return nodes;
  }
  function flagControl(q) {
    const flagged = () => !!store.flags[q.id];
    const btn = h('button', { class: 'flagbtn' + (flagged() ? ' on' : ''), 'data-nokey': true, onclick: () => {
      const area = h('textarea', { placeholder: 'What looks wrong? (optional)', 'aria-label': 'What looks wrong' }, store.flags[q.id] ? store.flags[q.id].note : '');
      const acts = [{ label: 'Save flag', fn: () => { store.flags[q.id] = { note: area.value.trim(), at: today() }; save(); sync(); } }];
      if (flagged()) acts.push({ label: 'Remove flag', cls: 'ghost', fn: () => { delete store.flags[q.id]; save(); sync(); } });
      acts.push({ label: 'Cancel', cls: 'ghost' });
      modal('Flag this question', h('div', null, h('p', { class: 'muted' }, `Saved on your Progress page as ${q.id}.`), area), acts);
    } });
    const sync = () => {
      btn.className = 'flagbtn' + (flagged() ? ' on' : '');
      btn.replaceChildren(icon('flag'), flagged() ? 'Flagged' : 'Answer looks wrong?');
    };
    sync();
    return btn;
  }

  /* ---------- Lesson / practice session ---------- */
  function startLesson(l) {
    const title = l.parts > 1 ? `${l.name}, lesson ${l.part}` : l.name;
    runSession({ title, unit: l.unit, ids: shuffle(l.ids), hearts: HEARTS, lessonId: l.id, restart: () => startLesson(l) });
  }
  function startPractice(title, ids, unit, restart) {
    if (!ids.length) return toast('Nothing to practice here yet.');
    runSession({ title, unit: unit || 'general', ids, hearts: null, lessonId: null, restart });
  }
  function runSession(opts) {
    const total = opts.ids.length;
    const s = { queue: opts.ids.slice(), doneCount: 0, hearts: opts.hearts, firstTry: new Set(), attempted: new Set(), started: Date.now() };
    const showQuestion = () => {
      const q = BY_ID.get(s.queue[0]);
      if (!q) { s.queue.shift(); return s.queue.length ? showQuestion() : finish(); }
      const order = shuffle([0, 1, 2, 3]);
      let selected = null, checked = false;
      const check = h('button', { class: 'btn', disabled: true, 'data-act': 'check', onclick: () => doCheck() }, 'Check');
      const footIn = h('div', { class: 'foot-in' }, check);
      const foot = h('div', { class: 'foot' }, footIn);
      const optBtns = order.map((orig, i) => h('button', { class: 'opt', 'data-orig': orig, 'aria-pressed': 'false', onclick: () => pick(i) }, h('span', { class: 'num' }, i + 1), h('span', null, q.options[orig])));
      const pick = i => {
        if (checked) return;
        selected = i;
        optBtns.forEach((b, j) => { b.classList.toggle('sel', j === i); b.setAttribute('aria-pressed', String(j === i)); });
        check.disabled = false;
      };
      const doCheck = () => {
        if (selected == null || checked) return;
        checked = true;
        const ok = order[selected] === q.answer;
        const first = !s.attempted.has(q.id);
        if (first) { s.attempted.add(q.id); record(q.id, ok); if (ok) s.firstTry.add(q.id); }
        optBtns.forEach((b, j) => {
          b.disabled = true; b.classList.remove('sel');
          if (order[j] === q.answer) b.classList.add('right');
          else if (j === selected) b.classList.add('wrong');
        });
        s.queue.shift();
        if (ok) s.doneCount++;
        else { s.queue.push(q.id); if (s.hearts != null) s.hearts--; }
        updateTop();
        const out = s.hearts === 0;
        const cont = h('button', { class: 'btn', 'data-act': 'continue', onclick: () => next(out) }, out ? 'See results' : 'Continue');
        foot.className = 'foot ' + (ok ? 'ok' : 'bad');
        footIn.replaceChildren(
          h('div', { class: 'verdict', role: 'status' }, icon(ok ? 'check' : 'x'), ok ? 'Correct!' : 'Not quite'),
          h('div', { class: 'explain' }, ok ? null : h('b', null, `Answer: ${q.options[q.answer]}. `), q.explanation, q.source ? h('span', { class: 'src' }, `Source: ${q.source}`) : null, h('div', null, flagControl(q))),
          cont);
        cont.focus({ preventScroll: true });
      };
      const next = out => {
        if (out) return outOfHearts();
        if (!s.queue.length) return finish();
        showQuestion();
      };
      const bar = h('i', { style: `width:${s.doneCount / total * 100}%` });
      const heartsEl = s.hearts != null ? h('span', { class: 'hearts', 'aria-label': `${s.hearts} hearts left` }, icon('heart'), h('span', null, s.hearts)) : null;
      const updateTop = () => {
        bar.style.width = `${s.doneCount / total * 100}%`;
        bar.parentNode.setAttribute('aria-valuenow', s.doneCount);
        if (heartsEl) { heartsEl.lastChild.textContent = s.hearts; heartsEl.setAttribute('aria-label', `${s.hearts} hearts left`); }
      };
      const retried = s.attempted.has(q.id);
      mount(h('div', { class: 'lesson c-' + q.subject },
        h('div', { class: 'lessontop' },
          h('button', { class: 'iconbtn', 'aria-label': 'Leave lesson', onclick: () => modal('Leave this lesson?', h('p', null, 'This lesson will not be marked complete. Answers you already gave still count in your stats.'), [{ label: 'Keep going', cls: 'good' }, { label: 'Leave', cls: 'ghost', fn: () => go('learn') }]) }, icon('x')),
          h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': s.doneCount, 'aria-label': 'Lesson progress' }, bar),
          heartsEl),
        h('div', { class: 'qbody' },
          h('div', { class: 'eyebrow' }, retried ? 'Try this one again' : skillName(q.skill)),
          renderStem(q),
          h('div', { class: 'options', role: 'group', 'aria-label': 'Answer choices' }, optBtns)),
        foot));
      keyHandler = e => {
        if (!checked && /^[1-4]$/.test(e.key)) { pick(+e.key - 1); return; }
        if (e.key === 'Enter' && e.target.getAttribute('data-nokey') == null) {
          e.preventDefault();
          if (checked) footIn.querySelector('[data-act=continue]').click();
          else if (selected != null) doCheck();
        }
      };
    };
    const outOfHearts = () => {
      mount(h('div', { class: 'endscreen c-numerical' },
        mascot('sad'), h('h1', null, 'Out of hearts'),
        h('p', null, 'No harm done. The questions you missed are saved in your mistakes list, so you can study them before trying again.'),
        h('button', { class: 'btn wide', onclick: opts.restart }, 'Try again'),
        h('a', { class: 'btn ghost wide', href: '#/learn', style: 'text-decoration:none' }, 'Back to path')));
    };
    const finish = () => {
      const right = s.firstTry.size;
      const acc = Math.round(right / total * 100);
      const perfect = right === total;
      const xp = right * 2 + (perfect ? 5 : 0);
      addXp(xp);
      if (opts.lessonId) {
        const prev = store.lessons[opts.lessonId];
        store.lessons[opts.lessonId] = { best: Math.max(acc, prev ? prev.best : 0), at: today() };
        save();
      }
      const secs = Math.round((Date.now() - s.started) / 1000);
      const cont = h('button', { class: 'btn wide', onclick: () => go(opts.lessonId ? 'learn' : 'practice') }, 'Continue');
      const confetti = perfect ? h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 36 }, (_, i) => h('i', { style: `left:${(i * 2.77) % 100}%;background:${['#f5b800', '#268600', '#0b74bd', '#ee3f4d', '#7f43d0'][i % 5]};animation-delay:${(i % 9) * 0.09}s` }))) : null;
      mount(h('div', { class: 'endscreen c-' + opts.unit }, confetti, mascot('happy'),
        h('h1', null, perfect ? 'Perfect lesson!' : 'Lesson complete!'),
        h('p', null, opts.title),
        h('div', { class: 'endstats' },
          h('div', { class: 'endstat' }, h('small', null, 'XP'), h('b', null, `+${xp}`)),
          h('div', { class: 'endstat' }, h('small', null, 'First try'), h('b', null, `${acc}%`)),
          h('div', { class: 'endstat' }, h('small', null, 'Time'), h('b', null, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`))),
        cont));
      cont.focus();
      keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); cont.click(); } };
    };
    showQuestion();
  }

  /* ---------- Practice ---------- */
  function viewPractice() {
    const bin = mistakes();
    let weakest = null;
    for (const u of UNITS) for (const [skill, name] of u.skills) {
      const st = skillStats(u.id, skill);
      if (st.seen >= 3 && st.pct < 100 && (!weakest || st.pct < weakest.pct)) weakest = { unit: u.id, skill, name, pct: st.pct };
    }
    const practiceSkill = w => {
      const ids = QUESTIONS.filter(q => q.subject === w.unit && q.skill === w.skill).map(q => q.id);
      startPractice(w.name, shuffle(ids).slice(0, 10), w.unit, () => practiceSkill(w));
    };
    const practiceBin = () => startPractice('Mistakes review', shuffle(mistakes()).slice(0, 12), 'numerical', () => go('practice'));
    const quick = u => startPractice(u ? unitOf(u).name : 'Mixed practice', shuffle(QUESTIONS.filter(q => !u || q.subject === u).map(q => q.id)).slice(0, 10), u || 'verbal', () => quick(u));
    mount(shell('practice',
      h('h1', { class: 'title' }, 'Practice'),
      h('p', { class: 'sub' }, 'No hearts here. Missed questions come back until you get them right.'),
      h('div', { class: 'card c-numerical' }, h('div', { class: 'row' }, h('div', { class: 'tile' }, icon('refresh')), h('div', { class: 'grow' }, h('h3', null, `Mistakes (${bin.length})`), h('p', { class: 'muted' }, bin.length ? `A question leaves this list after you get it right in ${CLEAR_AFTER} separate sessions.` : 'Questions you miss will show up here.'))),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn wide', disabled: !bin.length, 'data-act': 'mistakes', onclick: practiceBin }, 'Review mistakes'))),
      h('div', { class: 'card c-analytical' }, h('div', { class: 'row' }, h('div', { class: 'tile' }, icon('target')), h('div', { class: 'grow' }, h('h3', null, weakest ? `Weakest skill: ${weakest.name}` : 'Weakest skill'), h('p', { class: 'muted' }, weakest ? `${weakest.pct}% correct so far.` : 'Answer a few more questions to find this.'))),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn wide', disabled: !weakest, onclick: () => practiceSkill(weakest) }, 'Practice it'))),
      h('div', { class: 'card' }, h('h3', null, 'Quick 10'), h('p', { class: 'muted' }, 'Ten random questions.'),
        h('div', { class: 'btnrow' }, h('button', { class: 'btn small c-verbal', 'data-act': 'quick', onclick: () => quick(null) }, 'Mixed'), UNITS.map(u => h('button', { class: 'btn small c-' + u.id, onclick: () => quick(u.id) }, u.name))))));
  }

  /* ---------- Mock exam ---------- */
  function pickMock(items) {
    // Proportional to the question bank. CSC does not publish a per-subject split.
    const bank = UNITS.map(u => ({ id: u.id, qs: shuffle(QUESTIONS.filter(q => q.subject === u.id).map(q => q.id)) }));
    const n = Math.min(items, QUESTIONS.length);
    const alloc = bank.map(b => ({ b, exact: b.qs.length / QUESTIONS.length * n }));
    alloc.forEach(a => { a.take = Math.floor(a.exact); });
    let left = n - alloc.reduce((t, a) => t + a.take, 0);
    alloc.slice().sort((a, b) => (b.exact % 1) - (a.exact % 1)).forEach(a => { if (left > 0) { a.take++; left--; } });
    return alloc.flatMap(a => a.b.qs.slice(0, a.take));
  }
  function viewMockHome() {
    const m = store.mock;
    const card = (kind, cfg) => h('div', { class: 'card c-' + (kind === 'full' ? 'verbal' : 'analytical') },
      h('div', { class: 'row' }, h('div', { class: 'tile' }, icon(kind === 'full' ? 'clock' : 'bolt')), h('div', { class: 'grow' }, h('h3', null, cfg.name), h('p', { class: 'muted' }, `${Math.min(cfg.items, QUESTIONS.length)} items, ${Math.floor(cfg.mins / 60) ? Math.floor(cfg.mins / 60) + ' h ' : ''}${cfg.mins % 60} min`))),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn wide', 'data-mock': kind, onclick: () => {
        if (store.mock) return modal('Replace your unfinished mock?', h('p', null, 'Starting a new one discards the mock you have in progress.'), [{ label: 'Keep unfinished mock', cls: 'good' }, { label: 'Discard and start', cls: 'ghost', fn: () => startMock(kind) }]);
        startMock(kind);
      } }, 'Start')));
    mount(shell('mock',
      h('h1', { class: 'title' }, 'Mock exam'),
      h('p', { class: 'sub' }, 'No hints and no answers until you submit. Aim for at least 80%.'),
      m ? h('div', { class: 'notice' }, h('b', null, 'You have a mock in progress. '), `${Object.keys(m.answers).length} of ${m.ids.length} answered.`, h('div', { class: 'btnrow' }, h('button', { class: 'btn small c-verbal', 'data-act': 'resume', onclick: runMock }, 'Resume'))) : null,
      card('full', MOCKS.full), card('mini', MOCKS.mini),
      h('div', { class: 'card' }, h('h3', null, 'How close is this to the real exam?'),
        h('p', { class: 'muted' }, `Subjects follow CSC's published scope. CSC's announcement does not state the item count, time limit or subject split, so the length is based on unofficial reports (which vary between 150 and 170 items) and the mix follows this question bank. The real rating may not be a simple percentage, so treat the 80% line as a target and not a prediction.`)),
      store.mocks.length ? h('div', { class: 'card' }, h('h3', null, 'Past results'), store.mocks.slice(-8).reverse().map(r => h('div', { class: 'skillrow' }, h('span', null, `${r.at} · ${r.total} items`), h('em', null, `${r.pct}%`), h('div', { class: 'bar c-' + (r.pct >= PASS ? 'general' : 'numerical') }, h('i', { style: `width:${r.pct}%` }))))) : null));
  }
  function startMock(kind) {
    const cfg = MOCKS[kind];
    const ids = pickMock(cfg.items);
    const orders = {};
    ids.forEach(id => { orders[id] = shuffle([0, 1, 2, 3]); });
    store.mock = { kind, ids: shuffle(ids), orders, answers: {}, marks: {}, idx: 0, remaining: cfg.mins * 60 * 1000 };
    save();
    runMock();
  }
  const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); const hh = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
  function runMock() {
    const m = store.mock;
    if (!m) return go('mock');
    m.ids = m.ids.filter(id => BY_ID.has(id));
    if (!m.ids.length) { store.mock = null; save(); return go('mock'); }
    m.idx = Math.min(m.idx, m.ids.length - 1);
    const timer = h('span', { class: 'timer', role: 'timer' }, icon('clock'), h('span', null, fmt(m.remaining)));
    const count = h('div', { class: 'count' });
    const pauseBtn = h('button', { class: 'iconbtn', 'aria-label': 'Pause and exit', onclick: () => { tick(); save(); go('mock'); } }, icon('pause'));
    const gridBtn = h('button', { class: 'iconbtn', 'aria-label': 'All questions', 'data-act': 'palette', onclick: () => palette() }, icon('grid'));
    const body = h('div', { class: 'qbody' });
    const prev = h('button', { class: 'btn ghost', 'data-act': 'prev', onclick: () => goto(m.idx - 1) }, 'Back');
    const next = h('button', { class: 'btn', 'data-act': 'next', onclick: () => { if (m.idx === m.ids.length - 1) confirmSubmit(); else goto(m.idx + 1); } }, 'Next');
    const foot = h('div', { class: 'foot' }, h('div', { class: 'foot-in' }, h('div', { class: 'mocknav' }, prev, next)));
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      m.remaining -= now - last; last = now;
      timer.lastChild.textContent = fmt(m.remaining);
      timer.classList.toggle('low', m.remaining < 5 * 60 * 1000);
    };
    const goto = i => { m.idx = Math.max(0, Math.min(m.ids.length - 1, i)); save(); draw(); window.scrollTo(0, 0); };
    const draw = () => {
      const id = m.ids[m.idx], q = BY_ID.get(id), order = m.orders[id] || [0, 1, 2, 3];
      count.textContent = `Question ${m.idx + 1} of ${m.ids.length}`;
      const opts = order.map((orig, i) => h('button', { class: 'opt' + (m.answers[id] === orig ? ' sel' : ''), 'aria-pressed': String(m.answers[id] === orig), onclick: () => select(i) }, h('span', { class: 'num' }, i + 1), h('span', null, q.options[orig])));
      const select = i => {
        m.answers[id] = order[i];
        opts.forEach((b, j) => { b.classList.toggle('sel', j === i); b.setAttribute('aria-pressed', String(j === i)); });
        save();
      };
      const mark = h('button', { class: 'flagbtn' + (m.marks[id] ? ' on' : ''), style: 'margin-top:12px', 'data-nokey': true, onclick: () => { if (m.marks[id]) delete m.marks[id]; else m.marks[id] = true; save(); draw(); } }, icon('flag'), m.marks[id] ? 'Marked for review' : 'Mark for review');
      body.replaceChildren(h('div', { class: 'eyebrow' }, unitOf(q.subject).name), ...renderStem(q), h('div', { class: 'options', role: 'group', 'aria-label': 'Answer choices' }, opts), mark);
      body.className = 'qbody c-' + q.subject;
      prev.disabled = m.idx === 0;
      next.textContent = m.idx === m.ids.length - 1 ? 'Finish' : 'Next';
      curSelect = select;
    };
    let curSelect = null;
    const palette = () => {
      const grid = h('div', { class: 'pal' }, m.ids.map((id, i) => h('button', { class: (m.answers[id] != null ? 'ans ' : '') + (m.marks[id] ? 'mark ' : '') + (i === m.idx ? 'cur' : ''), 'aria-label': `Question ${i + 1}${m.answers[id] != null ? ', answered' : ''}${m.marks[id] ? ', marked' : ''}`, onclick: () => { document.querySelector('.modal-bg').remove(); goto(i); } }, i + 1)));
      modal('All questions', h('div', null, h('div', { class: 'legend' }, h('span', null, `${Object.keys(m.answers).length} answered`), h('span', null, `${Object.keys(m.marks).length} marked`)), grid), [{ label: 'Finish exam', cls: 'good', fn: () => { confirmSubmit(); } }, { label: 'Close', cls: 'ghost' }]);
    };
    const confirmSubmit = () => {
      const left = m.ids.length - m.ids.filter(id => m.answers[id] != null).length;
      modal('Finish the exam?', h('p', null, left ? `You still have ${left} unanswered. They count as wrong.` : 'All questions are answered.'), [{ label: 'Submit', cls: 'good', fn: () => submitMock() }, { label: 'Keep working', cls: 'ghost' }]);
    };
    mount(h('div', { class: 'lesson' }, h('div', { class: 'mockbar' }, pauseBtn, timer, count, gridBtn), body, foot));
    draw();
    ticker = setInterval(() => {
      tick();
      if (m.remaining <= 0) { document.querySelectorAll('.modal-bg').forEach(b => b.remove()); toast("Time's up. Your exam was submitted."); submitMock(); return; }
      if (Math.floor(m.remaining / 1000) % 5 === 0) save();
    }, 1000);
    keyHandler = e => {
      if (/^[1-4]$/.test(e.key)) curSelect(+e.key - 1);
      else if (e.key === 'ArrowRight') { if (m.idx < m.ids.length - 1) goto(m.idx + 1); }
      else if (e.key === 'ArrowLeft') goto(m.idx - 1);
    };
  }
  function submitMock() {
    const m = store.mock;
    if (!m) return;
    const rows = m.ids.map(id => ({ q: BY_ID.get(id), chosen: m.answers[id] })).filter(r => r.q);
    let right = 0;
    const bySubject = {};
    rows.forEach(r => {
      const ok = r.chosen === r.q.answer;
      if (ok) right++;
      (bySubject[r.q.subject] = bySubject[r.q.subject] || { right: 0, total: 0 }).total++;
      if (ok) bySubject[r.q.subject].right++;
      record(r.q.id, ok);
    });
    const pct = Math.round(right / rows.length * 1000) / 10;
    store.mock = null;
    store.mocks.push({ at: today(), kind: m.kind, right, total: rows.length, pct, bySubject });
    addXp(Math.floor(right / 2));
    save();
    const pass = pct >= PASS;
    const wrong = rows.filter(r => r.chosen !== r.q.answer);
    mount(shell('mock',
      h('div', { class: 'c-' + (pass ? 'general' : 'numerical'), style: 'text-align:center;margin-bottom:16px' },
        mascot(pass ? 'happy' : 'ok', 'endmascot'),
        h('h1', { class: 'title', 'data-score': pct }, `${pct}%`),
        h('p', { class: 'sub' }, `${right} of ${rows.length} correct. ${pass ? 'Above your 80% target. Keep it there.' : `${(PASS - pct).toFixed(1)} points below your 80% target. Your missed items are in Mistakes.`}`)),
      h('div', { class: 'card' }, h('h3', null, 'By subject'), UNITS.filter(u => bySubject[u.id]).map(u => {
        const b = bySubject[u.id], p = Math.round(b.right / b.total * 100);
        return h('div', { class: 'skillrow c-' + u.id }, h('span', null, u.name), h('em', null, `${b.right}/${b.total} · ${p}%`), h('div', { class: 'bar' }, h('i', { style: `width:${p}%` })));
      })),
      wrong.length ? h('h2', { style: 'font-size:20px;margin:20px 0 10px' }, `Review ${wrong.length} missed`) : null,
      wrong.map(r => h('details', { class: 'rev c-' + r.q.subject }, h('summary', null, r.q.question.length > 110 ? r.q.question.slice(0, 110) + '...' : r.q.question),
        r.q.passage ? h('p', { style: 'white-space:pre-line' }, r.q.passage) : null,
        h('p', null, h('b', null, 'Your answer: '), r.chosen == null ? 'Not answered' : r.q.options[r.chosen]),
        h('p', null, h('b', null, 'Correct: '), r.q.options[r.q.answer]),
        h('p', null, r.q.explanation), r.q.source ? h('p', { class: 'fine' }, `Source: ${r.q.source}`) : null, flagControl(r.q))),
      h('div', { class: 'btnrow' }, h('a', { class: 'btn wide', href: '#/practice', style: 'text-decoration:none' }, 'Go to practice'))));
    const em = document.querySelector('.endmascot');
    if (em) em.style.width = '110px';
  }

  /* ---------- Progress ---------- */
  function viewMe() {
    const answered = Object.values(store.q).filter(s => s.seen).length;
    const lessonsDone = LESSONS.filter(l => store.lessons[l.id]).length;
    const todayXp = store.days[today()] || 0;
    const flagged = Object.entries(store.flags);
    const d = daysToExam();
    const backup = () => {
      const blob = new Blob([JSON.stringify(store)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `tarsi-cse-backup-${today()}.json` });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', 'aria-label': 'Backup file', onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || data.v !== 1 || typeof data.xp !== 'number' || typeof data.q !== 'object' || data.q === null) throw new Error('shape');
        modal('Restore this backup?', h('p', null, `It has ${data.xp} XP and replaces all progress in this browser.`), [{ label: 'Restore', cls: 'good', fn: () => { store = Object.assign(fresh(), data); save(); viewMe(); toast('Backup restored.'); } }, { label: 'Cancel', cls: 'ghost' }]);
      } catch (err) { toast('That file is not a valid backup.'); }
      e.target.value = '';
    } });
    const copyFlags = async () => {
      const text = flagged.map(([id, f]) => `${id}${f.note ? ': ' + f.note : ''}`).join('\n');
      try { await navigator.clipboard.writeText(text); toast('Copied.'); } catch (e) { modal('Copy this list', h('textarea', { readonly: true }, text), [{ label: 'Close', cls: 'ghost' }]); }
    };
    mount(shell('me',
      h('h1', { class: 'title' }, 'Your progress'),
      h('div', { class: 'notice' }, h('b', null, d > 0 ? `${d} days to the exam. ` : d === 0 ? 'Exam day! ' : 'This exam date has passed. '), 'Sunday, 14 March 2027. Filing opened 2 November 2026 and closes when slots run out, so file early with your CSC regional or field office. ', h('a', { href: ANNOUNCEMENT, target: '_blank', rel: 'noopener' }, 'Read the announcement')),
      h('div', { class: 'grid2', style: 'margin-bottom:14px' },
        h('div', { class: 'metric' }, h('b', { style: 'color:var(--flame)' }, icon('flame'), currentStreak()), h('span', null, 'Day streak')),
        h('div', { class: 'metric' }, h('b', { style: 'color:var(--xp)' }, icon('bolt'), store.xp), h('span', null, 'Total XP')),
        h('div', { class: 'metric' }, h('b', null, `${lessonsDone}/${LESSONS.length}`), h('span', null, 'Lessons done')),
        h('div', { class: 'metric' }, h('b', null, `${answered}/${QUESTIONS.length}`), h('span', null, 'Questions tried'))),
      h('div', { class: 'card c-general' }, h('h3', null, `Today's goal: ${Math.min(todayXp, DAILY_GOAL)}/${DAILY_GOAL} XP`), h('div', { class: 'bar', style: 'margin-top:8px' }, h('i', { style: `width:${Math.min(100, todayXp / DAILY_GOAL * 100)}%` }))),
      UNITS.map(u => h('div', { class: 'card c-' + u.id }, h('h3', null, u.name), u.skills.map(([s, n]) => {
        const st = skillStats(u.id, s);
        return h('div', { class: 'skillrow' }, h('span', null, n), h('em', null, st.pct == null ? 'Not started' : `${st.pct}%`), h('div', { class: 'bar' }, h('i', { style: `width:${st.pct || 0}%` })));
      }))),
      h('div', { class: 'card' }, h('h3', null, `Flagged questions (${flagged.length})`),
        flagged.length ? [flagged.map(([id, f]) => h('p', { class: 'muted' }, h('b', null, id), f.note ? `: ${f.note}` : '')), h('div', { class: 'btnrow' }, h('button', { class: 'btn small c-verbal', onclick: copyFlags }, 'Copy list'))] : h('p', { class: 'muted' }, 'Questions you flag as possibly wrong are listed here so they can be checked and fixed.')),
      h('div', { class: 'card' }, h('h3', null, 'Your data'), h('p', { class: 'muted' }, 'Progress is saved only in this browser on this device. Clearing browser data erases it, so back it up now and then.'),
        fileIn,
        h('div', { class: 'btnrow' }, h('button', { class: 'btn small c-verbal', 'data-act': 'backup', onclick: backup }, 'Save backup'), h('button', { class: 'btn small ghost', onclick: () => fileIn.click() }, 'Restore'), h('button', { class: 'btn small ghost', onclick: () => modal('Erase all progress?', h('p', null, 'This cannot be undone unless you have a backup.'), [{ label: 'Keep my progress', cls: 'good' }, { label: 'Erase everything', cls: 'danger', fn: () => { store = fresh(); save(); viewMe(); } }]) }, 'Reset'))),
      h('p', { class: 'fine' }, 'Unofficial personal study tool. All questions are original practice items, not actual exam questions. Not affiliated with or endorsed by the Civil Service Commission. Answers may contain mistakes, so check anything important against the cited law.')));
  }

  /* ---------- Guide ---------- */
  function viewGuide() {
    const section = (title, ic, unit, ...items) => h('section', { class: 'card guide c-' + unit },
      h('div', { class: 'row' }, h('div', { class: 'tile' }, icon(ic)), h('h2', { class: 'grow' }, title)),
      h('ul', null, items.map(t => h('li', null, t))));
    const mockLine = kind => `${MOCKS[kind].name}: ${Math.min(MOCKS[kind].items, QUESTIONS.length)} items in ${Math.floor(MOCKS[kind].mins / 60) ? Math.floor(MOCKS[kind].mins / 60) + ' h ' : ''}${MOCKS[kind].mins % 60} min.`;
    mount(shell('guide',
      h('h1', { class: 'title' }, 'How this app works'),
      h('p', { class: 'sub' }, `Tarsi is a personal study app for the Career Service Examination, Professional level, on 14 March 2027. It has ${QUESTIONS.length} original practice questions following the subjects CSC published.`),
      section('Learn', 'path', 'general',
        `The path has ${LESSONS.length} short lessons across 4 units: General Information, Verbal Ability, Analytical Ability and Numerical Ability.`,
        'Pick an answer, press Check, then read the explanation. General Information answers also name their legal source.',
        'Miss a question and it comes back later in the same lesson. You finish when every question has been answered correctly.',
        'No lesson is locked, so you can start anywhere or replay one.'),
      section('Hearts', 'heart', 'numerical',
        `Each lesson starts with ${HEARTS} hearts, and every wrong answer costs one, including on retried questions.`,
        'At zero the lesson ends. You can try it again right away, with no waiting. That attempt does not complete the lesson or earn XP.',
        'Your answers still count in your stats, and first-try misses still go to your Mistakes list.',
        'Practice and mock exams do not use hearts.'),
      section('XP, streak and daily goal', 'bolt', 'analytical',
        'Finishing a lesson or practice set earns 2 XP per question right on the first try, plus 5 XP if all of them were.',
        'Finishing a mock exam earns 1 XP for every 2 correct answers.',
        `Earning XP on a day keeps your streak going. Miss a full day and it starts over. The daily goal is ${DAILY_GOAL} XP.`),
      section('Practice', 'target', 'verbal',
        `Mistakes collects questions you missed. Each one leaves the list after you get it right in ${CLEAR_AFTER} separate sessions.`,
        'Weakest skill drills the skill with your lowest score, once you have answered enough of it.',
        'Quick 10 gives you ten random questions, mixed or from one subject.'),
      section('Mock exam', 'clock', 'analytical',
        mockLine('full'), mockLine('mini'),
        'There are no answers or hints until you submit. You can go back, mark questions for review and jump around with the question grid.',
        'Pause stops the clock, and you can resume later. When time runs out, the exam submits itself.',
        'Unanswered questions count as wrong. Missed questions go to your Mistakes list.',
        'CSC does not publish the item count, time limit or subject split, so the length is based on unofficial reports. Treat 80% as a target and not a prediction.'),
      section('Your progress and data', 'user', 'general',
        'Progress shows your scores for each skill, past mock results and flagged questions.',
        'Everything is saved only in this browser on this device. There are no accounts and nothing is sent anywhere.',
        'Clearing browser data erases your progress, so use Save backup now and then. Restore moves it to another device.',
        'After the first load, the app can run without internet.'),
      section('If an answer looks wrong', 'flag', 'numerical',
        'Tap "Answer looks wrong?" under the explanation and add a note if you like. It appears on your Progress page.',
        'The questions were written and checked with AI, with no human expert review, so mistakes are possible. For anything important, check the cited law.'),
      h('section', { class: 'card guide side-only' }, h('h2', null, 'Keyboard shortcuts'),
        h('ul', null, h('li', null, '1 to 4: pick an answer'), h('li', null, 'Enter: check and continue in lessons'), h('li', null, 'Left and right arrows: move between mock exam questions'))),
      h('section', { class: 'card guide' }, h('h2', null, 'About the exam'),
        h('ul', null,
          h('li', null, 'Date: Sunday, 14 March 2027. Passing grade: a general rating of at least 80.00.'),
          h('li', null, 'Filing opened 2 November 2026 and closes when slots run out. File with your CSC regional or field office.'),
          h('li', null, h('a', { href: ANNOUNCEMENT, target: '_blank', rel: 'noopener' }, 'Read CSC Examination Announcement No. 06, s. 2026')))),
      h('p', { class: 'fine' }, 'Unofficial personal study tool. All questions are original practice items, not actual exam questions. Not affiliated with or endorsed by the Civil Service Commission.')));
  }

  /* ---------- Router ---------- */
  const VIEWS = { learn: viewLearn, practice: viewPractice, mock: viewMockHome, me: viewMe, guide: viewGuide };
  function route() { (VIEWS[location.hash.replace(/^#\/?/, '')] || viewLearn)(); }
  function go(name) { if (location.hash === '#/' + name) route(); else location.hash = '#/' + name; }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
