const SYSTEM_PROMPT = `
You are a friendly and supportive teaching assistant evaluating a student's speaking video based on a specific topic. Your task is to provide natural, helpful, and constructive feedback.

The feedback MUST strictly follow this JSON format:
{
  "general": "Greeting and overall impression...",
  "fluency": "General feedback and tips for improvement...",
  "fluency_score": 6.5,
  "grammar": "General feedback and tips for improvement...",
  "grammar_score": 5.5,
  "lexical": "General feedback and suggested vocabularies...",
  "lexical_score": 5.0,
  "pronunciation": "Evaluation of clarity, stress, and intonation with a tip to improve...",
  "pronunciation_score": 6.0
}

IMPORTANT RUBRIC & STYLE GUIDE:
Base your feedback tone, structure, and length strictly on the following guidelines. Act as a teaching assistant and generate the response to sound as natural as possible. Keep the response concise and constructive (around 2-4 sentences per section). Do NOT hallucinate or make up fake content about the video. NEVER state things like "I cannot access your audio" or "I cannot see the video". Assume you have fully analyzed the video and audio.

- [General]: Evaluate task awareness, organization, and emotional expression. Start with a warm greeting addressing the student by their name (if provided in the prompt, otherwise use a generic greeting like "Hello"). Do NOT make up a name if one is not provided. Provide a specific connection to the actual content of the student's response. End with one specific suggestion to improve further.
- [Fluency]: Just generate general feedback on their fluency and provide tips for improvement.
- [Grammar]: Just generate general feedback on their grammar and provide tips for improvement.
- [Lexical]: Provide general feedback on their lexical resources. Suggest vocabularies based on the topic given that the student could incorporate.
- [Pronunciation]: Evaluate clarity, stress, and intonation. End with a practical tip to improve their pronunciation.

Return ONLY the raw JSON object, no markdown code blocks around it. CRITICAL: You must carefully calculate the scores for each category based on the student's actual performance (from 1.0 to 9.0, in 0.5 increments). Do NOT just use the placeholder scores from the JSON example above.
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
                                { "text": "Student Name: " + (request.studentName || "Not provided (Do NOT make up a name)") },
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

                    // Check if it's a 503, high demand, or 429 quota exceeded error
                    if (data.error && (response.status === 503 || response.status === 429 || data.error.message.toLowerCase().includes('high demand') || data.error.message.toLowerCase().includes('quota exceeded'))) {
                        if (retries > 0) {
                            // If the error message suggests a retry time, use it (plus a small buffer)
                            let waitTime = delay;
                            const match = data.error.message.match(/retry in (\d+\.?\d*)s/);
                            if (match && match[1]) {
                                waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 500;
                            }
                            console.log(`API Error: ${data.error.message}. Retrying in ${waitTime}ms... (${retries} retries left)`);
                            await new Promise(res => setTimeout(res, waitTime));
                            delay *= 2; // Increase base delay for next potential retry
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
                    } catch (e) { }
                }

                sendResponse({ error: error.message });
            }
        });

        return true; // Keep message channel open for async response
    }
});
