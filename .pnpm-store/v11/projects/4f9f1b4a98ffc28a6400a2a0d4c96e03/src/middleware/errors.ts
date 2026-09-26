import { NextFunction, Request, Response } from 'express';
export function notFound(_req: Request, res: Response) { res.status(404).json({ message: 'No encontramos este recurso.' }); }
export function errors(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  const status = err.statusCode || (err.name === 'ZodError' ? 400 : 500);
  res.status(status).json({ message: status < 500 ? err.message : 'Ocurrió un error interno. Intenta nuevamente.' });
}
