# High-Level Architecture

**Vertex Connect** is designed around a hybrid real-time architecture that combines a structured **REST API** with an event-driven **Socket.io** gateway, using **Redis** for database caching, WebSocket horizontal scaling, and active call coordination.

---

## High-Level System Architecture

This diagram shows how the React frontend, Express backend, MongoDB database, and Redis cache work together:

```mermaid
%%{ init: { 'flowchart': { 'curve': 'linear' } } }%%
flowchart TD
    %% 1. Client Layer
    subgraph Client Layer
        Client["React Client App (Vite, Socket.IO Client, TanStack Query)"]
    end

    %% 2. API & Realtime Layer
    subgraph API & Realtime Layer
        ExpressAPI["Express.js API Gateway"]
        SocketGateway["Socket.IO Realtime Gateway"]
    end

    %% 3. Business Logic Layer
    subgraph Business Logic Layer
        AuthService["Auth & OTP Service"]
        MsgService["Message & Chat Service"]
        MediaService["Media & Upload Service"]
        AIService["Gemini AI Coordinator"]
    end

    %% 4. Data Layer
    subgraph " "
        DataLayer[("Data & Caching Layer<br/>• MongoDB (Users, Messages, Groups, AI History)<br/>• Redis (Presence, Call Locks, Pub/Sub Adapter)")]
        Title4["Data & Caching Layer"]
        DataLayer ~~~ Title4
    end
    style Title4 fill:none,stroke:none

    %% 5. External Services Layer
    subgraph " "
        Brevo["Brevo Email API (OTP Delivery)"]
        Cloudinary["Cloudinary Storage (Media CDN)"]
        GeminiAPI["Gemini AI Cloud API (BYOK Model)"]
        Title5["External Services Layer"]
        Brevo ~~~ Title5
        Cloudinary ~~~ Title5
        GeminiAPI ~~~ Title5
    end
    style Title5 fill:none,stroke:none


    %% --- Request & Data Flow ---

    %% Client to API Gateways
    Client --> ExpressAPI
    Client <--> SocketGateway

    %% API Gateways to Services
    ExpressAPI --> AuthService
    ExpressAPI --> MsgService
    ExpressAPI --> MediaService
    ExpressAPI --> AIService
    
    %% Socket Gateway presence & pub/sub adapter
    SocketGateway <--> DataLayer

    %% Services to Data & Caching
    AuthService --> DataLayer
    MsgService --> DataLayer
    MediaService --> DataLayer
    AIService --> DataLayer

    %% Services to External API Gateways
    AuthService --> Brevo
    MediaService --> Cloudinary
    AIService --> GeminiAPI
```

> [!NOTE]
> **Running on Multiple Servers**: Although currently running as a single Express server on Render, the system uses a Redis Pub/Sub adapter (`@socket.io/redis-adapter`) so that you can run multiple backend servers behind a load balancer at any time.

---

## Architectural Decisions

### 1. Database Caching Layer (Redis)
To make the backend faster and reduce database load, it stores frequently used data in Redis:
* **User Profiles**: Cached for 30 minutes so the server doesn't have to check MongoDB for every request.
* **Privacy & Follow Settings**: Cached for 1 hour to quickly check if a user is allowed to send messages or make calls.
* **AI Responses**: Saved in Redis so if another user asks the same question, the app can show the saved answer immediately without asking the AI again.

### 2. Multi-Server WebSockets (Redis Adapter)
WebSockets are normally saved in a server's temporary memory. To support running multiple servers at the same time, we use `@socket.io/redis-adapter`.
* All chat events are sent through Redis.
* Redis shares them with all server instances, so users can chat with each other even if they are connected to different servers.


### 3. Active Call Coordination (Preventing Double Calls)
To stop users from making or receiving more than one call at a time:
* The server checks Redis for an active call key (`active_call:<userId>`) before starting a call.
* Starting a call locks the user's status for 60 seconds (to handle ringing). If the call is answered, this lock is extended for up to 2 hours.
* The lock is deleted immediately when the call ends.

---

## Real-Time Messaging & Status Data Flow

The diagram below shows the path a message takes from being sent to being received:

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Client A)
    participant Server as Express Server
    participant DB as MongoDB
    participant Redis as Redis Cache
    actor Bob as Bob (Client B)
    
    Alice->>Server: HTTP POST /api/message (Payload + JWT)
    activate Server
    Server->>DB: Save Message Document
    Server->>DB: Update Chat (lastMessage reference)
    Server->>Redis: Invalidate user:chats_populated for participants
    Server->>Alice: Return HTTP 201 (Message Object)
    deactivate Server
    
    Server->>Bob: WebSocket Event: 'newMessage'
    activate Bob
    Bob->>Server: WebSocket Event: 'delivered' (messageId)
    deactivate Bob
    
    activate Server
    Server->>DB: Update Message Status (delivered = true)
    Server->>Alice: WebSocket Event: 'messageStatusUpdate' (delivered)
    deactivate Server
```

1. **REST Message Delivery**: Messages are sent using standard HTTP requests to ensure they are saved correctly in the database and checked for safety.
2. **Cache Clear**: The server deletes the old chat list from Redis for both users so they see the new message immediately.
3. **Real-time Push**: The message is sent to Bob immediately over WebSockets. If Bob is online, Alice gets a "delivered" status checkmark.
