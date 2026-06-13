// Inject the "Grade with AI" button into the page
function injectButton() {
    if (document.getElementById('pasall-ai-button')) return;

    const btn = document.createElement('button');
    btn.id = 'pasall-ai-button';
    btn.innerHTML = `
        <span class="icon">✨</span>
        <div class="spinner"></div>
        <span class="text">Grade with AI</span>
    `;

    btn.addEventListener('click', handleGradeClick);
    document.body.appendChild(btn);

    // Also inject toast notification container
    const toast = document.createElement('div');
    toast.id = 'pasall-ai-toast';
    document.body.appendChild(toast);

    // Inject the topic editing modal
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'pasall-ai-modal-overlay';
    modalOverlay.innerHTML = `
        <div id="pasall-ai-modal">
            <h3>Confirm Assignment Topic</h3>
            <p>We extracted this topic from the page. You can edit it or provide your own if it has changed.</p>
            <textarea id="pasall-topic-input" placeholder="Enter the assignment topic here..."></textarea>
            <div class="pasall-ai-modal-actions">
                <button id="pasall-modal-cancel" class="pasall-ai-btn-secondary">Cancel</button>
                <button id="pasall-modal-confirm" class="pasall-ai-btn-primary">Confirm & Grade</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalOverlay);

    document.getElementById('pasall-modal-cancel').addEventListener('click', () => {
        document.getElementById('pasall-ai-modal-overlay').classList.remove('show');
    });

    document.getElementById('pasall-modal-confirm').addEventListener('click', () => {
        document.getElementById('pasall-ai-modal-overlay').classList.remove('show');
        const finalTopic = document.getElementById('pasall-topic-input').value;
        const videoUrl = document.getElementById('pasall-ai-button').dataset.videoUrl;
        if (videoUrl) {
            startGrading(videoUrl, finalTopic);
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById('pasall-ai-toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

function setButtonLoading(isLoading) {
    const btn = document.getElementById('pasall-ai-button');
    const text = btn.querySelector('.text');
    if (isLoading) {
        btn.classList.add('loading');
        text.textContent = 'Grading...';
    } else {
        btn.classList.remove('loading');
        text.textContent = 'Grade with AI';
    }
}

// Scrape YouTube URL and Assignment Topic
function extractContext() {
    // 1. Find YouTube iframe
    const iframe = document.querySelector('iframe[src*="youtube.com"]');
    let videoUrl = iframe ? iframe.src : null;
    
    // Clean up YouTube embed URL to standard URL
    if (videoUrl && videoUrl.includes('/embed/')) {
        const videoId = videoUrl.split('/embed/')[1].split('?')[0];
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    // 2. Find Assignment Topic
    // Based on screenshot, there is a section "Yêu cầu bài tập"
    let topicText = "";
    // We look for any container containing the text "Yêu cầu bài tập" and grab its sibling/child text
    const allHeaders = document.querySelectorAll('h3, h4, div, span');
    let topicContainer = null;
    for (let el of allHeaders) {
        if (el.textContent.includes('Yêu cầu bài tập')) {
            // Find the closest container
            topicContainer = el.parentElement;
            break;
        }
    }

    if (topicContainer) {
        topicText = topicContainer.innerText || topicContainer.textContent;
    } else {
        // Fallback: just grab all text from the left column or any likely candidate
        // Or if we can't find it, we just send empty.
        topicText = "Unknown topic. Please grade based on the video context.";
    }

    return { videoUrl, topicText };
}

// Map AI Response to the correct textareas
function autofillForm(feedbackData) {
    // feedbackData should be a JSON object with keys: general, fluency, grammar, lexical, pronunciation
    
    // The Pasall portal has textareas for each section. We can try finding them by looking for their labels.
    const allLabels = document.querySelectorAll('div, span, label, h4');
    const allInputs = document.querySelectorAll('input[type="number"], input[type="text"]');

    // Convert NodeList to Array for sequential searching
    const allTextareas = Array.from(document.querySelectorAll('textarea'));

    // Helper to find textarea that comes immediately after a label
    function fillSection(labelText, textToFill, scoreToFill) {
        if (!textToFill) return;
        
        let targetLabel = null;
        for (let el of allLabels) {
            // Look for a small container/leaf node to avoid grabbing massive wrappers
            if (el.textContent.trim().toLowerCase().includes(labelText.toLowerCase()) && el.textContent.length < 50) {
                targetLabel = el;
                // Don't break, get the last/deepest one which is usually the actual visible label
            }
        }

        if (targetLabel) {
            // Find the first textarea that comes AFTER this label in the DOM
            let closestTa = null;
            for (let ta of allTextareas) {
                if (targetLabel.compareDocumentPosition(ta) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    closestTa = ta;
                    break; // The very next textarea
                }
            }

            if (closestTa) {
                closestTa.value = textToFill;
                closestTa.dispatchEvent(new Event('input', { bubbles: true }));
                closestTa.dispatchEvent(new Event('change', { bubbles: true }));
                
                // For the score input, find the <input> that appears BETWEEN the targetLabel and the closestTa
                if (scoreToFill) {
                    const allInputsArray = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input'));
                    for (let input of allInputsArray) {
                        // The input should be after the label...
                        const isAfterLabel = targetLabel.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING;
                        // ...and before the textarea
                        const isBeforeTa = input.compareDocumentPosition(closestTa) & Node.DOCUMENT_POSITION_FOLLOWING;
                        
                        // Or if it's slightly nested, we just grab the first input after the label
                        if (isAfterLabel && isBeforeTa) {
                            input.value = scoreToFill;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            break;
                        }
                    }
                }
                return true;
            }
        }
        return false;
    }

    // Attempt to fill based on known labels from screenshot
    let successCount = 0;
    if (fillSection('Nhận xét tổng quát', feedbackData.general)) successCount++;
    if (fillSection('Fluency', feedbackData.fluency, feedbackData.fluency_score)) successCount++;
    if (fillSection('Grammar', feedbackData.grammar, feedbackData.grammar_score)) successCount++;
    if (fillSection('Lexical', feedbackData.lexical, feedbackData.lexical_score)) successCount++;
    if (fillSection('Pronunciation', feedbackData.pronunciation, feedbackData.pronunciation_score)) successCount++;

    // Fallback: If labels weren't found, just fill textareas sequentially
    if (successCount === 0 && allTextareas.length >= 5) {
        allTextareas[0].value = feedbackData.general || '';
        allTextareas[1].value = feedbackData.fluency || '';
        allTextareas[2].value = feedbackData.grammar || '';
        allTextareas[3].value = feedbackData.lexical || '';
        allTextareas[4].value = feedbackData.pronunciation || '';
        
        allTextareas.forEach(ta => {
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
        });
        showToast('Auto-filled fields sequentially (labels not found).');
    } else {
        showToast('Successfully auto-filled feedback!');
    }
}

async function handleGradeClick() {
    // Get context
    const { videoUrl, topicText } = extractContext();
    
    if (!videoUrl) {
        showToast('Error: Could not find a YouTube video on this page.');
        return;
    }

    // Save videoUrl on the button dataset so we can access it from the modal confirm handler
    document.getElementById('pasall-ai-button').dataset.videoUrl = videoUrl;

    // Show the modal to confirm/edit the topic
    document.getElementById('pasall-topic-input').value = topicText;
    document.getElementById('pasall-ai-modal-overlay').classList.add('show');
}

function startGrading(videoUrl, topicText) {
    setButtonLoading(true);
    showToast('Analyzing video and generating feedback...');

    // Send message to background script to call Gemini API
    chrome.runtime.sendMessage(
        { action: "generate_feedback", videoUrl, topicText },
        (response) => {
            setButtonLoading(false);
            if (response.error) {
                showToast(`Error: ${response.error}`);
            } else if (response.feedback) {
                try {
                    // Try to parse the JSON returned by Gemini
                    // The background script should clean it up, but just in case
                    let jsonStr = response.feedback;
                    if (jsonStr.startsWith('```json')) {
                        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
                    }
                    const feedbackData = JSON.parse(jsonStr);
                    autofillForm(feedbackData);
                } catch (e) {
                    console.error("Failed to parse Gemini response:", response.feedback);
                    showToast('Error: AI did not return valid JSON format.');
                }
            }
        }
    );
}

// Only inject if we are on the grading page
if (window.location.pathname.includes('gv_cham_video.php')) {
    // Delay injection slightly to let React/DOM load
    setTimeout(injectButton, 1500);
}
