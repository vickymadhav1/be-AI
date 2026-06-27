# Interview Mate AI Backend

Production-oriented Express API for Firebase authentication, Neon PostgreSQL persistence, and application JWTs.

## Requirements

- Node.js 22 or newer
- A Neon PostgreSQL database
- A Firebase service account for the same Firebase project used by the Vue app

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in every required value.

3. In Neon, copy the pooled PostgreSQL connection string into `DATABASE_URL` and the
   direct connection string into `DIRECT_URL`. Runtime traffic uses the pooler while
   Prisma migrations use the direct connection. Keep `sslmode=require` in both URLs.
   Runtime connections use Prisma's Neon adapter. The optional
   `DATABASE_POOL_MAX`, `DATABASE_CONNECT_TIMEOUT_MS`, and
   `DATABASE_IDLE_TIMEOUT_MS` variables tune its bounded, autosuspend-safe pool.

4. In Firebase Console, open **Project settings > Service accounts** and generate a private key. Save the JSON file outside source control and set `GOOGLE_APPLICATION_CREDENTIALS` to its path. Inline Firebase variables remain supported as an alternative.

5. Generate Prisma Client and apply the checked-in migration:

   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

The API runs at `http://localhost:8000` by default.

Set `GROQ_API_KEY` and optionally `GROQ_MODEL` before requesting AI suggestions.
The default production model is `llama-3.3-70b-versatile`.

To watch compiled JavaScript with nodemon instead, run `npm run dev:dist`. Do not run
`nodemon server`; that is parsed as an extra script argument and produces an invalid
`node server dist/server.js` command.

## API

### `GET /api/health`

Checks both the Express server and the Neon database connection.

### `POST /api/auth/firebase`

Send the Firebase ID token returned by the frontend:

```json
{
  "idToken": "FIREBASE_ID_TOKEN"
}
```

The Authorization Bearer format remains supported for existing clients. The API verifies
the Firebase token, creates or updates the Neon user, then returns:

```json
{
  "success": true,
  "user": {
    "id": "database-user-id",
    "firebaseUid": "firebase-user-id",
    "email": "user@example.com",
    "name": "Example User",
    "photo": "https://example.com/avatar.jpg",
    "credits": 20,
    "createdAt": "2026-06-20T00:00:00.000Z",
    "updatedAt": "2026-06-20T00:00:00.000Z"
  },
  "token": "application-jwt"
}
```

### `GET /api/user/profile`

Send the application JWT returned by `/api/auth/firebase`:

```http
Authorization: Bearer APPLICATION_JWT
```

Returns the authenticated user in `data`.

### `GET /api/user/credits`

Returns the authenticated user's current credit balance.

### `POST /api/interviews`

Creates an interview for the authenticated user:

```json
{
  "title": "Frontend Interview",
  "role": "Frontend Developer",
  "experience": 3,
  "difficulty": "medium",
  "interviewType": "technical"
}
```

Difficulty accepts `easy`, `medium`, or `hard`. Interview type accepts `technical`,
`behavioral`, `hr`, `system-design`, or `mixed`.

### Interview routes

- `GET /api/interviews` lists the authenticated user's interviews.
- `GET /api/interviews/:id` returns one owned interview and its questions.
- `DELETE /api/interviews/:id` deletes an owned interview and its questions.
- `POST /api/interviews/:id/questions/generate` replaces and returns mock questions.
- `GET /api/interviews/:id/questions` lists questions for an owned interview.

### Question routes

- `GET /api/questions/:questionId` returns an owned question.
- `POST /api/questions/:questionId/answer` saves `{ "answer": "..." }`.

All interview and question lookups are scoped to the authenticated database user.

### Live session routes

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `PATCH /api/sessions/:id/end`
- `DELETE /api/sessions/:id`
- `POST /api/transcripts`
- `GET /api/transcripts/:id`
- `GET /api/sessions/:id/transcripts`
- `POST /api/assistant/suggest`
- `GET /api/sessions/:id/suggestions`

### Socket.IO

Connect with the application JWT in `handshake.auth.token`.

Client events: `session:start`, `session:end`, `transcript:new`, and
`assistant:request`.

Server events: `session:started`, `session:ended`, `transcript:stored`,
`assistant:response`, and `server:error`.

Interviewer transcripts ending in `?` or beginning with common question phrases
automatically request a Groq suggestion.

## Production

Build and run the compiled server:

```bash
npm run build
npm start
```

Use `prisma migrate deploy` in deployment automation to apply committed migrations without the interactive development workflow.
