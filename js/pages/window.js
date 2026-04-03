import { Api } from '../api.js';
import { positionColor, getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Window Analysis';

function classifyWindow(avgAge, starterQuality) {
  if (avgAge >= 29 && starterQuality >= 60) return { label: 'Win Now', color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
  if (avgAge <= 25 && starterQuality < 50) return { label: 'Rebuilding', color: 'text-blue-400', bg: 'bg-blue-500/15' };
  if (starterQuality >= 60) return { label: 'Contender', color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
  if (avgAge <= 26) return { label: 'Young Core', color: 'text-purple-400', bg: 'bg-purple-500/15' };
  return { label: 'Middle of Pack', color: 'text-gray-300', bg: 'bg-gray-500/15' };
}

export async function render(container) {
  showLoading(container);

  try {
    const [rosterMap, players, league] = await Promise.all([
      Api.getRosterMap(),
      Api.getPlayers(),
      Api.getLeague(),
    ]);

    const teams = Object.values(rosterMap).map(r => {
      const rosterPlayers = (r.players || [])
        .map(pid => ({ id: pid, ...players[pid] }))
        .filter(p => p.position && !['OL', 'OT', 'OG', 'C', 'LS', 'P'].includes(p.position));

      const ages = rosterPlayers.filter(p => p.age).map(p => p.age);
      const avgAge = ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : 0;

      const posCounts = {};
      for (const p of rosterPlayers) {
        const pos = p.position || '?';
        posCounts[pos] = (posCounts[pos] || 0) + 1;
      }

      const starterRanks = rosterPlayers
        .filter(p => p.search_rank && p.search_rank < 500)
        .sort((a, b) => a.search_rank - b.search_rank)
        .slice(0, league.settings?.num_starters || 9);

      const starterQuality = starterRanks.length
        ? Math.round(100 - (starterRanks.reduce((s, p) => s + p.search_rank, 0) / starterRanks.length))
        : 0;

      const window = classifyWindow(avgAge, Math.max(0, starterQuality));
      const youngCount = rosterPlayers.filter(p => (p.age && p.age <= 24) || p.years_exp <= 1).length;
      const vetCount = rosterPlayers.filter(p => p.age && p.age >= 28).length;

      return {
        ...r,
        rosterPlayers,
        avgAge: avgAge.toFixed(1),
        posCounts,
        starterQuality: Math.max(0, Math.min(100, starterQuality)),
        window,
        youngCount,
        vetCount,
        total: rosterPlayers.length,
      };
    }).sort((a, b) => b.starterQuality - a.starterQuality);

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-surface rounded-2xl border border-gray-800 p-4">
          <p class="text-xs text-gray-400">Roster window analysis based on player ages and consensus rankings. Higher starter quality = stronger current roster.</p>
        </div>

        ${teams.map(t => `
          <div class="bg-surface rounded-2xl border border-gray-800 p-5">
            <div class="flex items-center gap-3 mb-4">
              ${t.owner.avatar
                ? `<img src="${getAvatarUrl(t.owner.avatar)}" class="w-10 h-10 rounded-full">`
                : `<div class="w-10 h-10 rounded-full bg-gray-700 text-sm font-bold flex items-center justify-center">${t.owner.name[0]}</div>`}
              <div class="flex-1 min-w-0">
                <a href="#manager/${t.owner_id}" class="font-semibold hover:text-emerald-400 transition-colors">${t.owner.name}</a>
                <div class="text-xs text-gray-500">${t.total} players · Avg age ${t.avgAge}</div>
              </div>
              <span class="text-xs font-bold px-2.5 py-1 rounded-full ${t.window.bg} ${t.window.color}">${t.window.label}</span>
            </div>

            <!-- Starter Quality Bar -->
            <div class="mb-3">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>Starter Quality</span>
                <span>${t.starterQuality}/100</span>
              </div>
              <div class="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all ${t.starterQuality >= 60 ? 'bg-emerald-500' : t.starterQuality >= 40 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: ${t.starterQuality}%"></div>
              </div>
            </div>

            <!-- Age/Youth Breakdown -->
            <div class="grid grid-cols-3 gap-2 mb-3">
              <div class="bg-gray-800/30 rounded-lg p-2 text-center">
                <div class="text-xs text-gray-500">Young (≤24)</div>
                <div class="text-sm font-semibold text-purple-400">${t.youngCount}</div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-2 text-center">
                <div class="text-xs text-gray-500">Prime (25-27)</div>
                <div class="text-sm font-semibold text-emerald-400">${t.total - t.youngCount - t.vetCount}</div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-2 text-center">
                <div class="text-xs text-gray-500">Veteran (28+)</div>
                <div class="text-sm font-semibold text-yellow-400">${t.vetCount}</div>
              </div>
            </div>

            <!-- Positional Depth -->
            <div class="flex flex-wrap gap-1.5">
              ${['QB', 'RB', 'WR', 'TE'].map(pos => `
                <span class="text-xs px-2 py-0.5 rounded-full bg-gray-800/40 ${positionColor(pos)}">${pos}: ${t.posCounts[pos] || 0}</span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
