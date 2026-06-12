// Load the saved API key when the options page opens
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            document.getElementById('apiKey').value = result.geminiApiKey;
        }
    });
});

// Save the API key when the button is clicked
document.getElementById('saveBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    
    if (!apiKey) {
        showStatus('Please enter an API key!', '#f44336');
        return;
    }

    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
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
