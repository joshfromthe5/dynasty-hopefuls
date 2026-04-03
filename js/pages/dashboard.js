import { Api } from '../api.js';
import { formatRecord, formatPoints, getAvatarUrl } from '../utils/format.js';
import { showError } from '../utils/dom.js';

export const title = 'Home';

export async function render(container) {
  try {
    const [league, rosters, users, nflState] = await Promise.all([
      Api.getLeague(),
      Api.getRosters(),
      Api.getUserMap(),
      Api.getNflState(),
    ]);

    const sorted = [...rosters].sort((a, b) => {
      const aw = a.settings?.wins || 0, bw = b.settings?.wins || 0;
      const af = a.settings?.fpts || 0, bf = b.settings?.fpts || 0;
      return bw - aw || bf - af;
    });

    const statusLabel = {
      pre_draft: 'Pre-Draft',
      drafting: 'Drafting',
      in_season: 'In Season',
      complete: 'Complete',
    };

    container.innerHTML = `
      <div class="space-y-6">
        <!-- League Header Card -->
        <div class="bg-surface rounded-2xl p-5 border border-gray-800">
          <div class="flex items-center gap-4">
            ${league.avatar
              ? `<img src="${getAvatarUrl(league.avatar, false)}" class="w-14 h-14 rounded-xl object-cover" alt="">`
              : `<div class="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl">${(league.name || 'L')[0]}</div>`
            }
            <div class="flex-1 min-w-0">
              <h1 class="text-lg font-bold truncate">${league.name}</h1>
              <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-400">
                <span>${league.season} Season</span>
                <span>${statusLabel[league.status] || league.status}</span>
                <span>${league.total_rosters} Teams</span>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3 mt-4">
            <div class="bg-gray-800/50 rounded-xl p-3 text-center">
              <div class="text-xs text-gray-400 mb-1">Week</div>
              <div class="text-lg font-bold">${nflState.display_week || nflState.week || '-'}</div>
            </div>
            <div class="bg-gray-800/50 rounded-xl p-3 text-center">
              <div class="text-xs text-gray-400 mb-1">Season</div>
              <div class="text-lg font-bold">${nflState.season_type || '-'}</div>
            </div>
            <div class="bg-gray-800/50 rounded-xl p-3 text-center">
              <div class="text-xs text-gray-400 mb-1">Scoring</div>
              <div class="text-lg font-bold text-emerald-400">${league.scoring_settings?.rec === 1 ? 'PPR' : league.scoring_settings?.rec === 0.5 ? '0.5 PPR' : 'STD'}</div>
            </div>
          </div>
        </div>

        <!-- Quick Standings -->
        <div class="bg-surface rounded-2xl border border-gray-800">
          <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <h2 class="font-semibold">Standings</h2>
            <a href="#standings" class="text-sm text-emerald-400 hover:underline">View All</a>
          </div>
          <div class="divide-y divide-gray-800/50">
            ${sorted.map((r, i) => {
              const owner = users[r.owner_id] || { name: `Team ${r.roster_id}` };
              const wins = r.settings?.wins || 0;
              const losses = r.settings?.losses || 0;
              const ties = r.settings?.ties || 0;
              const fpts = formatPoints(r.settings?.fpts || 0, r.settings?.fpts_decimal);
              const isTop3 = i < 3;
              return `
                <div class="flex items-center gap-3 px-5 py-3">
                  <span class="w-6 text-center text-sm font-bold ${isTop3 ? 'text-emerald-400' : 'text-gray-500'}">${i + 1}</span>
                  ${owner.avatar
                    ? `<img src="${getAvatarUrl(owner.avatar)}" class="w-8 h-8 rounded-full object-cover" alt="">`
                    : `<div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">${owner.name[0]}</div>`
                  }
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">${owner.name}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-semibold">${formatRecord(wins, losses, ties)}</div>
                    <div class="text-xs text-gray-400">${fpts} PF</div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Quick Links -->
        <div class="grid grid-cols-2 gap-3">
          <a href="#matchups" class="bg-surface hover:bg-surface-light border border-gray-800 rounded-2xl p-4 transition-colors">
            <div class="text-emerald-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            </div>
            <div class="text-sm font-semibold">Matchups</div>
            <div class="text-xs text-gray-400 mt-0.5">Week ${nflState.display_week || nflState.week || '?'} scores</div>
          </a>
          <a href="#transactions" class="bg-surface hover:bg-surface-light border border-gray-800 rounded-2xl p-4 transition-colors">
            <div class="text-emerald-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
            </div>
            <div class="text-sm font-semibold">Transactions</div>
            <div class="text-xs text-gray-400 mt-0.5">Recent activity</div>
          </a>
          <a href="#power-rankings" class="bg-surface hover:bg-surface-light border border-gray-800 rounded-2xl p-4 transition-colors">
            <div class="text-emerald-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <div class="text-sm font-semibold">Power Rankings</div>
            <div class="text-xs text-gray-400 mt-0.5">Analytics & trends</div>
          </a>
          <a href="#history" class="bg-surface hover:bg-surface-light border border-gray-800 rounded-2xl p-4 transition-colors">
            <div class="text-emerald-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div class="text-sm font-semibold">History</div>
            <div class="text-xs text-gray-400 mt-0.5">Past champions</div>
          </a>
        </div>
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
