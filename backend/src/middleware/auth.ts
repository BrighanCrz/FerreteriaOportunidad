import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export type SessionUser = { id: string; role: string; branchId: string | null; driverId?: string | null; sessionId: string; permissions: string[] };
declare global { namespace Express { interface Request { user?: SessionUser } } }
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Inicia sesión para continuar.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; jti?: string };
    if (!payload.jti) return res.status(401).json({ message: 'La sesión ya no es válida.' });
    const session = await prisma.session.findFirst({ where: { id: payload.jti, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) return res.status(401).json({ message: 'La sesión expiró. Inicia sesión nuevamente.' });
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: { include: { permissions: { include: { permission: true } } } }, driver: true } });
    if (!user?.active) return res.status(401).json({ message: 'La sesión no es válida.' });
    req.user = { id: user.id, role: user.role.key, branchId: user.branchId, driverId: user.driver?.id, sessionId: session.id, permissions: user.role.permissions.map(p => p.permission.key) };
    next();
  } catch { res.status(401).json({ message: 'La sesión expiró. Inicia sesión nuevamente.' }); }
}
export const allow = (...permissions: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role === 'ADMIN' || permissions.some(p => req.user?.permissions.includes(p))) return next();
  return res.status(403).json({ message: 'No tienes permiso para realizar esta acción.' });
};
export const scopeBranch = (req: Request) => req.user?.role === 'ADMIN' ? (req.query.branchId as string | undefined) : req.user?.branchId;
