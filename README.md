# TextingApp - Real-Time WhatsApp-Inspired Messaging Application

A modern, responsive, WhatsApp-inspired full-stack real-time texting application built with **React.js** (Vite) on the frontend and **Django** (Django REST Framework, Django Channels, ASGI) on the backend, using **PostgreSQL** for persistent storage and **Redis** for WebSocket channel distribution and temporary presence/cache management.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │             React.js Client (Vite)           │
                      │  - Zustand State Stores                      │
                      │  - Axios HTTP (with JWT Auto-refresh)        │
                      │  - Real-time WebSocket Service               │
                      └──────────────┬───────────────────────────────┘
                                     │
                    HTTP REST API    │   WebSockets (Ticket Auth)
                    /api/auth/*      │   ws://localhost:8000/ws/chat/?ticket=...
                    /api/conversations/*
                    /api/messages/*  │
                    /api/attachments/*
                                     ▼
                      ┌──────────────────────────────────────────────┐
                      │              Django ASGI Backend             │
                      │  - Daphne ASGI Server                        │
                      │  - Django REST Framework (SimpleJWT)         │
                      │  - Django Channels (TicketAuthMiddleware)    │
                      └───────┬───────────────────────────────┬──────┘
                              │                               │
                              ▼                               ▼
               ┌─────────────────────────────┐  ┌─────────────────────────────┐
               │         PostgreSQL          │  │            Redis            │
               │  - Persistent source of truth│ │  - Channels layer group dist│
               │  - Custom User Model (UUID) │  │  - Multi-tab presence count │
               │  - Conversations & Members  │  │  - Outbox pub/sub & events  │
               │  - Messages & Receipts      │  └─────────────────────────────┘
               │  - Attachments & Metadata   │
               └─────────────────────────────┘
```

---

## Key Features

1. **Authentication & User Management**:
   - Registration, login, token refresh, and logout with JWT blacklist.
   - Profile management with custom display name, status message ("About"), and profile picture upload.
   - User search by username and display name.
   - Online/offline presence indicators and last seen timestamps.
   - Secure WebSocket authentication using single-use short-lived tickets (`/api/auth/ws-ticket/`) so long-lived JWTs are never exposed in WebSocket URLs.

2. **One-to-One & Group Conversations**:
   - One-to-one chats with instant search and automatic prevention of duplicate direct chats.
   - Group chats with custom name, avatar, member management (add/remove), and group administrator roles.
   - Recent conversation list with last message snippet, timestamp, unread message count badges, and online presence dots.

3. **Real-Time Messaging**:
   - Instant message transmission using Django Channels WebSockets.
   - **Persistence before broadcast**: messages are committed to PostgreSQL with member receipts before broadcasting over Redis.
   - Client-generated idempotency keys preventing duplicate message sends.
   - Cursor-based message history pagination with scroll-up loading.
   - Message editing and soft-deletion with real-time sync across connected clients.

4. **Message Status & Receipts**:
   - Sent status (single tick).
   - Delivered status (double grey tick).
   - Read status (double emerald/cyan tick).
   - Individual recipient receipts for group messages.

5. **Typing Indicators & Multi-Connection Presence**:
   - Real-time typing indicators in both the conversation header and chat bubble list with debounce.
   - Presence tracker accounting for multi-device / multi-tab connections and clean disconnect updates.

6. **File Sharing & Media Attachments**:
   - Image uploads with inline preview and full-resolution view.
   - Document uploads (PDF, DOCX, TXT, CSV, ZIP) with file size formatting and download links.
   - Strict server-side file size (10MB limit) and MIME type validation.
   - Stored locally in Django media storage.

7. **Design & Themes**:
   - WhatsApp-inspired color scheme with dark mode (`#111b21`) and light mode (`#ffffff`, `#f0f2f5`).
   - Clean message bubbles with sender distinction.
   - Responsive mobile view switching between conversation list and chat screen with mobile back navigation.

---

## Project Structure

```
texting-app/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── .env
│   ├── config/             # ASGI, WSGI, URLs, Settings
│   ├── accounts/           # Custom User model, Auth views, Serializers, Tests
│   ├── conversations/      # Conversation & Member models, Group management, Tests
│   ├── messaging/          # Message & MessageReceipt models, Pagination, Tests
│   ├── realtime/           # ChatConsumer, TicketAuthMiddleware, Presence, E2E Tests
│   ├── attachments/        # File attachment models, Upload view, Validation, Tests
│   └── notifications/      # Notification models
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── api/client.js               # Axios instance with JWT interceptors
│       ├── services/websocket.js       # WebSocket client with ticket auth & reconnect
│       ├── stores/
│       │   ├── authStore.js            # Zustand auth state
│       │   └── chatStore.js            # Zustand conversation & message state
│       ├── styles/
│       │   └── theme.css               # WhatsApp design tokens & themes
│       ├── components/
│       │   ├── common/                 # Avatar, ThemeToggle
│       │   ├── auth/                   # Login, Register
│       │   ├── sidebar/                # Sidebar, ConversationItem, Modals
│       │   └── chat/                   # ChatArea, ChatHeader, MessageList, Composer
│       ├── App.jsx                     # Router & Protected routes
│       └── index.css                   # Global styles & responsive rules
└── README.md
```

---

## Local Development Setup

### 1. Prerequisites
- **Python**: 3.10+ (tested on Python 3.13)
- **Node.js**: 18+ (tested on Node v24)
- **PostgreSQL**: 14+ (local instance)
- **Redis**: 6+ (local instance)

---

### 2. Database Setup (PostgreSQL)

Start your local PostgreSQL server and create the application database and user:

```sql
-- In psql or pgAdmin:
CREATE DATABASE texting_db;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE texting_db TO postgres;
```

---

### 3. Redis Setup

Start your local Redis server on the default port `6379`:

- **Windows**: Run Redis via native service, Memurai (`memurai.exe`), or WSL:
  ```bash
  redis-server
  ```
- **macOS / Linux**:
  ```bash
  redis-server
  # or via brew:
  brew services start redis
  ```

---

### 4. Backend Configuration & Startup

1. Open a terminal in the `backend/` directory:
   ```bash
   cd texting-app/backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Verify your `.env` settings:
   ```ini
   DEBUG=True
   SECRET_KEY=django-insecure-texting-app-development-key-9db32b65-2aa4-4ef4-9d55
   ALLOWED_HOSTS=*

   # PostgreSQL settings:
   DB_ENGINE=django.db.backends.postgresql
   DB_NAME=texting_db
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_HOST=127.0.0.1
   DB_PORT=5432
   USE_SQLITE=False

   # Redis settings:
   REDIS_URL=redis://127.0.0.1:6379/1
   USE_INMEMORY_CHANNELS=False
   ```

5. Run database migrations:
   ```bash
   python manage.py migrate
   ```

6. Start the Django ASGI development server:
   ```bash
   python manage.py runserver
   ```
   The backend will run on `http://127.0.0.1:8000` with full HTTP REST and WebSocket ASGI support.

---

### 5. Frontend Setup & Startup

1. Open a second terminal in the `frontend/` directory:
   ```bash
   cd texting-app/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## Terminal Commands Quick Reference

| Terminal | Purpose | Command |
|---|---|---|
| **Terminal 1** | Redis Server | `redis-server` |
| **Terminal 2** | Django ASGI Server | `cd backend` <br> `.\venv\Scripts\activate` <br> `python manage.py runserver` |
| **Terminal 3** | React Vite Frontend | `cd frontend` <br> `npm run dev` |

---

## Running the Automated Test Suite

The test suite covers models, serializers, REST endpoints, WebSocket lifecycle, receipts, and multi-user integration:

```bash
cd texting-app/backend
.\venv\Scripts\activate
python manage.py test
```

To run individual test modules:
```bash
# Accounts (registration, login, profile, search)
python manage.py test accounts

# Conversations (direct conversations, group creation, member management)
python manage.py test conversations

# Messaging (persistence, pagination, idempotency, editing, deletion)
python manage.py test messaging

# Realtime & WebSockets (ticket authentication, message delivery, receipts, typing)
python manage.py test realtime

# Attachments (file uploads, MIME validation, size limits)
python manage.py test attachments
```

---

## REST API Specification

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register/` | POST | Register new user account |
| `/api/auth/login/` | POST | Authenticate user & issue JWT tokens |
| `/api/auth/refresh/` | POST | Refresh expired access token |
| `/api/auth/logout/` | POST | Invalidate refresh token (blacklist) |
| `/api/auth/me/` | GET, PATCH | View and update current user profile |
| `/api/auth/ws-ticket/` | POST | Generate secure short-lived WebSocket ticket |
| `/api/users/search/?q=` | GET | Search registered users by username / display name |
| `/api/users/{id}/` | GET | Retrieve user profile |
| `/api/conversations/` | GET, POST | List recent conversations / start 1-to-1 or group chat |
| `/api/conversations/{id}/` | GET, PATCH, DELETE | Conversation details, update group, leave chat |
| `/api/conversations/{id}/members/` | GET, POST | List members / add members (admin only) |
| `/api/conversations/{id}/members/{user_id}/` | DELETE | Remove group member (admin only or self) |
| `/api/conversations/{id}/messages/` | GET, POST | Paginated message history / send message |
| `/api/messages/{id}/` | GET, PATCH, DELETE | Retrieve, edit, or soft-delete message |
| `/api/messages/{id}/read/` | POST | Mark message as read |
| `/api/attachments/upload/` | POST | Upload file or image attachment (multipart) |

---

## WebSocket Events

WebSocket URL: `ws://localhost:8000/ws/chat/?ticket=<ticket_uuid>`

### Client to Server:
- `message.send`: `{ type: "message.send", conversation_id, text, idempotency_key, attachment_ids }`
- `message.delivered`: `{ type: "message.delivered", message_id, conversation_id }`
- `message.read`: `{ type: "message.read", message_id, conversation_id }`
- `typing.start`: `{ type: "typing.start", conversation_id }`
- `typing.stop`: `{ type: "typing.stop", conversation_id }`

### Server to Client:
- `message.new`: Broadcasts newly created message payload to conversation members.
- `message.updated`: Broadcasts edited message text.
- `message.deleted`: Broadcasts soft-deletion update.
- `message.delivered`: Broadcasts recipient delivery receipt.
- `message.read`: Broadcasts recipient read receipt.
- `typing.update`: Broadcasts member typing status (`is_typing: true/false`).
- `presence.update`: Broadcasts user online/offline status and last seen timestamp.
