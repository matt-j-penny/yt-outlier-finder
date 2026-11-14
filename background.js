// Content scripts can't call Content OS directly (CORS), so saves go through here.
const CONTENT_OS = 'https://the-content-os.com';

async function youtubeTitle(url) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  return res.ok ? (await res.json()).title : '';
}

async function apiKey() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('Add your Content OS API key in the extension settings first.');
  return apiKey;
}

async function folders() {
  const res = await fetch(`${CONTENT_OS}/api/inspiration/folders`, { headers: { Authorization: `Bearer ${await apiKey()}` } });
  if (res.status === 401) throw new Error('Content OS rejected your API key. Check it in the extension settings.');
  if (!res.ok) throw new Error(`Could not load folders (${res.status})`);
  return (await res.json()).folders;
}

async function save({ type, url, title, outlier, folderId }) {
  const key = await apiKey();

  const instagram = url.includes('instagram.com');
  const short = instagram || url.includes('/shorts/');
  const [path, body] = type === 'inspo'
    ? ['inspiration', {
        kind: instagram ? 'instagram_post' : 'youtube_video',
        url,
        ...(outlier ? { outlier_multiple: outlier } : {}),
        ...(folderId ? { folder_id: folderId } : {})
      }]
    : ['content-ideas', {
        name: title || (instagram ? 'Instagram post' : await youtubeTitle(url)) || url,
        content_type: short ? 'Short Form' : 'YT Long Form',
        status: 'Idea',
        inspiration_url: url,
        outlier_factor: outlier || 0
      }];

  const res = await fetch(`${CONTENT_OS}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (res.status === 401) throw new Error('Content OS rejected your API key. Check it in the extension settings.');
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Save failed (${res.status})`);
}

// New installs start by highlighting small-channel breakouts: 10x+ from channels under 50K subscribers.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== 'install') return;
  chrome.storage.sync.set({
    filterMode: 'highlight',
    outlierFilterEnabled: true,
    outlierMinValue: 10,
    subFilterEnabled: true,
    subMinValue: '0',
    subMaxValue: '50K'
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const run = { save, folders }[message.action];
  if (!run) return;
  run(message).then(
    (data) => sendResponse({ ok: true, data }),
    (e) => sendResponse({ ok: false, error: e.message })
  );
  return true;
});
