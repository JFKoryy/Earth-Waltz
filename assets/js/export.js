// Export of results (client-side, no backend needed)
(() => {
  const msg = t => { const m = document.getElementById('exportMsg'); if (m) m.textContent = t; };
  let data = null;
  const load = async () => data || (data = await fetch('data/results.json').then(r => r.json()));
  const save = (blob, name) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const csv = rows => {
    const cols = Object.keys(rows[0] || {});
    const esc = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '\ufeff' + [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  };
  const csvBlob = rows => new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
  const pairRows = d => Object.entries(d.pairs).map(([k, p]) => {
    const [a, b] = k.split('__');
    return { scene_a: a, date_a: d.scenes[a]?.date, scene_b: b, date_b: d.scenes[b]?.date, version: p.version, days: p.days,
      became_water_ha: p.gained_ha, stopped_being_water_ha: p.lost_ha, gross_change_ha: p.gross_ha, net_change_ha: p.net_ha,
      gross_change_pct: p.gross_pct, water_a_ha: p.water_a_ha, water_b_ha: p.water_b_ha, stable_vegetation_ha: p.stable_veg_ha };
  });
  const currentMap = () => { const i = document.getElementById('changeImg'); return i && i.getAttribute('src'); };
  const actions = {
    async scenes(d) { save(csvBlob(Object.entries(d.scenes).map(([id, s]) => ({ scene: id, date: s.date, version: s.version, open_water_ha: s.water_ha, open_water_pct: s.water_pct, vegetation_hv_db: s.mean_hv_db, hh_minus_hv_db: s.hh_minus_hv_db }))), 'earth-waltz-scenes.csv'); },
    async pairs(d) { save(csvBlob(pairRows(d)), 'earth-waltz-comparisons.csv'); },
    async pair(d) {
      const src = currentMap(); const row = pairRows(d).find((r, i) => Object.values(d.pairs)[i].change_map && src && src.endsWith(Object.values(d.pairs)[i].change_map.split('/').pop()));
      if (!row) return msg('Pick Date A and Date B in the timeline first.');
      save(csvBlob([row]), `earth-waltz-${row.date_a}_vs_${row.date_b}.csv`);
    },
    async json(d) { save(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), 'earth-waltz-results.json'); },
    async chart() {
      const svg = document.getElementById('chartX'); if (!svg) return;
      const clone = svg.cloneNode(true);
      const src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
      src.forEach((el, i) => { const cs = getComputedStyle(el); ['fill','stroke','opacity','font-family','font-size','font-weight'].forEach(k => dst[i].style.setProperty(k, cs.getPropertyValue(k))); }); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const vb = svg.viewBox.baseVal, w = vb.width * 2, h = vb.height * 2;
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      await img.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#06161d'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      c.toBlob(b => save(b, 'earth-waltz-chart.png'), 'image/png');
    },
    async map() {
      const src = currentMap(); if (!src) return msg('Turn on “Show change map” first.');
      save(await fetch(src).then(r => r.blob()), src.split('/').pop());
    }
  };
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', async () => {
    try { msg(''); await actions[b.dataset.export](await load()); } catch (e) { msg('Sorry, that download did not work. Please try again.'); console.error(e); }
  }));
})();
