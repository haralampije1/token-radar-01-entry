// Token Radar Dashboard — Client-side rendering and interaction

let RADAR = null;
let filteredRows = [];
let currentView = 'board'; // 'board' or 'live'
let sortBy = 'rank';
let searchQuery = '';
let categoryFilter = '';
let chainFilter = '';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function fmtUSD(n) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toLocaleString();
}

function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  const sign = n > 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function fmtAge(days) {
  if (days === null || days === undefined) return '—';
  if (days < 30) return days + 'd';
  if (days < 365) return (days / 30).toFixed(1) + 'mo';
  return (days / 365).toFixed(1) + 'y';
}

function qualityClass(score) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function qualityLabel(score) {
  if (score >= 0.7) return 'High';
  if (score >= 0.4) return 'Medium';
  return 'Low';
}

function renderBoard() {
  const tbody = $('#board tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const rows = currentView === 'board' ? filteredRows : (RADAR?.live || []);

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted)">No protocols match your filters</td></tr>';
    return;
  }

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.slug = row.slug;

    if (currentView === 'board') {
      tr.innerHTML = `
        <td class="rank">${row.rank}</td>
        <td class="protocol-cell">
          <span class="protocol-name">${escapeHtml(row.name)}</span>
          <span class="protocol-slug">${escapeHtml(row.slug)}</span>
        </td>
        <td>${escapeHtml(row.category || '—')}</td>
        <td class="chains">${row.chains.map(c => `<span class="chain">${escapeHtml(c)}</span>`).join('')}</td>
        <td class="tvl">${fmtUSD(row.tvl_usd)}</td>
        <td class="growth ${row.change_7d !== null && row.change_7d >= 0 ? 'positive' : row.change_7d !== null ? 'negative' : ''}">${fmtPct(row.change_7d)}</td>
        <td class="age">${fmtAge(row.age_days)}</td>
        <td class="implied">${fmtUSD(row.implied_value_usd)}</td>
        <td><span class="quality-score ${qualityClass(row.quality_score)}">${qualityLabel(row.quality_score)}</span></td>
        <td><button class="farm-plan-btn" data-slug="${escapeHtml(row.slug)}">View Plan</button></td>
      `;
    } else {
      tr.innerHTML = `
        <td class="rank">${row.rank || '—'}</td>
        <td class="protocol-cell">
          <span class="protocol-name">${escapeHtml(row.name)}</span>
          <span class="protocol-slug">${escapeHtml(row.slug)}</span>
        </td>
        <td>${escapeHtml(row.category || '—')}</td>
        <td class="chains">${row.chains.map(c => `<span class="chain">${escapeHtml(c)}</span>`).join('')}</td>
        <td class="tvl">${fmtUSD(row.tvl_usd)}</td>
        <td class="growth ${row.change_7d !== null && row.change_7d >= 0 ? 'positive' : row.change_7d !== null ? 'negative' : ''}">${fmtPct(row.change_7d)}</td>
        <td class="age">—</td>
        <td class="implied">${row.mcap_usd !== null ? fmtUSD(row.mcap_usd) : '—'}</td>
        <td>—</td>
        <td>—</td>
      `;
    }

    tbody.appendChild(tr);
  }

  // Attach click handlers for farm plan buttons
  $$('.farm-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const slug = btn.dataset.slug;
      const row = filteredRows.find(r => r.slug === slug);
      if (row) showDetail(row);
    });
  });

  updateStats();
}

