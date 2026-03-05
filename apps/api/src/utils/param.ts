import type { Request } from 'express';

/** Get a route param as a string (Express types allow string | string[]). */
export function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}
