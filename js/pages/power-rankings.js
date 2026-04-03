import { Api } from '../api.js';
import { formatRecord, getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Power Rankings';

async function computeRankings() {
  const [league, rosters, rosterMap, nflState] = await Promise.all([
    Api.getLeague(),
    Api.getRosters(),
    Api.getRosterMap(),
    Api.getNflState(),
  ]);

  const currentWeek = nflState.display_week || nflState.week || 1;
  const regSeasonWeeks = (league.settings?.playoff_week_start || 15) - 1;
  const weeksToFetch = Math.min(currentWeek - 1, regSeasonWeeks);

  // Fetch all completed regular season matchups
  const weeklyScores = {}; // rosterId -> [score, score, ...]
  for (const r of rosters) {
    weeklyScores[r.roster_id] = [];
  }

  const allMatchups = [];
  for (let w = 1; w <= weeksToFetch; w++) {
    try {
      const matchups = await Api.getMatchups(w);
      allMatchups.push({ week: w, matchups });
      for (const m of matchups) {
        if (weeklyScores[m.roster_id]) {
          weeklyScores[m.roster_id].push(m.points || 0);
        }
      }
    } catch { break; }
  }

  // Calculate metrics per team
  const teamStats = rosters.map(r => {
    const scores = weeklyScores[r.roster_id] || [];
    const owner = rosterMap[r.roster_id]?.owner || { name: `Team ${r.roster_id}` };

    // Points For / Against
    const totalPF = scores.reduce((s, v) => s + v, 0);

    // All-Play Record
    let apWins = 0, apLosses = 0;
    for (const { matchups } of allMatchups) {
      const myMatch = matchups.find(m => m.roster_id === r.roster_id);
      if (!myMatch) continue;
      const myPts = myMatch.points || 0;
      for (const other of matchups) {
        if (other.roster_id === r.roster_id) continue;
        if (myPts > (other.points || 0)) apWins++;
        else if (myPts < (other.points || 0)) apLosses++;
      }
    }
    const apWinPct = apWins + apLosses > 0 ? apWins / (apWins + apLosses) : 0;

    // Consistency (lower std dev = more consistent)
    const mean = scores.length ? totalPF / scores.length : 0;
    const variance = scores.length
      ? scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // Actual record
    const wins = r.settings?.wins || 0;
    const losses = r.settings?.losses || 0;
    const actualWinPct = wins + losses > 0 ? wins / (wins + losses) : 0;

    // Luck index: actual win% - expected win% (all-play)
    const luck = actualWinPct - apWinPct;

    // Max / min weekly score
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const minScore = scores.length ? Math.min(...scores) : 0;

    return {
      rosterId: r.roster_id,
      owner,
      wins,
      losses,
      ties: r.settings?.ties || 0,
      totalPF,
      avgPF: mean,
      apWins,
      apLosses,
      apWinPct,
      stdDev,
      luck,
      maxScore,
      minScore,
    };
  });

  // Composite power score (weighted)
  const maxPF = Math.max(...teamStats.map(t => t.totalPF)) || 1;
  const maxAP = Math.max(...teamStats.map(t => t.apWinPct)) || 1;
  const maxStdDev = Math.max(...teamStats.map(t => t.stdDev)) || 1;

  for (const t of teamStats) {
    const pfScore = t.totalPF / maxPF;
    const apScore = t.apWinPct;
    const consistencyScore = 1 - (t.stdDev / maxStdDev);
    t.powerScore = (pfScore * 0.35) + (apScore * 0.40) + (consistencyScore * 0.25);
  }

  teamStats.sort((a, b) => b.powerScore - a.powerScore);

  return { teamStats, weeksToFetch };
}

export async function render(container) {
  showLoading(container);

  try {
    const { teamStats, weeksToFetch } = await computeRankings();

    if (!weeksToFetch) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">Not enough data yet — check back after week 1</p>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <p class="text-xs text-gray-500 text-center">Based on ${weeksToFetch} week${weeksToFetch > 1 ? 's' : ''} of data · Score = 35% PF + 40% All-Play + 25% Consistency</p>

        <!-- Rankings Cards -->
        <div class="space-y-3">
          ${teamStats.map((t, i) => {
            const barWidth = Math.round(t.powerScore * 100);
            const luckIcon = t.luck > 0.05 ? '↑' : t.luck < -0.05 ? '↓' : '→';
            const luckColor = t.luck > 0.05 ? 'text-green-400' : t.luck < -0.05 ? 'text-red-400' : 'text-gray-400';

            return `
              <div class="bg-surface rounded-xl border border-gray-800 p-4">
                <div class="flex items-center gap-3 mb-3">
                  <span class="text-xl font-extrabold ${i < 3 ? 'text-emerald-400' : 'text-gray-500'}">${i + 1}</span>
                  ${t.owner.avatar
                    ? `<img src="${getAvatarUrl(t.owner.avatar)}" class="w-9 h-9 rounded-full object-cover" alt="">`
                    : `<div class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">${t.owner.name[0]}</div>`
                  }
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold truncate">${t.owner.name}</div>
                    <div class="text-xs text-gray-400">${formatRecord(t.wins, t.losses, t.ties)}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-emerald-400">${(t.powerScore * 100).toFixed(1)}</div>
                    <div class="text-xs text-gray-500">PWR</div>
                  </div>
                </div>

                <!-- Power bar -->
                <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
                  <div class="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style="width: ${barWidth}%"></div>
                </div>

                <!-- Stats grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div class="bg-gray-800/30 rounded-lg p-2">
                    <div class="text-xs text-gray-500 mb-0.5">Avg PF</div>
                    <div class="text-sm font-semibold">${t.avgPF.toFixed(1)}</div>
                  </div>
                  <div class="bg-gray-800/30 rounded-lg p-2">
                    <div class="text-xs text-gray-500 mb-0.5">All-Play</div>
                    <div class="text-sm font-semibold">${t.apWins}-${t.apLosses}</div>
                  </div>
                  <div class="bg-gray-800/30 rounded-lg p-2">
                    <div class="text-xs text-gray-500 mb-0.5">Consistency</div>
                    <div class="text-sm font-semibold">±${t.stdDev.toFixed(1)}</div>
                  </div>
                  <div class="bg-gray-800/30 rounded-lg p-2">
                    <div class="text-xs text-gray-500 mb-0.5">Luck</div>
                    <div class="text-sm font-semibold ${luckColor}">${luckIcon} ${(t.luck * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <!-- High/Low -->
                <div class="flex justify-between mt-2 text-xs text-gray-500">
                  <span>High: <span class="text-gray-300">${t.maxScore.toFixed(1)}</span></span>
                  <span>Low: <span class="text-gray-300">${t.minScore.toFixed(1)}</span></span>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
