# Vertex Connect

Vertex Connect is a desktop-grade, real-time collaboration and chat application. It provides an all-in-one messaging workspace featuring private chats, role-managed group channels, high-fidelity Peer-to-Peer WebRTC voice/video calls, and a context-aware AI assistant.

Designed with premium, responsive aesthetics, Vertex Connect looks and feels like a native desktop operating system client, utilizing smooth micro-animations, customizable theme profiles, and custom hardware event controllers to provide an exceptional user experience on both desktop and mobile viewports.

---

## Why Vertex Connect? (Key Project Features)

Vertex Connect is designed as a clean, private, and efficient chat application. It stands out from standard chat apps with these simple features:

* **Bring-Your-Own-Key AI**: Instead of paying subscriptions to use AI, users can paste their own free Gemini API key to chat with the built-in AI assistant.
* **Locked Chats for Extra Privacy**: Instead of locking the whole app, users can lock individual sensitive chats with a passcode, keeping them hidden unless unlocked.
* **No Audio File Downloads**: To keep the app fast and lightweight, ringtones and calling sounds are generated mathematically by the browser in real-time.
* **Smart Media Uploads**: If a file or image has already been uploaded by someone else, the server is smart enough to reuse it rather than uploading it again, saving server space.
* **Reliable Signup Emails**: Uses the Brevo HTTP REST API to send verification emails, ensuring delivery works perfectly on cloud servers (like Render) where standard email ports are blocked.


---



## Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Tailwind CSS v4, Vite 8, React Router DOM v7 |
| **Backend** | Node.js, Express 5.2 (REST API), Socket.io (WebSocket gateway) |
| **Database** | MongoDB (via Mongoose ODM) |
| **Caching & Broker** | Redis (caching, presence tables, Socket.io Pub/Sub adapter) |
| **Real-Time Media** | WebRTC API (mesh voice/video), Web Audio API (signal tone synthesis) |
| **Cloud Storage** | Cloudinary API, Multer (in-memory streams) |
| **AI Assistants** | Google Gemini API (Cloud LLM - via user keys; backend includes local Ollama fallback) |
| **Email Delivery** | Brevo HTTP REST API (production), Nodemailer SMTP (local fallback) |

| **Deployments** | Vercel (frontend SPA rewrites), Render (backend web service keep-alives) |

---

## Project Structure


```bash
Vertex Connect/
├── client/                 # Frontend single page application code and assets
├── server/                 # Backend API routes, database schemas, and sockets
├── docs/                   # Detailed project documentation suite
├── .gitignore              # Multi-tier build cache and secret exclusions
├── README.md               # Main repository documentation landing page
└── vercel.json             # Root routing rewrites for Vercel SPA routing
```
* **`client/`**: Contains the React 19 source code, state contexts, custom hooks, and glassmorphic UI assets.
* **`server/`**: Houses the Express 5 controllers, socket event handlers, Mongoose schemas, and database configurations.
* **`docs/`**: Holds the senior-engineer-grade, comprehensive project documentation manuals.

---

## Documentation Hub

The core architecture, feature mechanics, and setup details are split into dedicated manuals. Explore them in detail here:

* **[System Architecture](docs/architecture.md)**: High-level design, client-server models, and horizontal scaling via Redis Pub/Sub.
* **[Frontend Architecture](docs/frontend.md)**: React components layout, theme customization engine, and mobile gesture interceptors.
* **[Backend Architecture](docs/backend.md)**: Express router structures, controller modules, and custom middleware layers.
* **[Authentication & Security](docs/authentication.md)**: Registration verification, login cycles, password recovery, and secure chat lock hashes.
* **[API Reference](docs/api.md)**: Payload and response mappings for primary REST endpoints, along with status codes.
* **[Database Design](docs/database.md)**: Mongoose document structures, entity relations, and caching strategies.
* **[WebRTC Calling](docs/webrtc-calling.md)**: Socket signaling states, call locking mutexes, and AudioContext tone synthesis.
* **[AI Assistant](docs/ai-assistant.md)**: Cloud-hosted Gemini conversation setup (BYOK), real-time Google search grounding, and response caching.
* **[Deployment & Production](docs/deployment.md)**: Environment variable configurations, Vercel SPA setups, and Render free-tier keep-alive pingers.

---

## Getting Started

### Prerequisites
* **Node.js**: Version 18.x or higher is recommended.
* **Databases**: Access to a MongoDB instance (local or Atlas) and a Redis instance.
* **Optional**: Google Gemini API Key.


