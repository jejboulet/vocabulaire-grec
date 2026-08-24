/* Vocabulaire grec — Introduction au grec biblique
 *
 * Deux façons de travailler, reprises telles quelles des cartes en carton :
 *
 *   Apprendre — les mots neufs sont coupés en piles d'une dizaine. On mène
 *     la première pile jusqu'à la savoir, puis la deuxième, puis on mélange
 *     tout ce qui a déjà été vu et on le reprend ; puis la troisième, et
 *     ainsi de suite. Les piles suivent l'ordre des chapitres, pour qu'une
 *     pile reste un morceau cohérent du livre.
 *
 *   Réviser — les chapitres choisis sont mélangés en une seule pile (coupée
 *     en paquets tenables si elle est grosse).
 *
 * Dans les deux cas, une pile se travaille de la même façon : on la parcourt,
 * ce qu'on sait en sort, ce qu'on rate est MIS DE CÔTÉ ; la pile de côté est
 * ensuite reprise, tour après tour, jusqu'à zéro.
 *
 * Aucun compte, aucun serveur : tout se passe dans l'onglet. Seuls les
 * réglages (chapitres, sens, taille des piles) sont retenus d'une fois sur
 * l'autre.
 */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PILES = {
  learn:  [{ v: 5, t: '5' }, { v: 10, t: '10' }, { v: 15, t: '15' }],
  review: [{ v: 15, t: '15' }, { v: 25, t: '25' }, { v: 40, t: '40' }, { v: 0, t: 'Tout' }],
};
const PREF_KEY = 'igg-vocab-v1';

let DATA  = null;
let S     = null;              // séance en cours
let prefs = Object.assign(
  { mode: 'learn', dir: 'gr-fr', chapters: [], pile: { learn: 10, review: 25 } },
  read(PREF_KEY)
);

function read(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } }
function save()  { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }

/* ───────────────────────────────────────────────────────────── outils */
const shuffle = a => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const chunk = (a, n) => {
  if (!n || n >= a.length) return [a.slice()];
  const out = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
};
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* Du grec apparaît au beau milieu de textes français — dans une note, dans
   une étiquette de sens. Il garde la serif partout : la sans-serif de
   l'interface n'a pas de polytonique digne de ce nom. */
