// v7-quicksearch-clean
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

// ── BUSCADOR RÁPIDO ──────────────────────────────────────────
function openScanner() {
  document.getElementById('modal-scanner').style.display = 'flex';
  setTimeout(() => {
    const inp = document.getElementById('quick-search-input');
    const res = document.getElementById('quick-results');
    if (inp) inp.value = '';
    if (res) res.innerHTML = renderQuickGrid();
    if (inp) inp.focus();
  }, 50);
}
function closeScanner() { document.getElementById('modal-scanner').style.display = 'none'; }
function renderQuickGrid() {
  const missing = [];
  ALBUM_DATA.teams.forEach(team => { team.players.forEach(p => { const key = team.flag + p.num; if (!cnt(key)) missing.push({ key, code: key, name: p.name, section: team.name }); }); });
  if (!missing.length) return '<div style="padding:20px;text-align:center;color:var(--text-3)">¡Álbum completo! 🏆</div>';
  return '<div style="padding:6px 4px 4px;font-size:11px;color:var(--text-3);font-weight:600">TUS PRÓXIMAS FALTANTES</div>' + missing.slice(0,40).map(s=>quickResultRow(s)).join('');
}
function quickSearch(q) {
  const container = document.getElementById('quick-results');
  if (!container) return;
  const query = (q||'').trim();
  if (!query) { container.innerHTML = renderQuickGrid(); return; }
  const qLow = query.toLowerCase(), qUp = query.toUpperCase().replace(/\s+/g,'');
  const results = [];
  ALBUM_DATA.teams.forEach(team => { team.players.forEach(p => { const code = team.flag+p.num; if (p.name.toLowerCase().includes(qLow)||code.includes(qUp)||team.name.toLowerCase().includes(qLow)) results.push({key:code,code,name:p.name,section:team.name}); }); });
  [...(ALBUM_DATA.intro?.items||[]),...(ALBUM_DATA.especiales?.items||[]),...(ALBUM_DATA.cocacola?.items||[])].forEach(s=>{ if(s.code.includes(qUp)||s.name.toLowerCase().includes(qLow)) results.push({key:s.code,code:s.code,name:s.name,section:'Especiales'}); });
  container.innerHTML = results.length ? results.slice(0,50).map(s=>quickResultRow(s)).join('') : `<div style="padding:20px;text-align:center;color:var(--text-3)">Sin resultados para "${query}"</div>`;
}
function quickResultRow(s) {
  const c = cnt(s.key), sk = s.key.replace(/[^a-z0-9]/gi,'-');
  const badge = c>0 ? `<span style="background:var(--blue);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px">×${c}</span>` : '';
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px;border-bottom:1px solid var(--border);gap:8px"><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:800;color:var(--blue)">${s.code} ${badge}</div><div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div><div style="font-size:11px;color:var(--text-3)">${s.section}</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><button onclick="quickAdd('${s.key}',-1)" style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:16px;cursor:pointer">−</button><span id="qty-${sk}" style="font-size:15px;font-weight:700;min-width:20px;text-align:center;color:${c>0?'var(--blue)':'var(--text-3)'}">${c}</span><button onclick="quickAdd('${s.key}',1)" style="width:30px;height:30px;border-radius:50%;border:none;background:var(--blue);color:#fff;font-size:16px;cursor:pointer">+</button></div></div>`;
}
function quickAdd(key, delta) {
  stickers[key] = Math.max(0, cnt(key)+delta); save();
  const el = document.getElementById('qty-'+key.replace(/[^a-z0-9]/gi,'-'));
  if (el) { el.textContent = stickers[key]; el.style.color = stickers[key]>0?'var(--blue)':'var(--text-3)'; }
  if (activeTab==='home') renderTab('home');
}
function showScanResult(s,r,st){ if(r){r.style.display='block';} }




let qrScanStream = null;
let qrScanInterval = null;
let friendData = null;      // data scanned from friend's QR
let dealGive = [];          // stickers I will give
let dealGet = [];           // stickers I will receive

