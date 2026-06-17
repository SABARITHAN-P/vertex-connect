# Vertex Connect - Frontend Client

Welcome to the **Vertex Connect Frontend Client**—a desktop-grade, real-time communication interface built with **React 19**, **Vite**, and **Tailwind CSS v4**.

For detailed architecture, state configuration, styling systems, and gesture interception details, please refer to the main **[Frontend Documentation](../docs/frontend.md)**.

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **React 19** | Core library for building the user interface |
| **Vite 8** | Fast tool to build and run the app during development |
| **Tailwind CSS v4** | CSS framework used to design and style the app |
| **React Router DOM v7** | Manages page navigation without page reloads |
| **Socket.io Client** | Handles real-time updates and messages |
| **WebRTC API** | Direct video and voice calling between users in the browser |
| **SweetAlert2** | Shows nice popup alerts and notifications that match the theme |
| **React Easy Crop** | Lets users crop and resize images before uploading |
| **Browser Image Compression** | Shrinks image sizes in the browser to make uploads faster |

---

## 📂 Directory Structure

```bash
client/
├── public/                 # Static files (icons, ringtone backups)
├── src/
│   ├── assets/             # Icons, images, and logos
│   ├── components/         # Reusable layouts and features (AI, Calls, Chat, Group, Settings, Social)
│   ├── context/            # Context files (managing call state and themes)
│   ├── hooks/              # Custom hooks (like back-button detection)
│   ├── layouts/            # Page layout frames
│   ├── pages/              # App pages (Login, VerifyOTP, ChatPage, etc.)
│   ├── services/           # API connection settings and helper utilities
│   ├── socket/             # Main real-time connection setup
│   └── utils/              # Small helpers (alerts, date formatters, sound generators)
├── eslint.config.js        # JavaScript code checker rules
├── jsconfig.json           # VSCode import settings
├── package.json            # Project dependencies and script commands
├── vercel.json             # Static routing settings for Vercel
└── vite.config.js          # Vite project settings
```

---

## 🚀 Setup & Run Instructions

Make sure Node.js (version 18 or higher) is installed.

### 1. Installation
Install project packages:
```bash
npm install
```

### 2. Configure Environment Settings
Create a `.env` file in this folder and add the following settings:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Run Development Server
Start the development server:
```bash
npm run dev
```

### 4. Build Production Bundle
Prepare and optimize the app for production deployment:
```bash
npm run build
```
The optimized website files will be generated in the `dist/` folder, ready to host on static hosting services like Vercel.
