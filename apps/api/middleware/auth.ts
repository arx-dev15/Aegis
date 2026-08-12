import { Request, Response, NextFunction } from 'express'
import { config } from '../config'

// Minimal API-key auth. Replace with proper JWT when auth system is built.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key']
  if (!key || key !== config.API_KEY) {
    res.status(401).json({
      error: { message: 'Unauthorized — missing or invalid x-api-key', code: 'UNAUTHORIZED' },
    })
    return
  }
  next()
}