const GREEK = /[Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿̀-ͯ’'*]*/g;
const grk = s => esc(s).replace(GREEK, m => `<span class="grk">${m}</span>`);

/* Les sens gardent l'étiquette du livre (« gén. », « moy. ») devant leur
   glose. Une carte les pose comme la liste imprimée les pose : en colonne
   quand les sens forment un paradigme qu'on lit en descendant — les cas
   d'une préposition, intrans./trans., actif/moyen — et au fil du texte
   autrement. Les deux tests sont ceux de build.py, exprès : « moy. &
   compl. au gén. » n'est pas un paradigme de cas, et « seul, unique ||
   neut. comme adv. :: seulement » est un sens nu suivi d'une précision. */
const CASE_LAB = /^(prép\. \+ )?(gén|dat|acc)\.$/;
const TRANS = ['intrans.', 'trans.'];
const VOICE = ['actif', 'moyen'];

function isAligned(ss) {
  if (!ss.length || ss.some(s => !s.l)) return false;
  const labs = ss.map(s => s.l);
  return labs.some(l => CASE_LAB.test(l))
      || labs.every(l => TRANS.includes(l))
      || labs.every(l => VOICE.includes(l));
}

function sensesHTML(w) {
  const ss = w.senses;
  if (ss.length === 1 && !ss[0].l) return grk(ss[0].g);
  if (isAligned(ss)) {
    return '<span class="senses">' + ss.map(s =>
      `<span class="sense"><span class="lab">${grk(s.l)}</span><span>${grk(s.g)}</span></span>`
    ).join('') + '</span>';
  }
  return '<span class="isenses">' + ss.map(s =>
    (s.l ? `<span class="lab">${grk(s.l)}</span> ` : '') + grk(s.g)
  ).join('<span class="sep">; </span>') + '</span>';
}

/* ───────────────────────────────────────────────────────────── écran 1 */
function renderSetup() {
  if (matchMedia('(pointer: coarse)').matches)
    $('#flip-hint').textContent = 'Touchez la carte';

  const d = new Date(DATA.generated + 'T12:00:00');
  $('#stamp').textContent = 'Vocabulaire mis à jour le '
    + d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';

  // Chapitres : une grille de numéros, sans titre. Le titre est de peu
  // d'usage ici -- on choisit la semaine qu'on a devant soi, qu'on connaît
  // déjà -- et c'est lui qui imposait à la liste une largeur que le
  // téléphone ne pouvait pas tenir. Il reste dans l'infobulle, dans
  // l'étiquette lue par un lecteur d'écran, et sous la grille dès que la
  // sélection est assez courte pour qu'on puisse l'écrire.
  const box = $('#chapters');
  box.innerHTML = '';
  DATA.chapters.forEach(c => {
    const b = document.createElement('button');
    b.className = 'ch';
    b.type = 'button';
    b.dataset.n = c.n;
    b.setAttribute('aria-pressed', prefs.chapters.includes(c.n));
    b.setAttribute('aria-label',
      `Chapitre ${c.n}, ${c.title}, ${plural(c.count, 'mot', 'mots')}`);
    b.title = `${c.n}. ${c.title} (${plural(c.count, 'mot', 'mots')})`;
    b.textContent = c.n;
    box.appendChild(b);
  });

  const cells = () => $$('.ch', box);
  const setRange = (a, b, on) => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    cells().forEach(o => {
      const k = +o.dataset.n;
      if (k >= lo && k <= hi) o.setAttribute('aria-pressed', on);
    });
  };

  // Deux façons de prendre une plage : Maj+clic, l'habitude du bureau, et
  // le glissement, seul geste dont dispose un écran tactile.
  //
  // L'un comme l'autre REJOUENT l'état mémorisé avant de tracer la plage.
  // C'est ce qui permet de revenir sur ses pas : un Maj+clic qui raccourcit
  // 6-9 en 6-8 doit laisser 6, 7, 8 -- pas basculer 6-8 et laisser le 9
  // tout seul. Sans état mémorisé, chaque Maj+clic ne peut que basculer ce
  // qu'il touche, et une plage ne se corrige plus, elle s'inverse.
  const snapshot = () => new Map(cells().map(o => [+o.dataset.n,
                                                   o.getAttribute('aria-pressed')]));
  const restore  = m => cells().forEach(o => o.setAttribute('aria-pressed',
                                                            m.get(+o.dataset.n)));

  let anchor   = null;   // dernière case posée à la main
  let baseline = null;   // sélection telle qu'elle était quand l'ancre a été posée
  let drag     = null;   // { from, on, before, last } pendant un glissement

  box.addEventListener('pointerdown', e => {
    const b = e.target.closest('.ch');
    if (!b) return;
    const n = +b.dataset.n;

    // Pas de `anchor !== n` ici : Maj+clic sur l'ancre elle-même réduit la
    // plage à cette seule case, ce qui est le geste pour se raviser. En
    // l'excluant, il retombait sur la bascule ordinaire et laissait un trou.
    if (e.shiftKey && anchor !== null) {
      restore(baseline);
      setRange(anchor, n, true);
      syncSelection();
      return;
    }
    drag = { from: n,
             on: b.getAttribute('aria-pressed') !== 'true',
             before: snapshot(),
             last: n };
    b.setAttribute('aria-pressed', drag.on);
    box.setPointerCapture(e.pointerId);
    syncSelection();
  });

  box.addEventListener('pointermove', e => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const b = el && el.closest ? el.closest('.ch') : null;
    if (!b || !box.contains(b)) return;
    const n = +b.dataset.n;
    if (n === drag.last) return;
    drag.last = n;
    restore(drag.before);
    setRange(drag.from, n, drag.on);
    syncSelection();
  });

  // Après un glissement l'ancre est sa case de départ, et l'état de
  // référence celui d'avant le glissement, cette case mise à jour : un
  // Maj+clic qui suit se comporte alors exactement comme après un clic
  // simple, au lieu de repartir de la plage que le glissement a tracée.
  const endDrag = () => {
    if (!drag) return;
    anchor = drag.from;
    baseline = new Map(drag.before);
    baseline.set(drag.from, String(drag.on));
    drag = null;
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);

  // Le clavier produit un clic sans pointeur (detail 0) : c'est le seul
  // cas que pointerdown n'a pas déjà traité.
  box.addEventListener('click', e => {
    const b = e.target.closest('.ch');
    if (!b || e.detail !== 0) return;
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
    anchor = +b.dataset.n;
    baseline = snapshot();   // sans quoi un Maj+clic rejouerait un état périmé
    syncSelection();
  });

  // Tout/Rien repartent de zéro : l'ancre et son état de référence
  // dateraient d'une sélection que ce clic vient d'effacer.
  const setAll = on => {
    cells().forEach(b => b.setAttribute('aria-pressed', on));
    anchor = null;
    baseline = null;
    syncSelection();
  };
  $('#sel-all').onclick  = () => setAll(true);
  $('#sel-none').onclick = () => setAll(false);

  // mode + sens : deux groupes de boutons radio
  $$('.mode').forEach(b => b.onclick = () => {
    $$('.mode').forEach(o => o.setAttribute('aria-checked', o === b));
    prefs.mode = b.dataset.mode;
    renderPileSizes();
    syncSelection();
  });
  $$('.mode').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === prefs.mode));

  $$('#dir button').forEach(b => {
    b.setAttribute('aria-checked', b.dataset.v === prefs.dir);
    b.onclick = () => {
      $$('#dir button').forEach(o => o.setAttribute('aria-checked', o === b));
      prefs.dir = b.dataset.v;
      save();
    };
  });

  renderPileSizes();
  syncSelection();

  $('#start').onclick = start;
  $('#redo').onclick  = () => start();
  $('#back').onclick  = () => show('setup');
  $('#quit').onclick  = () => show('setup');
}

