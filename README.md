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


### Notes

- Files are stored locally in `uploads/` with a timestamped filename for debugging.
- The server uses strict TypeScript settings and typed middleware.


