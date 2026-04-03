export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'onclick' || key === 'oninput') {
      element[key] = value;
    } else if (key === 'innerHTML') {
      element.innerHTML = value;
    } else if (key === 'textContent') {
      element.textContent = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  return element;
}

export function setContent(container, ...nodes) {
  container.innerHTML = '';
  for (const node of nodes) {
    if (typeof node === 'string') {
      container.innerHTML += node;
    } else if (node instanceof Node) {
      container.appendChild(node);
    }
  }
}

export function showLoading(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-600 border-t-emerald-400"></div>
    </div>`;
}

export function showError(container, message) {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-gray-400">
      <svg class="w-12 h-12 mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>
      <p class="text-lg font-medium text-red-400">Something went wrong</p>
      <p class="mt-1 text-sm">${message}</p>
    </div>`;
}

export function playerLink(playerId, name, extraClasses = '') {
  const a = el('a', {
    href: `#player/${playerId}`,
    className: `text-emerald-400 hover:text-emerald-300 hover:underline transition-colors ${extraClasses}`.trim(),
    textContent: name,
  });
  return a;
}

export function scoreGauge(score, size = 48) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  // Red (0) -> Yellow (50) -> Green (100)
  let r, g;
  if (clamped <= 50) {
    r = 239;
    g = Math.round(68 + (clamped / 50) * (180 - 68));
  } else {
    r = Math.round(239 - ((clamped - 50) / 50) * (239 - 34));
    g = Math.round(180 + ((clamped - 50) / 50) * (197 - 180));
  }
  const color = `rgb(${r}, ${g}, 68)`;

  const fontSize = size <= 36 ? 11 : size <= 48 ? 13 : 16;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="shrink-0">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#1f2937" stroke-width="3"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="3"
      stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${size / 2} ${size / 2})" style="transition: stroke-dashoffset 0.6s ease"/>
    <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central"
      fill="${color}" font-size="${fontSize}" font-weight="700">${clamped}</text>
  </svg>`;
}

export function injuryBadge(status) {
  if (!status) return null;
  const colors = {
    Out: 'bg-red-500/20 text-red-400',
    Doubtful: 'bg-red-500/20 text-red-300',
    Questionable: 'bg-yellow-500/20 text-yellow-400',
    Probable: 'bg-green-500/20 text-green-400',
    'Injured Reserve': 'bg-red-500/20 text-red-400',
    IR: 'bg-red-500/20 text-red-400',
    PUP: 'bg-orange-500/20 text-orange-400',
    Suspension: 'bg-gray-500/20 text-gray-400',
  };
  const colorClass = colors[status] || 'bg-gray-500/20 text-gray-400';
  return el('span', {
    className: `text-xs font-semibold px-1.5 py-0.5 rounded ${colorClass}`,
    textContent: status,
  });
}
