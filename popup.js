const YT_OEMBED = 'https://www.youtube.com/oembed';

function extractYouTubeUrlCandidate(raw) {
  if (!raw) return '';
  return raw.trim();
}

async function fetchYouTubeMeta(youtubeUrl) {
  const url = new URL(YT_OEMBED);
  url.searchParams.set('url', youtubeUrl);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch video details');
  return res.json();
}

function setMessage(text, isError = false) {
  const msg = document.getElementById('message');
  msg.textContent = text;
  msg.style.color = isError ? 'var(--accent)' : 'var(--muted)';
}

function saveVideo(videoURL) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'save-inspiration', item: { kind: 'youtube_video', url: videoURL } }, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!response.ok) reject(new Error(response.error));
      else resolve(response.inspirationUrl);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const previewBtn = document.getElementById('previewBtn');
  const openOptions = document.getElementById('openOptions');
  const preview = document.getElementById('preview');
  const thumb = document.getElementById('thumb');
  const titleEl = document.getElementById('title');
  const sendBtn = document.getElementById('sendBtn');
  
  // Outlier filter elements
  const outlierToggle = document.getElementById('outlierToggle');
  const sliderContainer = document.getElementById('sliderContainer');
  const outlierSlider = document.getElementById('outlierSlider');
  const sliderValue = document.getElementById('sliderValue');
  
  // Subscriber filter elements
  const subToggle = document.getElementById('subToggle');
  const subContainer = document.getElementById('subContainer');
  const subMin = document.getElementById('subMin');
  const subMax = document.getElementById('subMax');

  // Views filter elements
  const viewToggle = document.getElementById('viewToggle');
  const viewContainer = document.getElementById('viewContainer');
  const viewMin = document.getElementById('viewMin');
  const viewMax = document.getElementById('viewMax');

  // Load saved filter settings
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
    // Outlier settings
    const outlierEnabled = items.outlierFilterEnabled || false;
    const outlierMinVal = items.outlierMinValue || 5;
    
    outlierToggle.checked = outlierEnabled;
    outlierSlider.value = outlierMinVal;
    sliderValue.textContent = outlierMinVal + 'x';
    
    if (outlierEnabled) {
      sliderContainer.classList.remove('hidden');
    }
    
    // Subscriber settings
    const subEnabled = items.subFilterEnabled || false;
    const subMinVal = items.subMinValue || '0';
    const subMaxVal = items.subMaxValue || '';
    
    subToggle.checked = subEnabled;
    subMin.value = subMinVal;
    subMax.value = subMaxVal;
    
    if (subEnabled) {
      subContainer.classList.remove('hidden');
    }

    // Views settings
    const viewEnabled = items.viewFilterEnabled || false;
    const viewMinVal = items.viewMinValue || '0';
    const viewMaxVal = items.viewMaxValue || '';

    viewToggle.checked = viewEnabled;
    viewMin.value = viewMinVal;
    viewMax.value = viewMaxVal;

    if (viewEnabled) {
      viewContainer.classList.remove('hidden');
    }
  });

  // Toggle outlier filter on/off
  outlierToggle.addEventListener('change', () => {
    const enabled = outlierToggle.checked;
    
    if (enabled) {
      sliderContainer.classList.remove('hidden');
    } else {
      sliderContainer.classList.add('hidden');
    }
    
    // Save setting
    chrome.storage.sync.set({ outlierFilterEnabled: enabled });
  });

  // Update slider value display and save
  outlierSlider.addEventListener('input', () => {
    const value = outlierSlider.value;
    sliderValue.textContent = value + 'x';
    
    // Save setting
    chrome.storage.sync.set({ outlierMinValue: parseInt(value) });
  });
  
  // Toggle subscriber filter on/off
  subToggle.addEventListener('change', () => {
    const enabled = subToggle.checked;
    
    if (enabled) {
      subContainer.classList.remove('hidden');
    } else {
      subContainer.classList.add('hidden');
    }
    
    // Save setting
    chrome.storage.sync.set({ subFilterEnabled: enabled });
  });
  
  // Save subscriber min/max values on change
  subMin.addEventListener('change', () => {
    chrome.storage.sync.set({ subMinValue: subMin.value });
  });
  
  subMax.addEventListener('change', () => {
    chrome.storage.sync.set({ subMaxValue: subMax.value });
  });

  // Toggle views filter on/off
  viewToggle.addEventListener('change', () => {
    const enabled = viewToggle.checked;

    if (enabled) {
      viewContainer.classList.remove('hidden');
    } else {
      viewContainer.classList.add('hidden');
    }

    // Save setting
    chrome.storage.sync.set({ viewFilterEnabled: enabled });
  });

  // Save views min/max values on change
  viewMin.addEventListener('change', () => {
    chrome.storage.sync.set({ viewMinValue: viewMin.value });
  });

  viewMax.addEventListener('change', () => {
    chrome.storage.sync.set({ viewMaxValue: viewMax.value });
  });

  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  previewBtn.addEventListener('click', async () => {
    setMessage('');
    preview.classList.add('hidden');
    titleEl.textContent = '';
    thumb.src = '';

    const input = extractYouTubeUrlCandidate(urlInput.value);
    if (!input) {
      setMessage('Please enter a YouTube URL.', true);
      return;
    }

    previewBtn.disabled = true;
    try {
      const meta = await fetchYouTubeMeta(input);
      titleEl.textContent = meta.title || 'Untitled video';
      thumb.src = meta.thumbnail_url;
      preview.dataset.videoUrl = input;
      preview.dataset.title = meta.title || '';
      preview.dataset.thumbnailUrl = meta.thumbnail_url || '';
      preview.classList.remove('hidden');
    } catch (e) {
      setMessage(e.message || 'Unable to fetch video details.', true);
    } finally {
      previewBtn.disabled = false;
    }
  });

  sendBtn.addEventListener('click', async () => {
    setMessage('Saving to Content OS...');
    sendBtn.disabled = true;
    try {
      const inspirationUrl = await saveVideo(preview.dataset.videoUrl || '');
      setMessage('Saved! Click to open Inspiration.');
      const msgEl = document.getElementById('message');
      msgEl.style.cursor = 'pointer';
      msgEl.style.textDecoration = 'underline';
      msgEl.addEventListener('click', () => {
        window.open(inspirationUrl, '_blank');
        msgEl.style.cursor = '';
        msgEl.style.textDecoration = '';
      }, { once: true });
    } catch (e) {
      setMessage(e.message || 'Failed to save to Content OS.', true);
    } finally {
      sendBtn.disabled = false;
    }
  });
});




