let pageText = '';
let currentMode = 'visual';
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let currentTheme = 'default';
let dyslexiaFontEnabled = false;
let extensionEnabled = true; // master switch

// ===== MODE SWITCHING =====
document.getElementById('visualMode').addEventListener('click', () => setMode('visual'));
document.getElementById('readingMode').addEventListener('click', () => setMode('reading'));

function setMode(mode) {
    currentMode = mode;
    document.body.className = mode + '-mode';
    document.getElementById('visualMode').classList.toggle('active', mode === 'visual');
    document.getElementById('readingMode').classList.toggle('active', mode === 'reading');

    chrome.storage.sync.set({ currentMode: mode });

    // For now, do NOT call displayResults() here to avoid re-triggering AI
}

// ===== MASTER ENABLE TOGGLE =====
document.getElementById('extensionEnabled').addEventListener('change', (e) => {
    extensionEnabled = e.target.checked;
    chrome.storage.sync.set({ extensionEnabled });

    if (!extensionEnabled) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, { action: 'resetAccessibility' });
        });
    }
});

// ===== PAGE ANALYSIS =====
document.getElementById('analyzeBtn').addEventListener('click', async () => {
    try {
        document.getElementById('analyzeBtn').textContent = 'Processing...';
        document.getElementById('analyzeBtn').disabled = true;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractPageText
        });

        pageText = results[0].result;

        if (!pageText || pageText.trim().length === 0) {
            alert('No text found on this page.');
            return;
        }

        await displayResults();
        document.getElementById('results').classList.remove('hidden');
        document.getElementById('qaSection').classList.remove('hidden');

    } catch (error) {
        alert('Error analyzing page: ' + error.message);
    } finally {
        document.getElementById('analyzeBtn').textContent = '📊 Analyze This Page';
        document.getElementById('analyzeBtn').disabled = false;
    }
});

function extractPageText() {
    const elements = document.body.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, article, section'
    );
    let text = '';
    elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null) {
            const content = el.innerText || el.textContent;
            if (content && content.trim().length > 0) {
                text += content.trim() + ' ';
            }
        }
    });
    return text.trim();
}

// ===== AI SUMMARY (GEMINI BACKEND) =====
async function fetchAISummary(fullText) {
    const apiUrl = 'http://localhost:3000/summarize';

    // Limit payload size to avoid 413 errors
    const maxChars = 8000; // you can adjust
    const trimmedText = fullText.slice(0, maxChars);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmedText }),
    });

    if (!response.ok) {
        throw new Error('AI summarization failed');
    }

    const data = await response.json();
    return data.summary || '';
}

async function displayResults() {
    try {
        document.getElementById('summaryContent').textContent = 'Generating AI summary...';
        document.getElementById('simplifiedContent').textContent = 'Generating simplified version...';

        const aiSummary = await fetchAISummary(pageText);
        const aiSimplified = aiSummary; // reuse; can change later

        if (currentMode === 'visual') {
            document.getElementById('summaryContent').textContent = aiSummary;
            document.getElementById('simplifiedContent').textContent = aiSimplified;
        } else {
            document.getElementById('summaryContent').innerHTML = formatAsBullets(aiSummary);
            document.getElementById('simplifiedContent').innerHTML = formatAsBullets(aiSimplified);
        }
    } catch (err) {
        console.error('displayResults error:', err);
        document.getElementById('summaryContent').textContent = 'Error generating AI summary.';
        document.getElementById('simplifiedContent').textContent = 'Error generating AI simplified version.';
    }
}

// (legacy local summary helpers – kept for Q&A)
function generateSummary(text) {
    const words = text.split(/\s+/);
    const wordCount = words.length;
    if (wordCount === 0) return 'No content to summarize.';

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const summaryLength = Math.min(3, sentences.length);
    const summarySentences = sentences.slice(0, summaryLength);

    return `This page contains approximately ${wordCount} words. ${summarySentences.join(' ')}`;
}

function simplifyText(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const simplified = sentences.slice(0, 5).map(s => {
        return s.trim().replace(/\s+/g, ' ');
    });
    return simplified.join(' ');
}

function formatAsBullets(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const items = sentences.map(s => {
        const words = s.trim().split(/\s+/);
        if (words.length > 15) {
            return words.slice(0, 15).join(' ') + '...';
        }
        return s.trim();
    });
    return '<ul class="bullet-list">' +
        items.map(item => `<li>${item}</li>`).join('') +
        '</ul>';
}

// ===== READ ALOUD =====
// Main top button: read summary
document.getElementById('readAloudBtn').addEventListener('click', () => {
    readAloud('summaryContent', 'readAloudBtn');
});

// Summary section button
document.getElementById('readSummaryBtn').addEventListener('click', () => {
    readAloud('summaryContent', 'readSummaryBtn');
});

// Simplified section button
document.getElementById('readSimplifiedBtn').addEventListener('click', () => {
    readAloud('simplifiedContent', 'readSimplifiedBtn');
});

