import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = (param) => 'Player Details';

export async function render(container, playerId) {
  if (!playerId) {
    container.innerHTML = `<p class="text-center text-gray-500 py-8">No player selected</p>`;
    return;
  }

  showLoading(container);

  try {
    const [allPlayers, ownershipMap, rosterMap] = await Promise.all([
      Api.getPlayers(),
      Api.getPlayerOwnershipMap(),
      Api.getRosterMap(),
    ]);

    const player = allPlayers[playerId];
    if (!player) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">Player not found (ID: ${playerId})</p>`;
      return;
    }

    const pos = player.position || player.fantasy_positions?.[0] || '?';
    const rosterId = ownershipMap[playerId];
    const rosterOwner = rosterId ? rosterMap[rosterId]?.owner : null;
    const injury = player.injury_status;

    const injuryColors = {
      Out: 'bg-red-500/20 text-red-400 border-red-500/30',
      Doubtful: 'bg-red-500/20 text-red-300 border-red-500/30',
      Questionable: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      Probable: 'bg-green-500/20 text-green-400 border-green-500/30',
      'Injured Reserve': 'bg-red-500/20 text-red-400 border-red-500/30',
      IR: 'bg-red-500/20 text-red-400 border-red-500/30',
      PUP: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      Suspension: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    // Fetch news in background
    let newsArticles = [];
    try {
      const allNews = await Api.getNews();
      const playerName = `${player.first_name} ${player.last_name}`.toLowerCase();
      const lastName = (player.last_name || '').toLowerCase();
      newsArticles = allNews.filter(article => {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        return text.includes(playerName) || (lastName.length > 3 && text.includes(lastName));
      });
    } catch {}

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Back button -->
        <button onclick="history.back()" class="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>

        <!-- Player Header -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <div class="flex items-start gap-4">
            <img src="${getPlayerPhotoUrl(playerId)}" class="w-20 h-20 rounded-xl object-cover bg-gray-800" alt="${player.first_name} ${player.last_name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22><rect fill=%22%23374151%22 width=%2280%22 height=%2280%22/><text x=%2240%22 y=%2248%22 text-anchor=%22middle%22 fill=%22%239CA3AF%22 font-size=%2228%22>${(player.first_name || '?')[0]}</text></svg>'">
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-bold">${player.first_name} ${player.last_name}</h1>
              <div class="flex flex-wrap gap-2 mt-1">
                <span class="text-sm font-semibold ${positionColor(pos)}">${pos}</span>
                <span class="text-sm text-gray-400">${player.team || 'Free Agent'}</span>
                ${player.number ? `<span class="text-sm text-gray-500">#${player.number}</span>` : ''}
              </div>
              <div class="mt-2">
                ${rosterId
                  ? `<span class="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">Owned by ${rosterOwner?.name || `Team ${rosterId}`}</span>`
                  : `<span class="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400">Free Agent</span>`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Injury Status -->
        ${injury ? `
          <div class="bg-surface rounded-2xl border ${injuryColors[injury]?.split(' ').pop() || 'border-gray-800'} p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full ${(injuryColors[injury] || 'bg-gray-500/20 text-gray-400').split(' ').slice(0, 2).join(' ')} flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              </div>
              <div>
                <div class="text-sm font-semibold">${injury}</div>
                ${player.injury_start_date ? `<div class="text-xs text-gray-400">Since ${player.injury_start_date}</div>` : ''}
                ${player.practice_participation ? `<div class="text-xs text-gray-400">Practice: ${player.practice_participation}</div>` : ''}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Player Info -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <h2 class="font-semibold mb-3">Player Info</h2>
          <div class="grid grid-cols-2 gap-3">
            ${infoItem('Age', player.age)}
            ${infoItem('Experience', player.years_exp != null ? `${player.years_exp} yrs` : null)}
            ${infoItem('Height', player.height)}
            ${infoItem('Weight', player.weight ? `${player.weight} lbs` : null)}
            ${infoItem('College', player.college)}
            ${infoItem('Status', player.status)}
            ${infoItem('Depth Chart', player.depth_chart_position ? `${player.depth_chart_position} (${player.depth_chart_order || '?'})` : null)}
            ${infoItem('Team', player.team || 'None')}
          </div>
        </div>

        <!-- News -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <h2 class="font-semibold mb-3">Recent News</h2>
          ${newsArticles.length ? `
            <div class="space-y-3">
              ${newsArticles.slice(0, 10).map(article => `
                <a href="${article.link}" target="_blank" rel="noopener" class="block p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/60 transition-colors">
                  <div class="text-sm font-medium text-gray-200 line-clamp-2">${article.title}</div>
                  ${article.description ? `<div class="text-xs text-gray-400 mt-1 line-clamp-2">${article.description}</div>` : ''}
                  <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span class="font-medium">${article.source || 'News'}</span>
                    ${article.pubDate ? `<span>· ${new Date(article.pubDate).toLocaleDateString()}</span>` : ''}
                  </div>
                </a>
              `).join('')}
            </div>
          ` : `
            <p class="text-sm text-gray-500">No recent news found for this player. News is pulled from ESPN, CBS Sports, and other sources via RSS.</p>
          `}
        </div>
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}

function infoItem(label, value) {
  if (!value && value !== 0) return '';
  return `
    <div class="bg-gray-800/30 rounded-lg p-2.5">
      <div class="text-xs text-gray-500 mb-0.5">${label}</div>
      <div class="text-sm font-medium">${value}</div>
    </div>`;
}
