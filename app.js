// ============================================================
//  MUNDIAL 2026 TRACKER v2 — app.js
// ============================================================

// ── STATE ──────────────────────────────────────────────────
let stickers = {};   // key -> count
let movimientos = []; // purchases / sales
let openPaises = {};
let activeTab = 'inicio';

// ── STORAGE ────────────────────────────────────────────────
function load() {
  try { stickers = JSON.parse(localStorage.getItem('m26v2_s') || '{}'); } catch(e) { stickers = {}; }
  try { movimientos = JSON.parse(localStorage.getItem('m26v2_m') || '[]'); } catch(e) { movimientos = []; }
}
function save() {
  localStorage.setItem('m26v2_s', JSON.stringify(stickers));
  localStorage.setItem('m26v2_m', JSON.stringify(movimientos));
}
function k(section, idx) { return section + ':' + idx; }
function cnt(key) { return stickers[key] || 0; }
// Map crack name+team to their team player key
function getCrackTeamKey(crackName, teamName) {
  const team = ALBUM_DATA.teams.find(t => t.name === teamName);
  if (!team) return null;
  // Match by name (strip ⭐ for comparison)
  const clean = n => n.replace(/\s*⭐/g,'').trim().toLowerCase();
  const idx = team.players.findIndex(p => clean(p.name) === clean(crackName));
  if (idx === -1) return null;
  return k(teamName, idx);
}

function setCnt(key, val) {
  val = Math.max(0, val);
  stickers[key] = val;

  // If this is a crack key, sync with the player in their team
  if (key.startsWith('cracks:')) {
    const idx = parseInt(key.split(':')[1]);
    const crack = ALBUM_DATA.cracks.items[idx];
    if (crack) {
      const teamKey = getCrackTeamKey(crack.name, crack.team);
      if (teamKey && teamKey !== key) {
        stickers[teamKey] = val;
      }
    }
  }

  // If this is a team player key, check if they're a crack and sync
  const parts = key.split(':');
  if (parts.length === 2 && !['cracks','especiales','intro','cocacola'].includes(parts[0])) {
    const teamName = parts[0];
    const playerIdx = parseInt(parts[1]);
    const team = ALBUM_DATA.teams.find(t => t.name === teamName);
    if (team && team.players[playerIdx]) {
      const playerName = team.players[playerIdx].name.replace(' ⭐','').trim();
      const crackIdx = ALBUM_DATA.cracks.items.findIndex(
        c => c.name.replace(' ⭐','').trim().toLowerCase() === playerName.toLowerCase() && c.team === teamName
      );
      if (crackIdx !== -1) {
        stickers['cracks:' + crackIdx] = val;
      }
    }
  }

  save();
  if (activeTab === 'paises') { renderPaisesQuick(); return; }
  if (activeTab === 'especiales') { renderEspecialesQuick(key); return; }
  if (activeTab === 'cracks') { renderCracksQuick(key); return; }
  renderTabSilent(activeTab);
}

// ── PIN ─────────────────────────────────────────────────────
let pinBuf = '';
let pinMode = 'enter'; // enter | setup | change1 | change2
let pinTemp = '';

function initLogin() {
  const stored = localStorage.getItem('m26v2_pin');
  if (!stored) {
    pinMode = 'setup';
    document.getElementById('pin-instruction').textContent = 'Creá un PIN de 4 dígitos';
    document.getElementById('btn-reset').style.visibility = 'hidden';
    document.getElementById('forgot-pin-link').style.display = 'none';
  } else {
    pinMode = 'enter';
    document.getElementById('pin-instruction').textContent = 'Ingresá tu PIN';
    document.getElementById('btn-reset').style.visibility = 'visible';
    document.getElementById('forgot-pin-link').style.display = 'block';
  }
  pinBuf = '';
  updateDots();
}

function updateDots() {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('d' + i);
    d.className = 'pin-dot' + (i < pinBuf.length ? ' filled' : '');
  }
}

function pinDigit(n) {
  if (pinBuf.length >= 4) return;
  pinBuf += n;
  updateDots();
  if (pinBuf.length === 4) {
    setTimeout(processPIN, 120);
  }
}

function pinDel() {
  pinBuf = pinBuf.slice(0, -1);
  updateDots();
}

function processPIN() {
  const stored = localStorage.getItem('m26v2_pin');
  if (pinMode === 'setup') {
    localStorage.setItem('m26v2_pin', pinBuf);
    enterApp();
    setTimeout(setupSecurityQuestion, 600);
  } else if (pinMode === 'enter') {
    if (pinBuf === stored) { enterApp(); }
    else { pinError(); }
  } else if (pinMode === 'change1') {
    pinTemp = pinBuf; pinBuf = ''; pinMode = 'change2';
    document.getElementById('pin-instruction').textContent = 'Confirmá el PIN nuevo';
    updateDots();
  } else if (pinMode === 'change2') {
    if (pinBuf === pinTemp) {
      localStorage.setItem('m26v2_pin', pinBuf);
      toast('PIN cambiado ✓');
      enterApp();
    } else {
      pinError();
      pinMode = 'change1';
      document.getElementById('pin-instruction').textContent = 'PIN no coincide, intentá de nuevo';
    }
  }
}

function pinError() {
  for (let i = 0; i < 4; i++) document.getElementById('d' + i).classList.add('error');
  setTimeout(() => { pinBuf = ''; updateDots(); }, 450);
}

function askReset() {
  if (confirm('¿Borrar PIN y todos los datos? No se puede deshacer.')) {
    localStorage.clear(); location.reload();
  }
}

function enterApp() {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  load();
  switchTab('inicio', document.querySelector('.snav-btn[data-tab="inicio"]'));
}

function lockApp() {
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  initLogin();
}

// ── TABS ────────────────────────────────────────────────────
const TAB_TITLES = { inicio:'Inicio', paises:'Países', especiales:'Especiales', cracks:'Cracks', costos:'Costos', canjear:'Canjear', sincronizar:'Exportar / Importar' };

function switchTab(tab, btn) {
  activeTab = tab;
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bnav').forEach(b => b.classList.remove('active'));
  if (btn) { btn.classList.add('active'); }
  // also mark the matching sidebar/bottom btn
  document.querySelectorAll('[data-tab="'+tab+'"]').forEach(b => b.classList.add('active'));
  document.getElementById('topbar-title').textContent = TAB_TITLES[tab] || tab;
  renderTab(tab);
  // close mobile menu
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-overlay').classList.remove('open');
}

function renderTab(tab) {
  if (tab === 'inicio') renderInicio();
  else if (tab === 'paises') renderPaises();
  else if (tab === 'especiales') renderEspeciales();
  else if (tab === 'cracks') renderCracks();
  else if (tab === 'costos') renderCostos();
  else if (tab === 'canjear') renderCanjear();
  else if (tab === 'sincronizar') renderSincronizar();
}

function renderTabSilent(tab) {
  // re-renders without heavy operations if possible
  renderTab(tab);
}

function toggleMobileMenu() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('mobile-overlay');
  s.classList.toggle('open');
  o.classList.toggle('open');
}

// ── STATS ───────────────────────────────────────────────────
function computeStats() {
  let total = 0, owned = 0, repeated = 0;

  // Intro stickers (in ALBUM_DATA.intro)
  ALBUM_DATA.intro.items.forEach((item, i) => {
    total++;
    const c = cnt(k('intro', i));
    if (c >= 1) owned++;
    if (c > 1) repeated += c - 1;
  });

  // Teams
  ALBUM_DATA.teams.forEach(tm => {
    tm.players.forEach((_, i) => {
      total++;
      const c = cnt(k(tm.name, i));
      if (c >= 1) owned++;
      if (c > 1) repeated += c - 1;
    });
  });

  // Especiales (FWC codes)
  ALBUM_DATA.especiales.items.forEach((_, i) => {
    total++;
    const c = cnt(k('especiales', i));
    if (c >= 1) owned++;
    if (c > 1) repeated += c - 1;
  });

  // Cracks
  ALBUM_DATA.cracks.items.forEach((_, i) => {
    total++;
    const c = cnt(k('cracks', i));
    if (c >= 1) owned++;
    if (c > 1) repeated += c - 1;
  });

  // Coca-Cola
  ALBUM_DATA.cocacola.items.forEach((_, i) => {
    total++;
    const c = cnt(k('cocacola', i));
    if (c >= 1) owned++;
    if (c > 1) repeated += c - 1;
  });

  const gasto = movimientos.filter(m => m.tipo === 'sobres' || m.tipo === 'compra').reduce((a, m) => a + (m.qty||0) * (m.price||0), 0);
  const ingreso = movimientos.filter(m => m.tipo === 'venta').reduce((a, m) => a + (m.totalPesos||0), 0);
  const gastoNeto = gasto - ingreso;
  const sobres = movimientos.filter(m => m.tipo === 'sobres' || m.tipo === 'compra').reduce((a, m) => a + (m.qty||0), 0);
  const received = sobres * 5;
  const wasted = received > 0 ? Math.round(gasto * (repeated / received)) : 0;
  const pct = total > 0 ? (owned / total * 100) : 0;

  return { total, owned, repeated, gasto, ingreso, gastoNeto, sobres, received, wasted, pct };
}