// ── QR DATA ENCODING ─────────────────────────────────────────
function encodeQRData(data) {
  // Keep only repeated (what matters for trading), limit to 30 for QR size
  const r = (data.r || []).slice(0, 30).join(',');
  // Don't include missing in QR — too many, derive from repeated instead
  return 'M26|r:' + r;
}
function getMyQRDataFull() {
  // Full data including missing — used for deal proposal matching
  return getMyQRData();
}
function encodeDeal(give, get) {
  return 'M26D|g:' + give.join(',') + '|r:' + get.join(',');
}
function decodeQRData(str) {
  if (!str) return null;
  if (str.startsWith('M26D|')) {
    // Deal proposal QR
    const parts = str.split('|');
    const g = (parts.find(p=>p.startsWith('g:'))||'g:').substring(2).split(',').filter(Boolean);
    const r = (parts.find(p=>p.startsWith('r:'))||'r:').substring(2).split(',').filter(Boolean);
    return { v:1, isDeal:true, give:g, get:r };
  }
  if (str.startsWith('M26|')) {
    const parts = str.split('|');
    const r = (parts.find(p=>p.startsWith('r:'))||'r:').substring(2).split(',').filter(Boolean);
    const m = (parts.find(p=>p.startsWith('m:'))||'m:').substring(2).split(',').filter(Boolean);
    return { v:1, r, m };
  }
  if (str.startsWith('M26r:')) {
    // Compact format without M26| prefix
    const r = str.substring(5).split(',').filter(Boolean);
    return { v:1, r, m:[] };
  }
  return null;
}

function getMyQRData() {
  const repeated = [], missing = [];
  buildStickerIndex().forEach(s => {
    const c = cnt(s.key);
    if (c > 1) repeated.push(s.code);
    if (c === 0) missing.push(s.code);
  });
  return { v:1, r: repeated, m: missing };
}
async function generateCanjeCode() { return null; }

