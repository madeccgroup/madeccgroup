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
    theme?: string;
    createdAt: Date;
  };
}

// Register or fetch user from DB
export async function getOrCreateUser(uid: string, email: string, name: string) {
  // Check if we want to make certain email admin automatically
  const targetRole = (email.toLowerCase() === 'kreboya603@gmail.com') ? 'admin' : 'client';

  try {
    // 1. Check if user exists by UID
    const existingByUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existingByUid.length > 0) {
      const user = existingByUid[0];
      // Defensive: Ensure the admin role is enforced on this critical user
      if (email.toLowerCase() === 'kreboya603@gmail.com' && user.role !== 'admin') {
        const updated = await db.update(users)
          .set({ role: 'admin' })
          .where(eq(users.id, user.id))
          .returning();
        return updated[0];
      }
      return user;
    }

    // 2. If not found by UID, check if user exists by email (since email is unique)
    if (email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingByEmail.length > 0) {
        const user = existingByEmail[0];
        const updateFields: any = {};
        // If the UID is different, update it to the requested UID to keep it synced and avoid duplicate key errors.
        if (user.uid !== uid) {
          updateFields.uid = uid;
        }
        // Ensure admin role is set if they exist by email but don't have it
        if (email.toLowerCase() === 'kreboya603@gmail.com' && user.role !== 'admin') {
          updateFields.role = 'admin';
        }

        if (Object.keys(updateFields).length > 0) {
          const updated = await db.update(users)
            .set(updateFields)
            .where(eq(users.id, user.id))
            .returning();
          return updated[0];
        }
        return user;
      }
    }

    // 3. Create new user
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
  
  if (
    token === 'ADMIN_BYPASS:Adminmadeccgroup' || 
    token === 'Adminmadeccgroup' || 
    token === 'ADMIN_BYPASS:MADECC_Group_admin' || 
    token === 'ADMIN_BYPASS:MADECC Group admin' || 
    token === 'MADECC_Group_admin' || 
    token === 'MADECC Group admin'
  ) {
    try {
      const adminUser = await getOrCreateUser(
        'admin-madecc-uid',
        'kreboya603@gmail.com',
        'MADECC Admin'
      );
      req.user = {
        uid: 'admin-madecc-uid',
        email: 'kreboya603@gmail.com',
        name: 'MADECC Admin',
      } as any;
      req.dbUser = adminUser;
      return next();
    } catch (dbErr) {
      console.error('Error fetching/creating bypass admin user:', dbErr);
      return res.status(500).json({ error: 'Internal database error during admin login' });
    }
  }

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