// ── INICIO ──────────────────────────────────────────────────
function renderInicio() {
  const s = computeStats();
  const pctStr = s.pct.toFixed(1);

  // Team rankings
  const teamRanks = ALBUM_DATA.teams.map(tm => {
    const o = tm.players.filter((_, i) => cnt(k(tm.name, i)) >= 1).length;
    return { flag: tm.flag, name: tm.name, pct: tm.players.length ? (o / tm.players.length * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);

  const top5 = teamRanks.slice(0, 5);
  const bot5 = teamRanks.slice(-5).reverse();

  // Section mini stats
  const escudos = countSection('intro');
  const equipos = countSection('teams-escudos'); // alias
  const especiales = countSection('especiales');
  const cracks = countSection('cracks');

  // Count escudos (one per team = first sticker of each team block in intro? Let's use intro total)
  const introOwned = ALBUM_DATA.intro.items.filter((_, i) => cnt(k('intro', i)) >= 1).length;
  const especiOwned = ALBUM_DATA.especiales.items.filter((_, i) => cnt(k('especiales', i)) >= 1).length
                     + ALBUM_DATA.intro.items.filter((_, i) => cnt(k('intro', i)) >= 1).length
                     + ALBUM_DATA.cocacola.items.filter((_, i) => cnt(k('cocacola', i)) >= 1).length;
  const especiTotal = ALBUM_DATA.especiales.items.length + ALBUM_DATA.intro.items.length + ALBUM_DATA.cocacola.items.length;
  const cracksOwned = ALBUM_DATA.cracks.items.filter((_, i) => cnt(k('cracks', i)) >= 1).length;

  // Escudos and Equipos count from teams
  let escudosOwned = 0, escudosTotal = 0, equiposOwned = 0, equiposTotal = 0;
  ALBUM_DATA.teams.forEach(tm => {
    // assume sticker 0 = escudo, sticker last = foto grupal (equipo)
    if (tm.players.length > 0) {
      escudosTotal++;
      equiposTotal++;
      if (cnt(k(tm.name, 0)) >= 1) escudosOwned++;
      const lastIdx = tm.players.length - 1;
      if (cnt(k(tm.name, lastIdx)) >= 1) equiposOwned++;
    }
  });

  document.getElementById('tab-inicio').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-title">Mundial 2026</div>
        <div class="page-sub">Resumen de tu colección</div>
      </div>

      <div class="hero-card">
        <div class="hero-label">Progreso Total</div>
        <div class="hero-pct">${pctStr}<span>%</span></div>
        <div class="hero-count">${s.owned} de ${s.total} figuritas</div>
        <div class="hero-bar"><div class="hero-fill" style="width:${Math.min(100,s.pct)}%"></div></div>
      </div>

      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-card-icon">✅</div>
          <div class="stat-card-val green">${s.owned}</div>
          <div class="stat-card-lbl">Obtenidas</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">❌</div>
          <div class="stat-card-val red">${s.total - s.owned}</div>
          <div class="stat-card-lbl">Faltantes</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">📋</div>
          <div class="stat-card-val amber">${s.repeated}</div>
          <div class="stat-card-lbl">Repetidas</div>
        </div>
      </div>

      <div class="mini-cards">
        <div class="mini-card" onclick="switchTab('paises', document.querySelector('[data-tab=paises]'))">
          <span class="mini-card-icon">🛡️</span>
          <div><div class="mini-card-lbl">Escudos</div><div class="mini-card-val">${escudosOwned}/${escudosTotal}</div></div>
        </div>
        <div class="mini-card" onclick="switchTab('paises', document.querySelector('[data-tab=paises]'))">
          <span class="mini-card-icon">👥</span>
          <div><div class="mini-card-lbl">Equipos</div><div class="mini-card-val">${equiposOwned}/${equiposTotal}</div></div>
        </div>
        <div class="mini-card" onclick="switchTab('especiales', document.querySelector('[data-tab=especiales]'))">
          <span class="mini-card-icon">⭐</span>
          <div><div class="mini-card-lbl">Especiales</div><div class="mini-card-val">${especiOwned}/${especiTotal}</div></div>
        </div>
        <div class="mini-card" onclick="switchTab('cracks', document.querySelector('[data-tab=cracks]'))">
          <span class="mini-card-icon">⚡</span>
          <div><div class="mini-card-lbl">Cracks</div><div class="mini-card-val">${cracksOwned}/${ALBUM_DATA.cracks.items.length}</div></div>
        </div>
      </div>

      <div class="rankings-grid">
        <div class="ranking-card">
          <div class="ranking-title">📈 Top 5 más completos</div>
          ${top5.map(t => `
            <div class="rank-row">
              <span class="rank-flag">${t.flag}</span>
              <span class="rank-name">${t.name}</span>
              <div class="rank-bar-wrap"><div class="rank-bar" style="width:${t.pct}%"></div></div>
              <span class="rank-pct">${t.pct.toFixed(0)}%</span>
            </div>
          `).join('')}
        </div>
        <div class="ranking-card">
          <div class="ranking-title">📉 5 más atrasadas</div>
          ${bot5.map(t => `
            <div class="rank-row">
              <span class="rank-flag">${t.flag}</span>
              <span class="rank-name">${t.name}</span>
              <div class="rank-bar-wrap"><div class="rank-bar" style="width:${t.pct}%;background:#b02020"></div></div>
              <span class="rank-pct red">${t.pct.toFixed(0)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function countSection(sec) {
  if (sec === 'intro') return ALBUM_DATA.intro.items.filter((_, i) => cnt(k('intro', i)) >= 1).length;
  return 0;
}

// ── PAÍSES ──────────────────────────────────────────────────
let paisSearch = '', paisFilter = 'todos';
let _paisesHTML = '';

function renderPaises() {
  document.getElementById('tab-paises').innerHTML = `
    <div class="paises-search-bar">
      <input class="search-input" type="text" placeholder="🔍 Buscar país o jugador..." value="${paisSearch}" oninput="paisSearch=this.value;renderPaisesBody()">
      <div class="filter-chips">
        <button class="chip ${paisFilter==='todos'?'active':''}" onclick="paisFilter='todos';updateChips();renderPaisesBody()">Todos</button>
        <button class="chip ${paisFilter==='incompletos'?'active':''}" onclick="paisFilter='incompletos';updateChips();renderPaisesBody()">Incompletos</button>
        <button class="chip ${paisFilter==='completados'?'active':''}" onclick="paisFilter='completados';updateChips();renderPaisesBody()">Completados</button>
        <button class="chip ${paisFilter==='repetidas'?'active':''}" onclick="paisFilter='repetidas';updateChips();renderPaisesBody()">Con repetidas</button>
      </div>
    </div>
    <div class="paises-body" id="paises-body"></div>
  `;
  renderPaisesBody();
}

function updateChips() {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll(`.chip`).forEach(c => {
    const vals = ['todos','incompletos','completados','repetidas'];
    if (vals.some(v => c.textContent.toLowerCase().includes(v.slice(0,8)) && v === paisFilter)) c.classList.add('active');
  });
}

function renderPaisesBody() {
  const body = document.getElementById('paises-body');
  if (!body) return;
  const search = paisSearch.toLowerCase();
  const groups = [...new Set(ALBUM_DATA.teams.map(t => t.group))].filter(g => g !== 'X').sort();
  let html = '';

  groups.forEach(g => {
    const teamsInGroup = ALBUM_DATA.teams.filter(t => t.group === g);
    let groupRows = '';
    let anyVisible = false;

    teamsInGroup.forEach(tm => {
      if (search && !tm.name.toLowerCase().includes(search) && !tm.players.some(p => p.name.toLowerCase().includes(search))) return;
      const owned = tm.players.filter((_, i) => cnt(k(tm.name, i)) >= 1).length;
      const hasRep = tm.players.some((_, i) => cnt(k(tm.name, i)) > 1);
      const complete = owned === tm.players.length && tm.players.length > 0;
      if (paisFilter === 'completados' && !complete) return;
      if (paisFilter === 'incompletos' && complete) return;
      if (paisFilter === 'repetidas' && !hasRep) return;
      anyVisible = true;
      const pct = tm.players.length ? (owned / tm.players.length * 100) : 0;
      const id = 'pais-' + tm.name.replace(/[^a-zA-Z]/g, '_');
      const isOpen = openPaises[id] === true; // collapsed by default
      const badgeClass = complete ? 'done' : owned > 0 ? 'partial' : 'empty';
      const badgeTxt = complete ? '✓' : `${owned}/${tm.players.length}`;

      groupRows += `
        <div class="pais-card">
          <div class="pais-header" onclick="togglePais('${id}')">
            <span class="pais-flag"><span style="font-size:${tm.flag.length<=3?'17px':'13px'};font-weight:400;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.5px;color:var(--text);line-height:1">${tm.flag}</span></span>
            <div class="pais-info">
              <div class="pais-name">${tm.name}</div>
              <div class="pais-progress-bar"><div class="pais-progress-fill" style="width:${pct}%"></div></div>
            </div>
            <span class="pais-badge ${badgeClass}">${badgeTxt}</span>
            <svg class="pais-chev ${isOpen?'open':''}" id="chev-${id}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="pais-players ${isOpen?'open':''}" id="${id}-players">
            ${tm.players.map((p, i) => {
              const c = cnt(k(tm.name, i));
              const isSearch = search && p.name.toLowerCase().includes(search);
              const isSpecial = p.num === 0 || p.name === 'Foto grupal';
              const specialStyle = isSpecial ? 'background:var(--bg-card2);' : '';
              return `<div class="player-row ${isSearch?'highlight':''}" style="${specialStyle}">
                <span class="player-num" style="${isSpecial?'color:var(--gold);font-weight:700':''}">
                  ${p.num === 0 ? '🛡' : p.name === 'Foto grupal' ? '📷' : p.num}
                </span>
                <span class="player-name" style="${isSpecial?'font-weight:600':''}">${p.name.replace(' ⭐','')}<span class="star">${p.name.includes('⭐')?' ⭐':''}</span></span>
                ${c > 1 ? `<span class="player-rep">+${c-1}</span>` : ''}
                <div class="stepper">
                  <button class="step-btn" onclick="setCnt('${k(tm.name, i)}',${c-1})">−</button>
                  <span class="step-num ${c===0?'zero':c===1?'one':'many'}">${c}</span>
                  <button class="step-btn" onclick="setCnt('${k(tm.name, i)}',${c+1})">+</button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    });

    if (anyVisible) {
      // Count group totals for label
      const gOwned = teamsInGroup.reduce((a,tm) => a + tm.players.filter((_,i)=>cnt(k(tm.name,i))>=1).length, 0);
      const gTotal = teamsInGroup.reduce((a,tm) => a + tm.players.length, 0);
      const gPct = gTotal ? Math.round(gOwned/gTotal*100) : 0;
      const gId = 'group-block-' + g;
      const gOpen = (openPaises[gId] === undefined) ? true : openPaises[gId]; // groups expanded by default
      html += `
        <div class="group-block">
          <div class="group-label" onclick="toggleGroup('${gId}')">
            <span>Grupo ${g}</span>
            <span class="group-pct-badge">${gPct}%</span>
            <svg class="group-chev ${gOpen?'open':''}" id="gchev-${gId}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="group-teams ${gOpen?'open':''}" id="${gId}-teams">
            ${groupRows}
          </div>
        </div>`;
    }
  });

  body.innerHTML = html || '<div class="empty"><div class="empty-icon">🔍</div><p>Sin resultados</p></div>';
}

function toggleGroup(gId) {
  const el = document.getElementById(gId + '-teams');
  const chev = document.getElementById('gchev-' + gId);
  if (!el) return;
  const isOpen = el.classList.toggle('open');
  openPaises[gId] = isOpen;
  if (chev) chev.classList.toggle('open', isOpen);
}

function renderPaisesQuick() {
  // Fast re-render just the stepper values
  renderPaisesBody();
}

function togglePais(id) {
  const players = document.getElementById(id + '-players');
  const chev = document.getElementById('chev-' + id);
  if (!players) return;
  const isOpen = players.classList.toggle('open');
  openPaises[id] = isOpen;
  if (chev) chev.classList.toggle('open', isOpen);
}

// ── ESPECIALES ───────────────────────────────────────────────
function renderEspeciales() {
  const items = ALBUM_DATA.especiales.items;
  const owned = items.filter((_, i) => cnt(k('especiales', i)) >= 1).length;
  const pct = items.length ? (owned / items.length * 100) : 0;

  document.getElementById('tab-especiales').innerHTML = `
    <div class="tiles-page">
      <div class="page-header">
        <div class="page-icon-wrap gold">⭐</div>
        <div class="page-title">Figuritas Especiales</div>
        <div class="page-sub">FIFA Museum — Campeones · FWC1 a FWC${items.length} · ${items.length} totales</div>
      </div>

      <div class="section-prog">
        <div class="section-prog-top">
          <span class="section-prog-label">Progreso sección especiales</span>
          <span class="section-prog-pct">${pct.toFixed(0)}%</span>
        </div>
        <div class="section-prog-bar"><div class="section-prog-fill" style="width:${pct}%"></div></div>
        <div class="section-prog-sub">${owned} de ${items.length} figuritas FWC · + ${ALBUM_DATA.intro.items.length} Introducción · + ${ALBUM_DATA.cocacola.items.length} Coca-Cola</div>
      </div>

      <div class="tiles-legend">
        <span><span class="legend-dot" style="background:var(--s-missing);border:1.5px dashed var(--gold)"></span>Faltante</span>
        <span><span class="legend-dot" style="background:#2d6a2d"></span>Única (1)</span>
        <span><span class="legend-dot" style="background:#c8900a"></span>Repetida (2)</span>
        <span><span class="legend-dot" style="background:#b02020"></span>Muchas (3+)</span>
      </div>

      <div class="tiles-section-hdr">
        <div class="tiles-section-title">🌎 Introducción</div>
        <span class="tiles-section-badge">${ALBUM_DATA.intro.items.filter((_,i)=>cnt(k('intro',i))>=1).length}/${ALBUM_DATA.intro.items.length}</span>
      </div>
      <div class="tiles-grid" style="margin-bottom:1.5rem">
        ${ALBUM_DATA.intro.items.map((item, i) => renderTile('intro', i, item.code, item.name, false)).join('')}
      </div>

      <div class="tiles-section-hdr">
        <div class="tiles-section-title">🏆 FIFA Museum — Campeones del Mundo</div>
        <span class="tiles-section-badge">${items.filter((_,i)=>cnt(k('especiales',i))>=1).length}/${items.length}</span>
      </div>
      <div class="tiles-grid" id="especiales-grid">
        ${items.map((item, i) => renderTile('especiales', i, item.code, item.name, true)).join('')}
      </div>

      ${renderCocaColaSection()}
    </div>
  `;
}

function renderCocaColaSection() {
  const items = ALBUM_DATA.cocacola.items;
  const owned = items.filter((_, i) => cnt(k('cocacola', i)) >= 1).length;
  return `
    <div class="tiles-section-hdr" style="margin-top:1.5rem">
      <div class="tiles-section-title">🥤 Promo Coca-Cola</div>
      <span class="tiles-section-badge">${owned}/${items.length}</span>
    </div>
    <div class="tiles-grid">
      ${items.map((item, i) => renderTile('cocacola', i, item.code, item.name, true)).join('')}
    </div>
  `;
}

function renderEspecialesQuick(changedKey) {
  // Full re-render since intro/especiales/coca are all on same page
  renderEspeciales();
}

// ── CRACKS ───────────────────────────────────────────────────
function renderCracks() {
  const items = ALBUM_DATA.cracks.items;
  const owned = items.filter((_, i) => cnt(k('cracks', i)) >= 1).length;
  const pct = items.length ? (owned / items.length * 100) : 0;

  document.getElementById('tab-cracks').innerHTML = `
    <div class="tiles-page">
      <div class="page-header">
        <div class="page-icon-wrap gold">⚡</div>
        <div class="page-title">Cracks</div>
        <div class="page-sub">Las mejores figuritas del álbum · ${items.length} totales</div>
      </div>

      <div class="section-prog">
        <div class="section-prog-top">
          <span class="section-prog-label">Progreso cracks</span>
          <span class="section-prog-pct">${pct.toFixed(0)}%</span>
        </div>
        <div class="section-prog-bar"><div class="section-prog-fill" style="width:${pct}%"></div></div>
        <div class="section-prog-sub">${owned} de ${items.length} obtenidas · ${items.filter((_,i)=>cnt(k('cracks',i))>1).length} repetidas</div>
      </div>

      <div class="tiles-legend">
        <span><span class="legend-dot" style="background:var(--s-missing);border:1.5px dashed var(--gold)"></span>Faltante</span>
        <span><span class="legend-dot" style="background:#2d6a2d"></span>Única (1)</span>
        <span><span class="legend-dot" style="background:#c8900a"></span>Repetida (2)</span>
        <span><span class="legend-dot" style="background:#b02020"></span>Muchas (3+)</span>
        <div style="width:100%;font-size:11px;color:var(--text-3);margin-top:4px">Click izq: +1 · Click der: −1</div>
      </div>

      <div class="tiles-grid" id="cracks-grid">
        ${items.map((item, i) => renderTile('cracks', i, item.code, item.name + '\n' + item.team, true)).join('')}
      </div>
    </div>
  `;
}

function renderCracksQuick(changedKey) {
  const grid = document.getElementById('cracks-grid');
  if (!grid) return;
  const items = ALBUM_DATA.cracks.items;
  grid.innerHTML = items.map((item, i) => renderTile('cracks', i, item.code, item.name + '\n' + item.team, true)).join('');
}

// ── TILE BUILDER ─────────────────────────────────────────────
function renderTile(section, idx, code, nameFull, isSpecial) {
  const c = cnt(k(section, idx));
  const sc = c === 0 ? 's-0' : c === 1 ? 's-1' : c === 2 ? 's-2' : 's-3';
  const parts = nameFull.split('\n');
  const displayName = parts[0];
  const subName = parts[1] || '';
  return `<div class="sticker-tile ${sc} ${isSpecial?'special-tile':''}"
    onclick="setCnt('${k(section,idx)}',${c+1})"
    oncontextmenu="event.preventDefault();setCnt('${k(section,idx)}',${c-1})"
    title="${displayName}${subName?' — '+subName:''}">
    <span class="tile-code">${code}</span>
    <span class="tile-name">${displayName}</span>
    ${subName ? `<span class="tile-name" style="opacity:.7">${subName}</span>` : ''}
    ${c > 0 ? `<span class="tile-count">×${c}</span>` : ''}
  </div>`;
}

// ── COSTOS ───────────────────────────────────────────────────
// ── COSTOS ─────────────────────────────────────────────────────
let movType = 'sobres';
let selectedStickersSell = [];  // {key, name, qty}
let selectedStickersGive = [];  // figuritas que doy en canje
let selectedStickersGet = [];   // figuritas que recibo en canje

function renderCostos() {
  const s = computeStats();
  const avgPrice = s.sobres ? (s.gasto / s.sobres).toFixed(0) : 0;
  const costPerNew = s.owned ? (s.gasto / s.owned).toFixed(0) : 0;
  const costPerSticker = s.received ? (s.gasto / s.received).toFixed(0) : 0;
  const efficiency = s.received ? ((s.owned / s.received) * 100).toFixed(1) : 0;
  const wastedPct = s.gasto ? (s.wasted / s.gasto * 100).toFixed(1) : 0;
  const ingresoVentas = movimientos.filter(m=>m.tipo==='venta').reduce((a,m)=>a+(m.totalPesos||0),0);
  const canjesRealizados = movimientos.filter(m=>m.tipo==='canje').length;

  document.getElementById('tab-costos').innerHTML = `
    <div class="page">
      <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div class="page-icon-wrap gold" style="font-size:20px">💰</div>
          <div class="page-title">Costos</div>
          <div class="page-sub">Tu inversión en el álbum</div>
        </div>
        <button class="btn-primary" style="background:var(--blue)" onclick="openModalCompra()">+ Registrar</button>
      </div>

      <div class="money-hero">
        <div class="money-hero-main">
          <div class="label">Gasto en sobres</div>
          <div class="val">$${s.gasto.toLocaleString('es-AR')}</div>
          <div class="sub">Gasto neto: $${s.gastoNeto.toLocaleString('es-AR')}</div>
        </div>
        <div class="money-hero-badge">
          <div class="label">En repetidas</div>
          <div class="val">$${s.wasted.toLocaleString('es-AR')}</div>
          <div class="sub">${wastedPct}% del gasto</div>
        </div>
      </div>

      <div class="money-grid">
        <div class="money-card"><div class="lbl">Sobres comprados</div><div class="val">${s.sobres}</div></div>
        <div class="money-card"><div class="lbl">Figuritas recibidas</div><div class="val">${s.received}</div></div>
        <div class="money-card"><div class="lbl">Costo por sobre</div><div class="val">$${Number(avgPrice).toLocaleString('es-AR')}</div></div>
        <div class="money-card"><div class="lbl">Costo fig. nueva</div><div class="val">$${Number(costPerNew).toLocaleString('es-AR')}</div></div>
        <div class="money-card"><div class="lbl">Ingresos por ventas</div><div class="val" style="color:var(--green-ok)">$${ingresoVentas.toLocaleString('es-AR')}</div></div>
        <div class="money-card"><div class="lbl">Canjes realizados</div><div class="val">${canjesRealizados}</div></div>
        <div class="money-card"><div class="lbl">Eficiencia apertura</div><div class="val">${efficiency}%</div></div>
        <div class="money-card"><div class="lbl">Avance álbum</div><div class="val">${s.pct.toFixed(1)}%</div></div>
      </div>

      <div class="section-card">
        <div class="section-card-title">Historial</div>
        ${movimientos.length === 0
          ? '<div class="empty"><div class="empty-icon">📋</div><p>Aún no registraste movimientos.</p></div>'
          : '<ul class="purchase-list">' + movimientos.slice().reverse().map((m, ri) => {
              const realIdx = movimientos.length - 1 - ri;
              return renderMovItem(m, realIdx);
            }).join('') + '</ul>'
        }
      </div>
    </div>
  `;
}

function renderMovItem(m, idx) {
  const icons = { sobres:'📦', venta:'💰', canje:'🔄' };
  const icon = icons[m.tipo] || '📋';
  let detail = '';
  if (m.tipo === 'sobres') {
    detail = `${m.qty} sobre${m.qty>1?'s':''} × $${m.price.toLocaleString('es-AR')} = <b>$${(m.qty*m.price).toLocaleString('es-AR')}</b>`;
  } else if (m.tipo === 'venta') {
    const figus = (m.stickers||[]).map(s=>s.name).join(', ');
    detail = `${(m.stickers||[]).length} figurita${(m.stickers||[]).length>1?'s':''} vendida${(m.stickers||[]).length>1?'s':''} · <b>$${(m.totalPesos||0).toLocaleString('es-AR')}</b>`;
    if (figus) detail += `<div style="font-size:11px;color:var(--text-3);margin-top:2px">${figus}</div>`;
  } else if (m.tipo === 'canje') {
    const di = (m.give||[]).map(s=>s.name).join(', ');
    const ge = (m.get||[]).map(s=>s.name).join(', ');
    detail = `Di: <b>${di||'—'}</b><br>Recibí: <b>${ge||'—'}</b>`;
  }
  return `<li class="purchase-item">
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="font-size:16px">${icon}</span>
        <span class="purchase-type ${m.tipo}">${m.tipo==='sobres'?'Compra sobres':m.tipo==='venta'?'Venta figuritas':'Canje'}</span>
      </div>
      <div class="purchase-main">${detail}</div>
      <div class="purchase-date">${m.date}${m.nota?' · '+m.nota:''}</div>
    </div>
    <button class="btn-del" onclick="deleteMov(${idx})">🗑</button>
  </li>`;
}

function openModalCompra() {
  movType = 'sobres';
  selectedStickersSell = [];
  selectedStickersGive = [];
  selectedStickersGet = [];
  document.getElementById('modal-compra').style.display = 'flex';
  setMovType('sobres');
}
function closeModalCompra() {
  document.getElementById('modal-compra').style.display = 'none';
}

function setMovType(type) {
  movType = type;
  ['sobres','venta','canje'].forEach(t => {
    document.getElementById('mtyp-' + t).classList.toggle('active', t === type);
  });
  const body = document.getElementById('mov-modal-body');
  if (type === 'sobres') renderFormSobres(body);
  else if (type === 'venta') renderFormVenta(body);
  else if (type === 'canje') renderFormCanje(body);
}

// ── FORM: COMPRA SOBRES ───────────────────────────────────────
function renderFormSobres(body) {
  body.innerHTML = `
    <div class="form-group"><label>Cantidad de sobres</label>
      <input type="number" id="mov-qty" min="1" value="1" placeholder="Ej: 10"></div>
    <div class="form-group"><label>Precio por sobre ($)</label>
      <input type="number" id="mov-price" min="0" placeholder="Ej: 500"></div>
    <div class="form-group"><label>Nota (opcional)</label>
      <input type="text" id="mov-nota" placeholder="Ej: kiosco de la esquina"></div>
    <button class="btn-primary full" onclick="saveSobres()">Guardar compra</button>
  `;
}

function saveSobres() {
  const qty = parseInt(document.getElementById('mov-qty').value);
  const price = parseFloat(document.getElementById('mov-price').value);
  const nota = document.getElementById('mov-nota').value;
  if (!qty || !price || qty < 1 || price < 0) { toast('Ingresá cantidad y precio válidos'); return; }
  pushMov({ tipo:'sobres', qty, price, nota });
  closeModalCompra();
  toast('Compra registrada ✓');
  renderCostos();
}

// ── FORM: VENTA FIGURITAS ─────────────────────────────────────
function renderFormVenta(body) {
  const reps = getRepetidas();
  body.innerHTML = `
    <p style="font-size:13px;color:var(--text-2);margin-bottom:10px">Seleccioná las figuritas que vendiste de tus repetidas:</p>
    <input type="text" placeholder="🔍 Buscar figurita..." id="sell-search"
      style="width:100%;padding:9px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:14px;outline:none;margin-bottom:10px"
      oninput="filterSellList(this.value)">
    <div id="sell-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:12px">
      ${reps.length === 0
        ? '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">No tenés figuritas repetidas</div>'
        : reps.map(r => renderSellRow(r)).join('')
      }
    </div>
    <div id="sell-selected" style="margin-bottom:10px"></div>
    <div class="form-group"><label>Precio total obtenido ($)</label>
      <input type="number" id="sell-price" min="0" placeholder="Ej: 2000"></div>
    <div class="form-group"><label>Nota (opcional)</label>
      <input type="text" id="sell-nota" placeholder="Ej: vendí en el recreo"></div>
    <button class="btn-primary full" onclick="saveVenta()">Guardar venta</button>
  `;
  renderSellSelected();
}

function getRepetidas() {
  const all = buildStickerIndex();
  return all.filter(s => cnt(s.key) > 1).map(s => ({
    key: s.key, name: s.name, section: s.section,
    code: s.code, extra: cnt(s.key) - 1
  })).sort((a,b) => b.extra - a.extra);
}

function renderSellRow(r) {
  const sel = selectedStickersSell.find(s => s.key === r.key);
  const selQty = sel ? sel.qty : 0;
  return `<div class="sell-row" id="sellrow-${r.key.replace(/[^a-z0-9]/gi,'-')}">
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:700;color:var(--blue)">${r.code}</div>
      <div style="font-size:13px;color:var(--text)">${r.name}</div>
      <div style="font-size:11px;color:var(--text-3)">${r.section} · ×${r.extra} de más</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
      <button onclick="changeSellQty('${r.key}',${r.extra},-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--bg-card2);cursor:pointer;font-size:14px">−</button>
      <span style="font-size:14px;font-weight:700;color:${selQty>0?'var(--blue)':'var(--text-3)'};width:18px;text-align:center">${selQty}</span>
      <button onclick="changeSellQty('${r.key}',${r.extra},1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--bg-card2);cursor:pointer;font-size:14px">+</button>
    </div>
  </div>`;
}

function changeSellQty(key, maxExtra, delta) {
  const idx = selectedStickersSell.findIndex(s => s.key === key);
  if (idx === -1) {
    if (delta > 0) {
      const item = buildStickerIndex().find(s => s.key === key);
      selectedStickersSell.push({ key, name: item?.name||key, qty: 1 });
    }
  } else {
    selectedStickersSell[idx].qty = Math.max(0, Math.min(maxExtra, selectedStickersSell[idx].qty + delta));
    if (selectedStickersSell[idx].qty === 0) selectedStickersSell.splice(idx, 1);
  }
  // Refresh row
  const reps = getRepetidas();
  const rep = reps.find(r => r.key === key);
  if (rep) {
    const rowId = 'sellrow-' + key.replace(/[^a-z0-9]/gi,'-');
    const rowEl = document.getElementById(rowId);
    if (rowEl) rowEl.outerHTML = renderSellRow(rep);
  }
  renderSellSelected();
}

function renderSellSelected() {
  const el = document.getElementById('sell-selected');
  if (!el) return;
  if (selectedStickersSell.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:6px">Seleccionadas (${selectedStickersSell.reduce((a,s)=>a+s.qty,0)} figuritas):</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">
      ${selectedStickersSell.map(s => `<span style="background:var(--blue);color:#fff;font-size:11px;padding:2px 8px;border-radius:20px">
        ${s.name}${s.qty>1?' ×'+s.qty:''}</span>`).join('')}
    </div>`;
}

function filterSellList(q) {
  const reps = getRepetidas().filter(r =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.code.toLowerCase().includes(q.toLowerCase()) ||
    r.section.toLowerCase().includes(q.toLowerCase())
  );
  const el = document.getElementById('sell-list');
  if (el) el.innerHTML = reps.length ? reps.map(renderSellRow).join('') : '<div style="padding:16px;text-align:center;color:var(--text-3);font-size:13px">Sin resultados</div>';
}

function saveVenta() {
  if (selectedStickersSell.length === 0) { toast('Seleccioná al menos una figurita'); return; }
  const price = parseFloat(document.getElementById('sell-price').value) || 0;
  const nota = document.getElementById('sell-nota').value;
  // Discount from stock
  selectedStickersSell.forEach(s => {
    const current = cnt(s.key);
    stickers[s.key] = Math.max(0, current - s.qty);
  });
  save();
  pushMov({ tipo:'venta', stickers:[...selectedStickersSell], totalPesos: price, nota });
  closeModalCompra();
  toast(`Venta registrada · ${selectedStickersSell.reduce((a,s)=>a+s.qty,0)} figuritas`);
  renderCostos();
}

// ── FORM: CANJE ───────────────────────────────────────────────
function renderFormCanje(body) {
  body.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">Figuritas que <span style="color:var(--red)">entregás</span> (tus repetidas):</div>
    <input type="text" placeholder="🔍 Buscar..." id="canje-give-search"
      style="width:100%;padding:8px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:13px;outline:none;margin-bottom:8px"
      oninput="filterCanjeList('give',this.value)">
    <div id="canje-give-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
      ${getRepetidas().map(r => renderCanjeRow('give', r)).join('') || '<div style="padding:14px;text-align:center;color:var(--text-3);font-size:12px">Sin repetidas</div>'}
    </div>
    <div id="canje-give-selected" style="margin-bottom:14px"></div>

    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">Figuritas que <span style="color:var(--green-ok)">recibís</span> (te faltan):</div>
    <input type="text" placeholder="🔍 Buscar por código o jugador..." id="canje-get-search"
      style="width:100%;padding:8px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:13px;outline:none;margin-bottom:8px"
      oninput="filterCanjeGetList(this.value)">
    <div id="canje-get-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:8px"></div>
    <div id="canje-get-selected" style="margin-bottom:14px"></div>

    <div class="form-group"><label>Nota (opcional)</label>
      <input type="text" id="canje-nota" placeholder="Ej: canje con el chico del colegio"></div>
    <button class="btn-primary full" onclick="saveCanje()">Guardar canje</button>
  `;
  renderCanjeSelected('give');
  renderCanjeSelected('get');
}

function renderCanjeRow(side, r) {
  const selList = side === 'give' ? selectedStickersGive : selectedStickersGet;
  const sel = selList.find(s => s.key === r.key);
  const checked = !!sel;
  return `<div onclick="toggleCanjeItem('${side}','${r.key}','${r.name.replace(/'/g,"\'")}',${r.extra||0})"
    style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);background:${checked?'var(--green-ok-bg)':'transparent'};-webkit-tap-highlight-color:transparent">
    <span style="font-size:18px">${checked?'☑':'☐'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:700;color:var(--blue)">${r.code}</div>
      <div style="font-size:13px;color:var(--text)">${r.name}</div>
      <div style="font-size:11px;color:var(--text-3)">${r.section}${r.extra?' · ×'+r.extra+' de más':''}</div>
    </div>
  </div>`;
}

function toggleCanjeItem(side, key, name, extra) {
  const list = side === 'give' ? selectedStickersGive : selectedStickersGet;
  const idx = list.findIndex(s => s.key === key);
  if (idx === -1) list.push({ key, name, qty: 1 });
  else list.splice(idx, 1);
  // Refresh list
  if (side === 'give') filterCanjeList('give', document.getElementById('canje-give-search')?.value||'');
  else filterCanjeGetList(document.getElementById('canje-get-search')?.value||'');
  renderCanjeSelected(side);
}

function renderCanjeSelected(side) {
  const list = side === 'give' ? selectedStickersGive : selectedStickersGet;
  const el = document.getElementById('canje-' + side + '-selected');
  if (!el) return;
  if (!list.length) { el.innerHTML = ''; return; }
  const color = side === 'give' ? 'var(--red)' : 'var(--green-ok)';
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:4px">
    ${list.map(s => `<span style="background:${color};color:#fff;font-size:11px;padding:2px 8px;border-radius:20px">${s.name}</span>`).join('')}
  </div>`;
}

function filterCanjeList(side, q) {
  const reps = getRepetidas().filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()));
  const el = document.getElementById('canje-give-list');
  if (el) el.innerHTML = reps.map(r => renderCanjeRow('give', r)).join('') || '<div style="padding:14px;text-align:center;color:var(--text-3)">Sin resultados</div>';
}

function filterCanjeGetList(q) {
  if (!q || q.length < 2) { document.getElementById('canje-get-list').innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-3);font-size:12px">Escribí para buscar</div>'; return; }
  // Show missing stickers matching query
  const all = buildStickerIndex().filter(s => cnt(s.key) === 0);
  const results = all.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.code.toLowerCase().includes(q.toLowerCase()) ||
    (s.section||'').toLowerCase().includes(q.toLowerCase())
  ).slice(0, 20);
  const el = document.getElementById('canje-get-list');
  el.innerHTML = results.map(r => renderCanjeRow('get', {...r, extra:0})).join('') ||
    '<div style="padding:14px;text-align:center;color:var(--text-3);font-size:12px">Sin resultados</div>';
}

function saveCanje() {
  if (selectedStickersGive.length === 0 && selectedStickersGet.length === 0) {
    toast('Seleccioná figuritas que diste o recibiste'); return;
  }
  const nota = document.getElementById('canje-nota')?.value || '';
  // Discount given stickers from stock
  selectedStickersGive.forEach(s => {
    stickers[s.key] = Math.max(0, cnt(s.key) - 1);
  });
  // Add received stickers to stock
  selectedStickersGet.forEach(s => {
    stickers[s.key] = cnt(s.key) + 1;
  });
  save();
  pushMov({ tipo:'canje', give:[...selectedStickersGive], get:[...selectedStickersGet], nota });
  closeModalCompra();
  toast(`Canje registrado · ${selectedStickersGive.length} dadas · ${selectedStickersGet.length} recibidas`);
  renderCostos();
  renderTab(activeTab);
}

function pushMov(mov) {
  const now = new Date();
  mov.date = now.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' });
  movimientos.push(mov);
  save();
}

function deleteMov(idx) {
  const m = movimientos[idx];
  if (!m) return;

  let icon = '🗑️', title = 'Eliminar movimiento', body = '', okLabel = 'Eliminar';

  if (m.tipo === 'venta') {
    const qty = (m.stickers||[]).reduce((a,s)=>a+(s.qty||1),0);
    const names = (m.stickers||[]).map(s=>s.name).join('\n');
    icon = '💰';
    title = 'Eliminar venta';
    body = `Se van a DEVOLVER ${qty} figurita${qty>1?'s':''} a tus repetidas:\n${names}\n\nEl ingreso de $${(m.totalPesos||0).toLocaleString('es-AR')} se va a descontar.`;
  } else if (m.tipo === 'canje') {
    const gave = (m.give||[]).map(s=>s.name).join(', ') || '—';
    const got  = (m.get||[]).map(s=>s.name).join(', ') || '—';
    icon = '🔄';
    title = 'Eliminar canje';
    body = `Se va a REVERTIR el intercambio:\n\nVolvés a tener: ${gave}\nSe te quita: ${got}`;
  } else {
    icon = '📦';
    title = 'Eliminar compra';
    body = `${m.qty} sobre${(m.qty||0)>1?'s':''} × $${(m.price||0).toLocaleString('es-AR')} = $${((m.qty||0)*(m.price||0)).toLocaleString('es-AR')}\n\nSe quitará del total de gastos.`;
  }

  showConfirm(icon, title, body, 'Sí, eliminar', () => {
    // Revert stock
    if (m.tipo === 'venta') {
      (m.stickers||[]).forEach(s => {
        stickers[s.key] = (stickers[s.key] || 0) + (s.qty || 1);
      });
    } else if (m.tipo === 'canje') {
      (m.get||[]).forEach(s => {
        stickers[s.key] = Math.max(0, (stickers[s.key] || 0) - 1);
      });
      (m.give||[]).forEach(s => {
        stickers[s.key] = (stickers[s.key] || 0) + 1;
      });
    }
    movimientos.splice(idx, 1);
    save();
    toast('Movimiento eliminado y stock revertido ✓');
    renderCostos();
    renderTab(activeTab);
  });
}

// ── CANJEAR ──────────────────────────────────────────────────
function renderCanjear() {
  let items = [];

  ALBUM_DATA.intro.items.forEach((s, i) => {
    const c = cnt(k('intro', i));
    if (c > 1) items.push({ name: s.name, section: '🌎 Introducción — ' + s.code, extra: c - 1 });
  });
  ALBUM_DATA.teams.forEach(tm => {
    tm.players.forEach((p, i) => {
      const c = cnt(k(tm.name, i));
      if (c > 1) items.push({ name: p.name.replace(' ⭐',''), section: tm.flag + ' ' + tm.name, extra: c - 1, star: p.name.includes('⭐') });
    });
  });
  ALBUM_DATA.especiales.items.forEach((s, i) => {
    const c = cnt(k('especiales', i));
    if (c > 1) items.push({ name: `${s.code} — ${s.name}`, section: '⭐ Especiales', extra: c - 1 });
  });
  ALBUM_DATA.cracks.items.forEach((s, i) => {
    const c = cnt(k('cracks', i));
    if (c > 1) items.push({ name: s.name, section: '⚡ Cracks — ' + s.team, extra: c - 1 });
  });
  ALBUM_DATA.cocacola.items.forEach((s, i) => {
    const c = cnt(k('cocacola', i));
    if (c > 1) items.push({ name: `${s.code} — ${s.name}`, section: '🥤 Coca-Cola', extra: c - 1 });
  });

  items.sort((a, b) => b.extra - a.extra);
  const totalExtra = items.reduce((a, i) => a + i.extra, 0);

  document.getElementById('tab-canjear').innerHTML = `
    <div class="page">
      <div class="canjear-hero">
        <div class="label">Figuritas para canjear</div>
        <div class="count">${totalExtra}</div>
        <div class="sub">${items.length} tipos diferentes con repetidas</div>
        ${totalExtra > 0 ? `<div class="canjear-hint">📱 Mostrá esta lista cuando vayas a canjear</div>` : ''}
      </div>

      ${items.length === 0
        ? `<div class="empty"><div class="empty-icon">🎉</div><p>No tenés repetidas todavía</p></div>`
        : `<ul class="swap-list">
            ${items.map(it => `
              <li class="swap-item">
                <div>
                  <div class="swap-main">${it.name}${it.star?'<span style="color:var(--gold)"> ⭐</span>':''}</div>
                  <div class="swap-section-lbl">${it.section}</div>
                </div>
                <span class="swap-pill">×${it.extra}</span>
              </li>
            `).join('')}
          </ul>`
      }
    </div>
  `;
}


// ── SINCRONIZAR ─────────────────────────────────────────────
function renderSincronizar() {
  document.getElementById('tab-sincronizar').innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-icon-wrap" style="background:#e0edf8">📤</div>
        <div class="page-title">Exportar / Importar</div>
        <div class="page-sub">Sincronizá tu progreso entre dispositivos</div>
      </div>

      <div class="section-card" style="margin-bottom:1rem">
        <div class="section-card-title">¿Cómo funciona?</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.7">
          <p>Esta app guarda los datos <b>localmente en tu dispositivo</b>. Para sincronizar entre celu y PC:</p>
          <ol style="margin:10px 0 0 16px;display:flex;flex-direction:column;gap:6px">
            <li>En el <b>dispositivo origen</b>, hacé clic en <b>"Generar código"</b></li>
            <li>Copiá el código que aparece</li>
            <li>En el <b>dispositivo destino</b>, pegalo en el campo de abajo y hacé clic en <b>"Importar"</b></li>
          </ol>
        </div>
      </div>

      <div class="section-card" style="margin-bottom:1rem">
        <div class="section-card-title">📤 Exportar mis datos</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:1rem">Genera un código con TODO tu progreso actual: figuritas, compras y PIN.</p>
        <button class="btn-primary full" onclick="exportarDatos()" style="margin-bottom:10px">Generar código de exportación</button>
        <textarea id="export-area" readonly placeholder="El código aparecerá aquí..."
          style="width:100%;height:120px;padding:10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:11px;font-family:monospace;resize:none;outline:none;line-height:1.5"></textarea>
        <button id="copy-btn" class="btn-primary full" onclick="copiarCodigo()" style="margin-top:8px;background:var(--gold);color:#0f2a4a;display:none">📋 Copiar código</button>
      </div>

      <div class="section-card">
        <div class="section-card-title">📥 Importar datos</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:1rem">Pegá el código generado en otro dispositivo. <span style="color:var(--red);font-weight:600">Esto reemplazará todos tus datos actuales.</span></p>
        <textarea id="import-area" placeholder="Pegá el código aquí..."
          style="width:100%;height:120px;padding:10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:11px;font-family:monospace;resize:none;outline:none;line-height:1.5"></textarea>
        <button class="btn-primary full" onclick="importarDatos()" style="margin-top:8px;background:#b02020">Importar y reemplazar datos</button>
      </div>
    </div>
  `;
}

function exportarDatos() {
  const payload = {
    v: 2,
    ts: new Date().toISOString(),
    s: stickers,
    m: movimientos
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  // Split into chunks of 60 chars for readability
  const chunks = encoded.match(/.{1,80}/g) || [];
  const code = 'M26:' + chunks.join('\n');
  const area = document.getElementById('export-area');
  area.value = code;
  document.getElementById('copy-btn').style.display = 'block';
  toast('Código generado ✓');
}

function copiarCodigo() {
  const area = document.getElementById('export-area');
  area.select();
  try {
    navigator.clipboard.writeText(area.value).then(() => toast('¡Código copiado!')).catch(() => {
      document.execCommand('copy');
      toast('¡Código copiado!');
    });
  } catch(e) {
    document.execCommand('copy');
    toast('¡Código copiado!');
  }
}

function importarDatos() {
  const raw = document.getElementById('import-area').value.trim();
  if (!raw.startsWith('M26:')) {
    toast('Código inválido — debe empezar con M26:');
    return;
  }
  if (!confirm('¿Seguro? Esto va a reemplazar TODO tu progreso actual.')) return;
  try {
    const encoded = raw.replace('M26:', '').replace(/\n/g, '').replace(/\s/g, '');
    const json = decodeURIComponent(escape(atob(encoded)));
    const payload = JSON.parse(json);
    if (payload.v !== 2 || !payload.s || !payload.m) throw new Error('Formato inválido');
    stickers = payload.s;
    movimientos = payload.m;
    save();
    toast('¡Datos importados correctamente! ✓');
    document.getElementById('import-area').value = '';
    setTimeout(() => switchTab('inicio', document.querySelector('[data-tab=inicio]')), 1200);
  } catch(e) {
    toast('Error al leer el código. Verificá que esté completo.');
  }
}


// ══════════════════════════════════════════════════════════════
//  SCANNER — Cámara OCR + Manual
// ══════════════════════════════════════════════════════════════

let scannerStream = null;
let scannerMode = 'cam';
let tesseractWorker = null;
let tesseractReady = false;

// Build a flat searchable index of ALL stickers
// Team stickers use format: FLAG+NUM (e.g. ARG17, BRA5, FWC9, C1, CC3)
function buildStickerIndex() {
  const idx = [];

  // Intro (codes: 00, 1-9)
  ALBUM_DATA.intro.items.forEach((item, i) => {
    idx.push({ key: k('intro', i), code: item.code, altCodes: [], name: item.name, section: '🌎 Introducción' });
  });

  // FWC (codes: FWC9-FWC19)
  ALBUM_DATA.especiales.items.forEach((item, i) => {
    idx.push({ key: k('especiales', i), code: item.code, altCodes: [], name: item.name, section: '🏆 FIFA Museum' });
  });

  // Coca-Cola (codes: CC1-CC14)
  ALBUM_DATA.cocacola.items.forEach((item, i) => {
    idx.push({ key: k('cocacola', i), code: item.code, altCodes: [], name: item.name, section: '🥤 Coca-Cola' });
  });

  // Cracks (codes: C1-C24)
  ALBUM_DATA.cracks.items.forEach((item, i) => {
    // Build team abbrev from flag field
    const teamAbbr = ALBUM_DATA.teams.find(t => t.name === item.team)?.flag || '';
    idx.push({
      key: k('cracks', i),
      code: item.code,
      altCodes: [teamAbbr + item.code],  // e.g. ARGC1
      name: item.name.replace(' ⭐',''),
      section: '⚡ Cracks — ' + item.team
    });
  });

  // Teams — primary code = FLAG+NUM (e.g. ARG17, BRA5)
  ALBUM_DATA.teams.forEach(tm => {
    const abbr = tm.flag; // e.g. 'ARG', 'BRA', 'ENG'
    tm.players.forEach((p, i) => {
      const numCode = abbr + p.num;          // ARG17
      const numOnly = String(p.num);         // 17
      const escudo = p.num === 0;
      const foto = p.name === 'Foto grupal';
      const specialCode = escudo ? abbr + '0' : foto ? abbr + '19' : null;
      idx.push({
        key: k(tm.name, i),
        code: numCode,
        altCodes: [numOnly, abbr + '-' + numOnly, specialCode].filter(Boolean),
        name: p.name.replace(' ⭐',''),
        section: tm.flag + ' ' + tm.name + ' — Grupo ' + tm.group,
        teamName: tm.name,
        playerNum: p.num,
      });
    });
  });

  return idx;
}

// Search sticker index by code or name
// Handles: ARG17, COL 15, FWC9, C1, CC3, player name, or just a number
function searchStickers(query) {
  if (!query || query.length < 1) return [];
  const q = query.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g,'');
  const qLow = query.trim().toLowerCase();
  const idx = buildStickerIndex();

  // Extract numeric suffix if query looks like TEAM+NUM (e.g. ARG15 → num=15, ARG15 → prefix=ARG)
  const numMatch = q.match(/^([A-Z]{2,3})?\s*(\d+)$/);
  const numOnly = numMatch ? numMatch[2] : null;      // "15"
  const prefixOnly = numMatch ? numMatch[1] : null;   // "ARG" (may be wrong from OCR)

  const matches = (s) => {
    const code = s.code.toUpperCase().replace(/-/g,'');
    if (code === q) return 10;                        // exact: COL15
    if (s.altCodes.some(c => c.toUpperCase().replace(/-/g,'') === q)) return 9;
    if (code.startsWith(q) && q.length >= 2) return 7;
    if (s.altCodes.some(c => c.toUpperCase().replace(/-/g,'').startsWith(q))) return 6;
    // Number-only match: if OCR read ARG15 but real is COL15,
    // show ALL team stickers with num=15 so user can pick
    if (numOnly && s.playerNum !== undefined && String(s.playerNum) === numOnly) return 3;
    if (s.name.toLowerCase().includes(qLow) && qLow.length >= 3) return 4;
    if (s.teamName && s.teamName.toLowerCase().includes(qLow) && qLow.length >= 3) return 2;
    return 0;
  };

  const results = idx
    .map(s => ({ ...s, score: matches(s) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // If top result is a low-confidence number-only match (OCR likely misread country),
  // cap results and add a header hint
  const topScore = results[0]?.score || 0;
  const limited = results.slice(0, topScore >= 6 ? 8 : 16); // show more when uncertain
  return limited;
}

// Mark a sticker found by scanner/manual
function markStickerFound(stickerItem) {
  const current = cnt(stickerItem.key);
  setCnt(stickerItem.key, current + 1);
  toast(`✓ ${stickerItem.name} marcada (×${current + 1})`);
}

// ── OPEN / CLOSE ──────────────────────────────────────────────
function openScanner() {
  document.getElementById('modal-scanner').style.display = 'flex';
  // close mobile menu if open
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-overlay').classList.remove('open');
  // If no camera API available, go straight to manual
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || location.protocol === 'file:') {
    switchScannerTab('manual');
  } else {
    switchScannerTab('cam');
  }
}

function closeScanner() {
  document.getElementById('modal-scanner').style.display = 'none';
  stopCamera();
  document.getElementById('manual-code').value = '';
  document.getElementById('manual-results').innerHTML = '';
}

// ── TAB SWITCHING ─────────────────────────────────────────────
function switchScannerTab(mode) {
  scannerMode = mode;
  document.querySelectorAll('.sc-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + mode).classList.add('active');
  document.getElementById('sc-cam').style.display = mode === 'cam' ? 'block' : 'none';
  document.getElementById('sc-manual').style.display = mode === 'manual' ? 'block' : 'none';

  if (mode === 'cam') {
    startCamera();
  } else {
    stopCamera();
    setTimeout(() => document.getElementById('manual-code').focus(), 100);
  }
}

// ── CAMERA ────────────────────────────────────────────────────
let availableCameras = [];
let selectedCameraId = null;

async function startCamera() {
  const video = document.getElementById('sc-video');
  const status = document.getElementById('sc-status');
  status.textContent = 'Iniciando cámara...';
  document.getElementById('btn-capture').style.display = 'block';
  document.getElementById('btn-again').style.display = 'none';
  document.getElementById('sc-result').style.display = 'none';

  // Check if camera API is available (requires HTTPS)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = '';
    showCameraUnavailable('La cámara requiere HTTPS. Usá el modo Manual o abrí la app desde un servidor (ej: Netlify).');
    return;
  }

  try {
    // First request permission
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach(t => t.stop());

    // Enumerate all video devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter(d => d.kind === 'videoinput');

    // Populate selector
    const sel = document.getElementById('cam-select');
    const wrap = document.getElementById('cam-select-wrap');
    sel.innerHTML = availableCameras.map((d, i) =>
      `<option value="${d.deviceId}">${d.label || 'Cámara ' + (i + 1)}</option>`
    ).join('');

    if (availableCameras.length > 1) {
      wrap.style.display = 'flex';
      const back = availableCameras.find(d =>
        /back|trasera|environment|rear/i.test(d.label)
      );
      selectedCameraId = back ? back.deviceId : availableCameras[0].deviceId;
      sel.value = selectedCameraId;
    } else {
      wrap.style.display = 'none';
      selectedCameraId = availableCameras[0]?.deviceId || null;
    }

    await openCameraById(selectedCameraId);
    // Claude Vision handles recognition — no local OCR needed
  } catch(e) {
    status.textContent = '';
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      showCameraUnavailable('Permiso de cámara denegado. Habilitalo en la configuración del navegador o usá el modo Manual.');
    } else if (e.name === 'NotFoundError') {
      showCameraUnavailable('No se encontró ninguna cámara en este dispositivo. Usá el modo Manual.');
    } else if (location.protocol === 'file:') {
      showCameraUnavailable('La cámara no funciona desde archivos locales (file://). Subí la app a internet (Netlify) para usar la cámara, o usá el modo Manual.');
    } else {
      showCameraUnavailable('No se pudo acceder a la cámara: ' + e.message);
    }
  }
}

function showCameraUnavailable(msg) {
  // Auto-switch to manual immediately — no blocking error screen
  switchScannerTab('manual');
  // Show a subtle toast explaining why
  toast('📷 ' + (location.protocol === 'file:' ? 'Cámara requiere HTTPS — usando modo Manual' : msg.substring(0, 60)));
}

async function openCameraById(deviceId) {
  const video = document.getElementById('sc-video');
  const status = document.getElementById('sc-status');
  if (scannerStream) { scannerStream.getTracks().forEach(t => t.stop()); }
  const constraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
  };
  scannerStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = scannerStream;
  status.textContent = '📷 Listo — capturá el código del dorso (OCR local)';
}

async function switchCamera(deviceId) {
  selectedCameraId = deviceId;
  const status = document.getElementById('sc-status');
  status.textContent = 'Cambiando cámara...';
  try {
    await openCameraById(deviceId);
  } catch(e) {
    status.textContent = '❌ Error al cambiar cámara: ' + e.message;
  }
}

function stopCamera() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
}

// Tesseract removed — using Claude Vision API instead

async function captureFrame() {
  const video = document.getElementById('sc-video');
  const canvas = document.getElementById('sc-canvas');
  const status = document.getElementById('sc-status');
  const resultDiv = document.getElementById('sc-result');

  if (!video.srcObject) { status.textContent = '❌ Cámara no disponible'; return; }

  document.getElementById('btn-capture').style.display = 'none';
  document.getElementById('btn-again').style.display = 'block';

  // Capture frame at full resolution
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  // Convert to base64 JPEG for Claude Vision
  const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

  status.textContent = '🤖 Analizando con IA...';
  resultDiv.style.display = 'none';

  try {
    status.textContent = '🤖 Analizando con IA...';
    const code = await recognizeWithClaude(base64);
    if (!code) throw new Error('no_code');

    status.textContent = `🔍 IA detectó: "${code}"`;
    const results = searchStickers(code);
    if (results.length > 0 && results[0].score >= 6) {
      showScanResult(results[0], resultDiv, status);
    } else {
      showOCRFallback(resultDiv, status, code);
      const fixInp = document.getElementById('ocr-fix-input');
      if (fixInp) {
        const numPart = code.replace(/^[A-Z]{2,3}\s*/, '');
        fixInp.value = numPart || code;
        if (fixInp.value) ocrFixSearch(fixInp.value);
      }
    }
  } catch(e) {
    // Show specific error to help debug
    const errMsg = e.message || 'Error desconocido';
    status.textContent = '⚠ Error: ' + errMsg;
    showOCRFallback(resultDiv, status, '');
    toast('Error IA: ' + errMsg.substring(0, 60));
  }
}

// ── LOCAL OCR — Tesseract.js sin servidor ni costo ───────────
let _tesseractWorker = null;
let _tesseractReady = false;
let _tesseractLoading = false;

async function initLocalOCR() {
  if (_tesseractReady) return true;
  if (_tesseractLoading) {
    // Wait for it
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
      if (_tesseractReady) return true;
    }
    return false;
  }
  _tesseractLoading = true;
  try {
    // Load Tesseract.js from CDN
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    _tesseractWorker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const st = document.getElementById('sc-status');
          if (st) st.textContent = '⏳ Leyendo... ' + Math.round(m.progress*100) + '%';
        }
      }
    });
    await _tesseractWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
      tessedit_pageseg_mode: '7',  // single text line — better for COL 15
      preserve_interword_spaces: '1',
    });
    _tesseractReady = true;
    _tesseractLoading = false;
    return true;
  } catch(e) {
    _tesseractLoading = false;
    throw new Error('No se pudo cargar OCR: ' + e.message);
  }
}

async function recognizeWithClaude(base64Image) {
  // Uses local Tesseract OCR — no server, no cost
  const status = document.getElementById('sc-status');
  if (status) status.textContent = '⏳ Cargando OCR...';

  const ready = await initLocalOCR();
  if (!ready) throw new Error('OCR no disponible');

  // Try multiple crops + filters for best result
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + base64Image;
  await new Promise(r => { img.onload = r; });

  const w = img.width, h = img.height;
  // Crop to the yellow frame area — the code pill is in the center of the frame
  const crops = [
    { x: w*0.25, y: h*0.30, cw: w*0.50, ch: h*0.38 }, // center frame
    { x: w*0.22, y: h*0.26, cw: w*0.56, ch: h*0.46 }, // wider frame
    { x: w*0.30, y: h*0.33, cw: w*0.40, ch: h*0.32 }, // tight center (just the pill)
    { x: w*0.15, y: h*0.20, cw: w*0.70, ch: h*0.55 }, // fallback wide
  ];
  // COL 15 style: white text on dark pill background — invert first
  const filters = [
    'grayscale(1) contrast(3) brightness(1.2) invert(1)', // inverted (white-on-dark → dark-on-white)
    'grayscale(1) contrast(4) brightness(1.0) invert(1)', // high contrast inverted
    'grayscale(1) contrast(3) brightness(1.3)',           // normal (for light backgrounds)
    'grayscale(1) contrast(2.5) brightness(0.8) invert(1)', // darker inverted
  ];

  let bestCode = null;
  let bestRaw = '';

  for (const crop of crops) {
    for (const filter of filters) {
      try {
        const c = document.createElement('canvas');
        c.width = Math.round(crop.cw * 3);
        c.height = Math.round(crop.ch * 3);
        const ctx = c.getContext('2d');
        ctx.filter = filter;
        ctx.drawImage(img, crop.x, crop.y, crop.cw, crop.ch, 0, 0, c.width, c.height);

        const { data: { text } } = await _tesseractWorker.recognize(c);
        const withSpaces = text.replace(/[^A-Za-z0-9 ]/g,'').trim().toUpperCase();
        const noSpaces = withSpaces.replace(/\s+/g,'');

        for (const raw of [withSpaces, noSpaces]) {
          if (!raw || raw.length < 2) continue;
          const results = searchStickers(raw);
          if (results.length > 0 && results[0].score >= 6) {
            return raw; // Found confident match
          }
          if (!bestRaw || raw.length > bestRaw.length) bestRaw = raw;
        }
      } catch(e) { continue; }
    }
  }
  // No confident match — return best raw text for manual correction
  return bestRaw || null;
}

function showOCRFallback(resultDiv, status, rawText) {
  // Extract number from OCR text — even if country is wrong, number is often right
  const numMatch = (rawText || '').match(/(\d+)/);
  const extractedNum = numMatch ? numMatch[1] : '';
  // Extract possible country prefix (2-3 uppercase letters)
  const prefixMatch = (rawText || '').match(/^([A-Z]{2,3})/);
  const extractedPrefix = prefixMatch ? prefixMatch[1] : '';

  resultDiv.className = 'sc-result error';
  resultDiv.innerHTML = `
    <div class="sc-result-title" style="margin-bottom:10px">
      🔍 ${rawText ? 'OCR leyó: <b>' + rawText + '</b>' : 'No se reconoció — corregí manualmente'}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">País (ej: COL)</div>
        <input type="text" id="ocr-country" maxlength="3" value="${extractedPrefix}"
          placeholder="COL"
          style="width:100%;padding:10px;border-radius:8px;border:2px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:18px;font-weight:800;font-family:monospace;text-align:center;text-transform:uppercase;outline:none"
          oninput="this.value=this.value.toUpperCase();ocrCombinedSearch()"
          onfocus="this.select()">
      </div>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Número</div>
        <input type="text" id="ocr-number" maxlength="2" value="${extractedNum}"
          placeholder="15"
          style="width:100%;padding:10px;border-radius:8px;border:2px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:18px;font-weight:800;font-family:monospace;text-align:center;outline:none"
          oninput="ocrCombinedSearch()"
          onfocus="this.select()">
      </div>
    </div>
    <div id="ocr-fix-results" style="max-height:220px;overflow-y:auto"></div>
    <input type="hidden" id="ocr-fix-input" value="${rawText || ''}">
  `;
  resultDiv.style.display = 'block';
  if (status) status.textContent = rawText
    ? 'OCR leyó "' + rawText + '" — corregí el país o número si está mal'
    : 'Ingresá el código manualmente';

  // Auto-search immediately with extracted data
  setTimeout(() => {
    ocrCombinedSearch();
    // Focus the country field if prefix wrong-looking, else number
    const prefixOk = extractedPrefix.length === 3;
    const el = document.getElementById(prefixOk ? 'ocr-number' : 'ocr-country');
    if (el) { el.focus(); el.select(); }
  }, 80);
}

function ocrCombinedSearch() {
  const country = (document.getElementById('ocr-country')?.value || '').trim().toUpperCase();
  const number = (document.getElementById('ocr-number')?.value || '').trim();
  const container = document.getElementById('ocr-fix-results');
  if (!container) return;

  let query = '';
  if (country && number) query = country + number;      // COL15
  else if (number) query = number;                       // just 15 — shows all teams
  else if (country) query = country;                     // just COL — shows all COL stickers

  if (!query) { container.innerHTML = ''; return; }

  const results = searchStickers(query);
  if (!results.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:6px">Sin resultados</div>';
    return;
  }

  container.innerHTML = results.slice(0, 10).map(s => {
    const c = cnt(s.key);
    const ownedBadge = c > 0 ? `<span style='font-size:11px;font-weight:700;color:var(--green-ok);margin-left:4px'>×${c}</span>` : '';
    return `<div onclick="confirmScan('${s.key}')" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;margin-bottom:4px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card);cursor:pointer;-webkit-tap-highlight-color:transparent"><div><div style='font-size:12px;font-weight:800;color:var(--blue)'>${s.code}${ownedBadge}</div><div style='font-size:14px;font-weight:600;color:var(--text)'>${s.name}</div><div style='font-size:11px;color:var(--text-3)'>${s.section}</div></div><span style='font-size:22px;color:var(--blue);margin-left:8px;flex-shrink:0'>+</span></div>`;
  }).join('');
}

function ocrFixSearch(query) {
  const container = document.getElementById('ocr-fix-results');
  if (!container || !query) return;
  const results = searchStickers(query);
  if (!results.length) { container.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:4px">Sin resultados</div>'; return; }
  container.innerHTML = results.slice(0,8).map(s => {
    const c = cnt(s.key);
    return '<div onclick="confirmScan(\'' + s.key + '\')" style="padding:8px 10px;margin-top:4px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card);cursor:pointer;display:flex;align-items:center;justify-content:space-between;-webkit-tap-highlight-color:transparent"><div><div style="font-size:11px;font-weight:700;color:var(--blue)">' + s.code + '</div><div style="font-size:13px;font-weight:600;color:var(--text)">' + s.name + '</div><div style="font-size:11px;color:var(--text-3)">' + s.section + '</div></div><span style="font-size:20px;color:var(--blue);margin-left:8px;flex-shrink:0">+</span></div>';
  }).join('');
}

// ── MANUAL MODE ───────────────────────────────────────────────
function manualSearch(query) {
  const container = document.getElementById('manual-results');
  if (!query || query.length < 1) { container.innerHTML = ''; return; }

  const results = searchStickers(query);
  if (!results.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px">Sin resultados para "' + query + '"</div>';
    return;
  }

  container.innerHTML = results.map(s => {
    const c = cnt(s.key);
    const ownedClass = c > 0 ? (c > 1 ? 'rep' : 'owned') : '';
    const ownedBadge = c > 0 ? `<span class="match-cnt ${ownedClass}">×${c}</span>` : '';
    return `<div class="manual-match ${c > 0 ? 'already-owned' : ''}" onclick="markManual('${s.key}')">
      <div class="match-info">
        <div class="match-code">${s.code}</div>
        <div class="match-name">${s.name}</div>
        <div class="match-section">${s.section}</div>
      </div>
      ${ownedBadge}
      <span style="font-size:18px;margin-left:8px;color:var(--blue)">+</span>
    </div>`;
  }).join('');
}

function markManual(stickerKey) {
  const item = buildStickerIndex().find(s => s.key === stickerKey);
  if (item) {
    markStickerFound(item);
    // Refresh results
    manualSearch(document.getElementById('manual-code').value);
    renderTab(activeTab);
  }
}

// ══════════════════════════════════════════════════════════════
//  PIN RECOVERY
// ══════════════════════════════════════════════════════════════
const SECURITY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿En qué ciudad naciste?',
  '¿Cuál es el nombre de tu mejor amigo de la infancia?',
  '¿Cuál es tu equipo de fútbol favorito?',
  '¿Cuál es el segundo nombre de tu mamá?',
];

function openPinRecovery() {
  const hasAnswer = localStorage.getItem('m26v2_security_answer');
  const body = document.getElementById('pin-recovery-body');
  document.getElementById('modal-pin-recovery').style.display = 'flex';

  if (!hasAnswer) {
    // No security question set — show reset option only
    body.innerHTML = `
      <div style="text-align:center;padding:1rem 0">
        <div style="font-size:40px;margin-bottom:12px">😕</div>
        <div style="font-size:14px;color:var(--text);margin-bottom:8px;font-weight:600">No configuraste una pregunta de seguridad</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:16px;line-height:1.5">Podés exportar tus datos primero y después resetear el PIN sin perder el progreso.</div>
        <button class="btn-primary full" onclick="exportAndReset()" style="background:var(--blue);margin-bottom:8px">📤 Exportar datos y cambiar PIN</button>
        <button class="btn-primary full" onclick="resetAllData()" style="background:var(--red);margin-bottom:8px">🗑 Resetear todo (se pierden los datos)</button>
        <button class="btn-primary full" onclick="closePinRecovery()" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border)">Cancelar</button>
      </div>`;
    return;
  }

  const q = localStorage.getItem('m26v2_security_question') || '';
  body.innerHTML = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:14px">Respondé tu pregunta de seguridad para recuperar el PIN.</div>
    <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:10px">${q}</div>
    <div class="form-group">
      <input type="text" id="recovery-answer" placeholder="Tu respuesta..." autocomplete="off"
        style="width:100%;padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:14px;outline:none">
    </div>
    <div id="recovery-error" style="color:var(--red);font-size:13px;margin-bottom:8px;display:none">Respuesta incorrecta</div>
    <button class="btn-primary full" onclick="verifySecurityAnswer()">Verificar</button>
    <div id="recovery-export-opt" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:12px;color:var(--text-3);margin-bottom:8px">¿No recordás la respuesta? Exportá tus datos primero:</div>
      <button class="btn-primary full" onclick="exportAndReset()" style="background:var(--blue);margin-bottom:6px">📤 Exportar datos y cambiar PIN</button>
    </div>
    <button class="btn-primary full" onclick="closePinRecovery()" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border);margin-top:8px">Cancelar</button>
  `;
  setTimeout(() => document.getElementById('recovery-answer')?.focus(), 100);
}

function verifySecurityAnswer() {
  const input = document.getElementById('recovery-answer').value.trim().toLowerCase();
  const stored = (localStorage.getItem('m26v2_security_answer') || '').toLowerCase();
  if (input === stored) {
    // Show current PIN (we store it plain for simplicity)
    const pin = localStorage.getItem('m26v2_pin') || '';
    document.getElementById('pin-recovery-body').innerHTML = `
      <div style="text-align:center;padding:1rem 0">
        <div style="font-size:40px;margin-bottom:12px">✅</div>
        <div style="font-size:14px;color:var(--text-2);margin-bottom:8px">Tu PIN es:</div>
        <div style="font-size:48px;font-weight:800;letter-spacing:16px;color:var(--blue);margin-bottom:20px">${pin}</div>
        <button class="btn-primary full" onclick="closePinRecovery()">Entendido</button>
      </div>`;
  } else {
    document.getElementById('recovery-error').style.display = 'block';
    document.getElementById('recovery-answer').style.borderColor = 'var(--red)';
    // Show export option after wrong answer
    const exportOpt = document.getElementById('recovery-export-opt');
    if (exportOpt) exportOpt.style.display = 'block';
  }
}

function closePinRecovery() {
  document.getElementById('modal-pin-recovery').style.display = 'none';
}

function exportAndReset() {
  // Generate export code (same as the app's export system) and show it
  // so user can copy it before resetting PIN
  const raw = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) raw[key] = localStorage.getItem(key);
  }
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(raw)))).substring(0, 500);
  const fullCode = btoa(unescape(encodeURIComponent(JSON.stringify(raw))));

  const body = document.getElementById('pin-recovery-body');
  body.innerHTML = `
    <div style="padding:0.5rem 0">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:10px;line-height:1.5">
        📋 <b>Copiá este código</b> antes de resetear. Luego podés usarlo en "Importar datos" para recuperar todo tu progreso.
      </div>
      <textarea readonly onclick="this.select()"
        style="width:100%;height:90px;padding:8px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:10px;font-family:monospace;resize:none;outline:none"
      >${fullCode}</textarea>
      <button class="btn-primary full" onclick="
        navigator.clipboard?.writeText('${fullCode.replace(/'/g,"\'")}').then(()=>toast('Código copiado ✓')).catch(()=>toast('Seleccioná y copiá manualmente'));
      " style="margin-top:8px;background:var(--blue);margin-bottom:12px">
        📋 Copiar código al portapapeles
      </button>
      <div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Una vez copiado, podés resetear el PIN sin perder tus figuritas:</div>
      <button class="btn-primary full" onclick="resetPinOnly()" style="background:var(--green-ok);margin-bottom:6px">
        🔑 Listo, resetear solo el PIN
      </button>
      <button class="btn-primary full" onclick="closePinRecovery()" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border)">
        Cancelar
      </button>
    </div>
  `;
}

function resetPinOnly() {
  // Remove only PIN and security question, keep all sticker data
  localStorage.removeItem('m26v2_pin');
  localStorage.removeItem('m26v2_security_question');
  localStorage.removeItem('m26v2_security_answer');
  closePinRecovery();
  location.reload();
}

function resetAllData() {
  localStorage.clear();
  location.reload();
}

// Setup security question (called after first PIN creation)
function setupSecurityQuestion() {
  const body = document.getElementById('pin-recovery-body');
  document.getElementById('modal-pin-recovery').style.display = 'flex';
  body.innerHTML = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.5">
      Configurá una pregunta de seguridad para poder recuperar tu PIN si lo olvidás.
    </div>
    <div class="form-group">
      <label>Pregunta de seguridad</label>
      <select id="security-q" style="width:100%;padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:13px;outline:none">
        ${SECURITY_QUESTIONS.map((q,i) => `<option value="${i}">${q}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Tu respuesta</label>
      <input type="text" id="security-a" placeholder="Respuesta..." autocomplete="off"
        style="width:100%;padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:14px;outline:none">
    </div>
    <button class="btn-primary full" onclick="saveSecurityQuestion()">Guardar</button>
    <button class="btn-primary full" onclick="closePinRecovery()" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border);margin-top:8px">Ahora no</button>
  `;
}

function saveSecurityQuestion() {
  const qIdx = document.getElementById('security-q').value;
  const answer = document.getElementById('security-a').value.trim();
  if (!answer) { toast('Escribí una respuesta'); return; }
  localStorage.setItem('m26v2_security_question', SECURITY_QUESTIONS[qIdx]);
  localStorage.setItem('m26v2_security_answer', answer.toLowerCase());
  closePinRecovery();
  toast('Pregunta de seguridad guardada ✓');
}

// ══════════════════════════════════════════════════════════════
//  CANJE QR ENTRE AMIGOS
// ══════════════════════════════════════════════════════════════
let qrScanStream = null;
let qrScanInterval = null;
let friendData = null;  // parsed data from scanned QR

function openCanjeQR() {
  document.getElementById('modal-canje-qr').style.display = 'flex';
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-overlay').classList.remove('open');
  switchQRTab('show');
}

async function processQRCodeDirect(code) {
  const result = document.getElementById('qr-result');
  // Try M26 compact format first
  if (code.startsWith('M26|')) {
    const parsed = decodeQRData(code);
    if (parsed) { friendData = parsed; showCanjeProposal(parsed); return; }
  }
  // Try server lookup for 6-char codes (optional, won't work without Netlify)
  if (result) result.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-3);font-size:13px">Buscando...</div>';
  try {
    const res = await fetch('/.netlify/functions/canje/' + code);
    if (!res.ok) throw new Error('not found');
    const parsed = await res.json();
    if (parsed?.v === 1) { friendData = parsed; showCanjeProposal(parsed); return; }
  } catch(e) {}
  if (result) result.innerHTML = '<div style="color:var(--red);font-size:13px;padding:8px;text-align:center">❌ Código no válido</div>';
}

async function processQRCode() {
  const input = (document.getElementById('qr-code-input')?.value || '').trim();
  if (!input) { toast('Ingresá el código'); return; }
  // Handle M26 format pasted directly
  if (input.startsWith('M26|')) {
    const parsed = decodeQRData(input);
    if (parsed) { friendData = parsed; showCanjeProposal(parsed); return; }
    toast('Código M26 inválido'); return;
  }
  if (input.length !== 6) { toast('Ingresá los 6 caracteres del código'); return; }
  
  const result = document.getElementById('qr-result');
  if (result) result.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-3);font-size:13px">Buscando...</div>';

  try {
    const res = await fetch('/.netlify/functions/canje/' + input);
    if (res.status === 404) {
      if (result) result.innerHTML = '<div style="color:var(--red);font-size:13px;padding:8px;text-align:center">❌ Código no encontrado o expirado.<br><span style="color:var(--text-3)">Pedile a tu amigo que genere uno nuevo.</span></div>';
      return;
    }
    if (!res.ok) throw new Error('Error ' + res.status);
    const parsed = await res.json();
    if (parsed?.v === 1 && parsed?.r && parsed?.m) {
      friendData = parsed;
      showCanjeProposal(parsed);
    } else {
      toast('Datos inválidos');
    }
  } catch(e) {
    if (result) result.innerHTML = '<div style="color:var(--red);font-size:13px;padding:8px;text-align:center">❌ Sin conexión a internet</div>';
  }
}

function closeCanjeQR() {
  stopQRScan();
  document.getElementById('modal-canje-qr').style.display = 'none';
  friendData = null;
}

function switchQRTab(tab) {
  document.getElementById('qr-tab-show').classList.toggle('active', tab === 'show');
  document.getElementById('qr-tab-scan').classList.toggle('active', tab === 'scan');
  if (tab === 'show') { stopQRScan(); renderMyQR(); }
  else { stopQRScan(); renderQRScanner(); }
}

// ── MY QR ─────────────────────────────────────────────────────
function getMyQRData() {
  const repeated = [], missing = [];
  buildStickerIndex().forEach(s => {
    const c = cnt(s.key);
    if (c > 1) repeated.push(s.code);
    if (c === 0) missing.push(s.code);
  });
  return { v:1, r: repeated, m: missing };
}

// Encode data as compact string for QR — no server needed
// Format: "M26|r:ARG15,COL7|m:BRA3,ESP9" (only first 30 of each)
function encodeQRData(data) {
  const r = data.r.slice(0, 40).join(',');
  const m = data.m.slice(0, 40).join(',');
  return 'M26|r:' + r + '|m:' + m;
}

// Decode compact QR string back to data object
function decodeQRData(str) {
  if (!str.startsWith('M26|')) return null;
  const parts = str.split('|');
  const r = parts.find(p => p.startsWith('r:'))?.substring(2).split(',').filter(Boolean) || [];
  const m = parts.find(p => p.startsWith('m:'))?.substring(2).split(',').filter(Boolean) || [];
  return { v:1, r, m };
}

async function renderMyQR() {
  const body = document.getElementById('canje-qr-body');
  const data = getMyQRData();

  body.innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:12px;line-height:1.5">
        Mostrále este QR a tu amigo. Tiene tus <b>${data.r.length}</b> repetidas y <b>${data.m.length}</b> faltantes.
      </div>
      <div id="qr-wrap" style="display:inline-block;background:#fff;padding:14px;border-radius:12px;margin-bottom:12px;min-width:220px;min-height:220px">
        <canvas id="qr-canvas" width="220" height="220"></canvas>
      </div>
      <div style="font-size:12px;color:var(--text-3);margin-bottom:14px" id="qr-timer-text">Generando QR...</div>
      <div id="code-fallback" style="display:none">
        <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">¿No puede escanear el QR? Mostrále este código:</div>
        <div id="short-code-display" style="font-size:42px;font-weight:900;letter-spacing:10px;color:var(--blue);font-family:monospace;background:var(--bg-card2);padding:12px 20px;border-radius:10px;display:inline-block"></div>
      </div>
      <button class="btn-primary full" onclick="toggleCodeFallback()" style="display:none" id="btn-show-code"></button>
    </div>
  `;

  // Wait for DOM to render, then draw QR
  setTimeout(() => {
    const timerEl = document.getElementById('qr-timer-text');
    const canvas = document.getElementById('qr-canvas');
    
    if (data.r.length === 0) {
      if (canvas) canvas.style.display = 'none';
      const wrap = document.getElementById('qr-wrap');
      if (wrap) wrap.innerHTML = '<div style="padding:30px 20px;color:var(--text-2);font-size:13px;text-align:center">🙂 Todavía no tenés figuritas repetidas para canjear</div>';
      if (timerEl) timerEl.textContent = '';
      return;
    }

    // Encode compact: "WC26:r=ARG15,COL7,BRA3"
    // Max 40 repeated stickers in QR to keep it scannable
    const repeated = data.r.slice(0, 40).join(',');
    const qrText = 'WC26:r=' + repeated;
    
    if (timerEl) timerEl.textContent = `QR con tus ${data.r.length} repetidas · mostralo a tu amigo`;
    drawQROnCanvas('qr-canvas', qrText);
  }, 100);
}

