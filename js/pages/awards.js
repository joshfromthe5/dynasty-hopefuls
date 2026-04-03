import { Api } from '../api.js';
import { getAvatarUrl, formatPoints } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Weekly Awards';

export async function render(container) {
  showLoading(container);

  try {
    const [nflState, rosterMap, league] = await Promise.all([
      Api.getNflState(),
      Api.getRosterMap(),
      Api.getLeague(),
    ]);

    const currentWeek = nflState.display_week || nflState.week || 1;
    const maxWeek = Math.min(currentWeek, league.settings?.playoff_week_start || 14);
    let selectedWeek = Math.max(1, maxWeek - 1);

    function ownerInfo(rosterId) {
      const r = rosterMap[rosterId];
      return r?.owner || { name: `Team ${rosterId}`, avatar: null };
    }

    async function drawAwards() {
      const awardsEl = document.getElementById('awards-content');
      if (!awardsEl) return;
      showLoading(awardsEl);

      try {
        const matchups = await Api.getMatchups(selectedWeek);
        if (!matchups.length) {
          awardsEl.innerHTML = `<p class="text-center text-gray-500 py-8">No matchup data for week ${selectedWeek}</p>`;
          return;
        }

        const scored = matchups.filter(m => m.points != null && m.points > 0);
        if (!scored.length) {
          awardsEl.innerHTML = `<p class="text-center text-gray-500 py-8">Week ${selectedWeek} hasn't been played yet</p>`;
          return;
        }

        scored.sort((a, b) => b.points - a.points);
        const mvp = scored[0];
        const bust = scored[scored.length - 1];

        let benchHero = null;
        for (const m of matchups) {
          if (!m.players || !m.starters) continue;
          const benchPids = m.players.filter(p => !m.starters.includes(p));
          const benchTotal = benchPids.reduce((s, pid) => s + (m.players_points?.[pid] || 0), 0);
          if (!benchHero || benchTotal > benchHero.benchPts) {
            benchHero = { rosterId: m.roster_id, benchPts: benchTotal };
          }
        }

        const pairs = {};
        for (const m of matchups) {
          if (m.matchup_id == null) continue;
          if (!pairs[m.matchup_id]) pairs[m.matchup_id] = [];
          pairs[m.matchup_id].push(m);
        }

        let closest = null, biggest = null;
        for (const pair of Object.values(pairs)) {
          if (pair.length !== 2) continue;
          const diff = Math.abs((pair[0].points || 0) - (pair[1].points || 0));
          if (!closest || diff < closest.diff) closest = { pair, diff };
          if (!biggest || diff > biggest.diff) biggest = { pair, diff };
        }

        function awardCard(icon, title, subtitle, owner, value, accent) {
          return `
            <div class="bg-surface rounded-2xl border border-gray-800 p-5">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl ${accent} flex items-center justify-center text-xl shrink-0">${icon}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-gray-500 uppercase tracking-wide font-semibold">${title}</div>
                  <div class="text-sm font-bold mt-0.5">${subtitle}</div>
                </div>
                ${owner ? `
                <div class="flex items-center gap-2 shrink-0">
                  ${owner.avatar
                    ? `<img src="${getAvatarUrl(owner.avatar)}" class="w-8 h-8 rounded-full">`
                    : `<div class="w-8 h-8 rounded-full bg-gray-700 text-xs font-bold flex items-center justify-center">${owner.name[0]}</div>`}
                </div>` : ''}
              </div>
              ${value ? `<div class="mt-2 text-lg font-extrabold text-emerald-400">${value}</div>` : ''}
            </div>`;
        }

        function matchupCard(icon, title, pair, diff, accent) {
          if (!pair) return '';
          const [a, b] = pair.sort((x, y) => (y.points || 0) - (x.points || 0));
          const oA = ownerInfo(a.roster_id);
          const oB = ownerInfo(b.roster_id);
          return `
            <div class="bg-surface rounded-2xl border border-gray-800 p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-xl ${accent} flex items-center justify-center text-xl shrink-0">${icon}</div>
                <div>
                  <div class="text-xs text-gray-500 uppercase tracking-wide font-semibold">${title}</div>
                  <div class="text-sm font-bold mt-0.5">Margin: ${diff.toFixed(2)} pts</div>
                </div>
              </div>
              <div class="flex items-center justify-between bg-gray-800/30 rounded-xl p-3">
                <div class="flex items-center gap-2">
                  ${oA.avatar ? `<img src="${getAvatarUrl(oA.avatar)}" class="w-6 h-6 rounded-full">` : ''}
                  <span class="text-sm font-semibold">${oA.name}</span>
                </div>
                <span class="text-sm font-bold text-emerald-400">${(a.points || 0).toFixed(2)}</span>
              </div>
              <div class="flex items-center justify-between bg-gray-800/30 rounded-xl p-3 mt-1">
                <div class="flex items-center gap-2">
                  ${oB.avatar ? `<img src="${getAvatarUrl(oB.avatar)}" class="w-6 h-6 rounded-full">` : ''}
                  <span class="text-sm font-semibold">${oB.name}</span>
                </div>
                <span class="text-sm font-bold text-gray-400">${(b.points || 0).toFixed(2)}</span>
              </div>
            </div>`;
        }

        const mvpOwner = ownerInfo(mvp.roster_id);
        const bustOwner = ownerInfo(bust.roster_id);
        const benchOwner = benchHero ? ownerInfo(benchHero.rosterId) : null;

        awardsEl.innerHTML = `
          <div class="space-y-3">
            ${awardCard('🏆', 'MVP — Highest Score', mvpOwner.name, mvpOwner, `${mvp.points.toFixed(2)} pts`, 'bg-yellow-500/15')}
            ${benchHero ? awardCard('💺', 'Bench Hero — Most Bench Points', benchOwner.name, benchOwner, `${benchHero.benchPts.toFixed(2)} pts`, 'bg-purple-500/15') : ''}
            ${awardCard('📉', 'Bust — Lowest Score', bustOwner.name, bustOwner, `${bust.points.toFixed(2)} pts`, 'bg-red-500/15')}
            ${closest ? matchupCard('🎯', 'Closest Game', closest.pair, closest.diff, 'bg-blue-500/15') : ''}
            ${biggest ? matchupCard('💥', 'Biggest Blowout', biggest.pair, biggest.diff, 'bg-orange-500/15') : ''}
          </div>`;
      } catch (err) {
        awardsEl.innerHTML = `<p class="text-center text-red-400 py-4">${err.message}</p>`;
      }
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <button id="aw-prev" class="p-2 rounded-lg bg-surface border border-gray-800 hover:bg-surface-light transition-colors disabled:opacity-30" ${selectedWeek <= 1 ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="flex-1 text-center">
            <span class="text-sm font-semibold">Week <span id="aw-label">${selectedWeek}</span></span>
          </div>
          <button id="aw-next" class="p-2 rounded-lg bg-surface border border-gray-800 hover:bg-surface-light transition-colors disabled:opacity-30" ${selectedWeek >= maxWeek ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <div id="awards-content"></div>
      </div>`;

    function setWeek(w) {
      selectedWeek = w;
      document.getElementById('aw-label').textContent = w;
      document.getElementById('aw-prev').disabled = w <= 1;
      document.getElementById('aw-next').disabled = w >= maxWeek;
      drawAwards();
    }

    document.getElementById('aw-prev').addEventListener('click', () => { if (selectedWeek > 1) setWeek(selectedWeek - 1); });
    document.getElementById('aw-next').addEventListener('click', () => { if (selectedWeek < maxWeek) setWeek(selectedWeek + 1); });

    drawAwards();
  } catch (err) {
    showError(container, err.message);
  }
}
