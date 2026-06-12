# Pasall AI IELTS Grader

A Chrome extension designed to automatically grade IELTS speaking videos and fill in feedback on the Pasall portal using the latest Gemini models (Gemini 2.5 Flash, 2.5 Pro, and 3.1 Pro).

## Features

- **Automated Grading:** Analyzes YouTube videos and the provided assignment topic to generate comprehensive IELTS speaking feedback.
- **Form Autofill:** Automatically populates the Pasall portal grading form with concise, constructive feedback for:
  - General Comments
  - Fluency & Coherence
  - Grammatical Range & Accuracy
  - Lexical Resource
  - Pronunciation (including specific phoneme/vowel highlighting for mispronounced words)
- **Model Selection:** Easily switch between different AI models (like Gemini 2.5 Flash for speed, or Gemini 3.1 Pro for deeper reasoning) directly from the extension's options page.
- **Smart Retries:** Automatically handles temporary API rate limits or "High Demand" 503 errors with exponential backoff, ensuring a smooth grading experience.
- **Customizable AI Key:** Allows users to easily input and securely store their own Gemini API key for personalized usage.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/duynguyen21007/video-feedback-agent.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the cloned `video-feedback-agent` directory.

## Usage

1. Click on the extension icon in your Chrome toolbar to open the options page.
2. Enter your **Gemini API Key** and select your preferred **AI Model** (defaults to Gemini 2.5 Flash). You can get a free key from Google AI Studio.
3. Navigate to a Pasall grading page (`*://pasall.edu.vn/*gv_cham_video.php*`).
4. Click the **"✨ Grade with AI"** button that appears in the bottom right corner of the page.
5. Wait a few moments for the AI to analyze the video and generate feedback. The form will be auto-filled once complete.

## Technologies Used

- Chrome Extension Manifest V3
- JavaScript (ES6+)
- CSS3
- Gemini API (2.5 & 3.1)

## License

MIT

---

**Disclaimer**: This project is an unofficial community-built tool and is not affiliated with, endorsed by, or sponsored by Pasall or any related institutions. It is intended for personal automation and educational purposes.