function toggleCodeFallback() {
  const el = document.getElementById('code-fallback');
  const btn = document.getElementById('btn-show-code');
  if (!el) return;
  const showing = el.style.display !== 'none';
  el.style.display = showing ? 'none' : 'block';
  if (btn) btn.textContent = showing ? '⌨️ Mostrar código de 6 caracteres' : '🙈 Ocultar código';
}

function drawQROnCanvas(canvasId, text) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  // Library is embedded — always available
  if (window.qrcode) {
    _drawQRWithLib(canvas, text);
  } else {
    _drawQRManual(canvas, text);
  }
}

// Manual QR using canvas — draws a simple matrix-style code
// Not a real QR but scannable by the app's own scanner using the 6-char code
function _drawQRManual(canvas, text) {
  // Show the short code prominently as the "QR" with large text
  // Real QR needs a proper library; without it show the code clearly
  const size = 220;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  
  // Border
  ctx.strokeStyle = '#0A0F2C';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, size-20, size-20);
  
  // FIFA 2026 color bars at top
  const colors = ['#E8102A','#1B4FD8','#FFE600'];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(10, 10 + i*8, size-20, 8);
  });
  
  // "Mostrar al amigo" label
  ctx.fillStyle = '#0A0F2C';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Código de canje:', size/2, 75);
  
  // Big code text
  ctx.font = 'bold 42px monospace';
  ctx.fillStyle = '#1B4FD8';
  ctx.fillText(text.length <= 6 ? text : text.substring(0,6), size/2, 130);
  
  // Instruction
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText('Tu amigo ingresa este código', size/2, 160);
  ctx.fillText('en "Escanear → Ingresar código"', size/2, 175);
  
  // QR placeholder corners
  const drawCorner = (x, y) => {
    ctx.fillStyle = '#0A0F2C';
    ctx.fillRect(x, y, 20, 20);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x+3, y+3, 14, 14);
    ctx.fillStyle = '#0A0F2C';
    ctx.fillRect(x+6, y+6, 8, 8);
  };
  drawCorner(15, 185); drawCorner(size-35, 185);
}

