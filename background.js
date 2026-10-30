const DEFAULT_BASE_URL = 'https://the-content-os.com';

const MENUS = [
  { id: 'save-title', title: 'Save title to Content OS', kind: 'youtube_title' },
  { id: 'save-thumbnail', title: 'Save thumbnail to Content OS', kind: 'youtube_thumbnail' }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const menu of MENUS) {
      chrome.contextMenus.create({
        id: menu.id,
        title: menu.title,
        contexts: ['link', 'image', 'page', 'video'],
        documentUrlPatterns: ['https://www.youtube.com/*']
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menu = MENUS.find((m) => m.id === info.menuItemId);
  if (menu && tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'context-save', kind: menu.kind, linkUrl: info.linkUrl || null });
});

async function saveInspiration(item) {
  const { contentOsBaseUrl, contentOsApiKey } = await chrome.storage.local.get(['contentOsBaseUrl', 'contentOsApiKey']);
  if (!contentOsApiKey) throw new Error('Add your Content OS API key in the extension Options.');
  const baseUrl = (contentOsBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

  const res = await fetch(`${baseUrl}/api/inspiration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${contentOsApiKey}` },
    body: JSON.stringify(item)
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Content OS rejected the API key. Check it in Options.');
  if (!res.ok) throw new Error(data.error || `Content OS error (${res.status})`);
  return { item: data.item, inspirationUrl: `${baseUrl}/inspiration` };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== 'save-inspiration') return;
  saveInspiration(message.item)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true;
});
