import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Trade Calculator';

function formatValue(n) {
  return Math.round(n).toLocaleString();
}

function assetPhoto(asset) {
  if (asset.position === 'PICK' || !asset.sleeper_id || String(asset.sleeper_id).startsWith('pick_')) {
    return `<div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs shrink-0">📋</div>`;
  }
  return `<img src="${getPlayerPhotoUrl(asset.sleeper_id)}" class="w-8 h-8 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.outerHTML='<div class=\\'w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs shrink-0\\'>?</div>'">`;
}

export async function render(container) {
  showLoading(container);

  try {
    const values = await Api.getDynastyValues();
    const sideA = [];
    const sideB = [];
    let query = '';
    let posFilter = 'ALL';

    function total(side) {
      return side.reduce((s, a) => s + (a.current_value || 0), 0);
    }

    function searchResults() {
      let list = values;
      if (posFilter !== 'ALL') {
        list = list.filter(p => p.position === posFilter);
      }
      if (query) {
        const q = query.toLowerCase();
        list = list.filter(p => (p.name || '').toLowerCase().includes(q));
      }
      return list.slice(0, 40);
    }

    function verdict() {
      const a = total(sideA);
      const b = total(sideB);
      if (!sideA.length || !sideB.length) return { label: 'Add assets to both sides', color: 'text-gray-400', pct: 50 };
      const diff = a - b;
      const max = Math.max(a, b, 1);
      const pctDiff = Math.abs(diff) / max * 100;
      if (pctDiff < 5) return { label: 'Even trade', color: 'text-emerald-400', pct: 50, a, b, diff };
      if (diff > 0) return { label: `Side A wins by ${formatValue(diff)}`, color: 'text-blue-400', pct: Math.min(90, 50 + pctDiff / 2), a, b, diff };
      return { label: `Side B wins by ${formatValue(Math.abs(diff))}`, color: 'text-purple-400', pct: Math.max(10, 50 - pctDiff / 2), a, b, diff };
    }

    function draw() {
      const results = searchResults();
      const v = verdict();
      const aTotal = total(sideA);
      const bTotal = total(sideB);

      const resultsEl = document.getElementById('tc-results');
      const sidesEl = document.getElementById('tc-sides');
      const verdictEl = document.getElementById('tc-verdict');
      if (!resultsEl || !sidesEl || !verdictEl) return;

      verdictEl.innerHTML = `
        <div class="text-center mb-3">
          <div class="text-sm font-bold ${v.color}">${v.label}</div>
          ${sideA.length && sideB.length ? `<div class="text-xs text-gray-500 mt-1">${formatValue(aTotal)} vs ${formatValue(bTotal)}</div>` : ''}
        </div>
        <div class="h-2 bg-gray-800 rounded-full overflow-hidden flex">
          <div class="h-full bg-blue-500 transition-all" style="width: ${v.pct}%"></div>
          <div class="h-full bg-purple-500 transition-all" style="width: ${100 - v.pct}%"></div>
        </div>
        <div class="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>Side A</span>
          <span>Side B</span>
        </div>`;

      sidesEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="bg-surface rounded-2xl border border-blue-500/30 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-bold text-blue-400">Side A</h3>
              <span class="text-sm font-semibold">${formatValue(aTotal)}</span>
            </div>
            <div class="space-y-1 min-h-[60px]">
              ${sideA.length ? sideA.map((a, i) => `
                <div class="flex items-center gap-2 p-1.5 rounded-lg bg-gray-800/30">
                  ${assetPhoto(a)}
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate">${a.name}</div>
                    <div class="text-xs text-gray-500"><span class="${positionColor(a.position)}">${a.position}</span>${a.team && a.team !== 'NFL' ? ` · ${a.team}` : ''}</div>
                  </div>
                  <span class="text-xs text-gray-400 shrink-0">${formatValue(a.current_value)}</span>
                  <button data-remove-a="${i}" class="text-gray-500 hover:text-red-400 text-sm px-1">✕</button>
                </div>
              `).join('') : '<p class="text-xs text-gray-600 py-4 text-center">No assets added</p>'}
            </div>
          </div>
          <div class="bg-surface rounded-2xl border border-purple-500/30 p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-bold text-purple-400">Side B</h3>
              <span class="text-sm font-semibold">${formatValue(bTotal)}</span>
            </div>
            <div class="space-y-1 min-h-[60px]">
              ${sideB.length ? sideB.map((a, i) => `
                <div class="flex items-center gap-2 p-1.5 rounded-lg bg-gray-800/30">
                  ${assetPhoto(a)}
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate">${a.name}</div>
                    <div class="text-xs text-gray-500"><span class="${positionColor(a.position)}">${a.position}</span>${a.team && a.team !== 'NFL' ? ` · ${a.team}` : ''}</div>
                  </div>
                  <span class="text-xs text-gray-400 shrink-0">${formatValue(a.current_value)}</span>
                  <button data-remove-b="${i}" class="text-gray-500 hover:text-red-400 text-sm px-1">✕</button>
                </div>
              `).join('') : '<p class="text-xs text-gray-600 py-4 text-center">No assets added</p>'}
            </div>
          </div>
        </div>`;

      resultsEl.innerHTML = `
        <div class="bg-surface rounded-xl border border-gray-800 divide-y divide-gray-800/50 max-h-80 overflow-y-auto">
          ${results.length ? results.map(p => `
            <div class="flex items-center gap-2 px-3 py-2 hover:bg-surface-light/40 transition-colors">
              ${assetPhoto(p)}
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">${p.name}</div>
                <div class="text-xs text-gray-500"><span class="${positionColor(p.position)}">${p.position}</span>${p.team && p.team !== 'NFL' ? ` · ${p.team}` : ''}${p.age ? ` · Age ${p.age}` : ''}</div>
              </div>
              <span class="text-xs font-semibold text-gray-300 shrink-0 w-14 text-right">${formatValue(p.current_value)}</span>
              <button data-add-a="${p.sleeper_id}" class="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors shrink-0">A</button>
              <button data-add-b="${p.sleeper_id}" class="text-[10px] font-bold px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors shrink-0">B</button>
            </div>
          `).join('') : '<p class="text-center text-gray-500 py-6 text-sm">No matching assets</p>'}
        </div>`;

      sidesEl.querySelectorAll('[data-remove-a]').forEach(btn => {
        btn.addEventListener('click', () => {
          sideA.splice(parseInt(btn.dataset.removeA), 1);
          draw();
        });
      });
      sidesEl.querySelectorAll('[data-remove-b]').forEach(btn => {
        btn.addEventListener('click', () => {
          sideB.splice(parseInt(btn.dataset.removeB), 1);
          draw();
        });
      });
      resultsEl.querySelectorAll('[data-add-a]').forEach(btn => {
        btn.addEventListener('click', () => {
          const asset = values.find(p => p.sleeper_id === btn.dataset.addA);
          if (asset) { sideA.push(asset); draw(); }
        });
      });
      resultsEl.querySelectorAll('[data-add-b]').forEach(btn => {
        btn.addEventListener('click', () => {
          const asset = values.find(p => p.sleeper_id === btn.dataset.addB);
          if (asset) { sideB.push(asset); draw(); }
        });
      });
    }

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'PICK'];

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-surface rounded-2xl border border-gray-800 p-4">
          <p class="text-xs text-gray-400">Build a trade by adding players and draft picks to each side. Values from <a href="https://www.dynastydealer.com" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Dynasty Dealer</a> — based on real Sleeper trade data.</p>
        </div>

        <div id="tc-verdict" class="bg-surface rounded-2xl border border-gray-800 p-4"></div>
        <div id="tc-sides"></div>

        <div class="space-y-2">
          <div class="relative">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input id="tc-search" type="text" placeholder="Search players or picks..." class="w-full bg-surface border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors">
          </div>
          <div class="flex gap-2 overflow-x-auto no-scrollbar">
            ${positions.map(p => `
              <button data-pos="${p}" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${p === posFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${p}</button>
            `).join('')}
          </div>
          <div id="tc-results"></div>
        </div>

        <p class="text-xs text-gray-600 text-center">Values by <a href="https://www.dynastydealer.com" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Dynasty Dealer</a></p>
      </div>`;

    let debounce;
    document.getElementById('tc-search').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        query = e.target.value.trim();
        draw();
      }, 150);
    });

    container.querySelectorAll('[data-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        posFilter = btn.dataset.pos;
        container.querySelectorAll('[data-pos]').forEach(b => {
          b.className = `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${b.dataset.pos === posFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}`;
        });
        draw();
      });
    });

    draw();
  } catch (err) {
    showError(container, err.message);
  }
}
