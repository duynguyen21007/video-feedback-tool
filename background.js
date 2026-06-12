const SYSTEM_PROMPT = `
You are an expert IELTS examiner. Your task is to evaluate a student's speaking video based on a specific topic and provide detailed feedback.

The feedback MUST strictly follow this JSON format:
{
  "general": "Greeting and overall impression...",
  "fluency": "Detailed feedback on Fluency and Coherence...",
  "fluency_score": 6.0,
  "grammar": "Detailed feedback on Grammatical Range and Accuracy...",
  "grammar_score": 6.0,
  "lexical": "Detailed feedback on Lexical Resource...",
  "lexical_score": 6.0,
  "pronunciation": "Detailed feedback on Pronunciation...",
  "pronunciation_score": 6.0
}

IMPORTANT RUBRIC & STYLE GUIDE:
Base your feedback tone, structure, and length strictly on the following guidelines. Keep the response concise and constructive (around 2-4 sentences per section). Do not be overly detailed.

- [General]: Evaluate task awareness, organization, and emotional expression. Provide a specific connection to the student's response. End with one specific suggestion to improve further (e.g., "To improve further, you could include more detailed descriptions...").
- [Fluency]: Comment on their pace, pauses, and flow. Suggest one actionable way to improve fluency (e.g., "Practising more spontaneous speaking would help improve your fluency...").
- [Grammar]: Evaluate grammatical accuracy and the mix of simple/complex structures. Suggest one specific grammatical pattern to practice (e.g., "Increasing your use of conditional sentences and participle clauses would strengthen...").
- [Lexical]: Assess vocabulary appropriateness. Provide exactly 4-5 specific, advanced phrase or idiom suggestions related to the topic that the student could incorporate (e.g., "You could incorporate phrases such as [phrase 1], [phrase 2], [phrase 3], and [phrase 4]").
- [Pronunciation]: Evaluate clarity, stress, and intonation. End with 1 tip to sound more natural. CRITICAL: You MUST identify 2-4 specific words the student mispronounced. List them at the very end of this section, separated by newlines (\n), and you MUST capitalize the exact letter, vowel, or syllable that was mispronounced (e.g., bAlAnce, vehIcle, changED, reSult).

Return ONLY the raw JSON object, no markdown code blocks around it. Ensure the scores are numbers (e.g., 5.0, 5.5, 6.0, up to 9.0).
`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "generate_feedback") {
        
        chrome.storage.local.get(['geminiApiKey', 'geminiModel'], async (result) => {
            const apiKey = result.geminiApiKey;
            const model = result.geminiModel || 'gemini-2.5-flash';
            if (!apiKey) {
                sendResponse({ error: "API Key not found. Please click the Extension icon and enter your Gemini API Key in the settings." });
                return;
            }

            try {
                // Call Gemini API
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                
                const requestBody = {
                    "contents": [
                        {
                            "parts": [
                                { "text": SYSTEM_PROMPT },
                                { "text": "Assignment Topic: " + request.topicText },
                                { "text": "Please analyze this YouTube video and grade it: " + request.videoUrl }
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.2,
                        "response_mime_type": "application/json"
                    }
                };

                let response;
                let data;
                let retries = 2; // Try up to 3 times total
                let delay = 2000; // Start with 2 seconds delay

                while (retries >= 0) {
                    response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                    
                    data = await response.json();
                    
                    // Check if it's a 503 or high demand error
                    if (data.error && (response.status === 503 || data.error.message.toLowerCase().includes('high demand'))) {
                        if (retries > 0) {
                            console.log(`High demand error. Retrying in ${delay}ms... (${retries} retries left)`);
                            await new Promise(res => setTimeout(res, delay));
                            delay *= 2; // Exponential backoff (2s, 4s)
                            retries--;
                            continue; // Try again
                        }
                    }
                    // If it's not a retryable error or we ran out of retries, break the loop
                    break;
                }

                if (data.error) {
                    throw new Error(data.error.message || "Unknown API Error");
                }

                if (data.candidates && data.candidates.length > 0) {
                    const aiText = data.candidates[0].content.parts[0].text;
                    sendResponse({ feedback: aiText });
                } else {
                    throw new Error("No response generated by AI.");
                }

            } catch (error) {
                console.error("Gemini API Error:", error);
                
                // If it's a model error, try to fetch the list of valid models
                if (error.message.includes("is not found") || error.message.includes("is not supported")) {
                    try {
                        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                        const mRes = await fetch(modelsUrl);
                        const mData = await mRes.json();
                        const validModels = mData.models.map(m => m.name.replace('models/', '')).join(', ');
                        sendResponse({ error: `Model error. Your key supports these models: ${validModels}` });
                        return;
                    } catch (e) {}
                }
                
                sendResponse({ error: error.message });
            }
        });

        return true; // Keep message channel open for async response
    }
});