function _drawQRWithLib(canvas, text) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const size = 220;
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const mod = qr.getModuleCount();
    const cell = size / mod;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#0A0F2C';
    for (let r = 0; r < mod; r++) {
      for (let c2 = 0; c2 < mod; c2++) {
        if (qr.isDark(r, c2)) {
          ctx.fillRect(Math.floor(c2*cell), Math.floor(r*cell),
            Math.ceil(cell + 0.5), Math.ceil(cell + 0.5));
        }
      }
    }
  } catch(e) {
    _showQRTextFallback(canvas, text);
  }
}

function _showQRTextFallback(canvas, text) {
  // Hide canvas, show code prominently
  canvas.style.display = 'none';
  const parent = canvas.parentElement;
  const existing = parent.querySelector('.qr-text-fallback');
  if (existing) return;
  const div = document.createElement('div');
  div.className = 'qr-text-fallback';
  div.innerHTML = `
    <div style="font-size:12px;color:var(--text-3);margin-bottom:8px">QR no disponible — usá el código:</div>
    <div style="font-size:13px;font-family:monospace;word-break:break-all;background:var(--bg-card2);padding:10px;border-radius:8px;color:var(--text);max-height:80px;overflow:auto">${text.substring(0,200)}</div>
  `;
  parent.appendChild(div);
}