// ── OPEN / CLOSE ──────────────────────────────────────────────
function openCanjeQR() {
  friendData = null; dealGive = []; dealGet = [];
  document.getElementById('modal-canje-qr').style.display = 'flex';
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-overlay').classList.remove('open');
  switchQRTab('show');
}
function closeCanjeQR() {
  stopQRScan();
  document.getElementById('modal-canje-qr').style.display = 'none';
  friendData = null; dealGive = []; dealGet = [];
}
function switchQRTab(tab) {
  ['show','scan','deal'].forEach(t => {
    const btn = document.getElementById('qr-tab-'+t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab !== 'scan') stopQRScan();
  const body = document.getElementById('canje-qr-body');
  if (tab === 'show') renderMyQR(body);
  else if (tab === 'scan') renderQRScanner(body);
  else if (tab === 'deal') renderDealProposal(body);
}

// ── TAB 1: MI QR ──────────────────────────────────────────────
function renderMyQR(body) {
  const data = getMyQRData();
  body.innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:12px;line-height:1.5">
        Mostrále este QR a tu amigo para que lo escanee.<br>
        Tiene tus <b>${data.r.length}</b> repetidas y <b>${data.m.length}</b> faltantes.
      </div>
      <div id="qr-wrap" style="display:inline-block;background:#fff;padding:14px;border-radius:12px;margin-bottom:12px;min-width:220px;min-height:220px">
        <canvas id="qr-canvas" width="220" height="220"></canvas>
      </div>
      <div style="font-size:12px;color:var(--text-3)" id="qr-timer-text">Generando QR...</div>
    </div>`;
  setTimeout(() => {
    const data2 = getMyQRData();
    if (!data2.r.length && !data2.m.length) {
      document.getElementById('qr-wrap').innerHTML = '<div style="padding:20px;color:var(--text-3);font-size:13px">No hay datos para compartir todavía</div>';
      return;
    }
    drawQROnCanvas('qr-canvas', encodeQRData(data2));
    const t = document.getElementById('qr-timer-text');
    if (t) t.textContent = 'QR listo — mostráselo a tu amigo';
  }, 100);
}

// ── TAB 2: ESCANEAR ───────────────────────────────────────────
function renderQRScanner(body) {
  body.innerHTML = `
    <div style="padding:1rem">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:10px">Escaneá el QR de tu amigo:</div>
      <div style="position:relative;width:100%;max-width:300px;margin:0 auto;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:1/1">
        <video id="qr-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <div style="width:70%;height:70%;border:3px solid var(--yellow);border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.5)"></div>
        </div>
      </div>
      <div id="qr-scan-status" style="font-size:12px;color:var(--text-3);text-align:center;padding:8px 0">Iniciando cámara...</div>
      <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
        <div style="font-size:12px;color:var(--text-3);margin-bottom:6px">¿Sin cámara? Ingresá el código M26|... de tu amigo:</div>
        <div style="display:flex;gap:8px">
          <input type="text" id="qr-manual-input" placeholder="M26|r:ARG15,...|m:..."
            style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-card2);color:var(--text);font-size:12px;outline:none">
          <button class="btn-primary" onclick="processManualQR()" style="padding:8px 12px;font-size:12px">OK</button>
        </div>
      </div>
      <div id="qr-result"></div>
    </div>`;
  startQRScan();
}

async function startQRScan() {
  const video = document.getElementById('qr-video');
  const status = document.getElementById('qr-scan-status');
  if (!navigator.mediaDevices?.getUserMedia) {
    if (status) status.textContent = 'Cámara no disponible — usá el código manual';
    return;
  }
  try {
    qrScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
    video.srcObject = qrScanStream;
    if (status) status.textContent = '📷 Apuntá al QR';
    qrScanInterval = setInterval(() => scanQRFrame(video, status), 300);
  } catch(e) {
    if (status) status.textContent = 'Permiso denegado — usá el código manual';
  }
}

function stopQRScan() {
  if (qrScanInterval) { clearInterval(qrScanInterval); qrScanInterval = null; }
  if (qrScanStream) { qrScanStream.getTracks().forEach(t=>t.stop()); qrScanStream = null; }
}

function scanQRFrame(video, status) {
  if (!video || video.readyState < 2 || !video.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  const imageData = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let qr = null;
  try { qr = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts:'attemptBoth' }); } catch(e) { return; }
  if (!qr?.data) return;
  const parsed = decodeQRData(qr.data.trim());
  if (parsed) {
    stopQRScan();
    if (status) status.textContent = '✅ QR leído';
    handleScannedData(parsed);
  }
}

function processManualQR() {
  const val = (document.getElementById('qr-manual-input')?.value || '').trim();
  const parsed = decodeQRData(val);
  if (parsed) handleScannedData(parsed);
  else toast('Código inválido');
}

function handleScannedData(parsed) {
  if (parsed.isDeal) {
    // Friend scanned our deal proposal QR — show confirmation
    showDealConfirmation(parsed);
  } else {
    // Regular data QR — go to deal proposal tab
    friendData = parsed;
    dealGive = []; dealGet = [];
    const dealBtn = document.getElementById('qr-tab-deal');
    if (dealBtn) dealBtn.style.display = 'block';
    switchQRTab('deal');
  }
}

// ── TAB 3: PROPUESTA DE CANJE ─────────────────────────────────
function renderDealProposal(body) {
  if (!friendData) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-3)">Escaneá el QR de tu amigo primero</div>';
    return;
  }

  const myIdx = buildStickerIndex();
  // What I can give = my repeated that friend needs
  const iCanGive = myIdx.filter(s => cnt(s.key) > 1 && friendData.m.includes(s.code));
  // What friend can give = friend's repeated that I need
  const friendCanGive = myIdx.filter(s => cnt(s.key) === 0 && friendData.r.includes(s.code));

  body.innerHTML = `
    <div style="padding:1rem">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.5">
        Personalizá el canje. Seleccioná qué figuritas intercambian — sin límite de cantidad.
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px">
        📤 Yo le doy (mis repetidas que él necesita — ${iCanGive.length} disponibles):
      </div>
      <div id="deal-give-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:14px">
        ${iCanGive.length ? iCanGive.map(s => dealStickerRow('give', s)).join('') : 
          '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">No hay coincidencias — él no necesita ninguna de tus repetidas</div>'}
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--green-ok);margin-bottom:6px">
        📥 Él me da (sus repetidas que yo necesito — ${friendCanGive.length} disponibles):
      </div>
      <div id="deal-get-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:14px">
        ${friendCanGive.length ? friendCanGive.map(s => dealStickerRow('get', s)).join('') :
          '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">No hay coincidencias — él no tiene repetidas que te falten</div>'}
      </div>

      <div id="deal-summary" style="margin-bottom:12px"></div>

      <button class="btn-primary full" onclick="generateDealQR()" style="background:var(--blue);margin-bottom:8px">
        📤 Generar QR de propuesta
      </button>
      <button class="btn-primary full" onclick="confirmDealDirectly()" style="background:var(--green-ok)">
        ✅ Confirmar canje ahora (sin QR)
      </button>
    </div>`;

  updateDealSummary();
}

function dealStickerRow(side, s) {
  const sel = side === 'give' ? dealGive.includes(s.code) : dealGet.includes(s.code);
  const bg = sel ? (side==='give'?'rgba(232,16,42,0.15)':'rgba(0,200,100,0.15)') : 'transparent';
  return `<div id="deal-row-${side}-${s.code}" onclick="toggleDealSticker('${side}','${s.code}')"
    style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);background:${bg};-webkit-tap-highlight-color:transparent">
    <span style="font-size:18px">${sel?'☑':'☐'}</span>
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--blue)">${s.code}</div>
      <div style="font-size:13px;color:var(--text)">${s.name}</div>
    </div>
  </div>`;
}

function toggleDealSticker(side, code) {
  const list = side === 'give' ? dealGive : dealGet;
  const idx = list.indexOf(code);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(code);
  // Update row background
  const row = document.getElementById(`deal-row-${side}-${code}`);
  if (row) {
    const sel = idx < 0; // now selected
    row.style.background = sel ? (side==='give'?'rgba(232,16,42,0.15)':'rgba(0,200,100,0.15)') : 'transparent';
    row.querySelector('span').textContent = sel ? '☑' : '☐';
  }
  updateDealSummary();
}

function updateDealSummary() {
  const el = document.getElementById('deal-summary');
  if (!el) return;
  if (!dealGive.length && !dealGet.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div style="background:var(--bg-card2);border-radius:8px;padding:10px 12px;font-size:12px">
    <div style="color:var(--red);margin-bottom:4px">📤 Doy: <b>${dealGive.length ? dealGive.join(', ') : '—'}</b></div>
    <div style="color:var(--green-ok)">📥 Recibo: <b>${dealGet.length ? dealGet.join(', ') : '—'}</b></div>
  </div>`;
}

