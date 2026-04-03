import { Api } from '../api.js';
import { getAvatarUrl, getPlayerPhotoUrl, positionColor, formatRecord, formatPoints } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Rosters';

export async function render(container) {
  try {
    const [rosters, userMap, league] = await Promise.all([
      Api.getRosters(),
      Api.getUserMap(),
      Api.getLeague(),
    ]);

    showLoading(container);

    let players = null;
    try { players = await Api.getPlayers(); } catch {}

    const sorted = [...rosters].sort((a, b) => (b.settings?.wins || 0) - (a.settings?.wins || 0) || (b.settings?.fpts || 0) - (a.settings?.fpts || 0));

    const rosterPositions = league.roster_positions || [];
    const starterSlots = rosterPositions.filter(p => p !== 'BN');

    container.innerHTML = `
      <div class="space-y-4">
        ${sorted.map(roster => {
          const owner = userMap[roster.owner_id] || { name: `Team ${roster.roster_id}` };
          const wins = roster.settings?.wins || 0;
          const losses = roster.settings?.losses || 0;
          const ties = roster.settings?.ties || 0;
          const fpts = formatPoints(roster.settings?.fpts || 0, roster.settings?.fpts_decimal);

          const starters = roster.starters || [];
          const allPlayers = roster.players || [];
          const bench = allPlayers.filter(pid => !starters.includes(pid));
          const reserve = roster.reserve || [];

          function renderPlayer(pid, slotLabel) {
            const p = players?.[pid];
            const name = p ? `${p.first_name} ${p.last_name}` : pid;
            const pos = p?.position || p?.fantasy_positions?.[0] || '?';
            const team = p?.team || '';
            const injury = p?.injury_status;
            const injClass = injury === 'Out' || injury === 'IR' ? 'bg-red-500/20 text-red-400'
              : injury === 'Questionable' ? 'bg-yellow-500/20 text-yellow-400'
              : injury === 'Doubtful' ? 'bg-red-500/20 text-red-300'
              : injury ? 'bg-gray-500/20 text-gray-400' : '';

            return `
              <div class="flex items-center gap-2 py-1.5">
                <span class="w-8 text-xs text-gray-500 font-medium shrink-0">${slotLabel}</span>
                <img src="${getPlayerPhotoUrl(pid)}" class="w-7 h-7 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                <div class="flex-1 min-w-0">
                  <a href="#player/${pid}" class="text-sm text-gray-200 hover:text-emerald-400 transition-colors truncate block">${name}</a>
                </div>
                <span class="text-xs font-semibold ${positionColor(pos)}">${pos}</span>
                <span class="text-xs text-gray-500 w-8 text-right">${team}</span>
                ${injury ? `<span class="text-xs px-1 py-0.5 rounded ${injClass}">${injury}</span>` : ''}
              </div>`;
          }

          return `
            <details class="bg-surface rounded-xl border border-gray-800 group" open>
              <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-light/50 transition-colors">
                ${owner.avatar
                  ? `<img src="${getAvatarUrl(owner.avatar)}" class="w-9 h-9 rounded-full object-cover" alt="">`
                  : `<div class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">${owner.name[0]}</div>`
                }
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate">${owner.name}</div>
                  <div class="text-xs text-gray-400">${formatRecord(wins, losses, ties)} · ${fpts} PF</div>
                </div>
                <span class="text-xs text-gray-500">${allPlayers.length} players</span>
                <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div class="px-4 pb-3 border-t border-gray-800/50">
                <div class="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-3 mb-1">Starters</div>
                ${starters.map((pid, i) => renderPlayer(pid, starterSlots[i] || 'S')).join('')}

                ${bench.length ? `
                  <div class="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-3 mb-1">Bench</div>
                  ${bench.map(pid => renderPlayer(pid, 'BN')).join('')}
                ` : ''}

                ${reserve.length ? `
                  <div class="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-3 mb-1">Reserve</div>
                  ${reserve.map(pid => renderPlayer(pid, 'IR')).join('')}
                ` : ''}
              </div>
            </details>`;
        }).join('')}
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