async function generateCanjeCode(data) {
  // No server needed — encode data directly in QR
  // Format: "r:CODE1,CODE2|m:" — only repeated codes, faltantes omitted (too long)
  // The scanner will fetch faltantes from the other device's album
  return null; // Signal to use direct QR encoding
}

async function generateCanjeCode() {
  const btn = document.getElementById('btn-gen-code');
  const display = document.getElementById('qr-code-display');
  if (btn) btn.disabled = true;
  if (display) display.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:10px">Generando...</div>';

  try {
    const data = getMyQRData();
    const res = await fetch('/.netlify/functions/canje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error ' + res.status);
    const { code } = await res.json();

    if (display) display.innerHTML = `
      <div style="background:var(--navy);border-radius:16px;padding:24px 20px;display:inline-block;min-width:200px">
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Tu código</div>
        <div style="font-size:52px;font-weight:900;letter-spacing:10px;color:#fff;font-family:monospace">${code}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px">Válido por 15 minutos</div>
      </div>
      <div style="margin-top:16px">
        <button class="btn-primary full" onclick="navigator.clipboard?.writeText('${code}').then(()=>toast('Código copiado ✓'))" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border)">
          📋 Copiar código
        </button>
        <button class="btn-primary full" onclick="renderMyQR()" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border);margin-top:6px">
          🔄 Generar nuevo código
        </button>
      </div>
    `;
  } catch(e) {
    if (display) display.innerHTML = `
      <div style="color:var(--red);font-size:13px;padding:10px;margin-bottom:10px">
        ❌ Necesitás conexión a internet para generar el código.<br>
        <span style="color:var(--text-3)">Asegurate de estar conectado y que la app esté subida a Netlify.</span>
      </div>
      <button class="btn-primary full" onclick="generateCanjeCode()">Reintentar</button>
    `;
  }
}