function generateDealQR() {
  if (!dealGive.length && !dealGet.length) { toast('Seleccioná al menos una figurita'); return; }
  const encoded = encodeDeal(dealGive, dealGet);
  const body = document.getElementById('canje-qr-body');
  body.innerHTML = `
    <div style="text-align:center;padding:1rem">
      <div style="font-size:13px;color:var(--text-2);margin-bottom:8px;line-height:1.5">
        Mostrále este QR a tu amigo para que acepte el canje.<br>
        <b>Doy:</b> ${dealGive.join(', ')||'—'} · <b>Recibo:</b> ${dealGet.join(', ')||'—'}
      </div>
      <div id="qr-wrap" style="display:inline-block;background:#fff;padding:14px;border-radius:12px;margin-bottom:12px">
        <canvas id="qr-canvas" width="220" height="220"></canvas>
      </div>
      <div style="font-size:12px;color:var(--text-3);margin-bottom:12px">Tu amigo escanea esto para aceptar</div>
      <button class="btn-primary full" onclick="switchQRTab('deal')" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border)">
        ← Modificar propuesta
      </button>
    </div>`;
  setTimeout(() => drawQROnCanvas('qr-canvas', encoded), 100);
}

function showDealConfirmation(deal) {
  // Called when friend scans our deal QR
  // deal.give = what the QR generator gives, deal.get = what they receive
  // From our perspective: we give deal.get, we receive deal.give
  const body = document.getElementById('canje-qr-body');
  body.innerHTML = `
    <div style="padding:1rem">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px">🤝 Propuesta de canje recibida</div>
      <div style="background:var(--bg-card2);border-radius:10px;padding:12px;margin-bottom:14px">
        <div style="font-size:12px;color:var(--green-ok);margin-bottom:6px;font-weight:700">
          📥 Vos recibís: <span style="color:var(--text)">${deal.give.join(', ')||'—'}</span>
        </div>
        <div style="font-size:12px;color:var(--red);font-weight:700">
          📤 Vos das: <span style="color:var(--text)">${deal.get.join(', ')||'—'}</span>
        </div>
      </div>
      <button class="btn-primary full" onclick="acceptDeal(${JSON.stringify(deal).replace(/"/g,'&quot;')})" style="background:var(--green-ok);margin-bottom:8px">
        ✅ Aceptar y confirmar canje
      </button>
      <button class="btn-primary full" onclick="switchQRTab('scan')" style="background:var(--bg-card2);color:var(--text);border:1.5px solid var(--border)">
        ✕ Rechazar
      </button>
    </div>`;
  stopQRScan();
}

