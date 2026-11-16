/* Earth Waltz — stars, Dances dropdown, gallery lightbox, video, counters. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Twinkling stars (fixed background canvas)
  const cv = $('#stars');
  if (cv) {
    const ctx = cv.getContext('2d'); let stars = [], w, h, dpr;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr;
      const n = Math.round(innerWidth * innerHeight / 5200);
      stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.1 + .3) * dpr,
        p: Math.random() * Math.PI * 2, s: .6 + Math.random() * 1.8, c: Math.random() < .18 ? (Math.random() < .5 ? '46,230,246' : '190,170,255') : '255,255,255' })); };
    let shoot = null;
    const draw = t => { ctx.clearRect(0, 0, w, h);
      for (const s of stars) { const a = .25 + .75 * (.5 + .5 * Math.sin(t / 1000 * s.s + s.p));
        ctx.fillStyle = `rgba(${s.c},${a.toFixed(2)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        if (s.r > 1.2 * dpr && a > .9) { ctx.strokeStyle = `rgba(${s.c},${(a - .9) * 4})`; ctx.lineWidth = .6 * dpr; ctx.beginPath(); ctx.moveTo(s.x - 5 * dpr, s.y); ctx.lineTo(s.x + 5 * dpr, s.y); ctx.moveTo(s.x, s.y - 5 * dpr); ctx.lineTo(s.x, s.y + 5 * dpr); ctx.stroke(); } }
      if (!shoot && Math.random() < .002) shoot = { x: Math.random() * w * .7, y: Math.random() * h * .4, l: 0 };
      if (shoot) { shoot.l += 14 * dpr; const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x + shoot.l, shoot.y + shoot.l * .4);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(200,250,255,.8)'); ctx.strokeStyle = g; ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x + shoot.l, shoot.y + shoot.l * .4); ctx.stroke(); if (shoot.l > 260 * dpr) shoot = null; }
      if (!reduce) requestAnimationFrame(draw); };
    size(); addEventListener('resize', size); requestAnimationFrame(draw);
  }

  // Dances dropdown: hover on desktop, tap to open on touch / mobile
  $$('.has-dd').forEach(li => {
    const tg = $('.dd-toggle', li);
    const set = o => { li.classList.toggle('open', o); tg.setAttribute('aria-expanded', o); };
    li.addEventListener('mouseenter', () => matchMedia('(hover:hover)').matches && set(true));
    li.addEventListener('mouseleave', () => matchMedia('(hover:hover)').matches && set(false));
    li.addEventListener('focusin', () => set(true)); li.addEventListener('focusout', e => { if (!li.contains(e.relatedTarget)) set(false); });
    tg.addEventListener('click', e => { if (!matchMedia('(hover:hover)').matches || innerWidth <= 1100) { if (!li.classList.contains('open')) { e.preventDefault(); set(true); } } });
    document.addEventListener('keydown', e => e.key === 'Escape' && set(false));
  });

  // Gallery lightbox
  const items = $$('.g-item');
  if (items.length) {
    const lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Photo');
    lb.innerHTML = '<button class="lb-close" aria-label="Close">×</button><button class="lb-nav prev" aria-label="Previous">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-nav next" aria-label="Next">›</button>';
    document.body.appendChild(lb);
    const uniq = [...new Map(items.map(i => [i.dataset.src, i.dataset.cap])).entries()]; let k = 0;
    const show = i => { k = (i + uniq.length) % uniq.length; $('img', lb).src = uniq[k][0]; $('img', lb).alt = uniq[k][1]; $('figcaption', lb).textContent = uniq[k][1]; lb.classList.add('open'); };
    items.forEach(it => it.addEventListener('click', () => show(uniq.findIndex(u => u[0] === it.dataset.src))));
    $('.lb-close', lb).onclick = () => lb.classList.remove('open');
    $('.prev', lb).onclick = () => show(k - 1); $('.next', lb).onclick = () => show(k + 1);
    lb.addEventListener('click', e => e.target === lb && lb.classList.remove('open'));
    document.addEventListener('keydown', e => { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') lb.classList.remove('open'); if (e.key === 'ArrowRight') show(k + 1); if (e.key === 'ArrowLeft') show(k - 1); });
  }

  // NISAR video: show a friendly note until the file is added
  const vid = $('#nisarVideo');
  if (vid) { const ok = () => $('#videoMissing')?.classList.add('hide'); vid.addEventListener('loadedmetadata', ok); if (vid.readyState > 0) ok(); }

  // Compare: fill / whole scene
  const fit = $('#fitToggle'); if (fit) fit.addEventListener('change', () => $('#compare')?.classList.toggle('fit', fit.checked));

  // Count-up numbers (About)
  const cio = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const el = e.target, to = +el.dataset.count, t0 = performance.now();
    const st = n => { const k = Math.min(1, (n - t0) / 1400), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = v.toLocaleString('en-US'); if (k < 1) requestAnimationFrame(st); };
    requestAnimationFrame(st); cio.unobserve(el); }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));
  const r2 = $('#repoLink2'), r1 = $('#repoLink'); if (r2 && r1) r2.href = r1.href;
})();

/* v4: lilac stars follow the cursor, pause over reading content */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer:fine)').matches) return;
  const quiet = 'p,h1,h2,h3,h4,li,dd,dt,figcaption,article,.card,.eco,.lead,input,textarea,.ai-panel,.g-item,.compare,figure';
  let last = 0;
  addEventListener('mousemove', e => {
    const now = performance.now();
    if (now - last < 35) return;
    if (e.target.closest && e.target.closest(quiet)) return;
    last = now;
    const s = document.createElement('span');
    s.className = 'star-fx';
    const sz = 6 + Math.random() * 10;
    s.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;width:${sz}px;height:${sz}px;--dx:${(Math.random()-.5)*40}px;--dy:${10+Math.random()*30}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }, { passive: true });
})();
