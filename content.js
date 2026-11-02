// ==========================================
// OUTLIER FILTER FUNCTIONALITY
// ==========================================

// Store current filter settings
let filterMode = 'highlight';
let outlierFilterEnabled = false;
let outlierMinValue = 5;
let subFilterEnabled = false;
let subMinValue = 0;
let subMaxValue = Infinity;
let viewFilterEnabled = false;
let viewMinValue = 0;
let viewMaxValue = Infinity;

const VIDEO_SELECTOR = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer';
const HIGHLIGHT_ATTR = 'data-outlier-highlight';

// Parse subscriber count strings like "2.13M", "500K", "1.5B", "50000"
function parseSubscriberCount(text) {
  if (!text) return null;
  
  const cleaned = text
    .trim()
    .toUpperCase()
    .replace(/SUBSCRIBERS?/g, '')
    .replace(/\+/g, '')
    .replace(/,/g, '')
    .trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/);
  
  if (!match) return null;
  
  let value = parseFloat(match[1]);
  const suffix = match[2];
  
  if (suffix === 'K') {
    value *= 1000;
  } else if (suffix === 'M') {
    value *= 1000000;
  } else if (suffix === 'B') {
    value *= 1000000000;
  }
  
  return value;
}

function parseOutlierText(text) {
  if (!text) return null;

  const cleaned = text.trim();
  const match = cleaned.match(/(>?)\s*(\d+(?:\.\d+)?)\s*x\b/i);
  if (!match) return null;

  const value = parseFloat(match[2]);
  if (Number.isNaN(value)) return null;

  // Treat ">100x" as "strictly above 100"
  return match[1] === '>' ? value + 1 : value;
}

function parseViewCount(text) {
  if (!text) return null;

  const cleaned = text
    .trim()
    .toUpperCase()
    .replace(/VIEWS?/g, '')
    .replace(/\+/g, '')
    .replace(/,/g, '')
    .trim();

  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/);
  if (!match) return null;

  let value = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix === 'K') {
    value *= 1000;
  } else if (suffix === 'M') {
    value *= 1000000;
  } else if (suffix === 'B') {
    value *= 1000000000;
  }

  return value;
}

// Load filter settings from storage
function loadFilterSettings() {
  chrome.storage.sync.get([
    'filterMode',
    'outlierFilterEnabled',
    'outlierMinValue',
    'subFilterEnabled',
    'subMinValue',
    'subMaxValue',
    'viewFilterEnabled',
    'viewMinValue',
    'viewMaxValue'
  ], (items) => {
    filterMode = items.filterMode || 'highlight';
    outlierFilterEnabled = items.outlierFilterEnabled || false;
    outlierMinValue = items.outlierMinValue || 5;
    subFilterEnabled = items.subFilterEnabled || false;
    subMinValue = parseSubscriberCount(items.subMinValue || '0') || 0;
    subMaxValue = items.subMaxValue ? (parseSubscriberCount(items.subMaxValue) || Infinity) : Infinity;
    viewFilterEnabled = items.viewFilterEnabled || false;
    viewMinValue = parseViewCount(items.viewMinValue || '0') || 0;
    viewMaxValue = items.viewMaxValue ? (parseViewCount(items.viewMaxValue) || Infinity) : Infinity;
    applyOutlierFilter();
  });
}

// Listen for changes to filter settings
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.filterMode !== undefined) {
      filterMode = changes.filterMode.newValue || 'highlight';
    }
    if (changes.outlierFilterEnabled !== undefined) {
      outlierFilterEnabled = changes.outlierFilterEnabled.newValue || false;
    }
    if (changes.outlierMinValue !== undefined) {
      outlierMinValue = changes.outlierMinValue.newValue || 5;
    }
    if (changes.subFilterEnabled !== undefined) {
      subFilterEnabled = changes.subFilterEnabled.newValue || false;
    }
    if (changes.subMinValue !== undefined) {
      subMinValue = parseSubscriberCount(changes.subMinValue.newValue || '0') || 0;
    }
    if (changes.subMaxValue !== undefined) {
      subMaxValue = changes.subMaxValue.newValue ? (parseSubscriberCount(changes.subMaxValue.newValue) || Infinity) : Infinity;
    }
    if (changes.viewFilterEnabled !== undefined) {
      viewFilterEnabled = changes.viewFilterEnabled.newValue || false;
    }
    if (changes.viewMinValue !== undefined) {
      viewMinValue = parseViewCount(changes.viewMinValue.newValue || '0') || 0;
    }
    if (changes.viewMaxValue !== undefined) {
      viewMaxValue = changes.viewMaxValue.newValue ? (parseViewCount(changes.viewMaxValue.newValue) || Infinity) : Infinity;
    }
    applyOutlierFilter();
  }
});

