import { Router, Request, Response } from 'express';

const router = Router();

router.get('/healthz', (_req: Request, res: Response) => {
	res.json({ ok: true });
});

export default router;


