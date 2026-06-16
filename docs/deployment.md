# Deployment & Production Guidelines

**Vertex Connect** is structured to deploy on cloud platforms, with the frontend React application hosted on **Vercel** and the backend Express/WebSocket server deployed on **Render** (or equivalent cloud platforms).

---

## 1. Frontend Client Deployment (Vercel)

The React client compiles to a static single-page application (SPA). 

### Routing Configuration (`client/vercel.json` & Root `vercel.json`)
Because SPAs handle routing on the client side, hard browser refreshes on routes like `/chat` or `/verify-otp` will result in a Vercel 404 error if not handled. A rewrite rule directs all incoming paths to `index.html`:
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

### Environment Variables (Vercel)
Provide these parameters during Vercel project configuration:
* `VITE_API_URL`: The public HTTPS URL of your Render server (e.g. `https://vertex-connect-api.onrender.com/api`).
* `VITE_SOCKET_URL`: The root URL of the Render server (e.g. `https://vertex-connect-api.onrender.com`).

---

## 2. Backend Server Deployment (Render)

The server runs as a Web Service on Render, bound to a port and integrated with MongoDB Atlas and a Redis instance (e.g., Render Redis or Upstash).

### Environment Variables (Render)
Configure these variables on the Render dashboard:
* `PORT`: Set automatically by Render.
* `MONGO_URI`: Connection string to your MongoDB Atlas cluster.
* `REDIS_URL`: Connection string to your Redis database instance.
* `JWT_SECRET`: Cryptographically strong random string used to sign JWTs.
* `CLIENT_URL`: The URL of your Vercel deployment (e.g. `https://vertex-connect.vercel.app`).
* `RENDER_EXTERNAL_URL`: Set automatically by Render (e.g. `https://vertex-connect-api.onrender.com`).
* `EMAIL_USER` & `EMAIL_PASS`: SMTP credentials (used as fallback local mail delivery).
* `BREVO_API_KEY`: API key for Brevo HTTP email delivery (primary production option).
* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Cloudinary integration keys.
* `GEMINI_API_KEY`: Google Gemini API key for cloud LLM processing.


---

## 3. Production Optimizations & Keep-Alives

To optimize performance and circumvent constraints of free cloud hosting plans, the server implements two keep-alive tasks within `server.js`:

### 1. Render Free-Tier Self-Ping
Render's Free Tier spins down web services after 15 minutes of inactivity, causing cold starts up to 1 minute for subsequent requests:
* **Resolution**: When `RENDER_EXTERNAL_URL` is set, the server schedules an HTTP GET ping to itself every 10 minutes, resetting Render's inactivity timer.
  ```javascript
  setInterval(async () => {
    await axios.get(RENDER_EXTERNAL_URL);
  }, 10 * 60 * 1000); // 10 minutes
  ```

### 2. Brevo API Key Keep-Alive
Brevo automatically deactivates API keys if no transactional emails or API calls occur within a 90-day window:
* **Resolution**: If `BREVO_API_KEY` is present, the server runs a task every 20 days that calls Brevo's account retrieval endpoint to keep the key active.
  ```javascript
  setInterval(async () => {
    await axios.get("https://api.brevo.com/v3/account", {
      headers: { "api-key": BREVO_KEY }
    });
  }, 20 * 24 * 60 * 60 * 1000); // 20 days
  ```

### 3. Dynamic CORS Origin Resolvers
CORS rules on the server dynamically authorize socket connections:
* Allows local development environments (`localhost`).
* Allows Vercel preview environments using a regex match: `/^https:\/\/vertex-connect.*\.vercel\.app$/`.
* Allows the production deployment domain defined in `CLIENT_URL`.