function readAloud(contentId, buttonId) {
    const el = document.getElementById(contentId);
    const btn = document.getElementById(buttonId);
    const textToRead = el ? el.textContent : '';

    if (!textToRead || textToRead.trim().length === 0) {
        alert('Please analyze the page first');
        return;
    }

    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        resetReadButtons();
        return;
    }

    currentUtterance = new SpeechSynthesisUtterance(textToRead);
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;

    currentUtterance.onend = () => {
        resetReadButtons();
    };
    currentUtterance.onerror = () => {
        resetReadButtons();
    };

    resetReadButtons();
    if (btn) btn.textContent = '⏸ Stop reading';
    speechSynthesis.speak(currentUtterance);
}

function resetReadButtons() {
    const mainBtn = document.getElementById('readAloudBtn');
    const summaryBtn = document.getElementById('readSummaryBtn');
    const simpBtn = document.getElementById('readSimplifiedBtn');

    if (mainBtn) mainBtn.textContent = '🔊 Read Aloud';
    if (summaryBtn) summaryBtn.textContent = 'Read summary aloud';
    if (simpBtn) simpBtn.textContent = 'Read simplified aloud';
}

// ===== Q&A =====
document.getElementById('askBtn').addEventListener('click', askQuestion);
document.getElementById('questionInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askQuestion();
});

function askQuestion() {
    const question = document.getElementById('questionInput').value;
    if (!question.trim()) {
        alert('Please enter a question');
        return;
    }

    const answerText = generateAnswer(pageText, question);
    document.getElementById('answerContent').textContent = answerText;
    document.getElementById('answerContent').classList.remove('hidden');
}

function generateAnswer(text, question) {
    const keywords = question.toLowerCase().split(/\s+/);
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    const relevantSentences = sentences.filter(sentence => {
        const lowerSentence = sentence.toLowerCase();
        return keywords.some(keyword => lowerSentence.includes(keyword));
    }).slice(0, 2);

    if (relevantSentences.length > 0) {
        return relevantSentences.map(s => s.trim()).join(' ');
    } else {
        return 'I couldn\'t find a specific answer in the page content.';
    }
}

// ===== ACCESSIBILITY SETTINGS =====
document.getElementById('themeSelect').addEventListener('change', (e) => {
    currentTheme = e.target.value;
    chrome.storage.sync.set({ currentTheme });
});

document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
    const size = e.target.value;
    document.getElementById('fontSizeLabel').textContent = size + 'px';
    chrome.storage.sync.set({ fontSize: size });
});

document.getElementById('dyslexiaFont').addEventListener('change', (e) => {
    dyslexiaFontEnabled = e.target.checked;
    chrome.storage.sync.set({ dyslexiaFont: dyslexiaFontEnabled });
});

document.getElementById('letterSpacing').addEventListener('input', (e) => {
    const spacing = e.target.value;
    const label = spacing === '0' ? 'Normal' : '+' + (spacing * 100).toFixed(0) + '%';
    document.getElementById('letterSpacingLabel').textContent = label;
    chrome.storage.sync.set({ letterSpacing: spacing });
});

document.getElementById('lineHeight').addEventListener('input', (e) => {
    const height = e.target.value;
    document.getElementById('lineHeightLabel').textContent = height + 'x';
    chrome.storage.sync.set({ lineHeight: height });
});

document.getElementById('applyAccessibilityBtn').addEventListener('click', () => {
    if (!extensionEnabled) {
        alert('Turn on "Enable AccessNow on this page" first.');
        return;
    }

    const settings = {
        theme: document.getElementById('themeSelect').value,
        fontSize: document.getElementById('fontSizeSlider').value,
        dyslexiaFont: document.getElementById('dyslexiaFont').checked,
        letterSpacing: document.getElementById('letterSpacing').value,
        lineHeight: document.getElementById('lineHeight').value
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
        chrome.tabs.sendMessage(tabId, {
            action: 'applyAccessibility',
            settings: settings
        });
    });

    alert('✓ Accessibility settings applied to page!');
    chrome.storage.sync.set(settings);
});

// Load saved preferences on popup open
window.addEventListener('load', () => {
    chrome.storage.sync.get(
        [
            'currentMode',
            'currentTheme',
            'fontSize',
            'dyslexiaFont',
            'letterSpacing',
            'lineHeight',
            'extensionEnabled'
        ],
        (data) => {
            if (data.currentMode) {
                setMode(data.currentMode);
            }
            if (data.currentTheme) {
                document.getElementById('themeSelect').value = data.currentTheme;
            }
            if (data.fontSize) {
                document.getElementById('fontSizeSlider').value = data.fontSize;
                document.getElementById('fontSizeLabel').textContent = data.fontSize + 'px';
            }
            if (typeof data.dyslexiaFont === 'boolean') {
                document.getElementById('dyslexiaFont').checked = data.dyslexiaFont;
            }
            if (data.letterSpacing) {
                document.getElementById('letterSpacing').value = data.letterSpacing;
            }
            if (data.lineHeight) {
                document.getElementById('lineHeight').value = data.lineHeight;
            }
            if (typeof data.extensionEnabled === 'boolean') {
                extensionEnabled = data.extensionEnabled;
                document.getElementById('extensionEnabled').checked = extensionEnabled;
            } else {
                extensionEnabled = true;
                document.getElementById('extensionEnabled').checked = true;
            }
        }
    );
});