### Installation
Clone the repository and install dependencies in both the `client` and `server` folders:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Variables
Set up your configurations before launching the servers:

#### Backend Server (`server/.env`)
```env
PORT=5000
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
JWT_SECRET=yoursecretkey
CLIENT_URL=http://localhost:5173
RENDER_EXTERNAL_URL=
EMAIL_USER=
EMAIL_PASS=
BREVO_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=

# Optional - For large-scale production TURN bandwidth (falls back to OpenRelay for demos/testing if empty)
METERED_API_KEY=
METERED_SUBDOMAIN=
```

#### Frontend Client (`client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Running the Application

To run the project locally, open two terminal windows:

#### 1. Start the Backend Server
```bash
cd server
npm run dev
```
The server will connect to MongoDB/Redis and begin listening for API requests and Socket.io connections on `http://localhost:5000`.

#### 2. Start the Frontend Client
```bash
cd client
npm run dev
```
Vite will compile assets and serve the frontend application at `http://localhost:5173`.

---

## Security Notes

Vertex Connect enforces secure transmission and access protocols across all services:
* **Stateless Auth**: Accounts are shielded behind HS256 JWT tokens. Expired sessions are caught by client-side API response interceptors.
* **Bcrypt Hashing**: User credentials and chat passcodes are hashed using Bcrypt with 10 salt rounds before storage.
* **Privacy Isolation**: User details (avatars, emails, last-seen timestamps) are redacted on the fly in response JSONs based on target privacy constraints.
* **Chat Lock Encryption**: Locked chats require an active passcode header verification. Passcodes are cleared instantly from memory when browser tabs close.

---

## Engineering Challenges & Solutions

### 1. Reliable OTP Email Delivery
Cloud hosting sites (like Render) block standard email sending ports. To fix this, the app uses an automatic switcher: it first tries using Google's Gmail API, falls back to Brevo's web API, and only uses standard email ports if those aren't set up. This ensures registration emails are always delivered.

### 2. Preventing Double Calls
When two users call each other at the same time, it can crash the call connection. The server uses fast Redis keys to instantly block a user from receiving or making multiple voice/video calls at once, returning a "busy" signal to the caller instead.

### 3. Preventing Duplicate File Uploads
To save database and cloud storage space, the client calculates a unique hash of an image before uploading it. The server checks if this hash exists in the database. If it does, the app immediately reuses the existing file link, bypassing the upload process entirely.

### 4. Code-Generated Call Tones
Downloading audio files (like `.mp3` files) for ringing and dialing tones takes time and can lag on mobile phones. Instead, the app synthesizes telephone sounds directly in the browser using simple code oscillators, saving bandwidth and creating instant sound cues.

### 5. Graceful Redis Outage Fallbacks
If the Redis database crashes or goes offline in production, the app does not shut down. The server detects the disconnect and automatically falls back to MongoDB to verify user permissions and profiles, ensuring the chat remains online.

### 6. Mobile Back Button Interception
On mobile devices, clicking the physical back button often exits the web page. To resolve this, a custom back button stack intercepts browser history. When a menu drawer or chat settings panel is open, the back button safely closes that specific panel instead of exiting the app.

### 7. Dynamic WebRTC ICE/TURN Server Negotiation
WebRTC connections fail on strict corporate/academic firewalls and cellular networks (CGNAT). To resolve this securely, the system negotiates dynamic, short-lived TURN credentials from Metered.ca via a secure backend endpoint, falling back automatically to the public Open Relay Project for zero-configuration, cost-free local testing and live demos.



---

## Future Enhancements

The following features are planned to make Vertex Connect even more secure and capable:

1. **End-to-End Message Encryption**: Encrypt messages on the sender's device before transmitting them, so that only the receiver can read them, ensuring absolute chat privacy.
2. **Offline Notifications**: Send push notifications for new messages and incoming calls directly to the user's desktop or mobile device, even when the browser tab is closed.
3. **Group Voice and Video Calls**: Expand the calling system from 1-on-1 calls to group calls, allowing multiple users to join the same voice or video conversation at the same time.
4. **GIF & Sticker Integration**: Add a dedicated media picker featuring animated GIF queries (via Giphy/Tenor APIs) and local sticker packs, designed as a smooth glassmorphic drawer with debounced searching and lazy-loaded image lists.

---


## Author

Developed by **Sabarithan P**

* **GitHub**: [SABARITHAN-P](https://github.com/SABARITHAN-P)
* **LinkedIn**: [Sabarithan P](https://www.linkedin.com/in/sabarithan-palanivel-302852293/)
