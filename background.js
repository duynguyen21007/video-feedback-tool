const SYSTEM_PROMPT = `
You are an expert IELTS examiner. Your task is to evaluate a student's speaking video based on a specific topic and provide detailed feedback.

The feedback MUST strictly follow this JSON format:
{
  "general": "Greeting and overall impression...",
  "fluency": "Detailed feedback on Fluency and Coherence...",
  "fluency_score": 6.5,
  "grammar": "Detailed feedback on Grammatical Range and Accuracy...",
  "grammar_score": 5.5,
  "lexical": "Detailed feedback on Lexical Resource...",
  "lexical_score": 5.0,
  "pronunciation": "Detailed feedback on Pronunciation...",
  "pronunciation_score": 6.0
}

IMPORTANT RUBRIC & STYLE GUIDE:
Base your feedback tone, structure, and length strictly on the following guidelines. Keep the response concise and constructive (around 2-4 sentences per section). Do not be overly detailed. Do not specify the specific mistakes the student made (including grammar and pronunciation). Do NOT hallucinate or make up fake content about the video.

- [General]: Evaluate task awareness, organization, and emotional expression. Start with a greeting addressing the student by their name (if provided in the prompt, otherwise use a generic greeting like "Hello"). Do NOT make up a name if one is not provided. Provide a specific connection to the actual content of the student's response (do NOT make up fake content or details that the student did not say). End with one specific suggestion to improve further (e.g., "To improve further, you could include more detailed descriptions...").
- [Fluency]: Comment on their pace, pauses, and flow. Suggest one actionable way to improve fluency (e.g., "Practising more spontaneous speaking would help improve your fluency...").
- [Grammar]: Evaluate grammatical accuracy and the mix of simple/complex structures. Do NOT specify the specific grammatical mistakes made. Suggest one specific grammatical pattern to practice (e.g., "Increasing your use of conditional sentences and participle clauses would strengthen...").
- [Lexical]: Assess vocabulary appropriateness. Provide exactly 4-5 specific, advanced phrase or idiom suggestions related to the topic that the student could incorporate (e.g., "You could incorporate phrases such as [phrase 1], [phrase 2], [phrase 3], and [phrase 4]").
- [Pronunciation]: Evaluate clarity, stress, and intonation. End with 1 tip to sound more natural. Do NOT list specific mispronounced words or mistakes.

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