// Get outlier value from a video container
function getOutlierValue(videoContainer) {
  const selectors = [
    '[data-react-popover="OutlierPopover"] p',
    '[data-react-popover="OutlierPopover"]',
    '[href*="outliers"][href*="outlier_score"] p',
    '[href*="outliers"][href*="outlier_score"]',
    '.inline-video-stats [data-react-popover*="Outlier"] p'
  ];

  for (const selector of selectors) {
    const nodes = videoContainer.querySelectorAll(selector);
    for (const node of nodes) {
      const value = parseOutlierText(node.textContent);
      if (value !== null) return value;
    }
  }

  // Fallback: search all inline stats text for a value like "1.1x" or ">100x"
  const inlineStats = videoContainer.querySelector('.inline-video-stats');
  if (inlineStats) {
    const value = parseOutlierText(inlineStats.textContent);
    if (value !== null) return value;
  }

  return null;
}

// Get subscriber count from a video container
function getSubscriberCount(videoContainer) {
  // Method 1: Use popover wrapper, then scan text nodes inside it.
  const popover = videoContainer.querySelector('[data-react-popover="SubscriberPopover"]');
  if (popover) {
    const candidates = popover.querySelectorAll('p, span, div');
    for (const candidate of candidates) {
      const parsed = parseSubscriberCount(candidate.textContent);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  // Method 2: Find the visual badge and scan likely text elements.
  const subDiv = videoContainer.querySelector('[class*="bg-subscriber-count"]');
  if (subDiv) {
    const candidates = subDiv.querySelectorAll('p, span, div');
    for (const candidate of candidates) {
      const parsed = parseSubscriberCount(candidate.textContent);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  
  // Method 3: Find any subscriber-count class and parse descendants.
  const allSubElements = videoContainer.querySelectorAll('[class*="subscriber-count"]');
  for (const el of allSubElements) {
    const candidates = el.querySelectorAll('p, span, div');
    for (const candidate of candidates) {
      const parsed = parseSubscriberCount(candidate.textContent);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  
  return null;
}

function getViewCount(videoContainer) {
  const row = videoContainer.querySelector('.ytContentMetadataViewModelMetadataRow');
  if (row) {
    const parts = row.querySelectorAll('span, a');
    for (const part of parts) {
      const parsed = parseViewCount(part.textContent);
      if (parsed !== null) return parsed;
    }
  }

  const metadataNodes = videoContainer.querySelectorAll(
    '.ytContentMetadataViewModelMetadataText, #metadata-line span, span, a'
  );
  for (const node of metadataNodes) {
    const parsed = parseViewCount(node.textContent);
    if (parsed !== null) return parsed;
  }

  return null;
}

// Videos without data for the subscriber or views filter are treated as matching.
function matchesFilters(container) {
  if (outlierFilterEnabled) {
    const outlierValue = getOutlierValue(container);
    if (outlierValue === null || outlierValue < outlierMinValue) return false;
  }

  if (subFilterEnabled) {
    const subCount = getSubscriberCount(container);
    if (subCount !== null && (subCount < subMinValue || subCount > subMaxValue)) return false;
  }

  if (viewFilterEnabled) {
    const viewCount = getViewCount(container);
    if (viewCount !== null && (viewCount < viewMinValue || viewCount > viewMaxValue)) return false;
  }

  return true;
}

function setHidden(container, hidden) {
  if (hidden) {
    container.style.setProperty('display', 'none', 'important');
    container.setAttribute('data-filter-hidden', 'true');
  } else {
    container.style.removeProperty('display');
    container.removeAttribute('data-filter-hidden');
  }
}

// Apply the filter to all videos on the page
function applyOutlierFilter() {
  if (!window.location.hostname.includes('youtube.com')) return;

  const anyFilterEnabled = outlierFilterEnabled || subFilterEnabled || viewFilterEnabled;

  document.querySelectorAll(VIDEO_SELECTOR).forEach(container => {
    if (container.closest('[hidden]')) return;

    const matches = anyFilterEnabled && matchesFilters(container);
    setHidden(container, anyFilterEnabled && filterMode === 'hide' && !matches);
    if (matches && filterMode === 'highlight') {
      container.setAttribute(HIGHLIGHT_ATTR, 'true');
    } else {
      container.removeAttribute(HIGHLIGHT_ATTR);
    }
  });
}

function injectStyles() {
  if (document.getElementById('outlier-finder-style')) return;

  const style = document.createElement('style');
  style.id = 'outlier-finder-style';
  style.textContent = `
    [${HIGHLIGHT_ATTR}="true"] {
      background-color: #fee2e2 !important;
      border-radius: 8px;
      box-shadow: inset 0 0 0 1px #fecaca;
    }

    html[dark] [${HIGHLIGHT_ATTR}="true"],
    html[dark="true"] [${HIGHLIGHT_ATTR}="true"] {
      background-color: rgba(220, 38, 38, 0.2) !important;
      box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.45);
    }

    .cos-actions {
      display: flex;
      gap: 6px;
    }
    /* One floating pair on <body>, so it sits above YouTube's hover preview and Instagram's overlays. */
    .cos-actions.cos-floating {
      position: fixed;
      z-index: 2147483646;
    }
    .cos-actions button {
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      font: 600 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #fff;
      background: rgba(17, 24, 39, 0.88);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .cos-actions button:hover { background: #111827; }
    .cos-actions button.cos-idea { background: rgba(220, 38, 38, 0.92); }
    .cos-actions button.cos-idea:hover { background: #dc2626; }
    .cos-actions button:disabled { opacity: 0.6; cursor: default; }
    .cos-actions:not(.cos-side) .cos-icon,
    .cos-actions:not(.cos-side) .cos-short,
    .cos-actions.cos-side .cos-label { display: none; }

    /* Reels: round buttons in a column, styled like Instagram's own side actions. */
    .cos-actions.cos-side {
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .cos-actions.cos-side button,
    .cos-actions.cos-side button:hover {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 0;
      background: none;
      box-shadow: none;
      font-size: 12px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }
    .cos-side .cos-icon {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(38, 38, 38, 0.92);
      box-shadow: 0 2px 10px rgba(0,0,0,0.35);
      transition: transform 120ms ease, filter 120ms ease;
    }
    .cos-side .cos-idea .cos-icon { background: #dc2626; }
    .cos-side button:hover .cos-icon { transform: scale(1.06); filter: brightness(1.15); }
  `;
  document.documentElement.appendChild(style);
}

// Initialize outlier filter when on YouTube
function initOutlierFilter() {
  if (!window.location.hostname.includes('youtube.com')) return;

  // Load initial settings
  loadFilterSettings();

  // Watch for new videos being added to the page (infinite scroll)
  const filterObserver = new MutationObserver((mutations) => {
    // Check if any VidIQ elements were added
    let hasVidiqChanges = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            // Check if this is a video container or contains vidiq elements
            if (node.matches && (
              node.matches(VIDEO_SELECTOR) ||
              node.querySelector && (
                node.querySelector('[data-react-popover="OutlierPopover"]') ||
                node.querySelector('[data-react-popover="SubscriberPopover"]')
              )
            )) {
              hasVidiqChanges = true;
              break;
            }
            // Also check for vidiq class names
            if (node.className && typeof node.className === 'string' && node.className.includes('vidiq')) {
              hasVidiqChanges = true;
              break;
            }
          }
        }
      }
      if (hasVidiqChanges) break;
    }

    if (filterObserver.filterTimeout) {
      clearTimeout(filterObserver.filterTimeout);
    }
    // Use shorter timeout if vidiq changes detected, longer for general mutations
    const delay = hasVidiqChanges ? 100 : 300;
    filterObserver.filterTimeout = setTimeout(() => {
      applyOutlierFilter();
    }, delay);
  });

  onBody(() => filterObserver.observe(document.body, { childList: true, subtree: true }));

  // Also apply filter on navigation (YouTube is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Apply filter multiple times after navigation to catch VidIQ loading its data
      setTimeout(applyOutlierFilter, 300);
      setTimeout(applyOutlierFilter, 600);
      setTimeout(applyOutlierFilter, 1000);
      setTimeout(applyOutlierFilter, 1500);
      setTimeout(applyOutlierFilter, 2500);
      setTimeout(applyOutlierFilter, 4000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Apply filter periodically to catch any missed updates (every 2 seconds for first 10 seconds)
  let periodicCount = 0;
  const periodicInterval = setInterval(() => {
    applyOutlierFilter();
    periodicCount++;
    if (periodicCount >= 5) {
      clearInterval(periodicInterval);
    }
  }, 2000);
}

function onBody(fn) {
  if (document.body) fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

// ==========================================
// SAVE TO CONTENT OS (Add idea / Save inspo)
// ==========================================

function showToast(message, isError = false) {
  const existing = document.getElementById('cos-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'cos-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: ${isError ? '#991b1b' : '#111827'} !important;
    color: #fff !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 14px rgba(0,0,0,0.3) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    font-size: 13px !important;
    z-index: 2147483647 !important;
    max-width: 360px !important;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function saveToContentOS(type, getData, button) {
  const data = getData();
  if (!data.url) {
    showToast("Couldn't find this video's link.", true);
    return;
  }
  if (!chrome.runtime?.id) {
    showToast('The extension was updated. Refresh this page and try again.', true);
    return;
  }

  button.disabled = true;
  setLabel(button, 'Saving...');
  chrome.runtime.sendMessage({ action: 'save', type, ...data }, (response) => {
    button.disabled = false;
    if (chrome.runtime.lastError || !response) {
      resetLabel(button);
      showToast('The extension was updated. Refresh this page and try again.', true);
    } else if (response.ok) {
      setLabel(button, 'Saved');
      showToast(type === 'idea' ? 'Added to your Ideas board.' : 'Saved to your Inspiration.');
    } else {
      resetLabel(button);
      showToast(response.error, true);
    }
  });
}

const ICONS = {
  idea: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  inspo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>'
};

// The pill buttons show the long label; the round Reels buttons show the short one.
function setLabel(button, text, short = text) {
  button.querySelector('.cos-label').textContent = text;
  button.querySelector('.cos-short').textContent = short;
}

function resetLabel(button) {
  setLabel(button, button.dataset.label, button.dataset.short);
}

function createActions(getData) {
  const actions = document.createElement('div');
  actions.className = 'cos-actions';
  for (const [type, label, short] of [['idea', '+ Idea', 'Idea'], ['inspo', 'Save inspo', 'Inspo']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cos-${type}`;
    button.innerHTML = `<span class="cos-icon">${ICONS[type]}</span><span class="cos-label"></span><span class="cos-short"></span>`;
    button.dataset.label = label;
    button.dataset.short = short;
    resetLabel(button);
    button.title = type === 'idea' ? 'Add to the Ideas column of your content board' : 'Save the title and thumbnail to your Inspiration';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveToContentOS(type, getData, button);
    });
    actions.appendChild(button);
  }
  return actions;
}

// One floating pair of buttons follows whatever find() matches under the mouse,
// pinned to the top-left of its anchor (the thumbnail or post media).
function initHoverActions(find) {
  let current = null;
  const floating = createActions(() => current?.getData() || { url: '' });
  floating.classList.add('cos-floating');

  let hideTimer;

  const place = () => {
    const rect = current.anchor.getBoundingClientRect();
    floating.classList.toggle('cos-side', Boolean(current.side));
    if (!current.side) {
      floating.style.top = `${rect.top + 8}px`;
      floating.style.left = `${rect.left + 8}px`;
      return;
    }
    // To the right of the media, centred over vidIQ's panel when it's there.
    const vidiq = findVidiqPanel(rect);
    const centre = vidiq ? vidiq.centre : rect.right + 48;
    floating.style.left = `${centre - floating.offsetWidth / 2}px`;
    floating.style.top = vidiq
      ? `${Math.max(rect.top + 8, vidiq.top - floating.offsetHeight - 24)}px`
      : `${rect.top + 8}px`;
  };

  const update = (found) => {
    if (!found) {
      // A short delay lets the mouse cross the gap to side-placed buttons.
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        current = null;
        floating.remove();
      }, current?.side ? 400 : 0);
      return;
    }
    clearTimeout(hideTimer);
    if (found.key !== current?.key) {
      floating.querySelectorAll('button').forEach(resetLabel);
    }
    current = found;
    if (!floating.isConnected) document.body.appendChild(floating);
    place();
  };

  document.addEventListener('mouseover', (e) => {
    if (!(e.target instanceof Element) || e.target.closest('.cos-floating, #video-preview')) {
      clearTimeout(hideTimer);
      return;
    }
    update(find(e.target, e.clientX, e.clientY));
  }, true);

  window.addEventListener('scroll', () => { if (current) place(); }, true);
  return update;
}

// YouTube: the hover preview player is drawn over the card, so the buttons can't live inside it.
function initYouTubeActions() {
  if (!window.location.hostname.includes('youtube.com')) return;

  initHoverActions((target) => {
    let card = target.closest(VIDEO_SELECTOR);
    while (card?.parentElement?.closest(VIDEO_SELECTOR)) card = card.parentElement.closest(VIDEO_SELECTOR);
    if (!card) return null;
    return {
      key: card,
      anchor: card.querySelector('#thumbnail, ytd-thumbnail, yt-thumbnail-view-model, a[href*="/watch?v="], a[href*="/shorts/"]') || card,
      getData: () => {
        const link = card.querySelector('a#thumbnail[href], a[href*="/watch?v="], a[href*="/shorts/"]');
        const titleEl = card.querySelector('#video-title, h3 [title], h3');
        return {
          url: link ? new URL(link.getAttribute('href'), location.origin).href : '',
          title: (titleEl?.getAttribute('title') || titleEl?.textContent || '').trim(),
          outlier: getOutlierValue(card)
        };
      }
    };
  });
}

// Instagram: hover a grid tile, or a post's photo or video in the feed or on a post page.
const IG_POST_PATH = /^\/(?:[^/]+\/)?(p|reels?)\/[^/]+/;
const IG_POST_LINK = 'a[href*="/p/"], a[href*="/reel/"]';

function instagramCaption() {
  const match = document.title.match(/on Instagram: "([\s\S]+?)"\s*$/);
  return match ? match[1].trim().slice(0, 120) : '';
}

function postPath(href) {
  return href?.match(/\/(p|reel)\/[^/?#]+/)?.[0] || null;
}

// The post a piece of media belongs to: the one post link in its nearest container,
// or the page itself on a post or reel page.
function instagramPostUrl(media) {
  for (let el = media; el && el !== document.body; el = el.parentElement) {
    const paths = new Set([...el.querySelectorAll(IG_POST_LINK)].map((a) => postPath(a.getAttribute('href'))).filter(Boolean));
    if (paths.size === 1) return `${location.origin}${[...paths][0]}/`;
    if (paths.size > 1) break;
  }
  return IG_POST_PATH.test(location.pathname) ? location.origin + location.pathname : '';
}

// vidIQ's panel beside a reel: its top edge, and the centre of its biggest element
// (the pill, not the small "IQ" badge on its corner).
function findVidiqPanel(mediaRect) {
  let top = Infinity;
  let biggest = null;
  for (const el of document.querySelectorAll('[class*="vidiq" i], [id*="vidiq" i]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.left < mediaRect.right - 20 || r.left > mediaRect.right + 200) continue;
    if (r.bottom < mediaRect.top || r.top > mediaRect.bottom) continue;
    top = Math.min(top, r.top);
    if (!biggest || r.width * r.height > biggest.width * biggest.height) biggest = r;
  }
  return biggest && { top, centre: biggest.left + biggest.width / 2 };
}

function findInstagramMedia(target, x, y) {
  let el = target;
  for (let depth = 0; el && el !== document.body && depth < 6; depth++, el = el.parentElement) {
    const candidates = el.matches('img, video') ? [el] : el.querySelectorAll('video, img');
    for (const media of candidates) {
      const rect = media.getBoundingClientRect();
      const underMouse = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (underMouse && rect.width >= 150 && rect.height >= 150) return media;
    }
  }
  return null;
}

function initInstagram() {
  if (!window.location.hostname.includes('instagram.com')) return;

  // On the Reels page the buttons stay beside whichever reel is in view, no hover needed.
  const reelInView = () => {
    if (!location.pathname.startsWith('/reels/')) return null;
    const x = innerWidth / 2;
    const y = innerHeight / 2;
    const video = [...document.querySelectorAll('video')].find((v) => {
      const r = v.getBoundingClientRect();
      return r.top <= y && r.bottom >= y && r.width >= 150;
    }) || null;
    return video && {
      key: video,
      anchor: video,
      side: true,
      getData: () => ({ url: location.origin + location.pathname, title: instagramCaption() })
    };
  };

  const update = initHoverActions((target, x, y) => {
    if (location.pathname.startsWith('/reels/')) return reelInView();

    const tile = target.closest(IG_POST_LINK);
    if (tile && postPath(tile.getAttribute('href'))) {
      return {
        key: tile,
        anchor: tile,
        getData: () => ({ url: `${location.origin}${postPath(tile.getAttribute('href'))}/`, title: '' })
      };
    }

    const media = findInstagramMedia(target, x, y);
    const url = media && instagramPostUrl(media);
    if (!url) return null;
    return {
      key: media,
      anchor: media,
      getData: () => ({ url, title: url.startsWith(location.origin + location.pathname) ? instagramCaption() : '' })
    };
  });

  // ponytail: polls twice a second; Reels swaps videos without events we can rely on.
  let wasOnReels = false;
  setInterval(() => {
    const onReels = location.pathname.startsWith('/reels/');
    if (onReels || wasOnReels) update(reelInView());
    wasOnReels = onReels;
  }, 500);
}

injectStyles();
initOutlierFilter();
initYouTubeActions();
initInstagram();
