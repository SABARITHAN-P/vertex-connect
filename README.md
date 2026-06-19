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
* **No Phone Number Required**: Registration and access require only a valid email and username, completely avoiding the privacy risks of collecting sensitive mobile numbers.



---



### Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Tailwind CSS v4, Vite 8, React Router DOM v7 |
| **Backend** | Node.js, Express 5.2 (REST API), Socket.io (Real-time gateway) |
| **Database** | MongoDB (via Mongoose) |
| **Caching & Broker** | Redis (caching, online status tables, Socket.io Pub/Sub adapter) |
| **Real-Time Media** | WebRTC API (direct voice/video calls), Web Audio API (generating ringtones using code) |
| **Cloud Storage** | Cloudinary API, Multer (direct file uploads) |
| **AI Assistants** | Google Gemini API (Cloud AI via user keys) |
| **Email Delivery** | Brevo HTTP REST API (production), Nodemailer SMTP (local email backup) |

| **Deployments** | Vercel (frontend SPA rewrites), Render (backend web service keep-alives) |

---

## Project Structure


```bash
Vertex Connect/
├── client/                 # Frontend user interface code and assets
├── server/                 # Backend API routes, database schemas, and sockets
├── docs/                   # Detailed project documentation guides
├── .gitignore              # Build cache and secret exclusions
├── README.md               # Main documentation landing page
└── vercel.json             # Root routing rules for Vercel static hosting
```
* **`client/`**: Contains the React 19 source code, state contexts, custom hooks, and user interface files.
* **`server/`**: Houses the Express 5 controllers, socket event handlers, Mongoose schemas, and database files.
* **`docs/`**: Holds detailed, easy-to-read guides for the system.

---

## Documentation Hub

The core architecture, feature mechanics, and setup details are split into dedicated manuals. Explore them in detail here:

* **[System Architecture](docs/architecture.md)**: High-level design, client-server models, and running on multiple servers with Redis.
* **[Frontend Architecture](docs/frontend.md)**: React components layout, theme settings, and mobile swipe handlers.
* **[Backend Architecture](docs/backend.md)**: Express routes, controllers, and helper middlewares.
* **[Authentication & Security](docs/authentication.md)**: Sign up, login, password reset, and locked chats.
* **[API Reference](docs/api.md)**: Request and response details for all API paths, along with status codes.
* **[Database Design](docs/database.md)**: Database schemas, relationships, and cache setup.
* **[WebRTC Calling](docs/webrtc-calling.md)**: Voice/video calling details, call states, and code-generated ringtones.
* **[AI Assistant](docs/ai-assistant.md)**: Gemini AI setup, Google search capabilities, and caching replies.
* **[Deployment & Production](docs/deployment.md)**: Environment variables, Vercel static hosting, and Render stay-awake setup.

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

Vertex Connect enforces secure transmission and access rules across all services:
* **Stateless Authentication**: Uses JWT tokens to keep accounts secure. The app automatically detects when a session expires and asks the user to log in again.
* **Bcrypt Hashing**: Hashes passwords and passcodes 10 times using Bcrypt before saving them to the database, keeping them safe.
* **Privacy Protection**: Hides sensitive user info (like emails and last-seen times) automatically based on privacy settings before sending it to the client.
* **Chat Locks**: Locked chats need the correct passcode. Passcodes are deleted from the browser's memory as soon as you close the tab.

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

### 7. WebRTC ICE/TURN Server NAT Traversal
WebRTC connections fail on strict corporate/academic firewalls and cellular networks (CGNAT). To resolve this securely, the system automatically uses free public STUN/TURN servers from the Open Relay Project and Google for zero-configuration, cost-free testing and live demos, with optional support for fetching dynamic, short-lived TURN credentials from a private Metered.ca account when configured via environment variables.



---

## Future Enhancements

The following features are planned to make Vertex Connect even more secure and capable:

1. **End-to-End Message Encryption**: Encrypt messages on the sender's device before transmitting them, so that only the receiver can read them, ensuring absolute chat privacy.
2. **Offline Notifications**: Send push notifications for new messages and incoming calls directly to the user's desktop or mobile device, even when the browser tab is closed.
3. **Group Voice and Video Calls**: Expand the calling system from 1-on-1 calls to group calls, allowing multiple users to join the same voice or video conversation at the same time.
4. **GIF & Sticker Integration**: Add a media picker for search and send animated GIFs and local sticker packs, designed as a smooth popup panel with instant search and fast-loading images.
5. **In-Context AI Document & Media Uploads**: Integrate document (PDF, DOCX, TXT) and image upload controls in the AI Assistant chat drawer, feeding parsed content and images directly into the Google Gemini context window.


---

## Author

Developed by **Sabarithan P**

* **GitHub**: [SABARITHAN-P](https://github.com/SABARITHAN-P)
* **LinkedIn**: [Sabarithan P](https://www.linkedin.com/in/sabarithan-palanivel-302852293/)
