import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';

export const simulateRouter = Router();

const simulateSchema = z.object({
  content: z.record(z.unknown()), // JDM graph (nodes, edges, etc.)
  context: z.record(z.unknown()).optional(), // input context for the decision
});

simulateRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { content, context = {} } = parsed.data;

  try {
    const { ZenEngine } = await import('@gorules/zen-engine');
    const engine = new ZenEngine();
    const decision = engine.createDecision(content);
    const response = await decision.evaluate(context, { trace: true });
    engine.dispose();
    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Simulation failed';
    const data =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { nodeId?: string; type?: string; source?: string } }).data
        : undefined;
    res.status(500).json({
      error: 'Simulation failed',
      details: message,
      data: data ?? { nodeId: undefined, type: 'EngineError', source: message },
    });
  }
});
