// This script runs on every webpage and applies accessibility styles

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'applyAccessibility') {
    applyAccessibilitySettings(request.settings);
    sendResponse({ status: 'Applied' });
  }

  if (request.action === 'resetAccessibility') {
    // Remove any existing AccessNow styles
    const styleEl = document.getElementById('accessnow-styles');
    if (styleEl) {
      styleEl.remove();
    }
    sendResponse({ status: 'Reset' });
  }
});

function applyAccessibilitySettings(settings) {
  // Remove any existing AccessNow styles
  let styleEl = document.getElementById('accessnow-styles');
  if (styleEl) {
    styleEl.remove();
  }

  // Create new style element
  styleEl = document.createElement('style');
  styleEl.id = 'accessnow-styles';
  
  const fontSize = settings.fontSize || '16';
  const letterSpacing = settings.letterSpacing || '0';
  const lineHeight = settings.lineHeight || '1.5';
  const dyslexiaFont = settings.dyslexiaFont ? "'OpenDyslexic', " : '';
  
  let themeCSS = '';
  
  // Apply theme
  switch (settings.theme) {
    case 'dark':
      themeCSS = `
        body { background-color: #1a1a1a !important; color: #e0e0e0 !important; }
        * { background-color: #1a1a1a !important; color: #e0e0e0 !important; }
        a { color: #4da6ff !important; }
        button { background-color: #2a2a2a !important; color: #e0e0e0 !important; border: 1px solid #555 !important; }
      `;
      break;
    case 'blue-yellow':
      themeCSS = `
        body { background-color: #000080 !important; color: #FFFF00 !important; }
        * { background-color: #000080 !important; color: #FFFF00 !important; }
        a { color: #00FFFF !important; text-decoration: underline !important; }
        button { background-color: #003366 !important; color: #FFFF00 !important; border: 2px solid #FFFF00 !important; }
      `;
      break;
    case 'yellow-blue':
      themeCSS = `
        body { background-color: #FFFF00 !important; color: #000080 !important; }
        * { background-color: #FFFF00 !important; color: #000080 !important; }
        a { color: #0000FF !important; text-decoration: underline !important; }
        button { background-color: #FFCC00 !important; color: #000080 !important; border: 2px solid #000080 !important; }
      `;
      break;
    case 'gray':
      themeCSS = `
        body { background-color: #e5e5e5 !important; color: #333333 !important; }
        * { background-color: #e5e5e5 !important; color: #333333 !important; }
        a { color: #0066cc !important; text-decoration: underline !important; }
        button { background-color: #cccccc !important; color: #333333 !important; border: 1px solid #999 !important; }
      `;
      break;
    case 'default':
    default:
      themeCSS = `
        body { background-color: #ffffff !important; color: #000000 !important; }
        * { background-color: #ffffff !important; color: #000000 !important; }
        a { color: #0066cc !important; text-decoration: underline !important; }
        button { background-color: #f0f0f0 !important; color: #000000 !important; border: 2px solid #000000 !important; }
      `;
  }

  // Build final CSS
  const css = `
    * {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      letter-spacing: ${letterSpacing}em !important;
      font-family: ${dyslexiaFont}'Arial', sans-serif !important;
    }
    
    ${themeCSS}
    
    body, body * {
      margin-bottom: ${lineHeight * 8}px !important;
      padding: 12px !important;
    }
    
    /* Ensure text is readable */
    p, div, span, li, td, th, a, button, input, label {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
    }
    
    /* Make buttons larger and more accessible */
    button, input[type="button"], input[type="submit"] {
      padding: 12px 20px !important;
      min-height: 44px !important;
      cursor: pointer !important;
    }
    
    /* High contrast for inputs */
    input, textarea, select {
      border: 2px solid #000 !important;
      padding: 8px !important;
    }
    
    /* Add border to images (do not remove them) */
    img {
      border: 2px solid #ccc !important;
    }
  `;

  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

// Optional auto-load has been removed so extension only runs when you click Apply
// If you still want auto-load when enabled, you can gate it behind extensionEnabled from storage.
