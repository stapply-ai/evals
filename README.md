# Stapply Evals

A minimal, type-safe Express server in TypeScript for Stapply evals.

## Roadmap

- [ ] Auth (no verification email)
- [ ] Auth (with verification email)
- [ ] Resume and cover letter upload
- [ ] Questions / not provided data
- [ ] Linkedin easy apply
- [ ] Lever
- [ ] Ashby
- [ ] iFrame (ashby)
- [ ] Glassdoor
- [ ] Workday

## Prerequisites

- Node.js 18+

### Install

```bash
npm install
```

### Development

Run with ts-node:

```bash
npm run dev
```

Open `http://localhost:5173/eval/file-upload`, or any other eval.

### Build and Run

```bash
npm run build
npm start
```

### Endpoints

- `GET /eval/file-upload`: Simple HTML form for uploading a file
- `POST /eval/file-upload`: Accepts multipart form data (field name: `file`) and stores files to `uploads/`
- `GET /healthz`: Basic health check
- `GET /eval/login`: Minimal login form (no email verification)
- `POST /eval/login`: Accepts `email`, `password`; grants access and appends a JSON line to `uploads/logins.jsonl`
- `GET /eval/apply`: Protected simple job application form
- `POST /eval/apply`: Accepts `fullName`, `email`, `coverLetter`, and `resume` (PDF); saves resume to `uploads/` and appends a JSON line to `uploads/applications.jsonl`


### Notes

- For debugging only: credentials and application records are stored locally under `uploads/` as JSONL files.
- Auth is a simple in-memory flag keyed by client IP (not secure; dev-only).
- Files are stored locally in `uploads/` with a timestamped filename for debugging.
- The server uses strict TypeScript settings and typed middleware.


