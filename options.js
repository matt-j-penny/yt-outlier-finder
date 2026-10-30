const DEFAULT_BASE_URL = 'https://getcontentos.vercel.app';

function setMessage(text, isError = false) {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.style.color = isError ? '#b91c1c' : '#374151';
}

function loadSettings() {
  chrome.storage.local.get(['contentOsBaseUrl', 'contentOsApiKey'], (items) => {
    document.getElementById('contentOsBaseUrl').value = items.contentOsBaseUrl || DEFAULT_BASE_URL;
    document.getElementById('contentOsApiKey').value = items.contentOsApiKey || '';
  });
}

function saveSettings() {
  const contentOsBaseUrl = document.getElementById('contentOsBaseUrl').value.trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
  const contentOsApiKey = document.getElementById('contentOsApiKey').value.trim();
  if (contentOsApiKey && !contentOsApiKey.startsWith('cos_')) {
    setMessage('Content OS API keys start with cos_.', true);
    return;
  }

  let origin;
  try {
    origin = `${new URL(contentOsBaseUrl).origin}/*`;
  } catch (e) {
    setMessage('Enter a valid Content OS URL.', true);
    return;
  }

  // Only the default Content OS host is granted at install; other hosts are asked for here
  chrome.permissions.request({ origins: [origin] }, (granted) => {
    if (!granted) {
      setMessage(`Allow access to ${contentOsBaseUrl} so the extension can save to it.`, true);
      return;
    }
    chrome.storage.local.set({ contentOsBaseUrl, contentOsApiKey }, () => {
      setMessage('Saved.');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.getElementById('save').addEventListener('click', saveSettings);
});
