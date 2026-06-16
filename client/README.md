# Vertex Connect - Frontend Client

Welcome to the **Vertex Connect Frontend Client**—a desktop-grade, real-time communication interface built with **React 19**, **Vite**, and **Tailwind CSS v4**.

For detailed architecture, state configuration, styling systems, and gesture interception details, please refer to the main **[Frontend Documentation](../docs/frontend.md)**.

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19** | Core UI component lifecycle and virtual DOM management |
| **Vite 8** | High-performance bundler and development server |
| **Tailwind CSS v4** | Modern component styling and animation configuration |
| **React Router DOM v7** | Single Page Application (SPA) routing |
| **Socket.io Client** | Real-time bidirectional event pipeline |
| **WebRTC API** | Direct Peer-to-Peer media streaming and connection signaling |
| **SweetAlert2** | Custom, theme-aware premium dialog windows |
| **React Easy Crop** | Pre-upload image editor |
| **Browser Image Compression** | Compresses files on the client side before network transit |

---

## 📂 Directory Structure

```bash
client/
├── public/                 # Static assets (images, ringtone backups)
├── src/
│   ├── assets/             # SVGs, icons, and logo assets
│   ├── components/         # Reusable layouts and features (AI, Calls, Chat, Group, Settings, Social)
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

## 🚀 Setup & Run Instructions

Ensure your node environment is prepared (Node.js 18+ is recommended).

### 1. Installation
Install the necessary package modules:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in this directory or provide system environment parameters:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Run Development Server
Launch Vite local server:
```bash
npm run dev
```

### 4. Build Production Bundle
Build and minify for static deployments:
```bash
npm run build
```
The output bundle will be generated under the `dist/` directory, ready to serve or host on static services like Vercel.
