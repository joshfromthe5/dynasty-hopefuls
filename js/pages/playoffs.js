import { Api } from '../api.js';
import { getAvatarUrl } from '../utils/format.js';
import { showError } from '../utils/dom.js';

export const title = 'Playoffs';

export async function render(container) {
  try {
    const [winners, losers, rosterMap] = await Promise.all([
      Api.getWinnersBracket(),
      Api.getLosersBracket(),
      Api.getRosterMap(),
    ]);

    function teamName(rosterId) {
      if (!rosterId) return 'TBD';
      return rosterMap[rosterId]?.owner?.name || `Team ${rosterId}`;
    }

    function teamAvatar(rosterId) {
      if (!rosterId) return '';
      const avatar = rosterMap[rosterId]?.owner?.avatar;
      if (avatar) return `<img src="${getAvatarUrl(avatar)}" class="w-6 h-6 rounded-full object-cover shrink-0" alt="">`;
      const name = teamName(rosterId);
      return `<div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold shrink-0">${name[0]}</div>`;
    }

    function resolveTeam(match, field, fromField, bracket) {
      if (match[field]) return match[field];
      const from = match[fromField];
      if (!from) return null;
      const sourceMatch = bracket.find(m => m.m === (from.w != null ? from.w : from.l));
      if (!sourceMatch) return null;
      return from.w != null ? sourceMatch.w : sourceMatch.l;
    }

    function renderBracket(bracket, label) {
      if (!bracket?.length) return '';

      const maxRound = Math.max(...bracket.map(m => m.r));
      const rounds = [];
      for (let r = 1; r <= maxRound; r++) {
        rounds.push(bracket.filter(m => m.r === r).sort((a, b) => a.m - b.m));
      }

      const roundLabels = maxRound === 3
        ? ['Quarterfinals', 'Semifinals', 'Finals']
        : maxRound === 2
        ? ['Semifinals', 'Finals']
        : rounds.map((_, i) => `Round ${i + 1}`);

      return `
        <div class="mb-8">
          <h2 class="text-lg font-bold mb-4">${label}</h2>
          <div class="overflow-x-auto no-scrollbar">
            <div class="flex gap-6 min-w-max">
              ${rounds.map((roundMatches, ri) => `
                <div class="space-y-3 min-w-[200px]">
                  <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${roundLabels[ri]}</div>
                  ${roundMatches.map(match => {
                    const t1 = resolveTeam(match, 't1', 't1_from', bracket);
                    const t2 = resolveTeam(match, 't2', 't2_from', bracket);
                    const winnerId = match.w;
                    const placement = match.p ? `<span class="text-xs text-gray-500">${ordinalPlace(match.p)}</span>` : '';

                    return `
                      <div class="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                        ${placement ? `<div class="px-3 py-1 border-b border-gray-800/50 text-center">${placement}</div>` : ''}
                        <div class="divide-y divide-gray-800/50">
                          ${renderMatchTeam(t1, winnerId)}
                          ${renderMatchTeam(t2, winnerId)}
                        </div>
                      </div>`;
                  }).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>`;
    }

    function renderMatchTeam(rosterId, winnerId) {
      const isWinner = rosterId && winnerId && rosterId === winnerId;
      const name = teamName(rosterId);
      return `
        <div class="flex items-center gap-2 px-3 py-2 ${isWinner ? 'bg-emerald-500/10' : ''} ${!rosterId ? 'opacity-40' : ''}">
          ${teamAvatar(rosterId)}
          <span class="text-sm font-medium truncate flex-1 ${isWinner ? 'text-emerald-400' : 'text-gray-300'}">${name}</span>
          ${isWinner ? '<svg class="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
        </div>`;
    }

    function ordinalPlace(n) {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]) + ' place';
    }

    container.innerHTML = `
      <div class="space-y-6">
        ${renderBracket(winners, 'Winners Bracket')}
        ${renderBracket(losers, 'Consolation Bracket')}
      </div>`;

  } catch (err) {
    showError(container, err.message);
  }
}
