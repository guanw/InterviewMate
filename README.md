# InterviewMate

A comprehensive interview preparation tool that combines **real-time audio transcription**, **manual AI analysis control**, and **Chrome extension integration** for LeetCode, HackerRank, and CoderPad. Features advanced token optimization to minimize API costs while providing intelligent interview insights.

## Screenshots

![InterviewMate Main Interface](static/InterviewMate.png)
![Chrome Extension Popup](static/chrome-extension.png)

## Features

- **Manual AI Analysis Control**: Click "Analyze Conversation" button to trigger LLM analysis (prevents unwanted token usage)
- **Smart Transcription Filtering**: Automatically filters out "BLANK AUDIO", filler words, and low-quality speech
- **Conversation Buffer Management**: Manual reset with "Clear Conversation" button and real-time character count
- **Chrome Extension Support**: Extract interview questions from LeetCode, HackerRank, and CoderPad
- **Real-time Audio Processing**: Voice Activity Detection (VAD) for efficient transcription
- **Token Usage Optimization**: Quality filtering prevents expensive LLM calls on poor audio
- **Centralized Logging**: Cross-platform logging system with configurable log levels
- **Performance Metrics**: Track transcription and analysis performance (View → Performance Metrics)
- **Keyboard Shortcuts**: S to start recording, X to stop
- **Global Shortcuts**: Cmd/Ctrl + Arrow Keys to move window, Cmd/Ctrl + M to randomize position
- **Responsive UI**: Controls and analysis side-by-side layout
- **Hot Reloading**: Development mode with automatic restarts
- **ESLint Integration**: Code quality enforcement across Electron + React stack

## Prerequisites

- Node.js (v14 or higher)
- npm
- A DashScope API key for AI analysis

## Setup

1. Clone the repository and navigate to the project directory.

2. Install dependencies:

   ```
   npm install
   ```

3. Download the Whisper model:

   ```
   npx whisper-node download
   ```

   This downloads the required Whisper model files for offline transcription.

