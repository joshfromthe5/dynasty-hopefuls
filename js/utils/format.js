export function formatRecord(wins, losses, ties) {
  if (ties > 0) return `${wins}-${losses}-${ties}`;
  return `${wins}-${losses}`;
}

export function formatPoints(pts, decimal = 0) {
  const total = pts + (decimal || 0) / 100;
  return total.toFixed(2);
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function positionColor(pos) {
  const colors = {
    QB: 'text-red-400',
    RB: 'text-green-400',
    WR: 'text-blue-400',
    TE: 'text-yellow-400',
    K: 'text-purple-400',
    DEF: 'text-orange-400',
    DL: 'text-orange-300',
    LB: 'text-teal-400',
    DB: 'text-cyan-400',
  };
  return colors[pos] || 'text-gray-400';
}

export function getAvatarUrl(avatarId, thumb = true) {
  if (!avatarId) return null;
  return thumb
    ? `https://sleepercdn.com/avatars/thumbs/${avatarId}`
    : `https://sleepercdn.com/avatars/${avatarId}`;
}

export function getPlayerPhotoUrl(playerId) {
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}
