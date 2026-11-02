document.addEventListener('DOMContentLoaded', () => {
  const modeButtons = document.querySelectorAll('.mode-switch button');
  
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

  const showMode = (mode) => {
    modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    document.getElementById('modeHint').textContent = mode === 'hide'
      ? "Videos that don't match every filter below are hidden."
      : 'Videos that match every filter below get a red background.';
  };

  chrome.storage.local.get('apiKey', ({ apiKey }) => {
    document.getElementById('keyNotice').classList.toggle('hidden', Boolean(apiKey));
  });

  // Load saved filter settings
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
    showMode(items.filterMode || 'highlight');

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

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      showMode(button.dataset.mode);
      chrome.storage.sync.set({ filterMode: button.dataset.mode });
    });
  });

  document.querySelectorAll('.open-options').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  });
});