function renderPileSizes() {
  const seg = $('#pile');
  seg.innerHTML = '';
  PILES[prefs.mode].forEach(o => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.textContent = o.t;
    b.setAttribute('aria-checked', o.v === prefs.pile[prefs.mode]);
    b.onclick = () => {
      $$('button', seg).forEach(x => x.setAttribute('aria-checked', x === b));
      prefs.pile[prefs.mode] = o.v;
      save();
      syncSelection();
    };
    seg.appendChild(b);
  });
}

function chosen() {
  return $$('.ch').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => +b.dataset.n);
}

function syncSelection() {
  prefs.chapters = chosen();
  save();
  const words = pool();
  const n = words.length;
  const btn = $('#start');
  btn.disabled = n === 0;

  // Les titres que la grille ne montre plus reviennent ici tant qu'ils
  // tiennent en une ligne ou deux -- c'est-à-dire dans le cas ordinaire,
  // les deux ou trois chapitres d'une semaine.
  const names = $('#ch-names');
  const sel = prefs.chapters;
  names.textContent = (sel.length && sel.length <= 3)
    ? sel.map(k => (DATA.chapters.find(c => c.n === k) || {}).title)
         .filter(Boolean).join(' · ')
    : '';

  if (!n) {
    $('#tally').textContent = 'Aucun chapitre choisi';
    btn.textContent = 'Commencer';
    return;
  }
  const size  = prefs.pile[prefs.mode];
  const piles = chunk(words, size).length;
  $('#tally').textContent =
    `${selectionName()} · ${plural(n, 'mot', 'mots')} · `
    + (piles > 1 ? plural(piles, 'pile', 'piles') : 'une seule pile');
  btn.textContent = prefs.mode === 'learn' ? 'Apprendre' : 'Réviser';
}

