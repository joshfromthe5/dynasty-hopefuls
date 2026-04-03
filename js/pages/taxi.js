import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl, getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Taxi & IR';

export async function render(container) {
  showLoading(container);

  try {
    const [rosterMap, players] = await Promise.all([
      Api.getRosterMap(),
      Api.getPlayers(),
    ]);

    const rosters = Object.values(rosterMap).sort((a, b) =>
      a.owner.name.localeCompare(b.owner.name)
    );

    function playerCard(pid) {
      const p = players[pid];
      if (!p) return `<div class="text-xs text-gray-500">Unknown (${pid})</div>`;
      const pos = p.position || p.fantasy_positions?.[0] || '?';
      const injury = p.injury_status;
      return `
        <a href="#player/${pid}" class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-800/40 transition-colors">
          <img src="${getPlayerPhotoUrl(pid)}" class="w-8 h-8 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">${p.first_name} ${p.last_name}</div>
            <div class="text-xs text-gray-500">${p.team || 'FA'} · <span class="${positionColor(pos)}">${pos}</span>${p.years_exp === 0 ? ' · Rookie' : ''}</div>
          </div>
          ${injury ? `<span class="text-xs font-semibold px-1.5 py-0.5 rounded ${injury === 'Out' || injury === 'IR' ? 'bg-red-500/20 text-red-400' : injury === 'Questionable' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}">${injury}</span>` : ''}
        </a>`;
    }

    const taxiTeams = rosters.filter(r => r.taxi?.length);
    const irTeams = rosters.filter(r => r.reserve?.length);

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Taxi Squads -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            <h2 class="font-bold text-lg">Taxi Squads</h2>
            <span class="text-xs text-gray-500">${taxiTeams.reduce((s, r) => s + (r.taxi?.length || 0), 0)} players stashed</span>
          </div>
          ${taxiTeams.length ? taxiTeams.map(r => `
            <div class="mb-4 last:mb-0">
              <div class="flex items-center gap-2 mb-2">
                ${r.owner.avatar
                  ? `<img src="${getAvatarUrl(r.owner.avatar)}" class="w-5 h-5 rounded-full">`
                  : `<div class="w-5 h-5 rounded-full bg-gray-700 text-xs font-bold flex items-center justify-center">${r.owner.name[0]}</div>`}
                <a href="#manager/${r.owner_id}" class="text-sm font-semibold hover:text-emerald-400 transition-colors">${r.owner.name}</a>
                <span class="text-xs text-gray-600">${r.taxi.length} player${r.taxi.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="bg-gray-800/20 rounded-xl divide-y divide-gray-800/30">
                ${r.taxi.map(pid => playerCard(pid)).join('')}
              </div>
            </div>
          `).join('') : '<p class="text-sm text-gray-500">No teams have players on their taxi squad</p>'}
        </div>

        <!-- IR / Reserve -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            <h2 class="font-bold text-lg">Injured Reserve</h2>
            <span class="text-xs text-gray-500">${irTeams.reduce((s, r) => s + (r.reserve?.length || 0), 0)} players on IR</span>
          </div>
          ${irTeams.length ? irTeams.map(r => `
            <div class="mb-4 last:mb-0">
              <div class="flex items-center gap-2 mb-2">
                ${r.owner.avatar
                  ? `<img src="${getAvatarUrl(r.owner.avatar)}" class="w-5 h-5 rounded-full">`
                  : `<div class="w-5 h-5 rounded-full bg-gray-700 text-xs font-bold flex items-center justify-center">${r.owner.name[0]}</div>`}
                <a href="#manager/${r.owner_id}" class="text-sm font-semibold hover:text-emerald-400 transition-colors">${r.owner.name}</a>
                <span class="text-xs text-gray-600">${r.reserve.length} player${r.reserve.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="bg-gray-800/20 rounded-xl divide-y divide-gray-800/30">
                ${r.reserve.map(pid => playerCard(pid)).join('')}
              </div>
            </div>
          `).join('') : '<p class="text-sm text-gray-500">No teams have players on IR</p>'}
        </div>
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
