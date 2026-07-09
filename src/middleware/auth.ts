import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: number;
    uid: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  };
}

// Register or fetch user from DB
export async function getOrCreateUser(uid: string, email: string, name: string) {
  // Check if we want to make certain email admin automatically
  const targetRole = (email.toLowerCase() === 'kreboya603@gmail.com') ? 'admin' : 'client';

  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      // Once created, respect whatever role is currently in the database (critical for sandbox role toggling)
      return existing[0];
    }

    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
        role: targetRole,
      })
      .returning();

    return result[0];
  } catch (err) {
    console.error('Error in getOrCreateUser:', err);
    throw err;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Retrieve or create database user profile
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
      decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
    );
    req.dbUser = dbUser;

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (!req.dbUser || req.dbUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  });
};

export const requireStaffOrAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  await requireAuth(req, res, () => {
    if (!req.dbUser || (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff')) {
      return res.status(403).json({ error: 'Forbidden: Admin or Staff access required' });
    }
    next();
  });
};