function pool() {
  const set = new Set(prefs.chapters);
  return DATA.words.filter(w => set.has(w.ch));   // déjà dans l'ordre du livre
}

/* ─────────────────────────────────────────────────────── construction */
/* Apprendre : pile 1, pile 2, reprise de 1-2, pile 3, reprise de 1-3, … */
function buildStages(words, mode, size) {
  if (mode === 'review') {
    const piles = chunk(shuffle(words), size);
    return piles.map((p, i) => ({
      name: piles.length > 1 ? `Pile ${i + 1} sur ${piles.length}` : 'Révision',
      cards: shuffle(p),
    }));
  }
  const piles = chunk(words, size);
  const out = [];
  piles.forEach((p, i) => {
    out.push({
      name: piles.length > 1 ? `Pile ${i + 1} sur ${piles.length}` : 'Une seule pile',
      lead: 'mots neufs',
      cards: shuffle(p),
    });
    if (i > 0) {
      const seen = piles.slice(0, i + 1).flat();
      out.push({
        name: i === 1 ? 'Reprise des piles 1 et 2' : `Reprise des piles 1 à ${i + 1}`,
        lead: 'tout ce qui a été vu',
        cards: shuffle(seen),
      });
    }
  });
  return out;
}

/* ───────────────────────────────────────────────────────────── séance */
function start() {
  const words = pool();
  if (!words.length) return;
  S = {
    mode: prefs.mode,
    dir:  prefs.dir,
    stages: buildStages(words, prefs.mode, prefs.pile[prefs.mode]),
    si: -1,
    queue: [], aside: [], round: 1, mastered: 0,
    answers: 0, correct: 0,
    misses: new Map(),
    words: new Map(words.map(w => [w.id, w])),
    flipped: false,
  };
  show('study');
  nextStage();
}

function nextStage() {
  S.si++;
  if (S.si >= S.stages.length) return finish();
  const st = S.stages[S.si];
  S.queue = st.cards.slice();
  S.aside = [];
  S.round = 1;
  S.mastered = 0;
  drawStage();
  showCard();
}

function drawStage() {
  const st = S.stages[S.si];
  $('#stage-name').textContent = st.name;
  $('#stage-sub').textContent = S.round > 1
    ? `Tour ${S.round} · les mots mis de côté`
    : `${plural(st.cards.length, 'mot', 'mots')}${st.lead ? ' · ' + st.lead : ''}`;

  const dots = $('#dots');
  dots.innerHTML = '';
  if (S.stages.length > 1 && S.stages.length <= 14) {
    S.stages.forEach((_, i) => {
      const d = document.createElement('i');
      d.className = i < S.si ? 'on' : i === S.si ? 'now' : '';
      dots.appendChild(d);
    });
  } else if (S.stages.length > 1) {
    const t = document.createElement('i');
    t.className = 'txt';
    t.textContent = `${S.si + 1} / ${S.stages.length}`;
    dots.appendChild(t);
  }
}

function showCard() {
  const st = S.stages[S.si];
  const w  = S.queue[0];
  const grFirst = S.dir === 'gr-fr';

  $('#prompt').className = 'face' + (grFirst ? '' : ' fr');
  $('#prompt').innerHTML = grFirst ? esc(w.lex) : sensesHTML(w);

  let back = grFirst
    ? `<div class="answer fr">${sensesHTML(w)}</div>`
    : `<div class="answer">${esc(w.lex)}</div>`;
  if (w.tr)   back += `<div class="translit">${esc(w.tr)}</div>`;
  if (w.note) back += `<div class="note">${grk(w.note)}</div>`;
  back += `<div class="chip">Chapitre ${w.ch}</div>`;
  $('#reveal').innerHTML = back;

  S.flipped = false;
  $('#reveal').hidden = true;
  $('#verdict').hidden = true;
  $('#flip-hint').hidden = false;
  $('#card').focus({ preventScroll: true });

  $('#c-left').textContent  = S.queue.length;
  $('#c-aside').textContent = S.aside.length;
  $('#c-done').textContent  = S.mastered;
  $('#bar-fill').style.width = (100 * S.mastered / st.cards.length) + '%';
}

