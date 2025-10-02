## Stapply Evals - File Upload Server

A minimal, type-safe Express server in TypeScript for Stapply evals. It exposes a single page at `/eval/file-upload` to upload a file, which is saved locally under the `uploads/` directory for debugging purposes.

### Prerequisites

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

Open `http://localhost:3000/eval/file-upload`.

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


