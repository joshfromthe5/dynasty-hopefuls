import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Trade Values';

const TIERS = [
  { label: 'Elite', min: 1, max: 15, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  { label: 'Star', min: 16, max: 40, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  { label: 'Starter', min: 41, max: 80, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  { label: 'Bench', min: 81, max: 160, color: 'text-gray-300', border: 'border-gray-600', bg: 'bg-gray-800/30' },
  { label: 'Deep', min: 161, max: 300, color: 'text-gray-500', border: 'border-gray-700', bg: 'bg-gray-800/20' },
];

export async function render(container) {
  showLoading(container);

  try {
    const [players, ownershipMap, rosterMap] = await Promise.all([
      Api.getPlayers(),
      Api.getPlayerOwnershipMap(),
      Api.getRosterMap(),
    ]);

    const rosteredPlayers = Object.entries(ownershipMap)
      .map(([pid, rid]) => {
        const p = players[pid];
        if (!p || !p.position) return null;
        if (['OL', 'OT', 'OG', 'C', 'LS', 'P'].includes(p.position)) return null;
        return { id: pid, ...p, rosterId: rid, ownerName: rosterMap[rid]?.owner?.name || `Team ${rid}` };
      })
      .filter(Boolean)
      .sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999));

    let posFilter = 'ALL';

    function draw() {
      let list = rosteredPlayers;
      if (posFilter !== 'ALL') {
        list = list.filter(p => p.position === posFilter || p.fantasy_positions?.includes(posFilter));
      }

      const tiered = TIERS.map(tier => {
        const players = list.filter(p => {
          const rank = p.search_rank || 9999;
          return rank >= tier.min && rank <= tier.max;
        });
        return { ...tier, players };
      }).filter(t => t.players.length > 0);

      const resultsEl = document.getElementById('tv-results');
      if (!resultsEl) return;

      resultsEl.innerHTML = tiered.length ? tiered.map(tier => `
        <div class="bg-surface rounded-2xl border ${tier.border} mb-4">
          <div class="px-5 py-3 flex items-center gap-2 border-b ${tier.border}">
            <span class="text-sm font-bold ${tier.color}">${tier.label}</span>
            <span class="text-xs text-gray-500">${tier.players.length} player${tier.players.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="divide-y divide-gray-800/30">
            ${tier.players.map(p => {
              const pos = p.position || '?';
              return `
                <a href="#player/${p.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-light/50 transition-colors">
                  <img src="${getPlayerPhotoUrl(p.id)}" class="w-8 h-8 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">${p.first_name} ${p.last_name}</div>
                    <div class="text-xs text-gray-500">${p.team || 'FA'} · <span class="${positionColor(pos)}">${pos}</span></div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-xs text-gray-500">${p.ownerName}</div>
                    <div class="text-xs text-gray-600">#${p.search_rank || '—'}</div>
                  </div>
                </a>`;
            }).join('')}
          </div>
        </div>
      `).join('') : '<p class="text-center text-gray-500 py-8">No rostered players in this position</p>';
    }

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE'];

    container.innerHTML = `
      <div class="space-y-3">
        <div class="bg-surface rounded-2xl border border-gray-800 p-4">
          <p class="text-xs text-gray-400">Dynasty value tiers based on consensus rankings. Use these as a starting point for trade negotiations.</p>
        </div>
        <div class="flex gap-2 overflow-x-auto no-scrollbar">
          ${positions.map(p => `
            <button data-pos="${p}" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${p === posFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${p}</button>
          `).join('')}
        </div>
        <div id="tv-results"></div>
      </div>`;

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