4. Create a `.env` file in the root directory with your DashScope API key:

   ```
   DASHSCOPE_API_KEY=your_api_key_here
   ```

   You can obtain an API key from [DashScope](https://dashscope.aliyun.com/).

5. Start the application:
   ```
   npm start
   ```

## Usage

### Basic Recording

- Click "Start Recording" or press 'S' to begin recording.
- Speak into your microphone - speech is transcribed in real-time.
- Click "Stop Recording" or press 'X' to stop.
- View transcription history in the scrollable bottom section.

### Window Positioning

InterviewMate runs as a floating window that can be positioned anywhere on your screen using global shortcuts:

- **Move Window**: Use `Cmd/Ctrl + Arrow Keys` to move the window in any direction (50px steps)
- **Random Position**: Press `Cmd/Ctrl + M` to randomly reposition the window on your screen
- These shortcuts work even when InterviewMate is not the active window

### AI Analysis (Manual Control)

- **No automatic analysis** - you control when to spend tokens
- Click **"🧠 Analyze Conversation"** to send current buffer to LLM
- Analysis appears in the right panel with interview insights
- Use **"🧹 Clear Conversation"** to reset buffer between topics
- Monitor **"Buffer: X chars"** to see accumulated conversation

### Chrome Extension

- Install the extension from `interview-extension/` folder
- Navigate to LeetCode, HackerRank, or CoderPad problems
- Click extension icon and **"Extract Question"**
- Question data appears in InterviewMate for enhanced analysis

## Architecture

### Core Components

- **Frontend**: React components with manual AI analysis controls
- **Audio Processing**: Web Audio API with Voice Activity Detection (VAD)
- **Transcription**: OpenAI Whisper with quality filtering and artifact removal
- **AI Analysis**: Qwen 3-Max via DashScope API (manual trigger only)
- **IPC**: Electron for secure main/renderer communication

### Chrome Extension

- **Content Scripts**: Extract interview questions from LeetCode, HackerRank, CoderPad
- **Background Service**: Handles server communication and data processing
- **Popup UI**: Simple interface for question extraction
- **Local Server**: Express.js server for extension ↔ Electron communication

### Quality & Performance

- **Transcription Filtering**: Removes "BLANK AUDIO", filler words, and low-quality segments
- **Token Optimization**: Manual analysis prevents unwanted API calls
- **Centralized Logging**: Cross-platform logging with configurable levels
- **Performance Metrics**: Track transcription and analysis performance

## Development

### Available Scripts

- `npm start`: Start the application in production mode
- `npm run dev`: Start the application in development mode with hot reloading
- `npm run lint`: Run ESLint to check for code issues
- `npm run lint:fix`: Run ESLint and automatically fix fixable issues

### Project Structure

```
interviewmate/
├── src/                          # React frontend
│   ├── App.js                   # Main React component
│   ├── AudioManager.js          # Audio processing logic
│   ├── Constants.js             # Application constants
│   ├── LocalServer.js           # Express server for extension comms
│   ├── Logging.js               # Centralized logging system
│   ├── MetricsManager.js        # Performance tracking
│   ├── TranscriptEntry.js       # Transcription display component
│   └── VADManager.js            # Voice Activity Detection
├── interview-extension/         # Chrome extension
│   ├── manifest.json           # Extension configuration
│   ├── background.js           # Service worker
│   ├── content-script.js       # Page data extraction
│   ├── popup.html/js           # Extension UI
│   └── README.md               # Extension documentation
├── static/                      # Static assets
│   ├── InterviewMate.png       # Main interface screenshot
│   └── chrome-extension.png    # Extension screenshot
├── main.js                     # Electron main process
├── preload.js                  # IPC security bridge
├── index.html                  # Main UI template
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

### Code Quality

This project uses ESLint to maintain code quality and catch potential issues during development. The linter is configured to handle:

- **Main Process**: Node.js environment rules for Electron main process
- **Renderer Process**: React and browser environment rules
- **ES6 Modules**: Modern JavaScript import/export syntax
- **React Hooks**: Proper usage of React hooks

Run `npm run lint` before committing to ensure code quality.

## Token Usage Optimization

InterviewMate includes several features to minimize API costs:

### Manual Analysis Control

- **No automatic LLM calls** - you control when analysis happens
- **"Analyze Conversation" button** prevents unwanted token usage
- **Buffer management** with manual reset capabilities

### Smart Transcription Filtering

- **Removes "BLANK AUDIO"** artifacts from Whisper
- **Filters filler words**: "um", "uh", "ah", "er", "hmm", "mhm"
- **Quality scoring**: Only meaningful speech reaches the conversation buffer
- **Annotation cleanup**: Removes `[LAUGHTER]`, `(audience)`, etc. from transcripts

### Usage Monitoring

- **Real-time buffer tracking**: See "Buffer: X chars" status
- **Performance metrics**: Track transcription and analysis times
- **Manual control**: Clear conversation buffer between topics

## Chrome Extension Setup

The included Chrome extension extracts interview questions for enhanced AI analysis:

### Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `interview-extension/` folder
4. The extension will appear in your toolbar

### Supported Platforms

- **LeetCode** (`leetcode.com`)
- **HackerRank** (`hackerrank.com`)
- **CoderPad** (`coderpad.io`)

### Usage

1. Navigate to any supported interview platform
2. Click the InterviewMate extension icon
3. Click "Extract Question" to send problem data to the app
4. Question appears in InterviewMate for priority analysis

## Logging System

InterviewMate uses a centralized logging system across all components:

### Log Levels

- `error`: Errors and exceptions
- `warn`: Warnings and potential issues
- `info`: General information (default)
- `debug`: Detailed debugging information

### Configuration

Set the log level using environment variable:

```bash
LOG_LEVEL=debug npm start  # Show all log levels
LOG_LEVEL=error npm start  # Show only errors
```

### Cross-Platform Support

- **Electron Main Process**: Uses CommonJS imports
- **React Renderer Process**: Uses ES6 imports
- **Consistent formatting** across all components

## Troubleshooting

### Audio & Recording Issues

- Ensure microphone permissions are granted in browser/Electron
- Check that the API key is correctly set in `.env`
- For audio issues, verify Web Audio API support
- Try restarting the app if VAD (Voice Activity Detection) fails

### LLM Analysis Issues

- **"Free tier exhausted"**: Upgrade your DashScope plan or reduce analysis frequency
- **No analysis appearing**: Click "🧠 Analyze Conversation" button (analysis is manual-only)
- **Poor analysis quality**: Clear conversation buffer and try again with focused speech

### Chrome Extension Issues

- **Extension not loading**: Ensure "Developer mode" is enabled in `chrome://extensions/`
- **Question not extracting**: Refresh the interview page and try again
- **Connection failed**: Ensure InterviewMate app is running on localhost:8080

### Performance Issues

- **High token usage**: Use manual analysis mode and clear buffer regularly
- **Slow transcription**: Check Whisper model download with `npx whisper-node download`
- **UI lag**: Clear conversation buffer if it gets too large (>10,000 chars)

### Logging & Debugging

- Set `LOG_LEVEL=debug` to see detailed logs
- Check console for `[INFO]`, `[ERROR]`, `[WARN]` messages
- Use "Performance Metrics" from View menu to track performance
