# paisatax-web-user

Next.js 16 frontend for the PaisaTax chat-first tax filing app. This is a **chat-only UI** — no wizard, no sidebar, just a conversation with an AI agent that files your taxes.

**Port:** 3000

## Architecture Overview

```
paisatax-web-user (Next.js 16, port 3000)   ◄── YOU ARE HERE
  ├── app/                     ← Next.js App Router pages
  │   ├── page.tsx             ← Landing page (filing status selection)
  │   └── chat/page.tsx        ← Main chat page
  ├── src/
  │   ├── context/
  │   │   ├── AgentContext.tsx  ← Global state: session, messages, actions
  │   │   └── ThemeContext.tsx  ← Dark/light theme toggle
  │   ├── lib/
  │   │   ├── api.ts           ← Fetch wrappers for paisatax-agent backend
  │   │   └── types.ts         ← TypeScript types (mirrors agent types)
  │   ├── components/
  │   │   ├── chat/            ← Chat UI components
  │   │   └── layout/          ← Header, progress bar
  │   └── hooks/
  │       └── useAutoScroll.ts ← Auto-scroll to bottom on new messages
        │
        │ HTTP fetch() to localhost:3002
        ▼
  paisatax-agent (Express, port 3002)
```

---

## How Data Flows

### 1. Session Creation (Landing → Chat)

```
User clicks "Single" on landing page
  → AgentContext.startSession("single")
    → api.createSession("single")
      → POST http://localhost:3002/api/agent/session { filingStatus: "single" }
      ← { sessionKey: "session_1_..." }
    → api.converse({ sessionKey, message: "I want to file..." })
      → POST http://localhost:3002/api/agent/converse
      ← { messages: [...], phase: "intake", progress: 0 }
    → Updates state: sessionKey, phase, progress, messages
    → Navigates to /chat
```

### 2. Sending a Message

```
User types "I have W-2 income" and presses Enter
  → ChatInput calls sendMessage("I have W-2 income")
    → AgentContext.sendMessage()
      → Adds user message to local state immediately (optimistic)
      → Sets isLoading = true
      → api.converse({ sessionKey, message })
        → POST http://localhost:3002/api/agent/converse
        ← { messages: [{ type: "text", content: "..." }, { type: "quick_reply", ... }], phase, progress }
      → handleResponse():
        → Creates assistant ChatMessage with all response blocks
        → Appends to messages array
        → Updates phase and progress
        → Sets isLoading = false
```

### 3. Quick Reply Selection

```
User clicks "Yes" on "Do you have W-2 income?"
  → QuickReplyGroup calls selectOption({ label: "Yes", value: "yes" })
    → AgentContext.selectOption()
      → Adds "Yes" as user message
      → api.converse({ sessionKey, selectedOption: "yes" })
      ← Response with profile set confirmation + next question
```

### 4. File Upload

```
User drags a W-2 PDF into ChatInput
  → ChatInput calls uploadFiles([file])
    → AgentContext.uploadFiles()
      → Adds "I uploaded 1 file(s)." as user message
      → api.uploadFiles(sessionKey, [file])
        → POST http://localhost:3002/api/agent/upload (multipart FormData)
        ← Response with document_review blocks (extracted fields)
      → handleResponse() adds assistant message with confirmation card
```

### 5. Confirming Extracted Values

```
User checks fields and clicks "Confirm"
  → ConfirmationCard calls reviewFields(confirmedFields, rejectedFields)
    → AgentContext.reviewFields()
      → api.converse({ sessionKey, confirmedFields: [...], rejectedFields: [...] })
        → Backend applies confirmed fields directly to engine
        → Agent acknowledges and continues
```

### 6. PDF Download

```
User clicks "Download Tax Return PDF" on download card
  → DownloadLink calls downloadPdf()
    → AgentContext.downloadPdf()
      → api.downloadPdf(sessionKey)
        → GET http://localhost:3002/api/agent/export/:sessionKey/pdf
        ← Blob (raw PDF bytes)
      → Creates object URL from blob
      → Creates invisible <a> element with download attribute
      → Triggers click → browser downloads "tax-return-2025.pdf"
      → Cleans up URL and element
```

---

## Message Block Types

The backend returns an array of `AgentMessageBlock` objects. Each has a `type` that determines which React component renders it:

| Block Type | Component | What It Shows |
|-----------|-----------|---------------|
| `text` | Raw markdown | Agent's conversational text |
| `quick_reply` | `QuickReplyGroup` | Pill buttons for yes/no or multiple choice |
| `confirmation` | `ConfirmationCard` | Table of extracted fields with checkboxes |
| `summary` | `SummaryCard` | Income, tax, refund/owed figures + progress |
| `upload_prompt` | `UploadZone` | Drag-drop area for file uploads |
| `document_review` | `DocumentReview` | Accordion of classified docs with fields |
| `download` | `DownloadLink` | Rich card: name, filing status, refund, download button |
| `payment` | `PaymentCard` | Placeholder for future e-file payment |

