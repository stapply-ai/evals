import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

const router = Router();

// Simple in-memory session store (per-process). For demo only.
const sessionIdToEmail: Map<string, string> = new Map();

// Ensure debug data dir exists
const debugDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
}

// Where we store debug credentials/applications
const credsFile = path.join(debugDir, 'logins.jsonl');
const usersFile = path.join(debugDir, 'users.jsonl');
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

function getCookie(req: Request, name: string): string | null {
    const cookieHeader = req.headers['cookie'];
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
        const idx = cookie.indexOf('=');
        if (idx === -1) continue;
        const key = cookie.slice(0, idx);
        const value = cookie.slice(idx + 1);
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

function setCookie(res: Response, name: string, value: string, options?: { maxAgeMs?: number }) {
    const attrs: string[] = [`${name}=${encodeURIComponent(value)}`, 'Path=/' ];
    if (options?.maxAgeMs) {
        attrs.push(`Max-Age=${Math.floor(options.maxAgeMs / 1000)}`);
    }
    // Development-friendly cookie flags
    attrs.push('HttpOnly');
    attrs.push('SameSite=Lax');
    res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearCookie(res: Response, name: string) {
    res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function isAuthed(req: Request): boolean {
    const sid = getCookie(req, 'sid');
    if (!sid) return false;
    return sessionIdToEmail.has(sid);
}

function authedEmail(req: Request): string | null {
    const sid = getCookie(req, 'sid');
    if (!sid) return null;
    return sessionIdToEmail.get(sid) ?? null;
}

function requireAuth(req: Request, res: Response, next: () => void) {
    if (!isAuthed(req)) {
        return res.redirect('/eval/login');
    }
    next();
}

// Password hashing helpers (scrypt)
function hashPassword(password: string): { salt: string; hash: string; algo: 'scrypt'; } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash, algo: 'scrypt' };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

type StoredUser = { email: string; passwordHash: string; salt: string; algo: 'scrypt'; ts: string };

function findUserByEmail(email: string): StoredUser | null {
    if (!fs.existsSync(usersFile)) return null;
    const lines = fs.readFileSync(usersFile, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
        try {
            const rec = JSON.parse(line) as StoredUser;
            if (rec.email.toLowerCase() === email.toLowerCase()) return rec;
        } catch {
            // ignore malformed lines
        }
    }
    return null;
}

function createSession(res: Response, email: string) {
    const sid = crypto.randomBytes(16).toString('hex');
    sessionIdToEmail.set(sid, email);
    setCookie(res, 'sid', sid, { maxAgeMs: 1000 * 60 * 60 * 24 * 7 });
}

// GET signup page
router.get('/eval/signup', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign up</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; padding: 24px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    form { display: grid; gap: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
    input, button { padding: 8px 10px; }
    button { background: #111827; color: white; border: 0; border-radius: 6px; cursor: pointer; }
    button:hover { background: #000; }
    .small { color: #6b7280; font-size: 12px; }
    label { display: grid; gap: 6px; }
    a { color: #111827; }
  </style>
  </head>
  <body>
    <h1>Create an account</h1>
    <p class="small">Stored locally in <code>uploads/users.jsonl</code> for demo only.</p>
    <form action="/eval/signup" method="post">
      <label>
        Email
        <input type="email" name="email" required />
      </label>
      <label>
        Password
        <input type="password" name="password" required />
      </label>
      <button type="submit">Create account</button>
    </form>
    <p class="small">Already have an account? <a href="/eval/login">Sign in</a></p>
  </body>
</html>`);
});

// POST signup
router.post('/eval/signup', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).send('Missing email or password');
    }
    const existing = findUserByEmail(email);
    if (existing) {
        return res.status(409).send('User already exists. Try logging in.');
    }
    const { salt, hash } = hashPassword(password);
    const record: StoredUser = { email, passwordHash: hash, salt, algo: 'scrypt', ts: new Date().toISOString() };
    fs.appendFileSync(usersFile, JSON.stringify(record) + '\n');
    // Debug credential log
    const debugRecord = { ts: new Date().toISOString(), action: 'signup', email, ip: req.ip };
    fs.appendFileSync(credsFile, JSON.stringify(debugRecord) + '\n');

    createSession(res, email);
    return res.redirect('/eval/apply');
});

// GET login page
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
    <p class="small">No account? <a href="/eval/signup">Create one</a></p>
  </body>
</html>`);
});

// POST login: verify user and set session cookie
router.post('/eval/login', (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).send('Missing email or password');
    }

    const user = findUserByEmail(email);
    if (!user) {
        return res.status(401).send('Invalid credentials');
    }
    const ok = verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) {
        return res.status(401).send('Invalid credentials');
    }

    // Debug credential log (no plaintext password)
    const record = { ts: new Date().toISOString(), action: 'login', email, ip: req.ip };
    fs.appendFileSync(credsFile, JSON.stringify(record) + '\n');

    createSession(res, email);
    return res.redirect('/eval/apply');
});

// POST logout
router.post('/eval/logout', (req: Request, res: Response) => {
    const sid = getCookie(req, 'sid');
    if (sid) sessionIdToEmail.delete(sid);
    clearCookie(res, 'sid');
    return res.redirect('/eval/login');
});

// GET application form (protected)
router.get('/eval/apply', requireAuth, (req: Request, res: Response) => {
    const email = authedEmail(req);
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
    <p class="small">Signed in as <code>${email ?? 'unknown'}</code>.</p>
    <form action="/eval/logout" method="post" style="margin-bottom:16px">
      <button type="submit">Log out</button>
    </form>
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