// ── Minimal QR Code generator (no dependencies) ───────────────

function drawQR(text) { /* unused */ }
function showQRFallback(canvas, text) {
  // Can't generate QR — show a short share code instead
  const parsed = JSON.parse(text);
  // Compress: encode as base64 short string
  const short = btoa(unescape(encodeURIComponent(text))).substring(0, 100);
  const parent = canvas.parentElement;
  canvas.style.display = 'none';
  const div = document.createElement('div');
  div.innerHTML = `
    <div style="background:var(--bg-card2);border:2px dashed var(--border);border-radius:12px;padding:16px;margin-bottom:10px">
      <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">QR no disponible — compartí este código:</div>
      <div style="font-size:11px;font-family:monospace;word-break:break-all;color:var(--text);background:var(--bg-card);padding:8px;border-radius:6px;user-select:all">${btoa(unescape(encodeURIComponent(text)))}</div>
      <button class="btn-primary full" onclick="navigator.clipboard.writeText('${btoa(unescape(encodeURIComponent(text)))}').then(()=>toast('Código copiado ✓'))" style="margin-top:10px;font-size:13px">📋 Copiar código</button>
    </div>
  `;
  parent.insertBefore(div, canvas);
}

// ── QR SCANNER ────────────────────────────────────────────────
function renderQRScanner() {
  const body = document.getElementById('canje-qr-body');
  body.innerHTML = `
    <div style="padding:1rem">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:10px">Apuntá la cámara al QR de tu amigo:</div>
      <div style="position:relative;width:100%;max-width:300px;margin:0 auto;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:1/1">
        <video id="qr-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <div style="width:70%;height:70%;border:3px solid var(--yellow);border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.5)"></div>
        </div>
      </div>
      <div id="qr-scan-status" style="font-size:12px;color:var(--text-3);text-align:center;padding:8px 0">Iniciando cámara...</div>
      <div id="qr-result"></div>
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
        <div style="font-size:12px;color:var(--text-3);margin-bottom:6px">¿No funciona la cámara? Ingresá el código de 6 caracteres:</div>
        <div style="display:flex;gap:8px">
          <input type="text" id="qr-code-input" maxlength="6" placeholder="ABC123"
            autocomplete="off" autocorrect="off" spellcheck="false"
            oninput="this.value=this.value.toUpperCase()"
            style="flex:1;padding:10px 12px;border-radius:8px;border:2px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:22px;font-weight:900;font-family:monospace;letter-spacing:6px;text-align:center;outline:none;text-transform:uppercase">
          <button class="btn-primary" onclick="processQRCode()" style="padding:10px 16px;font-weight:700">OK</button>
        </div>
      </div>
    </div>
  `;
  startQRScan();
}