The rendering logic is in `MessageBubble.tsx → renderStructuredBlock()`.

---

## Component Hierarchy

```
app/chat/page.tsx
  └── ChatContainer
        ├── Header (logo + progress bar + phase label)
        ├── Message List (scrollable)
        │     └── MessageBubble (for each ChatMessage)
        │           ├── Text blocks → rendered as paragraphs
        │           ├── QuickReplyGroup → pill buttons
        │           ├── ConfirmationCard → field table + confirm/reject
        │           ├── SummaryCard → income/tax/refund card
        │           ├── UploadZone → drag-drop
        │           ├── DocumentReview → accordion
        │           ├── DownloadLink → rich download card
        │           └── PaymentCard → placeholder
        └── ChatInput (textarea + file upload button)
```

---

## Key Files Explained

### `src/lib/api.ts` — API Client

All HTTP communication with the backend. Every function is a typed wrapper around `fetch()`:

```typescript
const API_BASE = 'http://localhost:3002/api/agent';

// Generic request helper — adds JSON headers, handles errors
async function request<T>(path, init?): Promise<T>

// Specific endpoints:
createSession(filingStatus)     → POST /session
converse(params)                → POST /converse
uploadFiles(sessionKey, files)  → POST /upload (FormData)
getExportSummary(sessionKey)    → GET /export/:key/summary
downloadPdf(sessionKey)         → GET /export/:key/pdf → Blob
getChatHistory(sessionKey)      → GET /history/:key
```

**Note:** `uploadFiles` does NOT use the `request()` helper because it sends `FormData` (not JSON). It uses `fetch()` directly without the `Content-Type: application/json` header.

**Note:** `downloadPdf` returns a `Blob`, not JSON. It uses `res.blob()` instead of `res.json()`.

### `src/context/AgentContext.tsx` — Global State

This is the heart of the frontend. It provides:

**State:**
- `sessionKey` — current session ID (null before filing starts)
- `phase` — current filing phase (intake/documents/qa/review)
- `progress` — 0-100 completion percentage
- `messages` — array of `ChatMessage` objects (user + assistant)
- `isLoading` — true while waiting for backend response
- `error` — error message string or null

**Actions:**
- `startSession(filingStatus)` — creates session + sends first message
- `sendMessage(message)` — sends user text message
- `selectOption(option)` — sends quick reply selection
- `reviewFields(confirmed, rejected)` — sends field confirmation
- `confirmFields(fields)` — confirms extracted values
- `rejectFields(nodeIds)` — rejects extracted values
- `uploadFiles(files, message?)` — uploads files + triggers extraction
- `downloadPdf()` — downloads the PDF
- `clearError()` — clears error state

**Key pattern:** Every action follows the same flow:
1. Add user message optimistically
2. Set `isLoading = true`
3. Call the API
4. On success: `handleResponse()` adds assistant blocks, updates phase/progress
5. On error: `handleError()` sets error message

### `src/lib/types.ts` — Type Definitions

Mirrors `paisatax-agent/src/types/agent.types.ts`. This is a **copy** (not imported) because the frontend and backend are separate packages. If you change types on the backend, you must manually update this file too.

Key types:
- `AgentMessageBlock` — discriminated union of all block types
- `ChatMessage` — `{ id, role, blocks[], timestamp }`
- `AgentResponse` — `{ messages, sessionKey, phase, progress, usage }`
- `ConfirmedFieldValue` — `{ nodeId, value }` for confirming extracted fields

### `src/components/chat/MessageBubble.tsx` — Block Renderer

The main rendering logic. For each `ChatMessage`:
- User messages → right-aligned bubble with their text
- Assistant messages → left-aligned, renders each block by type

The `renderStructuredBlock(block, index)` switch determines which component to use.

### `src/components/chat/DownloadLink.tsx` — Download Card

A rich card that shows when the return is finalized:
- Header: "Your 2025 tax return is ready!" + name + filing status
- Center: Refund (green) or Amount Owed (red) with large amount
- Footer: Form list + download button
- Download button triggers `downloadPdf()` from AgentContext

### `src/components/chat/ConfirmationCard.tsx` — Field Confirmation

Renders extracted document fields as a table with checkboxes. User can:
- Select/deselect individual fields
- "Select All" / "Deselect All"
- Confirm selected → sends `confirmedFields` to backend
- The backend applies confirmed fields directly to the engine

### `src/components/chat/QuickReplyGroup.tsx` — Quick Replies

Renders multiple quick reply questions (e.g., "Do you have W-2 income? Yes/No"). Each question has pill buttons. Once the user answers all questions, their selections are submitted as a batch.

---

## File Structure

