import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';

export const simulateRouter = Router();

const simulateSchema = z.object({
  content: z.record(z.string(), z.unknown()), // JDM graph (nodes, edges, etc.)
  context: z.record(z.string(), z.unknown()).optional(), // input context for the decision
  decisions: z.record(z.string(), z.record(z.string(), z.unknown())).optional(), // key -> JDM graph for decision nodes
});

simulateRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { content, context = {}, decisions } = parsed.data;

  try {
    const { ZenEngine } = await import('@gorules/zen-engine');
    const loader =
      decisions && Object.keys(decisions).length > 0
        ? async (key: string) => {
            const graph = decisions[key];
            if (graph == null) throw new Error(`Decision not found: ${key}`);
            const str = typeof graph === 'string' ? graph : JSON.stringify(graph);
            return Buffer.from(str, 'utf-8');
          }
        : undefined;
    const engine = new ZenEngine(loader ? { loader } : {});
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
