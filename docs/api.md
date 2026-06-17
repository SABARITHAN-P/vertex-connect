# API Reference

The Vertex Connect backend exposes a secure REST API. Protected endpoints require a valid JWT token sent in the headers: `Authorization: Bearer <token>`.

---

## Authentication Endpoints (`/api/auth`)

### 1. Send OTP
* **Method & Route**: `POST /api/auth/send-otp`
* **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "username": "johndoe"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "OTP sent successfully"
  }
  ```

### 2. Register User
* **Method & Route**: `POST /api/auth/register`
* **Request Body**:
  ```json
  {
    "username": "johndoe",
    "email": "user@example.com",
    "password": "securepassword123",
    "otp": "123456"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "Registration successful",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "603d2b2f...",
      "username": "johndoe",
      "email": "user@example.com",
      "avatar": "",
      "status": "offline",
      "about": "Hey there!"
    }
  }
  ```

---

## Chat Endpoints (`/api/chat`)

### 1. Access or Create 1-to-1 Chat
* **Method & Route**: `POST /api/chat`
* **Request Body**:
  ```json
  {
    "userId": "603d2b2f..."
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "_id": "604e2b2f...",
    "isGroupChat": false,
    "participants": [
      { "_id": "603d2b2f...", "username": "johndoe" },
      { "_id": "603e2b2f...", "username": "janedoe" }
    ]
  }
  ```

### 2. Lock Conversation
* **Method & Route**: `POST /api/chat/lock/:chatId`
* **Request Body**:
  ```json
  {
    "passcode": "1234"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Chat locked successfully"
  }
  ```

---

## Message Endpoints (`/api/message`)

### 1. Send Message
* **Method & Route**: `POST /api/message`
* **Request Body**:
  ```json
  {
    "chatId": "604e2b2f...",
    "content": "Hello World!",
    "messageType": "text",
    "replyTo": {
      "messageId": "604f2b2f..."
    }
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "_id": "604f3b2f...",
    "chat": "604e2b2f...",
    "sender": {
      "_id": "603d2b2f...",
      "username": "johndoe"
    },
    "content": "Hello World!",
    "messageType": "text",
    "reactions": [],
    "messageStatus": []
  }
  ```

### 2. Fetch Chat Messages
* **Method & Route**: `GET /api/message/:chatId`
* **Query Parameters**:
  * `page` (optional): The page number to retrieve (default: `1`).
  * `limit` (optional): The number of messages per page (default: `20`).
* **Headers**: `x-lock-passcode` (required if chat is locked by user)
* **Success Response (200 OK)**:
  ```json
  {
    "messages": [
      {
        "_id": "604f3b2f...",
        "content": "Hello World!",
        "sender": { "_id": "603d2b2f...", "username": "johndoe" }
      }
    ],
    "hasMore": false,
    "currentPage": 1
  }
  ```

---

## Upload Endpoints (`/api/upload`)

### 1. Check File Hash (Deduplication)
* **Method & Route**: `GET /api/upload/check/:hash`
* **Success Response (200 OK - Cache Hit)**:
  ```json
  {
    "exists": true,
    "media": {
      "url": "https://res.cloudinary.com/...",
      "type": "image",
      "fileName": "landscape.jpg",
      "fileSize": 102456,
      "mimeType": "image/jpeg"
    }
  }
  ```

### 2. Upload Media
* **Method & Route**: `POST /api/upload`
* **Request Payload**: Multipart Form-Data containing one or multiple files under key `files`.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "media": [
      {
        "url": "https://res.cloudinary.com/...",
        "type": "image",
        "fileName": "photo.png",
        "fileSize": 51200,
        "mimeType": "image/png"
      }
    ]
  }
  ```

---

## AI Assistant Endpoints (`/api/ai`)

All AI requests require you to be logged in and require a custom header `x-gemini-key` containing your Google Gemini API Key.

### 1. Create AI Conversation
* **Method & Route**: `POST /api/ai/conversations`
* **Request Body**:
  ```json
  {
    "title": "New Chat"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "_id": "605c3b2f...",
    "user": "603d2b2f...",
    "title": "New Chat",
    "model": "gemma:latest",
    "temperature": 0.7,
    "maxTokens": 2048,
    "isSaved": false
  }
  ```

### 2. Stream AI Message response
* **Method & Route**: `POST /api/ai/conversations/:id/messages`
* **Headers**: `x-gemini-key` (required)
* **Request Body**:
  ```json
  {
    "content": "What is the capital of France?"
  }
  ```
* **Success Response (200 OK)**:
  * Sends the text reply piece-by-piece in real-time as it is generated (`Content-Type: text/event-stream`).

### 3. Extract Document Text (Backend-Only / Inactive in UI)
* **Method & Route**: `POST /api/ai/parse-file`
* **Request Payload**: Multipart Form-Data with a single file under the key `file` (supports `.pdf`, `.docx`, `.txt`, `.md`).
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "fileName": "document.pdf",
    "fileSize": 102456,
    "mimeType": "application/pdf",
    "extractedText": "Extracted document text content..."
  }
  ```

---

## Error Handling Schemes

All API errors return a standard JSON structure to make it easy for client applications to read errors:

```json
{
  "message": "Detailed error description goes here"
}
```

### Common HTTP Status Codes
| Code | Reason | Scenario |
| :--- | :--- | :--- |
| **200** | OK | Request succeeded. |
| **201** | Created | Resource (like a user, chat, or message) was successfully created. |
| **400** | Bad Request | Missing settings, wrong OTP, or validation errors. |
| **401** | Unauthorized | Login token is missing, expired, or invalid. |
| **403** | Forbidden | You have blocked each other or are trying to open a locked chat without the passcode. |
| **404** | Not Found | The requested item (like a user or chat) could not be found. |
| **500** | Server Error | Server errors (like database connection issues or external service timeouts). |
