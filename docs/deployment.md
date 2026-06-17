# Deployment & Production Guidelines

**Vertex Connect** is structured to deploy on cloud platforms, with the frontend React application hosted on **Vercel** and the backend Express/WebSocket server deployed on **Render** (or equivalent cloud platforms).

---

## 1. Frontend Client Deployment (Vercel)

The React client builds into static files for hosting.

### Routing Configuration (`client/vercel.json` & Root `vercel.json`)
Because single-page applications handle routing in the browser, reloading a page like `/chat` or `/verify-otp` will cause a Vercel 404 error. To prevent this, we use a rewrite rule that sends all paths to `index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Environment Settings (Vercel)
Add these settings in the Vercel dashboard:
* `VITE_API_URL`: The HTTPS address of your backend API (e.g. `https://vertex-connect-api.onrender.com/api`).
* `VITE_SOCKET_URL`: The address of your backend server (e.g. `https://vertex-connect-api.onrender.com`).

---

## 2. Backend Server Deployment (Render)

The backend runs as a Web Service on Render. It connects to MongoDB Atlas and a Redis database.

### Environment Settings (Render)
Add these settings in the Render dashboard:
* `PORT`: Set automatically by Render (no need to change).
* `MONGO_URI`: Connection link to your MongoDB database.
* `REDIS_URL`: Connection link to your Redis database.
* `JWT_SECRET`: A secret key used to secure login tokens.
* `CLIENT_URL`: The web address of your frontend site (e.g. `https://vertex-connect.vercel.app`).
* `RENDER_EXTERNAL_URL`: Set automatically by Render (e.g. `https://vertex-connect-api.onrender.com`).
* `EMAIL_USER` & `EMAIL_PASS`: SMTP email settings (used as a backup to send emails).
* `BREVO_API_KEY`: Key from Brevo used to send OTP emails.
* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Settings for saving pictures on Cloudinary.
* `GEMINI_API_KEY`: Google Gemini key for the AI assistant.

---

## 3. Production Optimizations & Keep-Alives

To keep the app running smoothly on free cloud plans, the server runs background keep-alive tasks within `server.js`:

### 1. Render Free-Tier Self-Ping
Render's free tier shuts down the server if no one uses it for 15 minutes. This makes the app very slow to start for new users:
* **Fix**: The server automatically pings its own address every 10 minutes to keep itself awake.
  ```javascript
  setInterval(async () => {
    await axios.get(RENDER_EXTERNAL_URL);
  }, 10 * 60 * 1000); // 10 minutes
  ```

### 2. Brevo API Key Keep-Alive
Brevo deactivates free API keys if they are not used for 90 days:
* **Fix**: The server makes a simple account check request to Brevo every 20 days to keep your API key active.
  ```javascript
  setInterval(async () => {
    await axios.get("https://api.brevo.com/v3/account", {
      headers: { "api-key": BREVO_KEY }
    });
  }, 20 * 24 * 60 * 60 * 1000); // 20 days
  ```

### 3. Dynamic CORS Origin Rules
CORS rules on the server dynamically authorize socket connections:
* Allows testing on your computer (`localhost`).
* Allows Vercel preview environments using a regex match: `/^https:\/\/vertex-connect.*\.vercel\.app$/`.
* Allows your main website domain defined in `CLIENT_URL`.
