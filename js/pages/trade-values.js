import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Trade Values';

const TIERS = [
  { label: 'Elite', min: 7000, color: 'text-yellow-400', border: 'border-yellow-500/30' },
  { label: 'Star', min: 4500, color: 'text-emerald-400', border: 'border-emerald-500/30' },
  { label: 'Starter', min: 2500, color: 'text-blue-400', border: 'border-blue-500/30' },
  { label: 'Bench', min: 1000, color: 'text-gray-300', border: 'border-gray-600' },
  { label: 'Deep', min: 0, color: 'text-gray-500', border: 'border-gray-700' },
];

function formatValue(n) {
  return Math.round(n).toLocaleString();
}

function tierFor(value) {
  return TIERS.find(t => value >= t.min) || TIERS[TIERS.length - 1];
}

export async function render(container) {
  showLoading(container);

  try {
    const [players, ownershipMap, rosterMap, dynastyValues] = await Promise.all([
      Api.getPlayers(),
      Api.getPlayerOwnershipMap(),
      Api.getRosterMap(),
      Api.getDynastyValues().catch(() => []),
    ]);

    const valueById = {};
    for (const v of dynastyValues) {
      if (v.sleeper_id && v.position !== 'PICK') {
        valueById[v.sleeper_id] = v.current_value || 0;
      }
    }

    const rosteredPlayers = Object.entries(ownershipMap)
      .map(([pid, rid]) => {
        const p = players[pid];
        if (!p || !p.position) return null;
        if (['OL', 'OT', 'OG', 'C', 'LS', 'P', 'DL', 'LB', 'DB', 'DEF', 'IDP', 'K'].includes(p.position)) return null;
        const dynastyValue = valueById[pid];
        if (dynastyValue == null) return null;
        return {
          id: pid,
          ...p,
          rosterId: rid,
          ownerName: rosterMap[rid]?.owner?.name || `Team ${rid}`,
          dynastyValue,
          tier: tierFor(dynastyValue),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.dynastyValue - a.dynastyValue);

    let posFilter = 'ALL';

    function draw() {
      let list = rosteredPlayers;
      if (posFilter !== 'ALL') {
        list = list.filter(p => p.position === posFilter || p.fantasy_positions?.includes(posFilter));
      }

      const tiered = TIERS.map(tier => ({
        ...tier,
        players: list.filter(p => p.tier.label === tier.label),
      })).filter(t => t.players.length > 0);

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
                    <div class="text-xs font-semibold text-emerald-400">${formatValue(p.dynastyValue)}</div>
                  </div>
                </a>`;
            }).join('')}
          </div>
        </div>
      `).join('') : '<p class="text-center text-gray-500 py-8">No rostered players with dynasty values in this position</p>';
    }

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE'];

    container.innerHTML = `
      <div class="space-y-3">
        <div class="bg-surface rounded-2xl border border-gray-800 p-4">
          <p class="text-xs text-gray-400">Live dynasty value tiers for rostered players from <a href="https://www.dynastydealer.com" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Dynasty Dealer</a>. Updates automatically — no redeploy needed.</p>
        </div>
        <div class="flex gap-2 overflow-x-auto no-scrollbar">
          ${positions.map(p => `
            <button data-pos="${p}" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${p === posFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${p}</button>
          `).join('')}
        </div>
        <div id="tv-results"></div>
        <p class="text-xs text-gray-600 text-center">Values by <a href="https://www.dynastydealer.com" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Dynasty Dealer</a></p>
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