```
paisatax-web-user/
├── app/
│   ├── globals.css              # Tailwind + CSS custom properties for theme
│   ├── layout.tsx               # Root layout: AgentProvider + ThemeProvider
│   ├── page.tsx                 # Landing page: filing status selection
│   └── chat/
│       └── page.tsx             # Chat page: renders ChatContainer
├── src/
│   ├── context/
│   │   ├── AgentContext.tsx      # Global session state + all actions
│   │   └── ThemeContext.tsx      # Dark/light theme
│   ├── lib/
│   │   ├── api.ts               # HTTP client for all backend endpoints
│   │   └── types.ts             # TypeScript interfaces (mirrors backend)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatContainer.tsx    # Full-page layout: header + messages + input
│   │   │   ├── ChatInput.tsx        # Text input + file upload button
│   │   │   ├── MessageBubble.tsx    # Renders message blocks by type
│   │   │   ├── QuickReply.tsx       # Single quick reply button
│   │   │   ├── QuickReplyGroup.tsx  # Multi-question quick reply with batch submit
│   │   │   ├── ConfirmationCard.tsx # Extracted field table with checkboxes
│   │   │   ├── SummaryCard.tsx      # Tax summary (income, tax, refund)
│   │   │   ├── UploadZone.tsx       # Drag-drop file upload
│   │   │   ├── DocumentReview.tsx   # Classified document accordion
│   │   │   ├── DownloadLink.tsx     # Rich download card
│   │   │   └── PaymentCard.tsx      # Placeholder for e-file
│   │   └── layout/
│   │       └── Header.tsx           # Logo + progress bar + phase
│   └── hooks/
│       └── useAutoScroll.ts         # Auto-scroll ref to bottom
├── package.json
├── next.config.ts
├── tsconfig.json
└── postcss.config.mjs
```

---

## Known Issues & Gotchas

### 1. Types must be kept in sync manually
`src/lib/types.ts` is a copy of the backend types. If you add a new block type on the backend (e.g., a new structured message), you must also add it here. There's no shared package.

### 2. API_BASE is hardcoded to localhost:3002
Set `NEXT_PUBLIC_API_URL` in `.env.local` to override. For production, this would point to the deployed agent API.

### 3. No authentication
There's no auth — anyone with the URL can create sessions and file taxes. This is V1 local dev only.

### 4. No streaming
Responses come as a single JSON payload after Claude finishes all tool calls. This means the user sees a loading spinner for 5-30 seconds depending on how many tools Claude needs to call. Future improvement: stream blocks as they arrive.

### 5. Session not persisted across page refreshes
The `sessionKey` is in React state. If the user refreshes the page, the session is lost. The backend still has the session in memory, but the frontend loses the reference. Could be fixed with `localStorage` persistence.

### 6. File uploads only work through ChatInput
The `UploadZone` component is for drag-drop within chat, but the actual upload is triggered through `ChatInput`'s file button. Make sure both paths call `uploadFiles()` from AgentContext.

### 7. Quick reply interactions
Once quick replies are answered, they should be disabled. The `QuickReplyGroup` handles this with local state, but if the user scrolls up and sees old quick replies, they could theoretically try to click them again.

---

## How the Frontend Connects to the Backend

```
paisatax-web-user                          paisatax-agent
(Next.js, port 3000)                       (Express, port 3002)

  AgentContext ──fetch()──────────────────→ agent.routes.ts
     │                                         │
     │ startSession()                          │ POST /session
     │   → api.createSession()                 │   → session.service.createSession()
     │                                         │   ← { sessionKey }
     │                                         │
     │ sendMessage()                           │ POST /converse
     │   → api.converse()                      │   → orchestrator.converse()
     │                                         │     → buildAgentContext() + buildSystemPrompt()
     │                                         │     → Agent SDK query() with MCP tools
     │                                         │     → Claude calls tools (send_input, etc.)
     │                                         │     ← { messages, phase, progress }
     │                                         │
     │ uploadFiles()                           │ POST /upload (multipart)
     │   → api.uploadFiles()                   │   → docproc.processUploadBatch()
     │                                         │     → classify (Haiku) → extract (Sonnet)
     │                                         │     → identity mapping (W-2 → f1040)
     │                                         │   → orchestrator.converse() with files
     │                                         │   ← { messages with document_review blocks }
     │                                         │
     │ downloadPdf()                           │ GET /export/:key/pdf
     │   → api.downloadPdf()                   │   → export.service.generateExportPdf()
     │   ← Blob                                │     → fillAndMergePdfs() from tax-graph
     │   → Create <a> + trigger download       │   ← Buffer (PDF bytes)
```

---

## Running

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → Opens http://localhost:3000

# Make sure paisatax-agent is also running on port 3002
```

## Tech Stack

- **Next.js 16** with App Router
- **React 19** with hooks
- **Tailwind CSS 4** for styling
- **TypeScript 5** strict mode
- No UI library — all custom components with CSS custom properties for theming


// 