function acceptDeal(deal) {
  // deal.give = what the proposer gives (I receive), deal.get = what proposer receives (I give)
  applyDeal(deal.get, deal.give, 'Canje vía QR (aceptado)');
}

function confirmDealDirectly() {
  if (!dealGive.length && !dealGet.length) { toast('Seleccioná figuritas primero'); return; }
  applyDeal(dealGive, dealGet, 'Canje vía QR');
}

function applyDeal(give, get, nota) {
  // Resolve codes to keys
  const myIdx = buildStickerIndex();
  const findKey = code => myIdx.find(s => s.code === code)?.key || code;

  const giveItems = give.map(code => ({ key: findKey(code), name: code }));
  const getItems  = get.map(code => ({ key: findKey(code), name: code }));

  // Update stock
  giveItems.forEach(s => { stickers[s.key] = Math.max(0, cnt(s.key) - 1); });
  getItems.forEach(s  => { stickers[s.key] = cnt(s.key) + 1; });
  save();

  // Register in costos
  pushMov({ tipo:'canje', give: giveItems, get: getItems, nota });

  closeCanjeQR();
  toast(`Canje registrado ✓ · Diste ${give.length} · Recibiste ${get.length}`);
  renderTab(activeTab);
}

// ── QR DRAWING ────────────────────────────────────────────────
function drawQROnCanvas(canvasId, text) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (window.qrcode) { _drawQRWithLib(canvas, text); return; }
  if (!window._qrLoading) {
    window._qrLoading = true;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    s.onload = () => { window._qrLoading=false; if(window.qrcode) _drawQRWithLib(canvas,text); else _drawQRManual(canvas,text); };
    s.onerror = () => { window._qrLoading=false; _drawQRManual(canvas,text); };
    document.head.appendChild(s);
  }
}
function _drawQRWithLib(canvas, text) {
  try {
    // Try auto version first, fall back to higher ECC levels if too much data
    let qr;
    for (const ecc of ['M','L']) {
      try {
        qr = qrcode(0, ecc);
        qr.addData(text);
        qr.make();
        break;
      } catch(e) { qr = null; }
    }
    if (!qr) { _drawQRManual(canvas, text); return; }
    const size=220, ctx=canvas.getContext('2d'), mod=qr.getModuleCount(), cell=size/mod;
    canvas.width=size; canvas.height=size;
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,size,size);
    ctx.fillStyle='#0A0F2C';
    for(let r=0;r<mod;r++) for(let c=0;c<mod;c++) if(qr.isDark(r,c)) ctx.fillRect(Math.floor(c*cell),Math.floor(r*cell),Math.ceil(cell+.5),Math.ceil(cell+.5));
  } catch(e) { _drawQRManual(canvas, text); }
}
function _drawQRManual(canvas, text) {
  const size=220, ctx=canvas.getContext('2d');
  canvas.width=size; canvas.height=size;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size);
  ctx.fillStyle='#0A0F2C'; ctx.font='bold 13px sans-serif'; ctx.textAlign='center';
  ctx.fillText('Código de canje:', size/2, 80);
  ctx.font='bold 18px monospace'; ctx.fillStyle='#1B4FD8';
  const short = text.length > 30 ? text.substring(0,30)+'...' : text;
  ctx.fillText(short, size/2, 120);
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
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});}

if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
