# Frontend Client Architecture

The frontend client of **Vertex Connect** is a desktop-grade, real-time collaboration interface. It is built using **React 19**, **Vite**, and styled with **Tailwind CSS v4**.

---

## Technical Stack

* **React 19**: Core library for UI rendering and lifecycle management.
* **Vite**: Ultra-fast build tool and development server.
* **Tailwind CSS v4**: Utility-first CSS framework for custom design tokens.
* **React Router DOM v7**: Managing client-side Single Page Application (SPA) routing.
* **Socket.io Client**: Real-time bidirectional WebSocket client for chat, presence, and signaling.
* **WebRTC API**: Native browser support for peer-to-peer audio and video streaming.
* **SweetAlert2 & React Hot Toast**: User-friendly, custom, theme-aware feedback alerts.
* **React Easy Crop**: Pre-upload image scaling and cropping.
* **Browser Image Compression**: Client-side image compression to reduce file sizes before uploads.

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
* **`ChatWindow.jsx`**: Coordinates active chat state, message feeds, background uploads, and typing indicators.
* **`MessageBubble.jsx`**: Renders message structures (text, polls, voice notes, media grids, system alerts, and reactions) with support for message thread replies and deletion/edit states.
* **`MessageInput.jsx`**: Handles draft states, typing indicator events, emojis, audio recordings, and file attachments.
* **`Sidebar.jsx`**: Displays list of active chats (filterable by pin, archive, lock, and unread states) and provides search options.
* **`VoiceRecorder.jsx`**: Captures voice notes using browser audio APIs.

### 2. State & Context Providers (`src/context`)
* **`CallContext.jsx`**: Manages WebRTC connections, audio/video streams, local camera/mic states, and coordinates with Socket.io signaling.
* **`ThemeProvider.jsx`**: Houses the dynamic application configuration settings:
  * **Theme**: Adaptive Light / Dark themes.
  * **Font Family**: Supports Outfit, Inter, Playfair Display, Space Mono, Fredoka, Orbitron, Caveat, Cinzel, and Dancing Script.
  * **Font Size**: Adjustable text sizing (Small ~13px, Medium ~15px, Large ~17px).
  * **Wallpaper**: Select solid backgrounds, gradients, vector patterns, or custom URLs with adjustable overlay opacity.
  * **Layout**: Compact mode toggles spacing on smaller screens.

### 3. Shared Components (`src/components/common`)
* **`CustomAudioPlayer.jsx`**: A custom-built player that renders dynamic audio waveforms for shared audio files and voice notes.
* **`TitleBar.jsx`**: Simulates a native desktop TitleBar with close, minimize, and maximize buttons.
* **`MarkdownRenderer.jsx`**: Safely renders code blocks, tables, and text styling for AI assistant responses.

---

## State Management & Client Services

Data fetching and mutations are handled directly using **Axios** HTTP requests and **Socket.io** event handling.

### Axios API Client (`src/services/api.js`)
Configures a centralized Axios client with interceptors:
1. **JWT Header Injection**: Appends the logged-in user's token:
   `Authorization: Bearer <token>`
2. **Chat Lock Passcode**: Extracts chat IDs and injects the unlocked passcode from `sessionStorage` for secure fetches:
   `x-lock-passcode: <passcode>`
3. **Custom AI Key**: Appends custom Gemini API keys to requests:
   `x-gemini-key: <key>`
4. **Session Expiry Interceptor**: Logs out the user and redirects to `/login` if any request returns a `401 Unauthorized` response.

---

## Advanced UX Customizations

### 1. Mobile Gesture Interceptor
* **Drawer & Drawer Gestures**: Uses custom touch listeners to allow swiping to close drawers.
* **Hardware Back Button Interceptor (`src/utils/backButtonManager.js` & `src/hooks/useBackButton.js`)**:
  * Pushes dummy window history states (`history.pushState`) when modal windows or drawers open.
  * Traps the back action. Clicking the hardware back button pops the state and fires registered callbacks to close open UI panels instead of navigating away.

### 2. Audio Synthesis Cues (`src/utils/toneSynthesizer.js`)
* Uses browser-synthesized waves via the Web Audio API rather than heavy static sound files. Plays ringtones and sonar dial sounds during incoming/outgoing calls.