function showDetail(row) {
  const detail = $('#detail');
  const content = $('.detail-content');
  if (!detail || !content) return;

  const boardRow = RADAR?.rows?.find(r => r.slug === row.slug);
  const model = boardRow?.model || {};

  content.innerHTML = `
    <div class="detail-header">
      <h2>${escapeHtml(row.name)}</h2>
      <div class="detail-meta">
        <span>Rank: <strong>#${row.rank}</strong></span>
        <span>Category: <strong>${escapeHtml(row.category || '—')}</strong></span>
      </div>
    </div>

    <div class="detail-section">
      <h3>Valuation Model</h3>
      <dl class="detail-grid">
        <dt>TVL</dt><dd>${fmtUSD(row.tvl_usd)}</dd>
        <dt>7d Growth</dt><dd class="${row.change_7d !== null && row.change_7d >= 0 ? 'positive' : 'negative'}">${fmtPct(row.change_7d)}</dd>
        <dt>Protocol Age</dt><dd>${fmtAge(row.age_days)}</dd>
        <dt>Implied Value</dt><dd class="implied">${fmtUSD(row.implied_value_usd)}</dd>
        <dt>Base Multiple</dt><dd>${model.base_multiple || '—'}</dd>
        <dt>Growth Multiplier</dt><dd>${model.growth_multiplier || '—'}</dd>
        <dt>Maturity Multiplier</dt><dd>${model.maturity_multiplier || '—'}</dd>
        <dt>Category Multiplier</dt><dd>${model.category_multiplier || '—'}</dd>
        <dt>Chain Diversity Bonus</dt><dd>${model.chain_diversity_bonus ? '+' + (model.chain_diversity_bonus * 100).toFixed(1) + '%' : '—'}</dd>
        <dt>Concentration Penalty</dt><dd>${model.concentration_penalty ? '-' + (model.concentration_penalty * 100).toFixed(1) + '%' : '—'}</dd>
        <dt>Quality Score</dt><dd class="quality-score ${qualityClass(row.quality_score)}">${qualityLabel(row.quality_score)}</dd>
      </dl>
    </div>

    <div class="detail-section">
      <h3>Chains</h3>
      <div class="chains">${row.chains.map(c => `<span class="chain">${escapeHtml(c)}</span>`).join('')}</div>
    </div>

    ${boardRow?.farm_steps ? `
    <div class="detail-section">
      <h3>Farm Plan (${boardRow.farm_steps.length} steps)</h3>
      <ul class="farm-steps">
        ${boardRow.farm_steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  `;

  detail.hidden = false;
  document.body.style.overflow = 'hidden';
}

function hideDetail() {
  const detail = $('#detail');
  if (detail) {
    detail.hidden = true;
    document.body.style.overflow = '';
  }
}

function updateStats() {
  const stats = $('#stats');
  if (!stats) return;

  if (currentView === 'board') {
    const totalTVL = filteredRows.reduce((sum, r) => sum + r.tvl_usd, 0);
    const avgQuality = filteredRows.reduce((sum, r) => sum + (r.quality_score || 0), 0) / filteredRows.length;
    stats.innerHTML = `
      <span>Showing: <strong>${filteredRows.length}</strong> / ${RADAR?.board_size || 0}</span>
      <span>Total TVL: <strong>${fmtUSD(totalTVL)}</strong></span>
      <span>Avg Quality: <strong>${(avgQuality * 100).toFixed(0)}%</strong></span>
    `;
  } else {
    const live = RADAR?.live || [];
    const totalTVL = live.reduce((sum, r) => sum + r.tvl_usd, 0);
    stats.innerHTML = `
      <span>Live Tokens: <strong>${live.length}</strong></span>
      <span>Total TVL: <strong>${fmtUSD(totalTVL)}</strong></span>
    `;
  }
}

function applyFilters() {
  if (!RADAR) return;

  let rows = RADAR.rows;

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q)
    );
  }

  // Category filter
  if (categoryFilter) {
    rows = rows.filter(r => r.category === categoryFilter);
  }

  // Chain filter
  if (chainFilter) {
    rows = rows.filter(r => r.chains.includes(chainFilter));
  }

  // Sort
  switch (sortBy) {
    case 'tvl':
      rows.sort((a, b) => b.tvl_usd - a.tvl_usd);
      break;
    case 'growth':
      rows.sort((a, b) => (b.change_7d || -999) - (a.change_7d || -999));
      break;
    case 'age':
      rows.sort((a, b) => (b.age_days || -1) - (a.age_days || -1));
      break;
    case 'quality':
      rows.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
      break;
    default: // rank
      rows.sort((a, b) => a.rank - b.rank);
  }

  // Re-rank after sort
  if (sortBy !== 'rank') {
    rows.forEach((r, i) => r.rank = i + 1);
  }

  filteredRows = rows;
  renderBoard();
}

function populateFilters() {
  if (!RADAR) return;

  const catSelect = $('#categoryFilter');
  const chainSelect = $('#chainFilter');
  if (!catSelect || !chainSelect) return;

  // Categories
  const categories = [...new Set(RADAR.rows.map(r => r.category).filter(Boolean))].sort();
  catSelect.innerHTML = '<option value="">All Categories</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  // Chains
  const chains = [...new Set(RADAR.rows.flatMap(r => r.chains))].sort();
  chainSelect.innerHTML = '<option value="">All Chains</option>' +
    chains.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function init() {
  // Load RADAR from data.js (injected globally)
  if (typeof window.RADAR === 'undefined') {
    console.error('RADAR data not found');
    return;
  }

  RADAR = window.RADAR;
  filteredRows = RADAR.rows;

  // Set meta
  $('#modelVersion')?.textContent?.(`Model: ${RADAR.model_version}`);
  $('#asOf')?.textContent?.(`As of: ${RADAR.as_of}`);
  $('#watchlistSize')?.textContent?.(`Watchlist: ${RADAR.watchlist_size}`);
  $('#footerModel')?.textContent?.(RADAR.model_version);

  // Populate filters
  populateFilters();

  // Event listeners
  $('#search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFilters();
  });

  $('#categoryFilter')?.addEventListener('change', (e) => {
    categoryFilter = e.target.value;
    applyFilters();
  });

  $('#chainFilter')?.addEventListener('change', (e) => {
    chainFilter = e.target.value;
    applyFilters();
  });

  $('#sortBy')?.addEventListener('change', (e) => {
    sortBy = e.target.value;
    applyFilters();
  });

  $('#viewBoard')?.addEventListener('click', () => {
    currentView = 'board';
    $('#viewBoard')?.classList.add('active');
    $('#viewLive')?.classList.remove('active');
    $('#viewBoard')?.setAttribute('aria-pressed', 'true');
    $('#viewLive')?.setAttribute('aria-pressed', 'false');
    applyFilters();
  });

  $('#viewLive')?.addEventListener('click', () => {
    currentView = 'live';
    $('#viewLive')?.classList.add('active');
    $('#viewBoard')?.classList.remove('active');
    $('#viewLive')?.setAttribute('aria-pressed', 'true');
    $('#viewBoard')?.setAttribute('aria-pressed', 'false');
    // Live view uses RADAR.live
    filteredRows = RADAR.live || [];
    renderBoard();
  });

  $('.close-detail')?.addEventListener('click', hideDetail);

  // Close detail on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDetail();
  });

  // Initial render
  applyFilters();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}