async function startQRScan() {
  const video = document.getElementById('qr-video');
  const status = document.getElementById('qr-scan-status');
  if (!navigator.mediaDevices?.getUserMedia) {
    if (status) status.textContent = '📷 Cámara no disponible — usá el código';
    return;
  }
  try {
    qrScanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width:{ideal:640}, height:{ideal:640} }
    });
    video.srcObject = qrScanStream;
    if (status) status.textContent = '📷 Apuntá al QR de tu amigo';
    // jsQR is embedded — start scanning immediately
    video.addEventListener('loadedmetadata', () => {
      if (status) status.textContent = '📷 Listo — apuntá al QR';
    });
    qrScanInterval = setInterval(() => scanQRFrame(video, status), 250);
  } catch(e) {
    if (status) status.textContent = '📷 ' + (e.name === 'NotAllowedError' ? 'Permiso denegado — usá el código' : 'Cámara no disponible');
  }
}

function stopQRScan() {
  if (qrScanInterval) { clearInterval(qrScanInterval); qrScanInterval = null; }
  if (qrScanStream) { qrScanStream.getTracks().forEach(t=>t.stop()); qrScanStream = null; }
}

function scanQRFrame(video, status) {
  if (!video.readyState || video.readyState < 2) return;
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  const imageData = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  if (!window.jsQR) return;
  const qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
  if (qr && qr.data) {
    try {
      const parsed = JSON.parse(qr.data);
      if (parsed.v === 1 && parsed.r && parsed.m) {
        stopQRScan();
        status.textContent = '✓ QR leído correctamente';
        friendData = parsed;
        showCanjeProposal(parsed);
      }
    } catch(e) {}
  }
}

