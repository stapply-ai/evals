import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer, { FileFilterCallback } from 'multer';

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (_req, file, cb) => {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
		cb(null, `${timestamp}-${safeOriginal}`);
	},
});

const fileFilter = (_req: Request, _file: Express.Multer.File, cb: FileFilterCallback) => {
	// Accept all files for debugging purposes
	cb(null, true);
};

const upload = multer({ storage, fileFilter });

// Basic request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
	const startedAt = Date.now();
	next();
	const durationMs = Date.now() - startedAt;
	// eslint-disable-next-line no-console
	console.log(`${req.method} ${req.originalUrl} ${durationMs}ms`);
});

// GET: simple upload page
app.get('/eval/file-upload', (_req: Request, res: Response) => {
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.send(`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Stapply Evals - File Upload</title>
		<style>
			body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; padding: 24px; max-width: 720px; margin: 0 auto; }
			h1 { font-size: 20px; margin-bottom: 12px; }
			form { display: grid; gap: 12px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
			button { background: #111827; color: white; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
			button:hover { background: #000; }
			.small { color: #6b7280; font-size: 12px; }
		</style>
	</head>
	<body>
		<h1>Upload an eval artifact</h1>
		<p class="small">For debugging: files are saved locally to the <code>uploads/</code> directory.</p>
		<form action="/eval/file-upload" method="post" enctype="multipart/form-data">
			<input type="file" name="file" required />
			<button type="submit">Upload</button>
		</form>
	</body>
	</html>`);
});

// POST: handle upload
app.post('/eval/file-upload', upload.single('file'), (req: Request, res: Response) => {
	if (!req.file) {
		return res.status(400).json({ ok: false, error: 'No file uploaded' });
	}
	return res.status(201).json({ ok: true, filename: req.file.filename, path: path.relative(process.cwd(), req.file.path), size: req.file.size });
});

// Health check
app.get('/healthz', (_req: Request, res: Response) => {
	res.json({ ok: true });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Server listening on http://localhost:${PORT}`);
});


