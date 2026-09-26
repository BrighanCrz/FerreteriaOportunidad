import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
const router = Router();
router.post('/login', async (req, res) => {
  const data = z.object({ login: z.string().min(1), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findFirst({ where: { OR: [{ username: data.login }, { email: data.login }] }, include: { role: true, branch: true, driver: true } });
  if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
  const jti = randomUUID();
  await prisma.session.create({ data: { id: jti, userId: user.id, expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000) } });
  const token = jwt.sign({ jti }, process.env.JWT_SECRET!, { subject: user.id, expiresIn: '10h' });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'LOGIN', module: 'auth', ip: req.ip } });
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role.key, branch: user.branch?.name, branchId: user.branchId, driverId: user.driver?.id, mustChangePassword: user.mustChangePassword } });
});
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { role: { include: { permissions: { include: { permission: true } } } }, branch: true } });
  res.json({ ...user, passwordHash: undefined, permissions: user?.role.permissions.map(p => p.permission.key) });
});
router.post('/change-password', authenticate, async (req, res) => {
  const data = z.object({ currentPassword: z.string(), newPassword: z.string().min(10) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) return res.status(400).json({ message: 'La contraseña actual no coincide.' });
  await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(data.newPassword, 12), mustChangePassword: false } }), prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })]);
  res.json({ message: 'Contraseña actualizada correctamente.' });
});
router.post('/logout', authenticate, async (req, res) => { await prisma.$transaction([prisma.session.update({ where: { id: req.user!.sessionId }, data: { revokedAt: new Date() } }), prisma.auditLog.create({ data: { userId: req.user!.id, action: 'LOGOUT', module: 'auth' } })]); res.json({ message: 'Sesión cerrada.' }); });
export default router;
