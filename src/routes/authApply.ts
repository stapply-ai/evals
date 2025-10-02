import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const router = Router();

// Simple in-memory session flag (per-process, per-user via cookie-less IP). For demo only.
// Map client IP to auth state. This is not secure and only for local eval/debug.
const ipToIsAuthed: Map<string, boolean> = new Map();

// Ensure debug data dir exists
const debugDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
}

// Where we store debug credentials/applications
const credsFile = path.join(debugDir, 'logins.jsonl');
const appsFile = path.join(debugDir, 'applications.jsonl');

// Basic multer setup for resume upload on application form
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, debugDir),
    filename: (_req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}-resume-${safeOriginal}`);
    },
});
const upload = multer({ storage });

function isAuthed(req: Request): boolean {
    const clientKey = `${req.ip}`;
    return Boolean(ipToIsAuthed.get(clientKey));
}

function requireAuth(req: Request, res: Response, next: () => void) {
    if (!isAuthed(req)) {
        return res.redirect('/eval/login');
    }
    next();
}

// GET login page (no email verification)
router.get('/eval/login', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; padding: 24px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    form { display: grid; gap: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    input, button { padding: 8px 10px; }
    button { background: #111827; color: white; border: 0; border-radius: 6px; cursor: pointer; }
    button:hover { background: #000; }
    .small { color: #6b7280; font-size: 12px; }
    label { display: grid; gap: 6px; }
  </style>
  </head>
  <body>
    <h1>Sign in</h1>
    <p class="small">No email verification. For debugging, submissions are saved under <code>uploads/</code>.</p>
    <form action="/eval/login" method="post">
      <label>
        Email
        <input type="email" name="email" required />
      </label>
      <label>
        Password
        <input type="password" name="password" required />
      </label>
      <button type="submit">Continue</button>
    </form>
  </body>
</html>`);
});

// POST login: mark session as authed and store credentials locally (JSONL)
router.post('/eval/login', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).send('Missing email or password');
    }

    const clientKey = `${req.ip}`;
    ipToIsAuthed.set(clientKey, true);

    // Save to JSONL for debugging
    const record = { ts: new Date().toISOString(), email, password, ip: req.ip };
    fs.appendFileSync(credsFile, JSON.stringify(record) + '\n');

    return res.redirect('/eval/apply');
});

// GET application form (protected)
router.get('/eval/apply', requireAuth, (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Job Application</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; padding: 24px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    form { display: grid; gap: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    input, textarea, button { padding: 8px 10px; }
    textarea { min-height: 100px; }
    button { background: #111827; color: white; border: 0; border-radius: 6px; cursor: pointer; }
    button:hover { background: #000; }
    label { display: grid; gap: 6px; }
  </style>
  </head>
  <body>
    <h1>Simple Job Application</h1>
    <form action="/eval/apply" method="post" enctype="multipart/form-data">
      <label>
        Full name
        <input type="text" name="fullName" required />
      </label>
      <label>
        Email
        <input type="email" name="email" required />
      </label>
      <label>
        Cover letter
        <textarea name="coverLetter" placeholder="A few sentences..." required></textarea>
      </label>
      <label>
        Resume (PDF)
        <input type="file" name="resume" accept="application/pdf" required />
      </label>
      <button type="submit">Submit application</button>
    </form>
  </body>
</html>`);
});

// POST application (protected) + save to JSONL and save resume
router.post('/eval/apply', requireAuth, upload.single('resume'), (req: Request, res: Response) => {
    const { fullName, email, coverLetter } = req.body ?? {};
    const resumeFile = req.file?.filename ?? null;

    if (!fullName || !email || !coverLetter || !resumeFile) {
        return res.status(400).send('Missing fields');
    }

    const record = {
        ts: new Date().toISOString(),
        fullName,
        email,
        coverLetter,
        resumeFile,
        ip: req.ip,
    };
    fs.appendFileSync(appsFile, JSON.stringify(record) + '\n');

    return res.set('Content-Type', 'text/html; charset=utf-8').send(`<p>Application received. Resume saved as <code>${resumeFile}</code>.</p><p><a href="/eval/apply">Back</a></p>`);
});

export default router;


