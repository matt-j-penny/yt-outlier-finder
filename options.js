const CONTENT_OS = 'https://the-content-os.com';

function setMessage(text, kind = '') {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.className = `status ${kind}`;
}

async function saveSettings() {
  const input = document.getElementById('apiKey');
  const button = document.getElementById('save');
  const apiKey = input.value.trim();

  if (!apiKey) {
    await chrome.storage.local.remove('apiKey');
    setMessage('API key removed.');
    return;
  }
  if (!apiKey.startsWith('cos_')) {
    setMessage('That doesn\'t look like a Content OS API key. It should start with cos_.', 'error');
    return;
  }

  button.disabled = true;
  setMessage('Checking your key...');
  try {
    const res = await fetch(`${CONTENT_OS}/api/inspiration?kind=youtube_title`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (res.status === 401) {
      setMessage('Content OS didn\'t accept that key. Check you copied all of it, or create a new one.', 'error');
      return;
    }
    if (!res.ok) throw new Error();
    await chrome.storage.local.set({ apiKey });
    setMessage('Connected. You can now save videos from YouTube and Instagram.', 'ok');
  } catch {
    setMessage('Couldn\'t reach Content OS. Check your connection and try again.', 'error');
  } finally {
    button.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiKey'], (items) => {
    document.getElementById('apiKey').value = items.apiKey || '';
    if (items.apiKey) setMessage('Connected.', 'ok');
  });
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('apiKey').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveSettings();
  });
});
