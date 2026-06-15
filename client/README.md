# Vertex Connect - Frontend Client

Welcome to the **Vertex Connect Frontend Client**—a desktop-grade, real-time communication application built with **React 19**, **Vite**, and **TailwindCSS v4**. Designed with premium aesthetics, rich transitions, and advanced responsiveness, this client provides a highly interactive workspace including real-time chats, group activities, Peer-to-Peer calling, and personal AI assistants.

---

## 🚀 Key Features

### 1. Real-Time Chat & Collaboration
* **Private & Group Channels**: Instant exchange of messages, replies, media, and location cards.
* **Typing Indicators & Read Receipts**: Live updates showing who is typing and exact read/delivery timestamps.
* **Poll Engine**: Design, launch, and vote on interactive polls with real-time percentages in groups.
* **Pinned, Locked & Archived Chats**:
  * **Archive**: Tidy up the list by hiding conversations.
  * **Lock**: Secure sensitive chats with a personal passcode. Messages are hidden behind `sessionStorage` passcode verification and sent with custom authorization headers.
  * **Pin**: Keep important conversations at the top.

### 2. Peer-to-Peer Calling (WebRTC)
* **High-Fidelity Audio/Video Calls**: Direct peer connections utilizing Google STUN servers.
* **In-Call Dashboard**: Control camera toggle, microphone mute, speaker simulation, and view the call duration timer.
* **Dynamic Audio Synthesis**: Synthesizes soft sonar dial tones, arpeggiated chord ringtones, and double-descending disconnect beeps via the Web Audio API without relying on audio file downloads.

### 3. Google Gemini AI Integration
* **Dedicated AI Assistant Tab**: Engage in isolated AI chat windows with persistent memory.
* **Custom AI Personas**: Customize the system prompt and instructions in the AI Settings drawer.
* **BYOK (Bring Your Own Key)**: Insert custom Gemini API keys to bypass default rate limits, securely passed to the backend via headers.
* **Markdown Renderer**: Formatted code blocks, inline styling, math equations, and single-click copy-to-clipboard options.

### 4. Rich Media & Image Editor
* **Image Editor & Cropper**: Crop, rotate, and scale avatars or shared pictures using `react-easy-crop` before uploading.
* **Custom Waveform Audio Player**: Listen to voice recordings or shared audio files using a custom visual track.
* **Full-Screen Media Carousel**: Double-click or click media items to open a fullscreen sliding viewer.
* **Media panel**: View all media, links, and documents shared within a conversation in a dedicated sidebar.

### 5. Customization & Personalization (ThemeProvider)
* **Adaptive Light & Dark Themes**: Synchronized instantly across active browser tabs using WebSockets.
* **Font Customization**: Choose between *Outfit, Inter, Playfair Display (Serif), Space Mono, Fredoka, Orbitron, Caveat, Cinzel,* and *Dancing Script* with three font sizes (Small ~13px, Medium ~15px, Large ~17px).
* **Chat Wallpapers**: Custom backgrounds featuring solid colors, CSS gradients, WhatsApp-like vector patterns, or user-defined image URLs. Includes a glassmorphism slider to set overlay opacity.
* **Compact Mode**: Toggles layouts to display more chat items and bubbles on smaller screen sizes.

### 6. Desktop-Grade UX (OS Feel)
* **TitleBar Simulator**: Restores a desktop application feel with fully functioning minimize, exit fullscreen, and SweetAlert2-based premium confirm-close modals.
* **Mobile Gesture Interceptor**: Supports swiping left/right to close drawers and slide-replying on messages. Intercepts hardware back button events on Android and mobile viewports to prevent accidental app exits.

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19** | Core UI component lifecycle and virtual DOM management |
| **Vite 8** | High-performance bundler and development server |
| **TailwindCSS v4** | Modern component styling and animation configuration |
| **React Router DOM v7** | Single Page Application (SPA) routing |
| **Socket.io Client** | Real-time bidirectional event pipeline |
| **WebRTC API** | Direct Peer-to-Peer media streaming and connection signaling |
| **SweetAlert2** | Custom, theme-aware premium dialog windows |
| **React Easy Crop** | Sub-pixel pre-upload image editor |
| **Browser Image Compression** | Compresses files on the client side before network transit |

---

## 📂 Project Structure

```bash
client/
├── public/                 # Static assets (images, ringtone backups)
├── src/
│   ├── assets/             # SVGs, icons, and logo assets
│   ├── components/         # Reusable layouts and features
│   │   ├── common/         # Shielded routes, custom players, desktop titlebar
│   │   └── features/       # Feature-specific modules (AI, Calls, Chat, Group, Settings, Social)
│   ├── context/            # React Contexts (Call state, custom ThemeProvider)
│   ├── hooks/              # Custom event interceptors (useBackButton, useEscapeKey)
│   ├── layouts/            # Page shell frames
│   ├── pages/              # Routed pages (Login, VerifyOTP, ResetPassword, ChatPage)
│   ├── services/           # Axios interceptors and central API client
│   ├── socket/             # Root Socket.io client instance
│   └── utils/              # Helper utilities (alerts, sound cues, date formatters)
├── eslint.config.js        # JavaScript code quality guidelines
├── jsconfig.json           # VSCode import mapping configs
├── package.json            # Scripts and dependency list
├── vercel.json             # SPA routing rewrite rules for Vercel deployments
└── vite.config.js          # Plugin hookups and `@` path aliases
```

