import express, { Request, Response, NextFunction } from 'express';
import fileUploadRouter from './routes/fileUpload';
import healthRouter from './routes/health';

const PORT = Number(5173);
const app = express();

// Basic request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
	const startedAt = Date.now();
	next();
	const durationMs = Date.now() - startedAt;
	// eslint-disable-next-line no-console
	console.log(`${req.method} ${req.originalUrl} ${durationMs}ms`);
});

// Mount routers
app.use(fileUploadRouter);
app.use(healthRouter);

app.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Server listening on http://localhost:${PORT}`);
});


