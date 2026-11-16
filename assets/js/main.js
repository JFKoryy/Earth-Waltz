/* Earth Waltz — interactions (vanilla JS, no build step, works on GitHub Pages). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile menu + nav shading
  const menuBtn = $('#menuBtn'), navRight = $('#navRight');
  on(menuBtn, 'click', () => {
    const open = navRight.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  const nav = $('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Long banner words get a smaller size
  $$('.mega-word').forEach(w => { if (w.textContent.length > 6) w.classList.add('long'); });
  $$('.mega-sub').forEach(s => { if (s.textContent.trim().length > 10) s.classList.add('small'); });

  // Typewriter effect
  const type = (el, delay) => {
    const text = el.dataset.type; if (!text || reduce) return;
    el.textContent = ''; el.classList.add('typing');
    let i = 0;
    setTimeout(function step() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, el.classList.contains('kicker') ? 55 : 28);
      else setTimeout(() => el.classList.remove('typing'), 1800);
    }, delay);
  };
  $$('.kicker[data-type]').forEach(el => type(el, 150));
  $$('.typer[data-type]').forEach(el => type(el, 1700));

  // Split headings into words for staggered reveal
  $$('[data-words]').forEach(h => {
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
  });

  // Reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal, [data-words]').forEach(el => io.observe(el));

  // 3D tilt cards
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('.tilt').forEach(card => {
      const max = 7;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(900px) rotateY(${x * max * 2}deg) rotateX(${-y * max * 2}deg) translateY(-6px)`;
      });
      card.addEventListener('pointerleave', () => card.style.transform = '');
    });
  }

  // Chapter rail (scroll spy)
  const chapters = $$('.chapter'), order = chapters.map(c => c.id);
  const rail = $('.rail');
  if (rail && chapters.length) {
    let cur = 0;
    const railShow = () => {
      const first = chapters[0].getBoundingClientRect().top, last = chapters[chapters.length - 1].getBoundingClientRect().bottom;
      rail.classList.toggle('show', first < innerHeight * .6 && last > innerHeight * .4);
    };
    addEventListener('scroll', railShow, { passive: true }); railShow();
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      cur = order.indexOf(e.target.id);
      const c = $('#crumbCur'), p = $('#progress');
      if (c) c.textContent = e.target.dataset.title;
      if (p) p.textContent = `Chapter ${cur + 1} of ${order.length}`;
      $$('.rail a[data-step]').forEach((a, i) => { a.classList.toggle('current', i === cur); a.classList.toggle('done', i < cur); a.toggleAttribute('aria-current', i === cur); });
      $$('.rail-arrow').forEach(a => { const t = order[Math.min(order.length - 1, Math.max(0, cur + +a.dataset.dir))]; a.href = '#' + t; });
    }), { rootMargin: '-45% 0px -50% 0px' });
    chapters.forEach(c => spy.observe(c));
  }

  // Chapter 2 tabs
  $$('[role="tab"]').forEach(t => t.addEventListener('click', () => {
    $$('[role="tab"]').forEach(x => x.setAttribute('aria-selected', x === t));
    $$('.panel').forEach(p => p.classList.toggle('show', p.id === t.dataset.panel));
  }));
  $$('.hotspot').forEach(h => h.addEventListener('click', () => $('#tip1').textContent = h.dataset.tip));

  // Polarization switch — real NISAR scene (Oct 29, 2025) colored by our code
  const polHelp = {
    hh: 'HH: water looks dark violet, flooded forest and shores glow bright blue-white because of the double bounce.',
    hv: 'HV: water looks deep blue, vegetation turns green and yellow. The denser the canopy, the brighter.',
    comp: 'Composite: red = HH, green = HV, blue = HH minus HV. Yellow-green is forest, violet is open water, pink marks double bounce.'
  };
  const polSrc = { hh: 'assets/scenes/color/hh_20251029.jpg', hv: 'assets/scenes/color/hv_20251029.jpg', comp: 'assets/scenes/color/rgb_20251029.jpg' };
  const polLeg = {
    hh: '<i style="background:linear-gradient(90deg,#05051c,#2a1468,#6b3fd6,#2fb6e0,#9ff0e6,#fff)"></i><span>weak</span><span>strong</span>',
    hv: '<i style="background:linear-gradient(90deg,#020a1f,#0b2a6b,#1d63c9,#14a7b8,#1fae6a,#7fd65a,#f4f2a0)"></i><span>water</span><span>vegetation</span>',
    comp: '<span class="sw" style="background:#c8c25a"></span>forest <span class="sw" style="background:#3b1d6e"></span>water <span class="sw" style="background:#e08ad8"></span>double bounce'
  };
  const setPol = k => { const im = $('#polImg'); if (!im) return; im.classList.add('swap'); setTimeout(() => { im.src = polSrc[k]; im.alt = `NISAR scene of the Ciénaga Grande, ${k.toUpperCase()}, October 29, 2025.`; }, 180); im.onload = () => im.classList.remove('swap'); const lg = $('#polLegend'); if (lg) lg.innerHTML = polLeg[k]; };
  setPol('hh');
  $$('[data-pol]').forEach(b => b.addEventListener('click', () => {
    $$('[data-pol]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#polHelp').textContent = polHelp[b.dataset.pol];
    setPol(b.dataset.pol);
  }));

  // Compare slider + change map
  const cmp = $('#compare');
  on($('#cmpRange'), 'input', e => cmp.style.setProperty('--pos', e.target.value + '%'));
  on($('#changeToggle'), 'change', e => cmp.classList.toggle('show-change', e.target.checked));

  // Explain button — calls POST /api/explicacion-par with the active pair
  const explainBtn = $('#explainBtn');
  on(explainBtn, 'click', async () => {
    const vs = vScenes();
    const sA = vs[A], sB = vs[B];
    if (!sA || !sB || !sA.date || sA.date.startsWith('[')) return;

    const box = $('#aiBox');
    explainBtn.textContent = 'Generating…';
    explainBtn.disabled = true;

    try {
      const resp = await fetch('/api/explicacion-par', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneA: sA, sceneB: sB }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data = await resp.json();

      // Render the explanation
      const chip = `<span class="chip" title="Generated by an AI model using only numbers our code computed. The AI never sees raw satellite data.">✦ AI-generated · based on computed data</span>`;
      let html = chip;
      if (data.title) html += `<h3 style="margin-top:1rem;font-family:var(--font-display);font-size:1.15rem">${data.title}</h3>`;
      if (data.summary) html += `<p style="margin-top:.7rem;color:var(--muted)">${data.summary}</p>`;
      if (Array.isArray(data.findings)) {
        data.findings.forEach(f => {
          html += `<h4 style="margin-top:1.1rem;font-size:.95rem">${f.title}</h4><p style="margin-top:.35rem;font-size:.93rem">${f.text}</p>`;
        });
      }
      if (data.what_it_means) html += `<p style="margin-top:1rem;font-size:.9rem;color:var(--muted)"><b>What it means:</b> ${data.what_it_means}</p>`;
      if (Array.isArray(data.what_we_dont_know) && data.what_we_dont_know.length) {
        html += `<p style="margin-top:.8rem;font-size:.88rem;color:var(--muted)"><b>What we don't know:</b></p><ul style="margin:.3rem 0 0 1.2rem;font-size:.88rem;color:var(--muted)">` +
          data.what_we_dont_know.map(w => `<li>${w}</li>`).join('') + `</ul>`;
      }
      html += `<p class="rule" style="margin-top:1rem">The AI only explains numbers we computed.</p>`;
      html += `<button class="btn btn-outline btn-sm" id="tryAnotherBtn" style="margin-top:1rem">↺ Try another pair</button>`;

      box.innerHTML = html;
      box.classList.add('show');
      explainBtn.textContent = '✓ Done';

      on($('#tryAnotherBtn'), 'click', () => {
        box.classList.remove('show');
        box.innerHTML = '';
        explainBtn.textContent = '✦ Explain it to me';
        explainBtn.disabled = false;
      });

    } catch (err) {
      box.innerHTML = `<span class="chip">✦ AI explanation</span><p style="margin-top:.8rem;color:var(--muted)">Could not generate the explanation: ${err.message}. Make sure the server is running.</p>`;
      box.classList.add('show');
      explainBtn.textContent = '✦ Explain it to me';
      explainBtn.disabled = false;
    }
  });

  // Glossary
  const glossary = {
    'SAR (synthetic aperture radar)': 'A radar on a moving platform, such as a satellite, that combines many echoes to make a sharp image. It works day and night and through clouds.',
    'Backscatter': 'The part of the radar signal that comes back to the satellite after hitting the ground.',
    'dB (decibel)': 'A unit used to show backscatter. Lower dB means a weaker echo.',
    'L-band': 'A radar wavelength of about 24 cm. It penetrates vegetation more than shorter wavelengths, so it can reach branches, trunks and water below.',
    'S-band': 'A shorter radar wavelength, about 9.4 cm, also carried by NISAR.',
    'Polarization': 'The direction the radar wave vibrates (H or V) when it is sent and received. HH, HV, VV…',
    'HH': 'Sent horizontal, received horizontal. Strong on water surfaces and double bounce.',
    'HV': 'Sent horizontal, received vertical. Sensitive to vegetation volume and biomass.',
    'Specular (mirror) reflection': 'The pulse bounces away from a smooth surface like calm water, so it looks dark.',
    'Double bounce': 'The pulse bounces twice, for example off water and then a trunk, and returns strongly. It looks bright.',
    'Volume scattering': 'The pulse scatters among leaves and branches in many directions.',
    'Speckle': 'The grainy, salt-and-pepper look in radar images caused by how echoes combine.',
    'Change detection': 'Comparing two images of the same place from different dates to find what changed.',
    'Mangrove': 'A salt-tolerant tree that grows on tropical and subtropical coasts, where land meets sea.',
    'Hectare (ha)': '10,000 square meters, about the size of a soccer field.',
    'Confidence': 'How much we trust a result, from high to low, with the reason shown.'
  };
  const entries = Object.entries(glossary);
  const gg = $('#glossGrid'); if (gg) gg.innerHTML = entries.map(([k, v]) => `<div><b>${k}</b><p>${v}</p></div>`).join('');
  const dl = $('#drawerList'); if (dl) dl.innerHTML = entries.map(([k, v]) => `<dt data-k="${k}">${k}</dt><dd>${v}</dd>`).join('');
  const drawer = $('#drawer');
  const openDrawer = term => {
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    $$('#drawerList dt').forEach(dt => dt.classList.toggle('hl', dt.dataset.k === term));
    const t = $$('#drawerList dt').find(dt => dt.dataset.k === term); if (t) t.scrollIntoView({ block: 'center' });
    $('#drawerClose').focus();
  };
  const closeDrawer = () => { if (!drawer) return; drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); };
  $$('.gloss-term').forEach(b => b.addEventListener('click', () => openDrawer(b.dataset.term)));
  on($('#drawerClose'), 'click', closeDrawer);

  // AI Interpreter (pre-generated answers)
  const chip = '<span class="chip">✦ AI-generated, based on computed data</span>';
  const answers = {
    dark: '<p>In a radar image, dark means a weak echo came back. Calm water acts like a mirror: it bounces the pulse away from the satellite, so it looks dark. Bare, smooth ground can also look dark.</p><p>In this scene, the dark areas match the class “water” for about <span class="ph">[X]</span> ha.</p>',
    trust: '<p>For this comparison, confidence is <span class="ph">[level]</span> because <span class="ph">[reason]</span>. A change in the radar signal is a clue, not a photograph. Tides, rain and soil moisture can also change the signal.</p><p>Our numbers are good for exploring. They are not an official measurement.</p>',
    pol: '<p>A radar wave can vibrate horizontally (H) or vertically (V). A polarization says how the wave was sent and received. HH is sensitive to water and flat surfaces. HV is sensitive to leaves and branches, so it tells us about vegetation.</p>'
  };
  const fab = $('#aiFab'), panel = $('#aiPanel');
  const togglePanel = open => { if (!panel) return; panel.classList.toggle('open', open); fab.setAttribute('aria-expanded', open); };
  on(fab, 'click', () => togglePanel(!panel.classList.contains('open')));
  on($('#aiClose'), 'click', () => togglePanel(false));
  $$('.qs button').forEach(b => b.addEventListener('click', () => $('#aiAnswer').innerHTML = answers[b.dataset.q] + chip));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { togglePanel(false); closeDrawer(); } });

  // Data: timeline, scenes table, chart (only on the Mangroves page)
  if (!$('#timeline')) return;
  const placeholderScenes = Array.from({ length: 15 }, (_, i) => ({ id: `scene_${String(i + 1).padStart(2, '0')}`, date: '[YYYY-MM-DD]', version: null, product: '[product]', polarizations: ['HH', 'HV'] }));

  // Version config — P05036 has only 1 scene so it is excluded from comparisons
  const VER_COLOR = { X05009: '#2EE6F6', P05023: '#22C58B' };
  const VERSIONS  = ['X05009', 'P05023'];
  let activeVer = 'X05009';
  let allScenes = [], allResults = null;
  let A = 0, B = 1; // default: first two scenes
  let activePol = 'hv'; // comparator polarization

  const isPh = v => v == null || String(v).startsWith('[');
  const vScenes = () => (allScenes.length ? allScenes : placeholderScenes).filter(s => !s.version || s.version === activeVer);

  // "Nov 22, 2025" from "2025-11-22"
  const fmtDate = str => {
    if (isPh(str)) return str;
    const [y, m, d] = str.split('-');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1];
    return `${mon} ${+d}, ${y}`;
  };
  // Short label for the button: "Nov 22"
  const fmtShort = str => {
    if (isPh(str)) return str.replace('[YYYY-MM-DD]', '?');
    const [, m, d] = str.split('-');
    const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1];
    return `${mon} ${+d}`;
  };

  // ---- Version selector (injected just above the timeline card) ----
  function renderVerTabs() {
    let el = $('#verTabs');
    if (!el) {
      const card = $('#timeline')?.closest('.card');
      if (!card) return;
      el = document.createElement('div');
      el.id = 'verTabs';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Processing version');
      el.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem';
      card.parentNode.insertBefore(el, card);
    }
    el.innerHTML = VERSIONS.map(v => `
      <button class="tl-ver-btn ${v === activeVer ? 'active' : ''}" data-v="${v}"
        style="--vc:${VER_COLOR[v]}" aria-pressed="${v === activeVer}">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${VER_COLOR[v]};margin-right:.35rem;vertical-align:middle"></span>
        ${v}
      </button>`).join('');
    $$('#verTabs .tl-ver-btn').forEach(btn => btn.addEventListener('click', () => {
      activeVer = btn.dataset.v;
      const vs = vScenes();
      A = 0; B = Math.min(1, vs.length - 1);
      renderVerTabs();
      render(allScenes.length ? allScenes : placeholderScenes, allResults);
    }));
  }

  // ---- Update comparator images ----
  function updateComparator() {
    const vs = vScenes();
    const sA = vs[A], sB = vs[B];
    if (!sA || !sB) return;
    const pk = activePol === 'comp' ? 'rgb' : activePol + '_color';
    const imgA = sA.files?.[pk] || sA.files?.hv_color || sA.files?.hv || '';
    const imgB = sB.files?.[pk] || sB.files?.hv_color || sB.files?.hv || '';
    // compare widget: bottom img = B (revealed), top img (clipped) = A
    const imgs = $$('#compare img');
    if (imgs[0]) { imgs[0].src = imgB; imgs[0].alt = `${fmtDate(sB.date)} — ${activePol.toUpperCase()}`; }
    if (imgs[1]) { imgs[1].src = imgA; imgs[1].alt = `${fmtDate(sA.date)} — ${activePol.toUpperCase()}`; }
  }

  function render(scenes, results) {
    const vs = vScenes();
    const col = VER_COLOR[activeVer] || '#2EE6F6';

    // Clamp anchors — allow A === B (edge case with 1 scene)
    A = Math.max(0, Math.min(A, vs.length - 1));
    B = Math.max(0, Math.min(B, vs.length - 1));

    $('#timeline').innerHTML = vs.map((s, i) => `
      <button class="tl ${i === A ? 'a' : ''} ${i === B ? 'b' : ''}"
        data-i="${i}" style="--vc:${col}"
        aria-label="${fmtDate(s.date)}${i === A ? ' — Date A' : i === B ? ' — Date B' : ''}">
        <span class="mk">${i === A ? 'A' : i === B ? 'B' : ''}</span>
        <span class="dot"></span>
        <span>${fmtShort(s.date)}</span>
      </button>`).join('');

    $$('#timeline .tl').forEach(btn => btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      // If clicked on an anchor, skip — user must click a different scene
      if (i === A && i === B) return; // only 1 scene, nothing to do
      if (i === A || i === B) {
        // clicking the current A moves A to nearest free slot, same for B
        // simpler: toggle which anchor is "floating" and reassign
      }
      // Assign to the closer anchor; if equidistant, prefer B
      const dA = Math.abs(i - A), dB = Math.abs(i - B);
      if (dA <= dB) A = i; else B = i;
      if (A > B) [A, B] = [B, A];
      render(scenes, results);
      updateComparator();
    }));

    // Date labels
    const dA = vs[A]?.date, dB = vs[B]?.date;
    $$('.dA').forEach(e => e.textContent = isPh(dA) ? '[Date A]' : fmtDate(dA));
    $$('.dB').forEach(e => e.textContent = isPh(dB) ? '[Date B]' : fmtDate(dB));

    // Comparator images
    updateComparator();

    // Scenes table
    const shown = (allScenes.length ? allScenes : placeholderScenes).filter(s => VERSIONS.includes(s.version) || !s.version);
    $('#scenesBody').innerHTML = shown.map(s => `<tr><td class="mono">${s.id}</td><td class="mono">${fmtDate(s.date)}</td><td>${s.product}</td><td>${s.polarizations.join(', ')}</td></tr>`).join('');

    // Pair stats
    const lo = vs[Math.min(A,B)]?.id, hi = vs[Math.max(A,B)]?.id;
    const pair = results?.pairs?.[`${lo}__${hi}`] || results?.pairs?.[`${hi}__${lo}`];
    $$('[data-r]').forEach(el => countTo(el, pair?.[el.dataset.r], el.dataset.r === 'net_ha'));
    const ci = $('#changeImg'); if (ci) { if (pair?.change_map) ci.src = pair.change_map; else ci.removeAttribute('src'); }
    // Trust: compare with normal 12-day change of the same version
    const ref = results?.reference_12d?.[activeVer];
    const tm = $('#trustMeter'), tt = $('#trustText');
    if (pair && ref?.median && tt) {
      const ratio = pair.gross_ha / ref.median;
      const lvl = pair.days <= 12 ? 1 : ratio < 1.5 ? 1 : ratio < 4 ? 2 : 3;
      const name = ['', 'Low', 'Medium', 'High'][lvl];
      const why = pair.days <= 12
        ? `these dates are one pass apart (12 days). This size of change is the normal “noise” between passes, from ${fmt(ref.min)} to ${fmt(ref.max)} ha.`
        : `the change (${fmt(pair.gross_ha)} ha) is ${ratio.toFixed(1)}× the typical change between passes 12 days apart (${fmt(ref.median)} ha), over ${pair.days} days. ${lvl === 3 ? 'Something likely changed, but radar alone can’t say why.' : 'Part of it may be normal variation.'}`;
      tt.innerHTML = `<b>${name}</b>: ${why}`;
      $$('span', tm).forEach((sp, i) => { sp.classList.toggle('on', i < lvl); sp.style.background = i < lvl ? ['#F5B544','#2EE6F6','#22C58B'][lvl-1] : ''; });
    } else if (tt) { tt.textContent = 'Choose two dates from the same processing version.'; }

    drawChart(scenes, results);
  }

  // ---------- Animated, interactive chart ----------
  let metric = 'hv', drawnOnce = false;
  const fmt = v => Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
  function countTo(el, v, signed) {
    if (v == null || isNaN(v)) { el.textContent = '–'; return; }
    const from = parseFloat(el.dataset.v || 0), to = +v, t0 = performance.now(), dur = 900;
    el.dataset.v = to;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), x = from + (to - from) * e;
      el.textContent = (signed && x > 0 ? '+' : '') + fmt(Math.round(x * 10) / 10); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function drawChart(scenes, results) {
    const svg = $('#chartX'); if (!svg || !results) return;
    const all = (scenes || []).filter(s => s.date && !s.date.startsWith('['));
    const val = s => metric === 'hv' ? results.scenes?.[s.id]?.mean_hv_db : results.scenes?.[s.id]?.water_ha;
    const pts = all.map(s => ({ s, t: new Date(s.date).getTime(), v: +val(s) })).filter(p => !isNaN(p.v));
    if (!pts.length) return;
    const W = 820, H = 340, L = 64, Rr = 20, T = 24, Bm = 46;
    const t0 = Math.min(...pts.map(p => p.t)), t1 = Math.max(...pts.map(p => p.t));
    let v0 = Math.min(...pts.map(p => p.v)), v1 = Math.max(...pts.map(p => p.v)); const pad = (v1 - v0) * .15 || 1; v0 -= pad; v1 += pad;
    const x = t => L + (t - t0) / (t1 - t0) * (W - L - Rr), y = v => T + (1 - (v - v0) / (v1 - v0)) * (H - T - Bm);
    const COL = { X05009: '#2EE6F6', P05023: '#22C58B', P05036: '#9FB8C0' };
    const vsA = vScenes(), idA = vsA[A]?.id, idB = vsA[B]?.id;
    let g = '<defs><linearGradient id="cgx" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2EE6F6" stop-opacity=".35"/><stop offset="1" stop-color="#2EE6F6" stop-opacity="0"/></linearGradient><linearGradient id="cgp" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#22C58B" stop-opacity=".35"/><stop offset="1" stop-color="#22C58B" stop-opacity="0"/></linearGradient></defs>';
    for (let i = 0; i <= 4; i++) { const v = v0 + (v1 - v0) * i / 4, yy = y(v);
      g += `<line x1="${L}" x2="${W-Rr}" y1="${yy}" y2="${yy}" stroke="#9FB8C0" stroke-opacity=".12"/><text x="${L-10}" y="${yy+4}" text-anchor="end" class="ax">${metric==='hv'?v.toFixed(1):Math.round(v/100)/10+'k'}</text>`; }
    // gap band
    const gs = pts.find(p => p.s.date === '2026-01-09'), ge = pts.find(p => p.s.date === '2026-06-26');
    if (gs && ge) g += `<rect x="${x(gs.t)+8}" y="${T}" width="${x(ge.t)-x(gs.t)-16}" height="${H-T-Bm}" fill="url(#hatch)" class="gap"/><text x="${(x(gs.t)+x(ge.t))/2}" y="${T+18}" text-anchor="middle" class="ax gapt">168 days without scenes</text>`;
    g = g.replace('</defs>', '<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(139,92,246,.06)"/><line y2="8" stroke="rgba(139,92,246,.25)" stroke-width="2"/></pattern></defs>');
    // month ticks
    const d0 = new Date(t0); d0.setDate(1);
    for (let d = new Date(d0); d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) { if (d.getTime() < t0) continue; const xx = x(d.getTime());
      g += `<text x="${xx}" y="${H-Bm+20}" text-anchor="middle" class="ax">${d.toLocaleString('en-US',{month:'short'})}${d.getMonth()===0?' ’'+String(d.getFullYear()).slice(2):''}</text>`; }
    ['X05009','P05023'].forEach(ver => {
      const ps = pts.filter(p => p.s.version === ver); if (ps.length < 2) return;
      const line = ps.map((p, i) => `${i?'L':'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
      const dim = ver !== activeVer ? ' dim' : '';
      g += `<path class="area${dim}" d="${line}L${x(ps.at(-1).t)},${H-Bm}L${x(ps[0].t)},${H-Bm}Z" fill="url(#${ver==='X05009'?'cgx':'cgp'})"/>`;
      g += `<path class="ln${dim}" d="${line}" fill="none" stroke="${COL[ver]}" stroke-width="2.5" stroke-linejoin="round" pathLength="1"/>`;
    });
    pts.forEach((p, i) => { const isA = p.s.id === idA, isB = p.s.id === idB, dim = p.s.version !== activeVer ? ' dim' : '';
      if (isA || isB) g += `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="12" fill="none" stroke="${isA?'#2EE6F6':'#F5B544'}" stroke-width="2" class="halo"/><text x="${x(p.t)}" y="${y(p.v)-18}" text-anchor="middle" class="abl" fill="${isA?'#2EE6F6':'#F5B544'}">${isA?'A':'B'}</text>`;
      g += `<circle class="pt${dim}" data-id="${p.s.id}" cx="${x(p.t)}" cy="${y(p.v)}" r="${isA||isB?6.5:5}" fill="${COL[p.s.version]||'#fff'}" style="--i:${i}"/>`; });
    svg.innerHTML = g;
    svg.classList.toggle('drawn', drawnOnce);
    if (!drawnOnce) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { svg.classList.add('play'); drawnOnce = true; io.disconnect(); } }, { threshold: .3 }); io.observe(svg); }
    const tip = $('#chartTip');
    $$('.pt', svg).forEach(c => {
      const s = all.find(z => z.id === c.dataset.id), r = results.scenes[s.id];
      const show = () => { const bb = svg.getBoundingClientRect(), k = bb.width / W;
        tip.innerHTML = `<b>${fmtDate(s.date)}</b><span>Vegetation HV: <em>${r.mean_hv_db} dB</em></span><span>Open water: <em>${fmt(r.water_ha)} ha</em> (${r.water_pct}%)</span><span class="mono">Version ${s.version}</span>${s.version===activeVer?'<small>Click to set as Date A / B</small>':'<small>Other processing version</small>'}`;
        tip.style.left = (+c.getAttribute('cx') * k) + 'px'; tip.style.top = (+c.getAttribute('cy') * k) + 'px'; tip.classList.add('show'); };
      c.addEventListener('mouseenter', show); c.addEventListener('focus', show);
      c.addEventListener('mouseleave', () => tip.classList.remove('show'));
      c.addEventListener('click', () => {
        if (s.version !== activeVer) { const btn = $(`#verTabs [data-v="${s.version}"]`); if (btn) btn.click(); return; }
        const vs2 = vScenes(), i = vs2.findIndex(z => z.id === s.id); if (i < 0) return;
        if (Math.abs(i - A) <= Math.abs(i - B)) A = i; else B = i; if (A > B) [A, B] = [B, A]; if (A === B) return;
        render(allScenes, allResults);
      });
    });
  }
  $$('#metricSeg [data-m]').forEach(b => b.addEventListener('click', () => {
    metric = b.dataset.m; $$('#metricSeg [data-m]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#chartTitle').textContent = metric === 'hv' ? 'Vegetation signal over time' : 'Open water over time';
    $('#chartSub').textContent = metric === 'hv' ? 'Median HV backscatter of stable vegetation, in decibels (dB). Higher = stronger echo.' : 'Hectares of open water detected in each scene.';
    drawnOnce = false; $('#chartX').classList.remove('play', 'drawn'); drawChart(allScenes, allResults);
  }));

  // Polarization toggle — hook into the existing #polSeg buttons
  $$('[data-pol]').forEach(b => b.addEventListener('click', () => {
    activePol = b.dataset.pol;
    updateComparator();
  }));

  renderVerTabs();
  render(placeholderScenes, null);
  Promise.all([fetch('data/scenes.json').then(r => r.json()), fetch('data/results.json').then(r => r.json())])
    .then(([s, r]) => {
      allScenes = Array.isArray(s) ? s : [];
      allResults = r || null;
      const vs = vScenes();
      A = 0; B = Math.min(1, vs.length - 1);
      renderVerTabs();
      render(allScenes, allResults);
    })
    .catch(() => {});
})();