---

## ⚙️ Path Aliases
To avoid deep directory import nesting (e.g. `../../../../components`), Vite and VSCode are configured with aliases mapping to the `src/` subdirectories:

* `@components` ➔ `src/components`
* `@pages` ➔ `src/pages`
* `@hooks` ➔ `src/hooks`
* `@context` ➔ `src/context`
* `@services` ➔ `src/services`
* `@socket` ➔ `src/socket`
* `@utils` ➔ `src/utils`
* `@assets` ➔ `src/assets`

---

## 📡 Axios API Interceptors (`src/services/api.js`)
Axios automatically intercepts outgoing requests and incoming responses to inject security contexts:
1. **JWT Header**: Appends `Authorization: Bearer <token>` if `userInfo` exists in `localStorage`.
2. **Chat Locks**: Detects message endpoints (e.g., `/message/:chatId`) and appends `x-lock-passcode: <passcode>` from `sessionStorage` to authorize locked chats.
3. **Custom Gemini Key**: Appends `x-gemini-key` to authorize custom AI usage, overriding server defaults.
4. **401 Intercept**: Automatically flushes expired user details and redirects the viewport to `/login`.

---

## 🎛️ Context Providers

### 1. `ThemeProvider` (`src/context/ThemeProvider.jsx`)
Coordinates live application styling:
* Applies `.dark` or `.light` class to `document.documentElement` alongside font weight, font styling, and compact mode properties.
* Provides `getWallpaperStyle` to render responsive backgrounds (WhatsApp dots, custom image, or linear color gradients) and overlays.
* Emits and listens to `"appearance:updated"` events to keep styling matching across multiple open browser tabs.

### 2. `CallProvider` (`src/context/CallContext.jsx`)
Orchestrates the WebRTC Peer Connection state machine:
* **States**: `idle` ➔ `calling`/`ringing` ➔ `connecting` ➔ `connected` ➔ `ended`/`failed`.
* **Flow**:
  1. Gathers local camera/mic stream using `getUserMedia`.
  2. Emits `call:initiate` via sockets and generates a database log entry.
  3. Swaps WebRTC SDP Offers, Answers, and ICE candidates.
  4. Manages in-call toggles and updates call history when hanging up.

---

## 🧰 Custom Listeners & Utility Managers

* **`escapeKeyManager` / `useEscapeKey`**: Registers keydown listeners in the browser's capture phase using a Last-In-First-Out (LIFO) stack with priority numbers. Allows nested drawers, galleries, and modals to close sequentially when pressing `Esc`.
* **`backButtonManager` / `useBackButton`**: Pushes temporary browser history states to intercept back navigation events on mobile devices. Prevents the browser from going back to the login page, closing the active modal/drawer instead.
* **`toneSynthesizer`**: Leverages the browser Web Audio API to play call sounds dynamically:
  * **Dial Tone**: A dual-frequency beep (440Hz + 480Hz) mimicking a classic telephone line.
  * **Ringtone**: An arpeggiated C-major/A-minor chord sequence.
  * **Disconnect Tone**: Descending frequency sweep when a call ends.
* **`soundHelper`**: Plays instant sound effects:
  * **Sent**: Swooshing checkmark audio ramp.
  * **Received**: Warm double-rising bell chime.
* **`premiumAlert` / `premiumConfirm`**: Wrapper over SweetAlert2 custom classes (e.g., `premium-swal-popup`) matching the Obsidian UI.

---

## 💾 LocalStorage & SessionStorage Map

| Storage Key | Type | Scope / Purpose |
| :--- | :--- | :--- |
| `userInfo` | Local | Token, user ID, profile name, and current avatar |
| `theme` | Local | Active theme mode (`light` or `dark`) |
| `font_size` | Local | Font scale setting (`small`, `medium`, or `large`) |
| `font_style` | Local | Selected font family class identifier |
| `compact_mode` | Local | Compact layout boolean state (`true` or `false`) |
| `wallpaper_type` | Local | Selected wallpaper category (`default`, `color`, `gradient`, `custom`) |
| `wallpaper_value` | Local | Direct value (color hex code, gradient values, or picture URL) |
| `wallpaper_opacity` | Local | Opacity value of the dimming overlay (0-100) |
| `enter_to_send` | Local | Determines whether pressing Enter sends messages or inserts lines |
| `sounds_enabled` | Local | Toggles UI sound effects |
| `auto_scroll` | Local | If `true`, lists scroll automatically to new messages |
| `vertex_custom_gemini_key` | Local | Personal Gemini AI API Key |
| `vertex_downloaded_files` | Local | Local record tracking completed file downloads |
| `lock_passcode_<chatId>` | Session | Passcode verifying access to a locked chat |

---

## 🚀 Setup & Run Instructions

Ensure your node environment is prepared (Node.js 18+ is recommended).

### 1. Installation
Install the necessary package modules:
```bash
npm install
```

### 2. Configure Environment variables
Create a `.env` file or provide system environment parameters:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Run Development server
Launch Vite local server:
```bash
npm run dev
```

### 4. Build Production Bundle
Build and minify for static deployments:
```bash
npm run build
```
The output bundle will be generated under the `dist/` directory, ready to serve or host on services like Vercel, Netlify, or AWS.