function flip() {
  if (S.flipped) return;
  S.flipped = true;
  $('#reveal').hidden = false;
  $('#verdict').hidden = false;
  $('#flip-hint').hidden = true;
}

function answer(ok) {
  if (!S.flipped) return;
  const w = S.queue.shift();
  S.answers++;
  if (ok) { S.correct++; S.mastered++; }
  else {
    S.aside.push(w);
    S.misses.set(w.id, (S.misses.get(w.id) || 0) + 1);
  }
  if (S.queue.length) return showCard();

  if (S.aside.length) {                    // la pile de côté se reprend
    S.queue = shuffle(S.aside);
    S.aside = [];
    S.round++;
    drawStage();
    return showCard();
  }
  nextStage();
}

/* ───────────────────────────────────────────────────────────── bilan */
/* « Chapitres 19 à 21 » quand la sélection est d'un seul tenant, ce qu'elle
   est presque toujours : c'est ainsi qu'un étudiant nomme sa semaine. */
function selectionName() {
  const ch = prefs.chapters.slice().sort((a, b) => a - b);
  if (ch.length === 1) return `Chapitre ${ch[0]}`;
  const contiguous = ch.every((n, i) => i === 0 || n === ch[i - 1] + 1);
  return contiguous ? `Chapitres ${ch[0]} à ${ch[ch.length - 1]}`
                    : plural(ch.length, 'chapitre', 'chapitres');
}

function finish() {
  const unique = S.words.size;
  const pct = S.answers ? Math.round(100 * S.correct / S.answers) : 0;
  $('#done-title').textContent = selectionName();
  $('#stats').innerHTML = [
    [unique, unique > 1 ? 'mots' : 'mot'],
    [S.answers, S.answers > 1 ? 'réponses' : 'réponse'],
    [pct + '&nbsp;%', 'justes'],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');

  const missed = [...S.misses.entries()].sort((a, b) => b[1] - a[1]);
  $('#missed-panel').hidden = !missed.length;
  $('#missed').innerHTML = missed.map(([id, n]) => {
    const w = S.words.get(id);
    return `<li><span class="w">${esc(w.lex)}</span><span class="g">${grk(w.fr)}</span>`
         + `<span class="n">${n}×</span></li>`;
  }).join('');

  show('done');
}

/* ──────────────────────────────────────────────────────────── écrans */
function show(which) {
  ['setup', 'study', 'done'].forEach(id => { $('#' + id).hidden = id !== which; });
  window.scrollTo({ top: 0 });
}

/* ─────────────────────────────────────────────────────────── entrées */
$('#card').addEventListener('click', flip);
$('#btn-good').addEventListener('click',  () => answer(true));
$('#btn-again').addEventListener('click', () => answer(false));

document.addEventListener('keydown', e => {
  if ($('#study').hidden) return;
  if (e.key === 'Escape') { show('setup'); return; }
  if (!S.flipped) {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); flip(); }
    return;
  }
  if (e.key === 'ArrowRight' || e.key === '2') { e.preventDefault(); answer(true); }
  if (e.key === 'ArrowLeft'  || e.key === '1') { e.preventDefault(); answer(false); }
});

/* ────────────────────────────────────────────────────────────── boot */
fetch('data/vocabulary.json')
  .then(r => r.json())
  .then(d => { DATA = d; renderSetup(); })
  .catch(() => {
    $('#chapters').innerHTML =
      '<p class="hint">Le fichier de vocabulaire n’a pas pu être chargé.</p>';
  });
