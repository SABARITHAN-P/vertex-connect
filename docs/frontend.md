# Frontend Client Architecture

The frontend client of **Vertex Connect** is a desktop-grade, real-time collaboration interface. It is built using **React 19**, **Vite**, and styled with **Tailwind CSS v4**.

---

## Technical Stack

* **React 19**: Core library for building the user interface.
* **Vite**: Fast tool to build and run the app during development.
* **Tailwind CSS v4**: CSS framework used to design and style the app.
* **React Router DOM v7**: Manages page navigation without page reloads.
* **Socket.io Client**: Handles real-time communication for chat messages, online status, and video/voice calls.
* **WebRTC API**: Direct video and voice calling between users in the browser.
* **SweetAlert2 & React Hot Toast**: Shows nice pop-up alerts and notifications that match the chosen theme.
* **React Easy Crop**: Lets users crop and resize images before uploading them.
* **Browser Image Compression**: Shrinks image file sizes in the browser before sending them to the server, making uploads faster.

---

## Directory Layout

```bash
client/
├── public/                 # Static assets (icons, fallback ringtones)
├── src/
│   ├── assets/             # Vector icons, SVG patterns, logos
│   ├── components/         # Shared and feature-specific UI components
│   │   ├── common/         # Shielded routes, custom players, desktop TitleBar
│   │   └── features/       # Feature-specific modules (AI, Calls, Chat, Group, Settings, Social)
│   ├── context/            # Global React Contexts (CallContext, ThemeProvider)
│   ├── hooks/              # Custom React hooks (useBackButton, useEscapeKey)
│   ├── layouts/            # Page shell layout templates
│   ├── pages/              # Routed page views (Login, VerifyOTP, ResetPassword, ChatPage)
│   ├── services/           # Axios HTTP client configurations and interceptors
│   ├── socket/             # Root Socket.io client configuration instance
│   └── utils/              # Helper utilities (alerts, sound cues, date formatters)
├── eslint.config.js        # JavaScript linting rules
├── jsconfig.json           # VSCode module resolution paths
├── package.json            # Client scripts and dependencies
├── vercel.json             # SPA routing rewrite rules for Vercel
└── vite.config.js          # Vite configuration and folder aliases
```

---

## Key Modules & Components

### 1. Chat & Message Interfaces (`src/components/features/chat`)
* **`ChatWindow.jsx`**: Manages the open chat, displays messages, handles file uploads, and shows when someone is typing.
* **`MessageBubble.jsx`**: Displays different types of messages (text, polls, voice recordings, pictures, system alerts, and emoji reactions). Also handles replying to, editing, and deleting messages.
* **`MessageInput.jsx`**: Handles typing messages, sending emojis, recording audio, and attaching files.
* **`Sidebar.jsx`**: Shows a list of your chats. You can search them or filter them by pinned, archived, locked, or unread messages.
* **`VoiceRecorder.jsx`**: Records voice messages using the device's microphone.

### 2. State & Context Providers (`src/context`)
* **`CallContext.jsx`**: Manages voice and video call connections, camera/mic access, and call signaling.
* **`ThemeProvider.jsx`**: Manages all settings and customizations:
  * **Theme**: Choose between light and dark modes.
  * **Font Family**: Supports Outfit, Inter, Playfair Display, Space Mono, Fredoka, Orbitron, Caveat, Cinzel, and Dancing Script.
  * **Font Size**: Change text size (Small, Medium, Large).
  * **Wallpaper**: Set solid colors, gradients, patterns, or custom links as chat wallpapers.
  * **Layout**: Reduces spacing to fit more content on smaller screens.

### 3. Shared Components (`src/components/common`)
* **`CustomAudioPlayer.jsx`**: A custom audio player that shows a moving waveform for voice notes and audio files.
* **`TitleBar.jsx`**: Shows a window bar at the top of the app with close, minimize, and maximize buttons to look like a desktop app.
* **`MarkdownRenderer.jsx`**: Formats messages from the AI assistant so code, tables, and bold text display correctly.

---

## State Management & Client Services

The app sends data to the server using Axios (for normal requests) and Socket.io (for real-time updates).

### Axios API Client (`src/services/api.js`)
Sets up Axios to automatically add special information to every request:
1. **User Token**: Adds the logged-in user's security token (JWT) to verify who they are:
   `Authorization: Bearer <token>`
2. **Chat Lock Passcode**: Automatically adds the passcode from temporary browser memory to fetch locked chats:
   `x-lock-passcode: <passcode>`
3. **Custom AI Key**: Adds the user's personal Gemini API key when talking to the AI:
   `x-gemini-key: <key>`
4. **Logout on Expiry**: Logs the user out and sends them to the login page if their session expires (returns a 401 response).

---

## Advanced UX Customizations

### 1. Phone Back Button Support
* **Swiping Menus**: Lets users swipe their finger on the screen to close side menus.
* **Hardware Back Button Interceptor (`src/utils/backButtonManager.js` & `src/hooks/useBackButton.js`)**:
  * Detects when a menu or pop-up drawer is open.
  * Intercepts the phone's physical back button so it closes the open menu instead of exiting the entire website.

### 2. Audio Synthesis Cues (`src/utils/toneSynthesizer.js`)
* Creates sound effects (like call ringing) using simple code in the browser instead of downloading large audio files.

### 3. Smooth Infinite Scroll (`src/components/features/chat/ChatWindow.jsx`)
* **Load Older Messages:** Scrolling near the top of a chat automatically loads earlier messages.
* **Keep Scroll Position:** When older messages load, the app adjusts the scrollbar position instantly so the screen doesn't jump or jitter, keeping your place.
* **Smooth Image Loading:** When images finish loading, the app adjusts the scrollbar to prevent the text from suddenly jumping.
