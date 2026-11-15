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

  // Polarization switch
  const polHelp = { hh: 'HH: good for water and flooded areas.', hv: 'HV: good for vegetation and forest structure.', comp: 'Composite: both combined into one color image. Use the legend to read it.' };
  $$('[data-pol]').forEach(b => b.addEventListener('click', () => {
    $$('[data-pol]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#polFig').className = 'pol-' + b.dataset.pol;
    $('#polHelp').textContent = polHelp[b.dataset.pol];
  }));

  // Compare slider + change map
  const cmp = $('#compare');
  on($('#cmpRange'), 'input', e => cmp.style.setProperty('--pos', e.target.value + '%'));
  on($('#changeToggle'), 'change', e => cmp.classList.toggle('show-change', e.target.checked));

  // Explain button
  const explainBtn = $('#explainBtn');
  on(explainBtn, 'click', () => {
    explainBtn.textContent = 'Explaining…'; explainBtn.disabled = true;
    setTimeout(() => { $('#aiBox').classList.add('show'); explainBtn.textContent = '✓ Done'; }, reduce ? 0 : 700);
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
  const placeholderScenes = Array.from({ length: 16 }, (_, i) => ({ id: `scene_${String(i + 1).padStart(2, '0')}`, date: '[YYYY-MM-DD]', product: '[product]', polarizations: ['HH', 'HV'] }));
  let A = 2, B = 10;
  const isPh = v => v == null || String(v).startsWith('[');
  function render(scenes, results) {
    const label = s => isPh(s.date) ? s.id.replace('scene_', '#') : s.date.slice(2);
    $('#timeline').innerHTML = scenes.map((s, i) => `<button class="tl ${i === A ? 'a' : ''} ${i === B ? 'b' : ''}" data-i="${i}" aria-label="Scene ${i + 1}, ${s.date}${i === A ? ', Date A' : ''}${i === B ? ', Date B' : ''}"><span class="mk">${i === A ? 'A' : i === B ? 'B' : ''}</span><span class="dot"></span><span>${label(s)}</span></button>`).join('');
    $$('#timeline .tl').forEach(btn => btn.addEventListener('click', () => {
      const i = +btn.dataset.i; if (i === A || i === B) return;
      if (Math.abs(i - A) <= Math.abs(i - B)) A = i; else B = i;
      if (A > B) [A, B] = [B, A];
      render(scenes, results);
    }));
    const dA = scenes[A].date, dB = scenes[B].date;
    $$('.dA').forEach(e => e.textContent = isPh(dA) ? '[Date A]' : dA);
    $$('.dB').forEach(e => e.textContent = isPh(dB) ? '[Date B]' : dB);
    $('#scenesBody').innerHTML = scenes.map(s => `<tr><td class="mono">${s.id}</td><td class="mono">${s.date}</td><td>${s.product}</td><td>${s.polarizations.join(', ')}</td></tr>`).join('');
    const pair = results?.pairs?.[`${scenes[A].id}__${scenes[B].id}`];
    $$('[data-r]').forEach(el => { const v = pair?.[el.dataset.r]; el.textContent = isPh(v) ? '[X]' : v; el.classList.toggle('ph', isPh(v)); });
    const vals = scenes.map(s => +(results?.scenes?.[s.id]?.mean_hv_db));
    const has = vals.some(v => !isNaN(v));
    const W = 400, H = 200, p = 30, min = has ? Math.min(...vals.filter(v => !isNaN(v))) - 1 : 0, max = has ? Math.max(...vals.filter(v => !isNaN(v))) + 1 : 1;
    const x = i => p + i * (W - p * 1.5) / 15, y = v => H - p - (v - min) / (max - min) * (H - p * 1.8);
    let svg = `<line x1="${p}" y1="${H - p}" x2="${W - 10}" y2="${H - p}" stroke="#9FB8C0" opacity=".4"/><line x1="${p}" y1="12" x2="${p}" y2="${H - p}" stroke="#9FB8C0" opacity=".4"/><text x="${W / 2}" y="${H - 6}" fill="#9FB8C0" font-size="9" text-anchor="middle" font-family="IBM Plex Mono">date</text><text x="10" y="${H / 2}" fill="#9FB8C0" font-size="9" font-family="IBM Plex Mono" transform="rotate(-90 10 ${H / 2})" text-anchor="middle">mean HV (dB)</text>`;
    if (has) {
      svg += `<polyline fill="none" stroke="#2EE6F6" stroke-width="2" points="${vals.map((v, i) => isNaN(v) ? '' : `${x(i)},${y(v)}`).join(' ')}"/>`;
      vals.forEach((v, i) => { if (!isNaN(v)) svg += `<circle cx="${x(i)}" cy="${y(v)}" r="${i === A || i === B ? 6 : 3}" fill="${i === A ? '#2EE6F6' : i === B ? '#F5B544' : '#EAF6F8'}"/>`; });
    } else {
      scenes.forEach((_, i) => svg += `<circle cx="${x(i)}" cy="${H / 2}" r="${i === A || i === B ? 6 : 3}" fill="${i === A ? '#2EE6F6' : i === B ? '#F5B544' : 'rgba(234,246,248,.3)'}"/>`);
      svg += `<text x="${W / 2}" y="${H / 2 - 20}" fill="#C9B8FF" font-size="11" text-anchor="middle" font-family="IBM Plex Mono">[waiting for data/results.json]</text>`;
    }
    $('#chart').innerHTML = svg;
  }
  render(placeholderScenes, null);
  Promise.all([fetch('data/scenes.json').then(r => r.json()), fetch('data/results.json').then(r => r.json())])
    .then(([s, r]) => { if (Array.isArray(s) && s.length) { A = Math.min(A, s.length - 1); B = Math.min(B, s.length - 1); render(s, r); } })
    .catch(() => {});
})();
