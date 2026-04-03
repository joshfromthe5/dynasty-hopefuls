import { Api } from '../api.js';
import { formatRecord, formatPoints, getAvatarUrl } from '../utils/format.js';
import { showError } from '../utils/dom.js';

export const title = 'Standings';

let sortKey = 'wins';
let sortDir = -1;

function sortRosters(rosters) {
  return [...rosters].sort((a, b) => {
    let av, bv;
    switch (sortKey) {
      case 'wins': av = a.settings?.wins || 0; bv = b.settings?.wins || 0; break;
      case 'losses': av = a.settings?.losses || 0; bv = b.settings?.losses || 0; break;
      case 'fpts': av = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100; bv = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100; break;
      case 'fpts_against': av = (a.settings?.fpts_against || 0) + (a.settings?.fpts_against_decimal || 0) / 100; bv = (b.settings?.fpts_against || 0) + (b.settings?.fpts_against_decimal || 0) / 100; break;
      case 'streak': av = a.metadata?.streak || ''; bv = b.metadata?.streak || ''; break;
      default: av = 0; bv = 0;
    }
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * (av - bv);
  });
}

export async function render(container) {
  try {
    const [rosters, userMap] = await Promise.all([
      Api.getRosters(),
      Api.getUserMap(),
    ]);

    function draw() {
      const sorted = sortRosters(rosters);

      const headerBtn = (label, key) => {
        const active = sortKey === key;
        return `<button data-sort="${key}" class="text-xs font-semibold uppercase tracking-wide ${active ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'} transition-colors">${label}${active ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}</button>`;
      };

      container.innerHTML = `
        <div class="space-y-3">
          <!-- Table Header -->
          <div class="bg-surface rounded-xl border border-gray-800 overflow-hidden">
            <div class="grid grid-cols-[2rem_1fr_4.5rem_4.5rem_4.5rem] md:grid-cols-[2rem_1fr_5rem_5rem_5rem_5rem] gap-2 px-4 py-2.5 border-b border-gray-800 items-center">
              <span class="text-xs text-gray-500 font-semibold">#</span>
              <span class="text-xs text-gray-500 font-semibold">Team</span>
              ${headerBtn('W-L', 'wins')}
              ${headerBtn('PF', 'fpts')}
              ${headerBtn('PA', 'fpts_against')}
              <span class="hidden md:block">${headerBtn('Moves', 'losses')}</span>
            </div>
            <div class="divide-y divide-gray-800/50">
              ${sorted.map((r, i) => {
                const owner = userMap[r.owner_id] || { name: `Team ${r.roster_id}` };
                const wins = r.settings?.wins || 0;
                const losses = r.settings?.losses || 0;
                const ties = r.settings?.ties || 0;
                const fpts = formatPoints(r.settings?.fpts || 0, r.settings?.fpts_decimal);
                const pa = formatPoints(r.settings?.fpts_against || 0, r.settings?.fpts_against_decimal);
                const moves = r.settings?.total_moves || 0;
                const isPlayoff = i < 6;

                return `
                  <div class="grid grid-cols-[2rem_1fr_4.5rem_4.5rem_4.5rem] md:grid-cols-[2rem_1fr_5rem_5rem_5rem_5rem] gap-2 px-4 py-3 items-center hover:bg-surface-light/50 transition-colors">
                    <span class="text-sm font-bold ${isPlayoff ? 'text-emerald-400' : 'text-gray-500'}">${i + 1}</span>
                    <div class="flex items-center gap-2 min-w-0">
                      ${owner.avatar
                        ? `<img src="${getAvatarUrl(owner.avatar)}" class="w-7 h-7 rounded-full object-cover shrink-0" alt="">`
                        : `<div class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold shrink-0">${owner.name[0]}</div>`
                      }
                      <a href="#manager/${r.owner_id}" class="text-sm font-medium truncate hover:text-emerald-400 transition-colors">${owner.name}</a>
                    </div>
                    <span class="text-sm font-semibold text-right">${formatRecord(wins, losses, ties)}</span>
                    <span class="text-sm text-right text-gray-300">${fpts}</span>
                    <span class="text-sm text-right text-gray-400">${pa}</span>
                    <span class="hidden md:block text-sm text-right text-gray-500">${moves}</span>
                  </div>`;
              }).join('')}
            </div>
          </div>
          <p class="text-xs text-gray-600 text-center">Green ranks indicate projected playoff spots</p>
        </div>`;

      container.querySelectorAll('[data-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.sort;
          if (sortKey === key) {
            sortDir *= -1;
          } else {
            sortKey = key;
            sortDir = -1;
          }
          draw();
        });
      });
    }

    draw();
  } catch (err) {
    showError(container, err.message);
  }
}