// ── CANJE PROPOSAL ────────────────────────────────────────────
function showCanjeProposal(friend) {
  const myIdx = buildStickerIndex();
  const myRepeated = myIdx.filter(s => cnt(s.key) > 1);
  const myMissing  = myIdx.filter(s => cnt(s.key) === 0);

  // What friend can give me (their repeated that I need)
  const friendCanGive = myMissing.filter(s => friend.r.includes(s.code));
  // What I can give friend (my repeated — friend's faltantes unknown, show all my repeated)
  const iCanGive = friend.m && friend.m.length > 0
    ? myRepeated.filter(s => friend.m.includes(s.code))
    : myRepeated.slice(0, 20); // show up to 20 if no faltantes info

  const result = document.getElementById('qr-result');
  if (!result) return;

  if (iCanGive.length === 0 && friendCanGive.length === 0) {
    result.innerHTML = `
      <div style="text-align:center;padding:1.5rem;color:var(--text-2)">
        <div style="font-size:36px;margin-bottom:8px">😕</div>
        <div style="font-size:14px;font-weight:600">No hay canjes posibles</div>
        <div style="font-size:13px;margin-top:4px">No tienen figuritas que se necesiten mutuamente.</div>
      </div>`;
    return;
  }

  result.innerHTML = `
    <div style="margin-top:12px">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">🎯 Canjes posibles (${Math.min(iCanGive.length, friendCanGive.length)} pares)</div>

      ${iCanGive.length > 0 ? `
      <div style="font-size:12px;font-weight:700;color:var(--green-ok);margin-bottom:4px">✅ Yo le puedo dar (${iCanGive.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
        ${iCanGive.map(s=>`<span style="background:var(--green-ok-bg);color:var(--green-ok);font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">${s.code} ${s.name}</span>`).join('')}
      </div>` : ''}

      ${friendCanGive.length > 0 ? `
      <div style="font-size:12px;font-weight:700;color:var(--blue);margin-bottom:4px">✅ Él/ella me puede dar (${friendCanGive.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px">
        ${friendCanGive.map(s=>`<span style="background:var(--green-ok-bg);color:var(--blue);font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">${s.code} ${s.name}</span>`).join('')}
      </div>` : ''}

      <div style="font-size:13px;color:var(--text-2);margin-bottom:12px;padding:10px;background:var(--bg-card2);border-radius:8px;line-height:1.5">
        ⚠️ Mostrá esta pantalla a tu amigo para que confirme el canje de su lado también. Ambos tienen que aceptar.
      </div>

      <button class="btn-primary full" onclick="confirmCanjeQR()" style="background:var(--green-ok)">
        ✅ Confirmar y registrar este canje
      </button>
      <button class="btn-primary full" onclick="closeCanjeQR()" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border);margin-top:8px">
        Cancelar
      </button>
    </div>
  `;
}

function confirmCanjeQR() {
  if (!friendData) return;
  const myIdx = buildStickerIndex();
  const myRepeated = myIdx.filter(s => cnt(s.key) > 1);
  const myMissing  = myIdx.filter(s => cnt(s.key) === 0);
  const iGive = myRepeated.filter(s => friendData.m.includes(s.code));
  const iGet  = myMissing.filter(s => friendData.r.includes(s.code));

  // Apply to stock
  iGive.forEach(s => { stickers[s.key] = Math.max(0, cnt(s.key) - 1); });
  iGet.forEach(s => { stickers[s.key] = cnt(s.key) + 1; });
  save();

  // Register as movement
  pushMov({
    tipo: 'canje',
    give: iGive.map(s=>({key:s.key, name:s.name})),
    get:  iGet.map(s=>({key:s.key, name:s.name})),
    nota: 'Canje vía QR'
  });

  closeCanjeQR();
  toast(`Canje registrado ✓ · Diste ${iGive.length} · Recibiste ${iGet.length}`);
  renderTab(activeTab);
}

// ── CONFIRM MODAL ────────────────────────────────────────────
let _confirmCallback = null;

function showConfirm(icon, title, body, okLabel, callback) {
  document.getElementById('confirm-icon').textContent = icon;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  document.getElementById('confirm-ok-btn').textContent = okLabel || 'Eliminar';
  _confirmCallback = callback;
  document.getElementById('modal-confirm').style.display = 'flex';
}
function doConfirm() {
  document.getElementById('modal-confirm').style.display = 'none';
  if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
}
function cancelConfirm() {
  document.getElementById('modal-confirm').style.display = 'none';
  _confirmCallback = null;
}

function resetCapture() {
  document.getElementById('sc-result').style.display = 'none';
  document.getElementById('btn-capture').style.display = 'block';
  document.getElementById('btn-again').style.display = 'none';
  document.getElementById('sc-status').textContent = '📷 Listo — capturá el código del dorso';
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wire numpad
  document.querySelectorAll('.num-btn[data-n]').forEach(btn => {
    btn.addEventListener('click', () => pinDigit(btn.dataset.n));
  });
  document.getElementById('btn-del').addEventListener('click', pinDel);
  initLogin();
});
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
