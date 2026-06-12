// Load the saved API key when the options page opens
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['geminiApiKey', 'geminiModel'], (result) => {
        if (result.geminiApiKey) {
            document.getElementById('apiKey').value = result.geminiApiKey;
        }
        if (result.geminiModel) {
            document.getElementById('modelSelect').value = result.geminiModel;
        }
    });
});

// Save the API key when the button is clicked
document.getElementById('saveBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('modelSelect').value;
    
    if (!apiKey) {
        showStatus('Please enter an API key!', '#f44336');
        return;
    }

    chrome.storage.local.set({ geminiApiKey: apiKey, geminiModel: model }, () => {
        showStatus('Settings saved successfully!', '#4caf50');
    });
});

function showStatus(message, color) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.color = color;
    statusEl.classList.add('visible');
    
    setTimeout(() => {
        statusEl.classList.remove('visible');
    }, 3000);
}
