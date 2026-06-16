# High-Level Architecture

**Vertex Connect** is designed around a hybrid real-time architecture that combines a structured **REST API** with an event-driven **Socket.io** gateway, using **Redis** for database caching, WebSocket horizontal scaling, and active call coordination.

---

## High-Level System Architecture

The following diagram illustrates the interaction between the React frontend client, Node/Express server nodes, MongoDB database, and the Redis cache/broker layer:

```mermaid
graph TB
    Client[React Client] <-->|HTTPS REST / WSS Sockets| LB[Load Balancer]
    LB <--> Node1[Express Server 1]
    LB <--> Node2[Express Server 2]
    
    subgraph Data Layer
        Node1 <-->|Mongoose Queries| Mongo[(MongoDB)]
        Node2 <-->|Mongoose Queries| Mongo
        
        Node1 <-->|Pub/Sub & Caching| Redis[(Redis)]
        Node2 <-->|Pub/Sub & Caching| Redis
    end
    
    subgraph Third-Party Integrations
        Node1 -->|HTTPS| Cloudinary((Cloudinary CDNs))
        Node2 -->|HTTPS| Gemini((Gemini AI Cloud BYOK))
        Node1 -->|HTTPS| MailSender((Brevo / Gmail API))
    end

```

---

## Architectural Decisions

### 1. Database Caching Layer (Redis)
To minimize disk reads and optimize latency, the backend leverages Redis for active caches:
* **User Profiles**: Cached for 30 minutes to shield MongoDB from authentication lookups.
* **Privacy Controls & Follow States**: Cached for 1 hour to verify message and calling permissions on the fly.
* **Hashed AI Responses**: Hashed prompts are cached in Redis to instantly serve common questions without invoking model compute.

### 2. Horizontal WebSocket Scaling (Redis Adapter)
Socket.io maintains connections in-memory on each server node. To support horizontal scaling (running multiple server instances behind a load balancer), the servers integrate `@socket.io/redis-adapter`.
* All socket events are published to Redis Pub/Sub channels.
* Redis automatically broadcasts events to other server nodes, ensuring that a user connected to *Server 1* can message or call a user connected to *Server 2* seamlessly.

### 3. Active Call Coordination (Mutex-like Lock)
To prevent users from receiving multiple calls or dial requests simultaneously:
* Dials and connections check for existing active keys in Redis (`active_call:<userId>`).
* Initiating a call sets a temporary mutex lock (60-second expire), which is updated to a 2-hour session key once the call is answered.
* The lock is deleted instantly when the call ends or disconnects.

---

## Real-Time Messaging & Status Data Flow

The sequence diagram below details the path a message takes from transmission to receipt, along with real-time state broadcasts:

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

1. **REST Message Delivery**: Messages are sent via REST endpoints to guarantee ACID transactions, file reference logging, and input validations.
2. **Cache Invalidation**: The server invalidates the populated chat list caches in Redis for both Alice and Bob.
3. **Real-time Push**: The message is instantly pushed to Bob over WebSockets. If Bob is active, a `delivered` status notification is returned to update Alice's message receipt state.
