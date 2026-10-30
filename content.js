// ==========================================
// OUTLIER FILTER FUNCTIONALITY
// ==========================================

// Store current filter settings
let outlierFilterEnabled = false;
let outlierMinValue = 5;
let subFilterEnabled = false;
let subMinValue = 0;
let subMaxValue = Infinity;
let viewFilterEnabled = false;
let viewMinValue = 0;
let viewMaxValue = Infinity;

const SMALL_CHANNEL_OUTLIER_MIN = 10;
const SMALL_CHANNEL_SUB_MAX = 50000;
const SMALL_CHANNEL_HIGHLIGHT_ATTR = 'data-small-channel-outlier-highlight';

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
    'outlierFilterEnabled',
    'outlierMinValue',
    'subFilterEnabled',
    'subMinValue',
    'subMaxValue',
    'viewFilterEnabled',
    'viewMinValue',
    'viewMaxValue'
  ], (items) => {
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

function shouldHighlightSmallChannelOutlier(videoContainer) {
  const outlierValue = getOutlierValue(videoContainer);
  if (outlierValue === null || outlierValue <= SMALL_CHANNEL_OUTLIER_MIN) {
    return false;
  }

  const subCount = getSubscriberCount(videoContainer);
  if (subCount === null || subCount >= SMALL_CHANNEL_SUB_MAX) {
    return false;
  }

  return true;
}

function applySmallChannelOutlierHighlight(videoContainer) {
  if (shouldHighlightSmallChannelOutlier(videoContainer)) {
    videoContainer.setAttribute(SMALL_CHANNEL_HIGHLIGHT_ATTR, 'true');
  } else {
    videoContainer.removeAttribute(SMALL_CHANNEL_HIGHLIGHT_ATTR);
  }
}

function injectSmallChannelHighlightStyles() {
  if (document.getElementById('small-channel-outlier-highlight-style')) return;

  const style = document.createElement('style');
  style.id = 'small-channel-outlier-highlight-style';
  style.textContent = `
    [${SMALL_CHANNEL_HIGHLIGHT_ATTR}="true"] {
      background-color: #fee2e2 !important;
      border-radius: 8px;
      box-shadow: inset 0 0 0 1px #fecaca;
    }

    html[dark] [${SMALL_CHANNEL_HIGHLIGHT_ATTR}="true"],
    html[dark="true"] [${SMALL_CHANNEL_HIGHLIGHT_ATTR}="true"] {
      background-color: rgba(220, 38, 38, 0.2) !important;
      box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.45);
    }
  `;
  document.documentElement.appendChild(style);
}

// Apply the outlier filter to all videos on the page
function applyOutlierFilter() {
  // Only run on YouTube
  if (!window.location.hostname.includes('youtube.com')) return;
  
  // Find all video containers (works for homepage, search, channel pages, shorts shelf, etc.)
  const videoContainers = document.querySelectorAll(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer'
  );
  
  videoContainers.forEach(container => {
    // Skip if this is inside a dismissed/hidden parent
    if (container.closest('[hidden]')) return;

    applySmallChannelOutlierHighlight(container);
    addSaveButton(container);
    
    // Check if any filter is enabled
    const anyFilterEnabled = outlierFilterEnabled || subFilterEnabled || viewFilterEnabled;
    
    if (!anyFilterEnabled) {
      // All filters OFF - show all videos
      container.style.removeProperty('display');
      container.removeAttribute('data-filter-hidden');
    } else {
      let shouldHide = false;
      
      // Check outlier filter
      if (outlierFilterEnabled) {
        const outlierValue = getOutlierValue(container);
        if (outlierValue === null || outlierValue < outlierMinValue) {
          shouldHide = true;
        }
      }
      
      // Check subscriber filter (only if not already hidden)
      if (!shouldHide && subFilterEnabled) {
        const subCount = getSubscriberCount(container);
        // Only filter if we found subscriber data - don't hide videos without data
        if (subCount !== null) {
          if (subCount < subMinValue || subCount > subMaxValue) {
            // Outside the subscriber range
            shouldHide = true;
          }
        }
      }

      // Check views filter (only if not already hidden)
      if (!shouldHide && viewFilterEnabled) {
        const viewCount = getViewCount(container);
        // Only filter if we found views data - don't hide videos without data
        if (viewCount !== null) {
          if (viewCount < viewMinValue || viewCount > viewMaxValue) {
            shouldHide = true;
          }
        }
      }
      
      if (shouldHide) {
        container.style.setProperty('display', 'none', 'important');
        container.setAttribute('data-filter-hidden', 'true');
      } else {
        container.style.removeProperty('display');
        container.removeAttribute('data-filter-hidden');
      }
    }
  });
}

// Initialize outlier filter when on YouTube
function initOutlierFilter() {
  if (!window.location.hostname.includes('youtube.com')) return;

  injectSmallChannelHighlightStyles();
  injectSaveButtonStyles();
  
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
              node.matches('ytd-video-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer') ||
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
  
  // Start observing once body is available
  if (document.body) {
    filterObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      filterObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
  
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

// Start the outlier filter
initOutlierFilter();

// ==========================================
// SAVE TO CONTENT OS
// ==========================================

const VIDEO_CARD_SELECTOR = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-reel-item-renderer';

function normalizeVideoUrl(href) {
  if (!href) return null;
  try {
    const url = new URL(href, location.origin);
    const id = url.searchParams.get('v') || (url.pathname.match(/^\/shorts\/([^/?]+)/) || [])[1];
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch (e) {
    return null;
  }
}

function getCardVideoUrl(container) {
  const link = container.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]');
  return link ? normalizeVideoUrl(link.getAttribute('href')) : null;
}

function showToast(message, { isError = false, linkUrl = null } = {}) {
  document.getElementById('cos-toast')?.remove();
  const toast = document.createElement(linkUrl ? 'a' : 'div');
  toast.id = 'cos-toast';
  toast.textContent = message;
  if (linkUrl) {
    toast.href = linkUrl;
    toast.target = '_blank';
    toast.rel = 'noopener noreferrer';
  }
  if (isError) toast.dataset.error = 'true';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function saveInspiration(item) {
  return new Promise((resolve) => {
    if (!chrome.runtime?.id) {
      resolve({ ok: false, error: 'Extension was reloaded. Refresh this page and try again.' });
      return;
    }
    chrome.runtime.sendMessage({ action: 'save-inspiration', item }, (response) => {
      resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : response);
    });
  });
}

const SAVED_LABELS = { youtube_video: 'Video', youtube_title: 'Title', youtube_thumbnail: 'Thumbnail' };

async function saveAndNotify(item) {
  const result = await saveInspiration(item);
  if (result.ok) showToast(`${SAVED_LABELS[item.kind]} saved to Content OS`, { linkUrl: result.inspirationUrl });
  else showToast(result.error || 'Could not save to Content OS', { isError: true });
  return result.ok;
}

function addSaveButton(container) {
  // Cards nest (yt-lockup-view-model inside ytd-rich-item-renderer), so only the outermost gets a button
  if (container.hasAttribute('data-cos-card') || container.querySelector('[data-cos-card]') || container.parentElement?.closest('[data-cos-card]')) return;
  if (!getCardVideoUrl(container)) return;

  container.setAttribute('data-cos-card', 'true');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cos-save-btn';
  button.textContent = 'Save';
  button.title = 'Save to Content OS inspiration';
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const videoUrl = getCardVideoUrl(container);
    if (!videoUrl) return;
    button.disabled = true;
    button.textContent = 'Saving…';
    const outlier = getOutlierValue(container);
    const ok = await saveAndNotify({ kind: 'youtube_video', url: videoUrl, ...(outlier !== null && { outlier_multiple: outlier }) });
    button.textContent = ok ? 'Saved' : 'Save';
    button.disabled = false;
  });
  container.appendChild(button);
}

function injectSaveButtonStyles() {
  if (document.getElementById('cos-save-style')) return;
  const style = document.createElement('style');
  style.id = 'cos-save-style';
  style.textContent = `
    [data-cos-card] { position: relative; }
    .cos-save-btn {
      position: absolute; top: 8px; left: 8px; z-index: 10;
      padding: 4px 10px; border: none; border-radius: 6px;
      background: rgba(17, 24, 39, 0.85); color: #fff;
      font: 500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer; opacity: 0; transition: opacity 120ms ease-in-out;
    }
    [data-cos-card]:hover .cos-save-btn, .cos-save-btn:focus-visible { opacity: 1; }
    .cos-save-btn:hover { background: #111827; }
    .cos-save-btn:disabled { cursor: default; }
    #cos-toast {
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      max-width: 320px; padding: 12px 16px; border-radius: 8px;
      background: #111827; color: #fff; text-decoration: none;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    a#cos-toast:hover { text-decoration: underline; }
    #cos-toast[data-error] { background: #991b1b; }
  `;
  document.documentElement.appendChild(style);
}

// Right-click menu: remember which video was under the cursor
let lastContextVideoUrl = null;
document.addEventListener('contextmenu', (e) => {
  const card = e.target.closest?.(VIDEO_CARD_SELECTOR);
  lastContextVideoUrl = (card && getCardVideoUrl(card)) || normalizeVideoUrl(location.href);
}, true);

async function fetchTitle(videoUrl) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`);
  if (!res.ok) throw new Error('Could not find that video');
  return (await res.json()).title;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action !== 'context-save') return;
  const videoUrl = normalizeVideoUrl(message.linkUrl) || lastContextVideoUrl;
  if (!videoUrl) {
    showToast('Right-click a video to save it', { isError: true });
    return;
  }
  if (message.kind === 'youtube_thumbnail') {
    saveAndNotify({ kind: 'youtube_thumbnail', url: videoUrl });
    return;
  }
  fetchTitle(videoUrl)
    .then((title) => saveAndNotify({ kind: 'youtube_title', url: videoUrl, title }))
    .catch((e) => showToast(e.message, { isError: true }));
});
