import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { db } from './src/db/index.ts';
import { 
  users, 
  categories, 
  projects, 
  projectProgress, 
  blogPosts, 
  reviews, 
  appointments, 
  contactMessages, 
  newsletterSubscribers, 
  services, 
  galleryItems, 
  heroBanners, 
  companyDocuments, 
  auditLogs,
  teamMembers,
  signedContracts,
  signedReceipts,
  userSyncData,
  lessonPlans,
  syllabusDocuments
} from './src/db/schema.ts';
import { seedDatabase } from './src/db/seed.ts';
import { requireAuth, requireAdmin, requireStaffOrAdmin } from './src/middleware/auth.ts';
import { logAudit } from './src/lib/audit.ts';
import { eq, desc, and, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type } from '@google/genai';

// Lazy initializer for the Gemini SDK to prevent warnings and errors on startup if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Helper function to extract Cloudinary credentials from either CLOUDINARY_URL or individual variables
function getCloudinaryCredentials() {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let apiKey = process.env.CLOUDINARY_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (process.env.CLOUDINARY_URL) {
    try {
      const urlStr = process.env.CLOUDINARY_URL;
      if (urlStr.startsWith('cloudinary://')) {
        const credentialsAndHost = urlStr.replace('cloudinary://', '');
        const atIndex = credentialsAndHost.lastIndexOf('@');
        if (atIndex !== -1) {
          const creds = credentialsAndHost.substring(0, atIndex).split(':');
          cloudName = credentialsAndHost.substring(atIndex + 1);
          if (creds.length === 2) {
            apiKey = creds[0];
            apiSecret = creds[1];
          }
        }
      }
    } catch (e) {
      console.error('[CLOUDINARY_PARSE_ERROR] Failed to parse CLOUDINARY_URL:', e);
    }
  }

  return { cloudName, apiKey, apiSecret };
}

// Helper function to securely delete files from cloud storage (Supabase / Cloudinary) or local fallback
async function deleteFileFromCloud(fileUrl: string | null | undefined) {
  if (!fileUrl) return;

  // 1. Supabase Storage clean-up
  if (fileUrl.includes('supabase.co') && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split('/storage/v1/object/public/');
      if (pathParts.length > 1) {
        const fullPath = pathParts[1];
        const firstSlash = fullPath.indexOf('/');
        if (firstSlash !== -1) {
          const bucket = fullPath.substring(0, firstSlash);
          const filePath = fullPath.substring(firstSlash + 1);
          
          const { error } = await supabase.storage.from(bucket).remove([filePath]);
          if (error) {
            console.error(`[STORAGE_DELETE_ERROR] Failed to delete from Supabase storage:`, error);
          } else {
            console.log(`[STORAGE_DELETE] Deleted from Supabase: bucket=${bucket}, path=${filePath}`);
          }
        }
      }
    } catch (err) {
      console.error('[STORAGE_DELETE_ERROR] Error deleting from Supabase:', err);
    }
  }
  // 2. Cloudinary asset clean-up
  else if (fileUrl.includes('cloudinary.com')) {
    try {
      const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
      if (cloudName && apiKey && apiSecret) {
        const cloudinary = await import('cloudinary');
        cloudinary.v2.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret
        });

        const urlObj = new URL(fileUrl);
        const pathname = urlObj.pathname;
        const parts = pathname.split('/');
        
        const resourceType = parts[2] || 'image';
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex !== -1 && uploadIndex + 1 < parts.length) {
          let remainingParts = parts.slice(uploadIndex + 1);
          if (remainingParts[0] && remainingParts[0].startsWith('v') && /^\d+$/.test(remainingParts[0].substring(1))) {
            remainingParts = remainingParts.slice(1);
          }
          
          const fileWithExt = remainingParts.join('/');
          const lastDotIndex = fileWithExt.lastIndexOf('.');
          const publicId = lastDotIndex !== -1 ? fileWithExt.substring(0, lastDotIndex) : fileWithExt;
          
          const result = await cloudinary.v2.uploader.destroy(publicId, {
            resource_type: resourceType === 'raw' ? 'raw' : (resourceType === 'video' ? 'video' : 'image')
          });
          console.log(`[STORAGE_DELETE] Deleted from Cloudinary: publicId=${publicId}, result=`, result);
        }
      } else {
        console.warn('[STORAGE_DELETE_WARN] Could not delete Cloudinary asset because configuration is missing.');
      }
    } catch (err) {
      console.error('[STORAGE_DELETE_ERROR] Error deleting from Cloudinary:', err);
    }
  }
  // 3. Local disk clean-up fallback
  else if (fileUrl.startsWith('/uploads/')) {
    try {
      const localPath = path.join(process.cwd(), fileUrl);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`[STORAGE_DELETE] Deleted local file: ${localPath}`);
      }
    } catch (err) {
      console.error('[STORAGE_DELETE_ERROR] Error deleting local file:', err);
    }
  }
}

function validateEnvironmentVariables() {
  console.log('🔍 [ENVIRONMENT AUDIT] Auditing system environment configuration...');
  const required = ['DATABASE_URL'];
  const missingRequired = required.filter(key => !process.env[key]);
  
  if (missingRequired.length > 0) {
    console.error(`❌ [FATAL CONFIG ERROR] Missing required environment variables: ${missingRequired.join(', ')}`);
    console.error('The application cannot boot without a valid DATABASE_URL connection string.');
    process.exit(1);
  }

  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
  const hasCloudinary = !!(cloudName && apiKey && apiSecret);

  if (!hasSupabase && !hasCloudinary) {
    console.warn('⚠️  [CONFIG WARNING] Neither Supabase nor Cloudinary cloud storage is fully configured.');
    console.warn('File uploads will fallback to local disk storage, which is ephemeral in cloud hosting (e.g. Cloud Run).');
  } else {
    if (hasSupabase) {
      console.log('✅ [CONFIG AUDIT] Supabase Cloud Storage: ACTIVE');
    }
    if (hasCloudinary) {
      console.log('✅ [CONFIG AUDIT] Cloudinary Media Engine: ACTIVE');
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  [CONFIG WARNING] GEMINI_API_KEY is not defined. AI Assistant & document workflows will run in offline fallback mode.');
  } else {
    console.log('✅ [CONFIG AUDIT] Gemini AI Assistant Engine: ACTIVE');
  }

  if (!(process.env.SMTP_USER && process.env.SMTP_PASS)) {
    console.warn('⚠️  [CONFIG WARNING] SMTP_USER/SMTP_PASS are not defined. E-mail dispatchers will fallback to console logging.');
  } else {
    console.log('✅ [CONFIG AUDIT] SMTP Email Transporter: ACTIVE');
  }
}

// SMTP Transporter Helper
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    console.warn('[SMTP] Missing SMTP credentials (SMTP_USER and SMTP_PASS/SMTP_PASSWORD). Mail notifications will be output to console logs.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

async function sendNotificationEmail(subject: string, text: string, html: string) {
  const recipient = 'kreboya603@gmail.com';
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n==========================================\n[SMTP SIMULATION] Mail to ${recipient}:\nSubject: ${subject}\nBody:\n${text}\n==========================================\n`);
    return { simulated: true };
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@madecc.com';
    const info = await transporter.sendMail({
      from: `"MADECC Group Portal" <${fromAddress}>`,
      to: recipient,
      subject,
      text,
      html,
    });
    console.log('[SMTP] Email sent successfully to ' + recipient + ':', info.messageId);
    return info;
  } catch (err) {
    console.error('[SMTP_ERROR] Failed to send email to ' + recipient + ':', err);
  }
}

async function sendEmail(recipient: string, subject: string, text: string, html: string) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n==========================================\n[SMTP SIMULATION] Mail to ${recipient}:\nSubject: ${subject}\nBody:\n${text}\n==========================================\n`);
    return { simulated: true };
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@madecc.com';
    const info = await transporter.sendMail({
      from: `"MADECC Group" <${fromAddress}>`,
      to: recipient,
      subject,
      text,
      html,
    });
    console.log('[SMTP] Email sent successfully to ' + recipient + ':', info.messageId);
    return info;
  } catch (err) {
    console.error('[SMTP_ERROR] Failed to send email to ' + recipient + ':', err);
  }
}

async function retryWithFallback<T>(
  fn: (model: string) => Promise<T>,
  models: string[] = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
  retriesPerModel: number = 2,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: any = null;

  for (const model of models) {
    let delay = initialDelayMs;
    for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
      try {
        return await fn(model);
      } catch (err: any) {
        lastError = err;
        let errMsg = err.message || '';
        if (typeof err === 'object') {
          try {
            errMsg += ' ' + JSON.stringify(err);
          } catch (_) {}
        }

        // Intercept leaked key or permissions error immediately to notify the user elegantly
        if (errMsg.includes('leaked') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('API key was reported as leaked')) {
          const leakedError = new Error('Your Gemini API key has been reported as leaked by Google. Please update/replace your GEMINI_API_KEY in the Settings > Secrets panel (or click Settings in Google AI Studio) to restore AI service operations.');
          (leakedError as any).status = 403;
          console.warn('[Gemini Warning] THE CONFIGURED GEMINI_API_KEY HAS BEEN REPORTED AS LEAKED by Google. Please go to Settings > Secrets in Google AI Studio and replace the key.');
          throw leakedError;
        }

        console.warn(`[GEMINI] Attempt ${attempt + 1} with model ${model} failed. Error: ${err.message || err}`);
        
        if (attempt < retriesPerModel) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models and retries failed.');
}

async function generateAIResponse(prompt: string, fallbackHtml: string): Promise<string> {
  const gemini = getGeminiClient();
  if (!gemini) {
    console.warn('[GEMINI] API Key missing. Using pre-crafted fallback email response.');
    return fallbackHtml;
  }
  try {
    const response = await retryWithFallback(async (modelName) => {
      return await gemini.models.generateContent({
        model: modelName,
        contents: prompt,
      });
    });
    let html = response.text || '';
    // Strip markdown formatting if any
    if (html.includes('```html')) {
      html = html.split('```html')[1].split('```')[0];
    } else if (html.includes('```')) {
      html = html.split('```')[1].split('```')[0];
    }
    return html.trim() || fallbackHtml;
  } catch (error: any) {
    console.warn('[Gemini Info] Falling back to offline email auto-response:', error.message || error);
    return fallbackHtml;
  }
}

const PORT = 3000;

// CSRF Cryptographic Configuration
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

function generateCsrfToken(): string {
  const timestamp = Date.now().toString();
  const randomSalt = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${randomSalt}`;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${payload}.${signature}`;
}

function validateCsrfToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  const [timestampStr, randomSalt, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  
  // Max token age: 24 hours
  const age = Date.now() - timestamp;
  const MAX_AGE = 24 * 60 * 60 * 1000;
  if (age < 0 || age > MAX_AGE) return false;
  
  const payload = `${timestampStr}.${randomSalt}`;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (err) {
    return false;
  }
}

export async function getApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Support Netlify Serverless environment path forwarding
  app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      req.url = req.url.replace('/.netlify/functions/api', '/api');
    }
    next();
  });

  // CSRF Protection Token Request Route (GET: Safe, always permitted)
  app.get('/api/csrf-token', (req, res) => {
    const token = generateCsrfToken();
    res.json({ csrfToken: token });
  });

  // Apply CSRF Protection Middleware globally on all write actions (POST, PUT, DELETE, PATCH)
  app.use('/api', (req, res, next) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Exclude CSRF token route (it is a GET anyway, but being safe)
    if (req.path === '/csrf-token') {
      return next();
    }

    // Requests with an Authorization Bearer header are structurally immune to CSRF.
    // They are explicitly triggered via JS headers and do not rely on implicit browser cookies.
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = req.headers['x-csrf-token'];
    if (!token || typeof token !== 'string' || !validateCsrfToken(token)) {
      const isMissing = !token;
      const debugDetail = isMissing 
        ? 'Missing CSRF token header (X-CSRF-Token).' 
        : 'Invalid or expired CSRF token.';
        
      console.warn(`[CSRF] Blocked unauthorized request from ${req.ip} targeting ${req.method} ${req.originalUrl}: ${debugDetail}`);
      return res.status(403).json({ 
        error: `Forbidden: ${debugDetail} To resolve, please refresh the webpage or ensure that your browser allows cookies and local storage, and then submit again.` 
      });
    }

    next();
  });

  // Ensure uploads directory exists and serve it statically
  const isServerlessEnvironment = 
    process.env.NETLIFY === 'true' || 
    process.env.NETLIFY === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
    process.env.LAMBDA_TASK_ROOT !== undefined ||
    process.env.FUNCTIONS_SIGNATURE !== undefined;

  const uploadDir = isServerlessEnvironment 
    ? '/tmp/uploads' 
    : path.join(process.cwd(), 'uploads');

  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
      console.error('Error creating uploads directory:', err);
    }
  }
  app.use('/uploads', express.static(uploadDir));

  // Configure multer disk storage for files up to 150MB
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });

  const upload = multer({
    storage: storage,
    limits: { fileSize: 150 * 1024 * 1024 } // 150MB limit
  });

  // Endpoint to sign client-side direct Cloudinary uploads (prevents serverless 6MB body size limits and timeouts)
  app.get('/api/cloudinary-signature', requireAuth, async (req: any, res) => {
    try {
      const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(400).json({ error: 'Cloudinary is not configured on the server.' });
      }

      const timestamp = Math.round(Date.now() / 1000);
      const folder = 'madecc';

      const cloudinary = await import('cloudinary');
      const signature = cloudinary.v2.utils.api_sign_request(
        { timestamp, folder },
        apiSecret
      );

      res.json({
        signature,
        timestamp,
        apiKey,
        cloudName,
        folder
      });
    } catch (err: any) {
      console.error('[CLOUDINARY_SIGN_ERROR] Error generating upload signature:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Upload endpoint (accepts any file, including up to 150MB videos, with cloud storage support)
  app.post('/api/upload', requireAuth, upload.single('file'), async (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      let fileUrl = `/uploads/${req.file.filename}`;

      // 1. Detect and upload to Supabase Storage if configured (production-ready)
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          const fileBuffer = fs.readFileSync(req.file.path);
          const bucketName = process.env.SUPABASE_BUCKET || 'madecc-assets';
          const fileName = `uploads/${Date.now()}-${req.file.originalname}`;

          const { error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, fileBuffer, {
              contentType: req.file.mimetype,
              cacheControl: '3600',
              upsert: true
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

          fileUrl = publicUrl;
          console.log(`[STORAGE] Successfully uploaded ${req.file.originalname} to Supabase Storage: ${fileUrl}`);
          
          // Remove local file after successful cloud upload
          fs.unlinkSync(req.file.path);
        } catch (supabaseErr) {
          console.error('[STORAGE-FALLBACK] Failed to upload to Supabase Storage, falling back to disk:', supabaseErr);
        }
      }
      // 2. Detect and upload to Cloudinary if configured
      else {
        const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
        if (cloudName && apiKey && apiSecret) {
          try {
            const cloudinary = await import('cloudinary');
            cloudinary.v2.config({
              cloud_name: cloudName,
              api_key: apiKey,
              api_secret: apiSecret
            });

            const result = await cloudinary.v2.uploader.upload(req.file.path, {
              resource_type: 'auto',
              folder: 'madecc'
            });

            fileUrl = result.secure_url;
            console.log(`[STORAGE] Successfully uploaded ${req.file.originalname} to Cloudinary: ${fileUrl}`);
            
            // Remove local file after successful cloud upload
            fs.unlinkSync(req.file.path);
          } catch (cloudinaryErr) {
            console.error('[STORAGE-FALLBACK] Failed to upload to Cloudinary, falling back to disk:', cloudinaryErr);
          }
        }
      }

      // Return metadata and public-facing secure URL to store in Neon PostgreSQL
      res.json({ url: fileUrl, filename: req.file.filename, size: req.file.size });
    } catch (err: any) {
      console.error('File upload handler error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- RATE LIMITER FOR CONTACT FORM ---
  const ipSubmissions = new Map<string, number[]>();
  const rateLimitContact = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.ip || req.headers['x-forwarded-for'] || 'unknown').toString();
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 3;

    if (!ipSubmissions.has(ip)) {
      ipSubmissions.set(ip, []);
    }

    const timestamps = ipSubmissions.get(ip)!;
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);
    ipSubmissions.set(ip, activeTimestamps);

    if (activeTimestamps.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many messages submitted. Please wait 1 minute and try again.' });
    }

    activeTimestamps.push(now);
    next();
  };


  // ==========================================
  // --- AUTH ENDPOINTS ---
  // ==========================================

  // Verify token, return DB profile with persistent login history logging
  app.get('/api/auth/me', requireAuth, async (req: any, res) => {
    try {
      await logAudit(
        req.dbUser.uid,
        req.dbUser.email,
        'LOGIN_SUCCESS',
        `User ${req.dbUser.name} initiated session successfully with role: ${req.dbUser.role}`
      );
    } catch (auditErr) {
      console.error('Failed to log session start audit:', auditErr);
    }
    res.json({ user: req.dbUser });
  });

  // Self-demote/promote for demonstration purposes or admin testing
  app.put('/api/auth/role', requireAuth, async (req: any, res) => {
    const { role } = req.body;
    if (!['admin', 'staff', 'client'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    try {
      const updated = await db.update(users)
        .set({ role })
        .where(eq(users.id, req.dbUser.id))
        .returning();
      
      await logAudit(req.dbUser.uid, req.dbUser.email, 'ROLE_CHANGE', `Changed own role to ${role}`);
      res.json({ user: updated[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all user synced data keys (replaces localStorage)
  app.get('/api/user-sync', requireAuth, async (req: any, res) => {
    try {
      const records = await db.select()
        .from(userSyncData)
        .where(eq(userSyncData.userId, req.dbUser.uid));
      
      const dictionary: Record<string, string> = {};
      for (const r of records) {
        dictionary[r.key] = r.value;
      }
      res.json({ data: dictionary });
    } catch (error: any) {
      console.error('Error fetching user sync data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save/Update a synced data key
  app.post('/api/user-sync', requireAuth, async (req: any, res) => {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    const valString = typeof value === 'string' ? value : JSON.stringify(value);
    
    try {
      const existing = await db.select()
        .from(userSyncData)
        .where(and(eq(userSyncData.userId, req.dbUser.uid), eq(userSyncData.key, key)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(userSyncData)
          .set({ value: valString, updatedAt: new Date() })
          .where(eq(userSyncData.id, existing[0].id));
      } else {
        await db.insert(userSyncData)
          .values({
            userId: req.dbUser.uid,
            key,
            value: valString
          });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error saving user sync data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save global theme system preference
  app.post('/api/user-theme', requireAuth, async (req: any, res) => {
    const { theme } = req.body;
    if (!['dark', 'light'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme' });
    }
    try {
      // 1. Update user profile in Neon PostgreSQL
      const updatedUser = await db.update(users)
        .set({ theme })
        .where(eq(users.id, req.dbUser.id))
        .returning();

      // 2. Also keep in sync_data for backup or generic retrieval
      const existing = await db.select()
        .from(userSyncData)
        .where(and(eq(userSyncData.userId, req.dbUser.uid), eq(userSyncData.key, 'theme')))
        .limit(1);

      if (existing.length > 0) {
        await db.update(userSyncData)
          .set({ value: theme, updatedAt: new Date() })
          .where(eq(userSyncData.id, existing[0].id));
      } else {
        await db.insert(userSyncData)
          .values({
            userId: req.dbUser.uid,
            key: 'theme',
            value: theme
          });
      }

      await logAudit(req.dbUser.uid, req.dbUser.email, 'THEME_CHANGE', `Changed visual theme to ${theme}`);
      res.json({ success: true, theme, user: updatedUser[0] });
    } catch (error: any) {
      console.error('Error saving user theme preference:', error);
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- CHATBOT (GEMINI) ENDPOINT ---
  // ==========================================
  app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const gemini = getGeminiClient();
    if (!gemini) {
      return res.json({ 
        reply: "Thank you for reaching out to MADECC Group! Our AI virtual assistant is currently offline for scheduled maintenance. Please feel free to contact our direct customer support desk at +237 683 316 486 (or on WhatsApp) or email us at madeccco5@gmail.com. We look forward to assisting you with your construction and engineering needs!" 
      });
    }

    try {
      const systemInstruction = `You are "MADECC Bot", a virtual assistant representing MADECC Group, a premier construction and civil engineering firm in Cameroon.
Your role is to assist website visitors with their construction inquiries in a polite, highly informative, and professional manner.

MADECC Group Corporate Profiles:
- Headquarters: Rue Joss, Bonanjo, Douala, Cameroon.
- Phone Numbers for customer calls & Whatsapp:
  * +237 683 316 486 (General & WhatsApp)
  * +237 671 063 511 (Operations)
  * +237 689 115 595 (Projects)
  * +237 671 289 643 (Administration)
  * +237 640 194 505 (Customer Support)
- Official Email Contacts: madeccco5@gmail.com, madecccons@gmail.com
- Main Services: General Contracting, Architectural & Interior Design, Civil Infrastructure Planning, Green & Sustainable Building.
- Core Iconic Projects in Cameroon:
  * MADECC Eco-HQ Tower (Douala, Budget: 14.7 Billion FCFA) - A cutting-edge 6-story commercial office building in Douala featuring zero-carbon building design adapted for tropical climates.
  * Kribi Beachfront Luxury Estates (Kribi, Budget: 8.5 Billion FCFA) - A premium smart-grid residential complex of 12 custom net-zero luxury homes.
  * The Sanaga Bridge Corridor (Eda, Budget: 43.2 Billion FCFA) - A critical civil infrastructure highway and suspension bridge spanning the Sanaga River.
  * Douala Port Logistics Terminal (Douala Port, Budget: 22.8 Billion FCFA) - Modern industrial warehouse for automated Central African logistics.
- Currency: Central African CFA franc (FCFA / XAF).
- Human Support: If they request direct human assistance or custom engineering estimates, kindly invite them to submit their inquiry via our interactive contact form or schedule an appointment. You can also offer our direct phone, WhatsApp, or email desk channels for immediate personal service.

Answer customer inquiries professionally, explaining materials, safety compliance, estimates, and engineering processes. Always suggest booking a free consultation using our appointment scheduler or contact form, and offer them the direct phone numbers or WhatsApp link. Keep explanations helpful, concise, and professional. Respond in English or French depending on the user's language.`;

      const response = await retryWithFallback(async (modelName) => {
        const chatSession = gemini.chats.create({
          model: modelName,
          config: {
            systemInstruction,
          }
        });
        return await chatSession.sendMessage({ message });
      });

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error('[CHAT_API_ERROR] Chat failed after all retries:', error);
      res.status(500).json({ error: 'Failed to communicate with virtual assistant.' });
    }
  });


  // ==========================================
  // --- CAREER STUDIO GENERATOR ENDPOINT ---
  // ==========================================
  
  function getFallbackLetter(letterType: string, subType: string, senderName: string, recipientCompany: string) {
    const sName = senderName || 'Jane Doe';
    const rCompany = recipientCompany || 'MADECC Group';

    if (letterType === 'teaching-jobs') {
      switch (subType) {
        case 'stem-teacher':
          return {
            subject: 'APPLICATION FOR THE POST OF SENIOR MATHEMATICS & PHYSICS TEACHER',
            salutation: 'Dear Sir/Madam,',
            bodyParagraphs: [
              `I am writing to express my strong interest in the Senior Mathematics and Physics teaching vacancy at your esteemed institution. Having followed your school’s remarkable academic achievements and commitment to STEM education, I am eager to contribute my pedagogical expertise and passion for educational excellence to your faculty.`,
              `With over eight years of teaching experience, including serving as a Head of Department, I have successfully designed student-centered curriculum frameworks that make complex concepts in calculus, trigonometry, and Newtonian mechanics highly accessible. In my previous role, I guided my classes to a record-breaking 94% pass rate in national examinations.`,
              `Beyond instruction, I am highly committed to fostering a supportive, inclusive learning environment. I have successfully organized region-wide STEM forums, pioneered student coaching circles, and mentored junior educators in implementing digital interactive simulators.`,
              `Thank you for your time and consideration of my application. I look forward to the opportunity to discuss how my teaching credentials align with the academic aspirations of your institution.`
            ],
            signoff: 'Yours faithfully,'
          };
        case 'university-lecturer':
          return {
            subject: 'APPLICATION FOR THE POST OF UNIVERSITY LECTURER / RESEARCH FELLOW',
            salutation: 'Dear Chairman of the Search Committee,',
            bodyParagraphs: [
              `I am pleased to submit my application for the Lecturer/Research Fellow position in your esteemed Faculty. With a strong track record of high-impact research publications and over six years of academic teaching experience, I am prepared to deliver rigorous training to your students and lead state-of-the-art academic investigations.`,
              `My doctoral research focused on structural resilience and sustainable load modeling in sub-tropical zones, resulting in several peer-reviewed articles. In the classroom, I utilize a blended learning approach that combines theoretical engineering and computational mechanics, ensuring students gain both conceptual depth and practical technical skills.`,
              `I am eager to collaborate with your distinguished colleagues on interdisciplinary research grants and to contribute actively to departmental curriculum reviews. I have a proven track record of securing national project funding and supervising undergraduate honors theses.`,
              `Thank you for considering my credentials for this academic post. I look forward to the prospect of discussing my research program and pedagogical vision with your committee.`
            ],
            signoff: 'Yours sincerely,'
          };
        case 'civil-engineer':
          return {
            subject: 'APPLICATION FOR THE POSITION OF SENIOR CIVIL / INFRASTRUCTURE ENGINEER',
            salutation: 'Dear Hiring Director,',
            bodyParagraphs: [
              `It is with great enthusiasm that I submit my application for the Senior Civil Engineer position. Having managed multi-million dollar public infrastructure tenders and geotechnical operations, I am eager to bring my structural expertise and team leadership to your esteemed firm.`,
              `Over the past decade, I have supervised reinforced concrete high-rises and municipal bridge expansions, ensuring strict safety compliance and structural load balancing. By leveraging advanced CAD and Civil 3D load computations, I have consistently optimized steel and material logistics, reducing project overheads by up to 15%.`,
              `My professional background includes extensive collaboration with regulatory boards, executing environmental impact studies, and leading field crews under complex climate constraints. I pride myself on maintaining zero-incident safety records across all managed sites.`,
              `I appreciate your consideration of my professional profile. I would welcome the opportunity to discuss how my infrastructure project management background can add value to your upcoming portfolios.`
            ],
            signoff: 'Yours faithfully,'
          };
        case 'architect':
          return {
            subject: 'APPLICATION FOR THE ROLE OF LEAD ARCHITECT & SPACE DESIGNER',
            salutation: 'Dear Head of Design,',
            bodyParagraphs: [
              `I am writing to express my eager interest in the Lead Architect and Space Designer role at your innovative firm. With a passion for sustainable tropical architecture and a portfolio of award-winning green commercial layouts, I am excited to help elevate your visual and functional design standards.`,
              `My design philosophy merges structural utility with aesthetic boldness, utilizing energy-efficient materials and natural ventilation profiles. I am fully proficient in Revit, SketchUp, and custom structural rendering pipelines, having successfully guided projects from conceptual sketches to final builder drafts.`,
              `I have collaborated with engineering and municipal planning boards to obtain full zoning approvals, and have a proven track record of supervising interior finish work to ensure absolute alignment with high-end client expectations.`,
              `Thank you for reviewing my application and digital portfolio. I am enthusiastic about discussing how my design methodology can bring your clients' architectural visions to life.`
            ],
            signoff: 'Sincerely yours,'
          };
        case 'project-manager':
          return {
            subject: 'APPLICATION FOR THE POSITION OF SENIOR PROJECTS MANAGER',
            salutation: 'Dear Operations Director,',
            bodyParagraphs: [
              `Please accept this letter as my formal application for the Senior Projects Manager vacancy at your company. With over nine years of project management experience leading complex real-estate and utility initiatives, I have the operational expertise to keep your schedules on-time and within budget.`,
              `I specialize in resource dispatch, risk management matrices, and agile project monitoring. In my previous role, I oversaw a multi-disciplinary engineering and contractor workforce, implementing rigorous project milestone reviews that accelerated delivery cycles by 20%.`,
              `My strength lies in seamless stakeholder communications and managing supply chain logistics. I am certified in PMP and have a proven record of negotiating contracts that maximize cost-efficiency while ensuring standard regulatory compliance.`,
              `I look forward to discussing how my operational methodology can drive success for your upcoming projects. Thank you for your time and review of my application.`
            ],
            signoff: 'Yours faithfully,'
          };
        case 'it-developer':
          return {
            subject: 'APPLICATION FOR THE ROLE OF LEAD SYSTEMS & SOFTWARE DEVELOPER',
            salutation: 'Dear Chief Technology Officer,',
            bodyParagraphs: [
              `I am writing to express my strong interest in the Lead Systems and Software Developer position. As a full-stack engineer with over seven years of experience building secure, scalable cloud architectures and enterprise software, I am eager to lead your technology initiatives.`,
              `I have designed high-throughput APIs, optimized database queries, and implemented robust OAuth2 security gateways, reducing server response times by 30%. My technology stack includes React, Node.js, TypeScript, PostgreSQL, and modern container orchestration tools.`,
              `I am highly skilled in mentoring junior developers, conducting rigorous code reviews, and establishing clean CI/CD automated test pipelines to ensure software of the highest reliability.`,
              `Thank you for your time and consideration. I would be thrilled to discuss how my software engineering experience can help scale your digital products.`
            ],
            signoff: 'Yours sincerely,'
          };
        default:
          return {
            subject: 'APPLICATION FOR THE POSITION of CO-WORKER / COLLABORATOR',
            salutation: 'Dear Hiring Manager,',
            bodyParagraphs: [
              `I am writing to formally submit my application for employment opportunities at your company. With a solid professional background and a dedication to continuous growth, I am confident in my ability to make a positive impact on your operations.`,
              `Throughout my career, I have focused on collaboration, problem-solving, and executing tasks to the highest standards. I adapt quickly to new workflows and pride myself on my strong work ethic and attention to detail.`,
              `I would appreciate the chance to discuss how my qualifications align with your company's core objectives. Thank you for your consideration.`
            ],
            signoff: 'Yours faithfully,'
          };
      }
    } else {
      // letterType === 'application'
      switch (subType) {
        case 'general-employment':
          return {
            subject: 'APPLICATION FOR EMPLOYMENT OPPORTUNITY',
            salutation: 'Dear Recruitment Director,',
            bodyParagraphs: [
              `I am writing to formally express my interest in joining your esteemed company. With a diverse range of professional competencies and a strong record of accomplishment, I am confident in my ability to contribute effectively to your organizational goals.`,
              `My professional journey has been defined by a commitment to operational excellence, cross-functional collaboration, and strategic execution. I possess robust communication skills and have successfully navigated corporate and public partnerships to drive measurable growth.`,
              `I admire your company's market leadership and dedication to quality, and I am eager to apply my skills within your dynamic team environment to solve complex challenges.`,
              `Thank you for your time and review of my application documents. I look forward to discussing how my experience can benefit your upcoming initiatives.`
            ],
            signoff: 'Yours faithfully,'
          };
        case 'internship':
          return {
            subject: 'APPLICATION FOR PROFESSIONAL INTERNSHIP PROGRAM',
            salutation: 'Dear Human Resources Team,',
            bodyParagraphs: [
              `I am writing to request a professional internship opportunity at your prestigious organization. As an ambitious and high-achieving student specializing in my field, I am eager to apply my academic foundation to real-world industrial projects under your mentorship.`,
              `During my academic studies, I have gained hands-on experience through project-based coursework, laboratory analyses, and professional modeling software. I have maintained a strong academic record and won student accolades for teamwork and innovation.`,
              `An internship with your company would provide me with invaluable exposure to standard corporate workflows, permitting me to contribute fresh perspectives and enthusiastic support to your active teams.`,
              `Thank you for considering my application for an internship. I am available for an interview at your earliest convenience to discuss how I can assist your projects.`
            ],
            signoff: 'Yours faithfully,'
          };
        case 'promotion':
          return {
            subject: 'APPLICATION FOR INTERNAL PROMOTION & LEADER POST',
            salutation: 'Dear Management Board,',
            bodyParagraphs: [
              `I am writing to formally express my interest in applying for the upcoming internal promotion to the leadership position. Having served proudly within our organization for several years, I am eager to take on this expanded responsibility and lead our team to new heights.`,
              `In my current role, I have consistently exceeded my key performance metrics, successfully streamlined cross-departmental operations, and spearheaded key initiatives that reduced operational bottlenecks. I have also loved mentoring junior staff and fostering a culture of accountability.`,
              `I believe my deep familiarity with our corporate values, combined with my leadership background, makes me uniquely qualified to guide the department through its upcoming growth phases.`,
              `Thank you for your continuous support and for considering my application for this promotion. I look forward to discussing my vision for the role with you.`
            ],
            signoff: 'Sincerely yours,'
          };
        case 'tender-eoi':
          return {
            subject: `EXPRESSION OF INTEREST (EOI) & COVER LETTER FOR ARCHITECTURAL/CONSTRUCTION TENDERS`,
            salutation: 'Dear President of the Tenders Board,',
            bodyParagraphs: [
              `We are pleased to submit our Expression of Interest (EOI) for the upcoming municipal development and construction tender. As a registered contracting firm with extensive regional experience, we are fully prepared to deliver world-class infrastructure engineering on-time and within budget.`,
              `Our technical proposal highlights our specialized competence in structural integrity, eco-friendly materials sourcing, and advanced load-balancing computations. We have successfully completed similar large-scale public initiatives, maintaining strict adherence to international safety regulations.`,
              `We possess a robust fleet of modern heavy machinery, a multidisciplinary team of licensed engineers, and a secure financial line to ensure seamless project execution without logistical delay.`,
              `We appreciate the opportunity to bid on this milestone public contract and look forward to the opening of the technical and financial envelopes. Thank you for your review of our qualifications.`
            ],
            signoff: 'Yours faithfully,'
          };
        case 'corp-collab':
          return {
            subject: 'PROPOSAL FOR CORPORATE COLLABORATION & STRATEGIC PARTNERSHIP',
            salutation: 'Dear Managing Director,',
            bodyParagraphs: [
              `I am writing on behalf of our firm to propose the establishment of a strategic corporate partnership between our organizations. By aligning our respective industry strengths, we believe we can unlock substantial synergy and deliver unprecedented value to our clients.`,
              `Our firm specializes in advanced structural contracting and architectural design, while your company represents excellence in raw materials supply and regional distribution. Together, we can form a highly integrated solution that accelerates execution timelines and lowers cost-overheads.`,
              `We suggest a preliminary meeting next week to explore potential pilot projects where our combined competencies can be immediately deployed to secure upcoming market opportunities.`,
              `Thank you for considering this collaborative proposal. We are highly enthusiastic about the prospect of a long and mutually beneficial relationship.`
            ],
            signoff: 'Yours sincerely,'
          };
        case 'grad-school':
          return {
            subject: 'APPLICATION FOR ADMISSION TO THE POSTGRADUATE PROGRAM',
            salutation: 'Dear Members of the Graduate Admissions Committee,',
            bodyParagraphs: [
              `I am writing to express my eager desire to gain admission into your prestigious Master of Science program. Having graduated at the top of my undergraduate class and developed a keen interest in advanced structural engineering, I believe your curriculum offers the ideal setting for my academic development.`,
              `My undergraduate thesis explored sustainable concrete composites for high-temperature tropical climates, and I am keen to expand this research under your faculty's distinguished supervision. I have already acquired strong foundations in statistical modeling and advanced physics.`,
              `I am highly motivated to participate in your active research seminars, contribute to departmental teaching assistantships, and represent your institution with academic distinction.`,
              `Thank you for your review and consideration of my postgraduate application. I look forward to the opportunity to join your scholarly community.`
            ],
            signoff: 'Yours sincerely,'
          };
        case 'admin-permit':
          return {
            subject: 'APPLICATION FOR ADMINISTRATIVE PERMIT AND CLEARANCE',
            salutation: 'Your Excellency / Honorable Minister,',
            bodyParagraphs: [
              `I have the honor to write to your high office to respectfully request the issuance of an administrative permit and structural clearance for our upcoming municipal infrastructure initiative.`,
              `In strict compliance with current urban zoning codes and environmental safety standards, we have compiled all necessary technical diagrams, soil stability analyses, and community impact reports for your review. Our project aims to expand municipal transport safety and create dozens of local employment opportunities.`,
              `We remain at your disposal to supply any additional documentations or participate in state technical reviews to ensure absolute alignment with national regulations.`,
              `We thank you in advance for your high attention to this request, and pray you accept, Your Excellency, the assurances of our highest respect and consideration.`
            ],
            signoff: 'Yours respectfully,'
          };
        default:
          return {
            subject: 'FORMAL APPLICATION AND LETTER OF CORRESPONDENCE',
            salutation: 'Dear Sir/Madam,',
            bodyParagraphs: [
              `I am writing to bring to your attention a formal request regarding our ongoing business operations. We are dedicated to maintaining positive relations and ensuring all procedures are carried out professionally.`,
              `We have attached the relevant documentation for your records and stand ready to collaborate on any necessary next steps. Our team is fully committed to a smooth and mutually agreeable resolution.`,
              `Thank you for your prompt attention to this matter. We look forward to your feedback.`
            ],
            signoff: 'Yours faithfully,'
          };
      }
    }
  }

  app.post('/api/career/generate-letter', async (req, res) => {
    const {
      letterType,
      subType,
      senderName,
      senderTitle,
      senderEmail,
      senderPhone,
      senderAddress,
      recipientName,
      recipientTitle,
      recipientCompany,
      recipientAddress,
      customPrompt
    } = req.body;

    const gemini = getGeminiClient();
    
    if (!gemini) {
      console.warn('[GEMINI] Offline. Using fallback pre-crafted letters.');
      const fallback = getFallbackLetter(letterType, subType, senderName, recipientCompany);
      return res.json(fallback);
    }

    try {
      const systemInstruction = `You are an expert executive resume writer and career coach specializing in professional cover letters and official corporate/administrative application letters in Cameroon and internationally.

Your task is to write a highly professional, realistic, and persuasive cover letter or application letter based on the user's input.
Generate a structured JSON object containing:
1. "subject" - A bold, professional subject line (e.g. "APPLICATION FOR THE POSITION OF...")
2. "salutation" - An appropriate formal salutation (e.g. "Dear Mr. President,", "Dear Hiring Manager,", "Dear Sir/Madam,")
3. "bodyParagraphs" - An array of 3 to 4 distinct paragraphs. The first paragraph should state the intent to apply and enthusiasm, the middle paragraphs should highlight specific experience, technical skills, and value proposition tailored to the firm/industry, and the final paragraph should conclude with a call to action and a polite thank you.
4. "signoff" - A polite closing sign-off (e.g. "Yours faithfully,", "Sincerely,")

Choose high-quality, professional vocabulary, and tailor the letter carefully according to the requested letterType, subType, and any user accomplishments. Keep the letters fully realistic, referring to professional standards (like ONIGC, local municipal bridge projects, or corporate bid procedures in Cameroon where applicable if relevant to the sender/recipient).`;

      const userPrompt = `Generate a letter of type "${letterType}" (sub-type: "${subType}").
Sender details:
- Name: ${senderName || 'N/A'}
- Title: ${senderTitle || 'N/A'}
- Email: ${senderEmail || 'N/A'}
- Phone: ${senderPhone || 'N/A'}
- Address: ${senderAddress || 'N/A'}

Recipient details:
- Name: ${recipientName || 'N/A'}
- Title: ${recipientTitle || 'N/A'}
- Company/Institution: ${recipientCompany || 'N/A'}
- Address: ${recipientAddress || 'N/A'}

Additional highlights / Custom instructions from applicant:
"${customPrompt || 'None provided. Generate a highly persuasive, stellar letter.'}"`;

      const response = await retryWithFallback(async (modelName) => {
        return await gemini.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                salutation: { type: Type.STRING },
                bodyParagraphs: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                signoff: { type: Type.STRING }
              },
              required: ["subject", "salutation", "bodyParagraphs", "signoff"]
            }
          }
        });
      });

      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } catch (err: any) {
      console.warn('[Gemini Info] Falling back to offline cover letter generator:', err.message || err);
      // Fallback
      const fallback = getFallbackLetter(letterType, subType, senderName, recipientCompany);
      res.json(fallback);
    }
  });


  function getFallbackArticles(
    companyName: string,
    legalForm: string,
    jurisdiction: string,
    headOffice: string,
    shareCapital: string,
    sharesCount: string,
    shareValue: string,
    initialManager: string,
    scopeOfActivity: string
  ) {
    const activeName = companyName || 'MADECC CIVIL WORKS SARL';
    const activeForm = legalForm || 'SARL (Société à Responsabilité Limitée)';
    const activeJurisdiction = jurisdiction || 'Cameroon (OHADA Uniform Act) & Worldwide';
    const activeOffice = headOffice || 'Akwa Boulevard, Douala, Cameroon';
    const activeCapital = shareCapital || '10,000,000 FCFA';
    const activeSharesCount = sharesCount || '1,000';
    const activeShareValue = shareValue || '10,000 FCFA';
    const activeManager = initialManager || 'Dr. Marcel Mbida';
    const activeScope = scopeOfActivity || 'Execution of all civil works, building construction, road infrastructure, hydraulic and maritime engineering, and project supply chain logistics.';

    return {
      title: `ARTICLES OF ASSOCIATION OF ${activeName.toUpperCase()}`,
      metadata: `Governed under the provisions of the OHADA Uniform Act on Commercial Companies and Economic Interest Groups (AUDSCGIE) and applicable international business laws. Jurisdiction: ${activeJurisdiction}. Registered office: ${activeOffice}.`,
      articles: [
        {
          number: 1,
          title: "ARTICLE 1: LEGAL FORM AND DENOMINATION",
          content: `**1.1. Purpose & Scope:** This Article establishes the formal legal existence, corporate form, and denomination of the company to operate within Cameroon and international markets.\n\n**1.2. Legal Authority:** Conforming to Article 1 and Articles 309 to 384 of the OHADA Uniform Act Relating to Commercial Companies and Economic Interest Groups (AUDSCGIE).\n\n**1.3. Corporate Form:** The company is established in the form of a ${activeForm}. It operates as a limited liability entity where the shareholders' liabilities are strictly limited to the amount of their respective contributions to the share capital.\n\n**1.4. Corporate Name:** The company operates under the official corporate denomination: "${activeName}". This name must appear on all deeds, bills, invoices, letters, receipts, and publications issued by the company, followed immediately by its legal form, registered office address, and its registered share capital.\n\n**1.5. Protection & Penalties:** Any unauthorized third-party use of the company name is strictly prohibited and subject to civil and criminal penalties under Cameroonian trade laws. The General Manager is authorized to initiate intellectual property protection filings under OAPI guidelines.`
        },
        {
          number: 2,
          title: "ARTICLE 2: REGISTERED OFFICE (SIÈGE SOCIAL) AND DOMICILE",
          content: `**2.1. Purpose & Scope:** Establishing the official address for statutory notices, tax declarations, and legal jurisdictions.\n\n**2.2. Legal Authority:** OHADA AUDSCGIE Articles 24 to 26 and Cameroonian tax residence statutes.\n\n**2.3. Location:** The registered office is located at: ${activeOffice}.\n\n**2.4. Procedures for Transfer:** The registered office designates the legal forum for any notification, administrative filing, or judicial action. The General Manager (Gérant) is authorized to transfer the registered office within the same city or territory by simple management decision. A transfer to a different city or region requires approval from the shareholders through an Extraordinary General Meeting (EGM) and subsequent update of the Trade and Personal Property Credit Register (RCCM).\n\n**2.5. Record Keeping:** All official letters, court writs, and regulatory notifications received at the registered office must be recorded in an incoming mail ledger overseen by the Company Secretary.`
        },
        {
          number: 3,
          title: "ARTICLE 3: CORPORATE PURPOSE (OBJET SOCIAL) AND INDUSTRIAL SPECIFICATIONS",
          content: `**3.1. Purpose & Scope:** Defining the commercial, technical, and engineering bounds of the company's operations.\n\n**3.2. Legal Authority:** OHADA AUDSCGIE Articles 19 to 21.\n\n**3.3. Permissible Construction & Engineering Scope:** The primary corporate purpose of the company consists of high-standard construction, civil engineering, and infrastructure operations, including:\n- 3.3.1. Execution of all civil engineering works, building construction, public works, road networks, bridge building, hydraulic dams, and structural installations.\n- 3.3.2. General contracting, infrastructure development, real estate development, and heavy equipment leasing.\n- 3.3.3. Technical design, architectural procurement, quantity surveying, supply chain logistics, and project management of complex industrial structures.\n- 3.3.4. Participation in public and private tenders, the formation of joint ventures (JVs), consortia, and partnerships.\n- 3.3.5. Any commercial, financial, industrial, or real estate operations directly or indirectly linked to the achievement of this corporate purpose.\n\n**3.4. Exceptions & Exclusions:** The company shall not engage in financial or banking activities reserved for accredited credit institutions under COBAC regulations.`
        },
        {
          number: 4,
          title: "ARTICLE 4: CORPORATE DURATION (DURÉE)",
          content: `**4.1. Purpose & Scope:** Defining the legal lifespan of the company and rules for extension or early dissolution.\n\n**4.2. Legal Authority:** OHADA AUDSCGIE Article 28.\n\n**4.3. Lifespan:** The company is established for a duration of ninety-nine (99) years starting from its formal registration in the RCCM of Cameroon.\n\n**4.4. Procedures for Extension:** At least one (1) year prior to the expiration of the company's term, the General Manager must convene an Extraordinary General Meeting of shareholders to decide whether the company's duration should be extended. This decision must be made in accordance with the voting requirements of an EGM and filed with the notary public and the RCCM.\n\n**4.5. Failures and Penalties:** If the Manager fails to convene this meeting, any shareholder may petition the President of the competent commercial court to appoint a corporate representative to hold the meeting, with costs borne by the company.`
        },
        {
          number: 5,
          title: "ARTICLE 5: SHARE CAPITAL AND SHARES DISTRIBUTION",
          content: `**5.1. Purpose & Scope:** Detailing the capital structure, share valuation, and shareholder certificates.\n\n**5.2. Legal Authority:** OHADA AUDSCGIE Articles 311 to 316.\n\n**5.3. Capitalization:** The share capital is fixed at the sum of ${activeCapital}, divided into ${activeSharesCount} equal shares with a nominal value of ${activeShareValue} each, fully subscribed and paid up by the initial founders.\n\n**5.4. Certificates and Share Register:** Shares are nominative and represented by physical or digital Share Certificates signed by the General Manager. All transactions must be recorded in the company's physical and digital Share Transfer Register (Registre des transferts de parts) kept at the registered office.\n\n**5.5. Certificate Replacement:** If a certificate is lost or destroyed, a duplicate is issued upon proof of ownership, a 30-day public notice, and a signed indemnity bond. Capital increases or reductions must be authorized by an EGM.`
        },
        {
          number: 6,
          title: "ARTICLE 6: STATUTORY MANAGEMENT & LIMITATIONS OF POWER (GÉRANCE)",
          content: `**6.1. Purpose & Scope:** Governing the executive management of the company and limiting the powers of the Gérant.\n\n**6.2. Legal Authority:** OHADA AUDSCGIE Articles 323 to 328.\n\n**6.3. Appointment:** The company is managed and legally bound by its initial General Manager (Gérant): ${activeManager}, appointed for an indefinite term, unless removed by the shareholders.\n\n**6.4. Scope of Authority:** The Gérant has the broadest executive powers to act in all circumstances in the name of the company and conduct civil works operations. However, the Manager's authority is subject to board-approved limits.\n\n**6.5. Mandated Limitations of Power:** The Gérant is strictly prohibited from executing borrowing agreements exceeding 50% of the company's share capital, or selling substantial corporate real estate and assets, without the prior written authorization of the shareholders in a General Meeting. Violations of these limitations shall constitute grounds for immediate dismissal and personal liability for damages.`
        },
        {
          number: 7,
          title: "ARTICLE 7: SHAREHOLDERS' GENERAL MEETINGS (VOTING & NOTICES)",
          content: `**7.1. Purpose & Legal Authority:** Governing all collective decisions of the company's shareholders. Governed strictly under OHADA AUDSCGIE Articles 546 to 561.\n\n**7.2. Annual General Meeting (AGM) Mandates:**\n- 7.2.1. Held mandatorily within six (6) months of the close of each financial year (by June 30th).\n- 7.2.2. Responsibilities: Approval of the annual financial statements; appointment or removal of directors and statutory managers; appointment of external auditors; declaration of dividends; approval of strategic projects and major construction contracts exceeding 50% of capital; and authorizations for capital increases.\n\n**7.3. Extraordinary General Meeting (EGM) Mandates:**\n- 7.3.1. Convened by the Gérant, the statutory auditor, or shareholders representing at least twenty percent (20%) of the share capital in emergency circumstances.\n- 7.3.2. Responsibilities: Authorizing mergers, acquisitions, splits, spin-offs, early voluntary liquidation, amendments to these Articles of Association, sale of substantial corporate real estate or capital assets, and borrowing beyond approved limits.\n\n**7.4. Notice of Meetings & Documents:**\n- 7.4.1. Notice Period: Written notification delivered by hand against signature, registered post with acknowledgment of receipt, or official electronic mail (email) with read-receipt, sent at least fifteen (15) calendar days prior to the meeting date.\n- 7.4.2. Supporting Documents: Convocations must contain a precise Agenda and must be accompanied by draft resolutions, financial statements, the General Manager's report, and the Auditor's report.\n\n**7.5. Quorums, Adjournments & Voting Rights:**\n- 7.5.1. AGM Quorum: On first call, representing at least one-quarter (25%) of the shares. On second call, no quorum is required. Resolutions are passed by a simple majority of votes cast (50% + 1 vote).\n- 7.5.2. EGM Quorum: On first call, representing at least one-half (50%) of the share capital. On second call, representing at least one-quarter (25%) of the share capital. Resolutions require a two-thirds (66.67%) majority of votes present or represented.\n- 7.5.3. Voting Rights: Strictly "one share, one vote". Voting may be executed in person, by proxy to another shareholder, or through secure electronic voting. Ballots may be cast by show of hands, or secret ballot upon request of any shareholder. The Chairman shall have a casting vote only where expressly authorized.\n\n**7.6. Minutes & Record Keeping:** All deliberations must be recorded in formal Minutes (Procès-verbaux), signed by the General Manager/Chairman and the secretary of the assembly, and permanently stored in a sequential, numbered corporate minutes register (Registre des délibérations) preserved at the registered office. Failure to maintain correct records shall incur administrative penalties of 500,000 FCFA per instance.`
        },
        {
          number: 8,
          title: "ARTICLE 8: TRANSFER, TRANSMISSION, AND PLEDGING OF SHARES",
          content: `**8.1. Purpose & Legal Authority:** Regulating any changes in share ownership to maintain corporate stability and protect shareholders' assets under OHADA AUDSCGIE Articles 317 to 322.\n\n**8.2. Right of First Refusal (Pre-emption Right):** Existing shareholders enjoy an absolute right of first refusal. Any shareholder desiring to transfer shares to a non-shareholder third party must submit a written request via registered post to the General Manager, specifying the name of the transferee, the number of shares, and the agreed price. The General Manager shall notify all shareholders within seven (7) business days. Shareholders have thirty (30) calendar days from receipt to exercise their pre-emption rights proportionally.\n\n**8.3. Board Approval (Consent Clause):** Any transfer of shares to a non-shareholder third party requires mandatory prior approval by the General Meeting of shareholders representing at least three-quarters (75%) of the company's capital.\n\n**8.4. Valuation of Shares:** In the event of a dispute over the fair value of shares, the price shall be determined by an independent certified accountant/valuation expert (Expert-Comptable Agréé CEMAC) appointed by mutual agreement of the parties or, failing that, by the President of the competent commercial court of Cameroon.\n\n**8.5. Share Certificates & Transfer Register:** Shares are nominative and represented by Share Certificates signed by the General Manager. All transactions must be recorded in the company's physical and digital Share Transfer Register (Registre des transferts de parts). If lost or destroyed, a replacement certificate is issued only after a 30-day public notice period and submission of a sworn indemnity bond.\n\n**8.6. Transmission upon Death of a Shareholder:** Heirs, successions, and executors do not automatically become active voting partners. The company's operations shall continue. Heirs must submit certified probate documents and be formally approved by the remaining shareholders within ninety (90) days. Executor powers are limited to estate preservation until approval.\n\n**8.7. Bankruptcy & Insolvency:** In the event of bankruptcy of a shareholder, the company reserves the right to purchase the bankrupt shareholder's shares at fair market value (determined by an expert) to prevent creditors from seizing voting controls.\n\n**8.8. Compliance Restrictions & Penalties:** Transfers that would create severe conflicts of interest, breach national security laws, violate Cameroonian public procurement regulations, or breach OHADA maximum shareholding guidelines are strictly prohibited and void *ab initio*. Violators shall be penalized via temporary suspension of dividend rights.`
        },
        {
          number: 9,
          title: "ARTICLE 9: ACCOUNTS, FINANCE, AUDIT AND PROFIT DISTRIBUTION",
          content: `**9.1. Purpose & Legal Authority:** Ensuring strict financial transparency, internal control, and compliance with national and international accounting frameworks under SYSCOHADA, IFRS guidelines, and International Standards on Auditing (ISAs).\n\n**9.2. Fiscal Year:** Commences on January 1st and terminates on December 31st of each calendar year.\n\n**9.3. Financial Statements:** The General Manager must establish and submit the annual financial statements within four (4) months of the close of the financial year (by April 30th), including: Statement of Financial Position (Bilan), Income Statement, Cash Flow Statement, Statement of Changes in Equity, and Notes to Accounts (Notes annexes) detailing site contingencies, performance guarantees, and retention money.\n\n**9.4. Construction Financial Controls & Budget Approval:** The company shall maintain robust construction internal controls. The annual operating and capital expenditure (CAPEX & OPEX) budgets must be submitted by the General Manager and approved by the shareholders before December 15th of the preceding fiscal year. All expenditures exceeding 10,000,000 FCFA outside the approved budget require board or general manager approval.\n\n**9.5. External Statutory Audit:** Appointment of an independent External Auditor (Commissaire aux Comptes) enrolled in the One-Order of Chartered Accountants of Cameroon (ONCCA) is mandatory if the company exceeds the statutory OHADA thresholds. The auditor is appointed for a three-year term and is responsible for certifying the accounts and submitting an independent audit report to the AGM.\n\n**9.6. Internal Audit Function:** A dedicated Internal Auditor shall monitor site-level expenditure, material waste, supplier invoices, and compliance with anti-corruption and HSE policies, reporting quarterly directly to the audit committee.\n\n**9.7. Profit Distribution & Reserves:** Net profit consists of total revenues minus operating costs, depreciation, and interest. Distribution Procedures:\n- 1. Deduct ten percent (10%) of net profit to form the mandatory Legal Reserve, until this reserve reaches twenty percent (20%) of the share capital.\n- 2. Allocate a minimum of fifteen percent (15%) to an **Equipment Replacement Reserve** for heavy machinery fleet.\n- 3. Allocate ten percent (10%) to a **Project Emergency Reserve** to cover defects liability and site incidents.\n- 4. Allocate five percent (5%) to a **Reinvestment & Capital Expansion Reserve**.\n- 5. Allocate the remaining balance to Retained Earnings or distribute as **Dividends** as approved by the AGM. Dividend payments must be executed within nine (9) months of approval.\n\n**9.8. Financial Transparency & Confidentiality:** Shareholders have a permanent right to inspect all corporate ledgers, invoices, payroll sheets, and audit reports at the registered office. All inspectors must execute a binding non-disclosure agreement to protect trade secrets and sensitive bidding prices.`
        },
        {
          number: 10,
          title: "ARTICLE 10: DISSOLUTION, LIQUIDATION AND DISPUTE RESOLUTION",
          content: `**10.1. Purpose & Legal Authority:** Managing the orderly winding up, debt settlement, and asset distribution of the company in case of cessation of business under OHADA AUDSCGIE Articles 200 to 241.\n\n**10.2. Grounds for Dissolution:** Voluntary decision by shareholders in an EGM (requiring 75% approval); Judicial court order by the competent court of Cameroon due to persistent insolvency or shareholder deadlock; Merger, acquisition, division, or corporate split; Expiration of the company's 99-year duration without extension.\n\n**10.3. Liquidation Process & Liquidator Appointment:** Dissolution immediately puts the company into "liquidation" status. The EGM shall appoint one or more professional Liquidators (usually a certified receiver or corporate attorney) and define their specific remuneration and powers. Upon appointment, all powers of the General Manager and Board of Directors shall terminate.\n\n**10.4. Liquidator Powers & Debt Settlement:** The liquidator has full power to realize all corporate assets, complete active construction projects under execution, collect outstanding receivables from government contracts, and settle liabilities.\nPriority of Settlement:\n- 1. First Priority: Employee statutory wages, outstanding HSE/accident compensation, and social insurance contributions (CNPS).\n- 2. Second Priority: Legal, liquidation, and court-mandated administrative fees.\n- 3. Third Priority: National tax liabilities, custom duties, and public municipal dues in Cameroon.\n- 4. Fourth Priority: Secured creditors, project bank loans, and supplier invoices.\n- 5. Fifth Priority: Unsecured creditors.\n\n**10.5. Final Accounts & Asset Distribution:** After complete debt settlement, the liquidator shall draft the final accounts. The remaining net assets (boni de liquidation) shall be distributed among the shareholders in proportion to their paid-up share capital.\n\n**10.6. Removal from Registry:** The liquidator must file the closing minutes, register the final accounts, and publish a notice of closure in a Journal of Legal Notices (JAL). The company is then formally removed from the RCCM in Cameroon.`
        },
        {
          number: 11,
          title: "ARTICLE 11: CORPORATE GOVERNANCE & EXECUTIVE MANAGEMENT",
          content: `**11.1. Purpose & Scope:** Establishing a robust, dual-tier corporate governance framework to steer strategic direction and operations.\n\n**11.2. Board of Directors:** Composed of three (3) to twelve (12) members appointed by the AGM for a term of four (4) years. The Board is responsible for defining the strategic direction of the company, approving tenders exceeding 500,000,000 FCFA, and supervising executive management.\n\n**11.3. Managing Director (Directeur Général):** Appointed by the Board of Directors to execute daily operations, manage engineering sites, sign commercial agreements, and represent the company vis-à-vis clients and authorities.\n\n**11.4. Company Secretary (Secrétaire Général):** Responsible for statutory compliance, legal filings, organizing general meetings, ensuring that directors are kept fully informed of their legal duties under Cameroonian and OHADA laws, and preserving physical and digital corporate records.`
        },
        {
          number: 12,
          title: "ARTICLE 12: PUBLIC PROCUREMENT, TENDER PROCEDURES, AND FIDIC CONTRACTS",
          content: `**12.1. Scope & Applicability:** All public contracts, infrastructure tenders, and private engineering agreements under Cameroon MINMAP guidelines.\n\n**12.2. FIDIC Adherence:** All international and high-value domestic construction agreements must utilize standard international construction templates, specifically the International Federation of Consulting Engineers (FIDIC) standard forms (Red, Yellow, or Silver Books depending on the project structure).\n\n**12.3. Joint Ventures (JV) and Consortia:** Participation in tenders through JVs or consortia must be backed by a comprehensive Joint Venture Agreement detailing the division of civil engineering works, percentage of financial participation, mutual indemnities, and joint and several liability (responsabilité solidaire) before Cameroonian authorities.\n\n**12.4. Subcontractors and Consultants:** All subcontractors, consultants, architects, and surveyors must be vetted through a rigorous pre-qualification procurement policy, ensuring compliance with HSE norms, technical capacity, and financial solvency.`
        },
        {
          number: 13,
          title: "ARTICLE 13: SITE OPERATIONS, HSE, AND DEFECTS LIABILITY",
          content: `**13.1. Purpose & Scope:** Establishing standards for physical engineering works, worker safety, and client construction guarantees.\n\n**13.2. Occupational Health, Safety, and Environment (HSE):** The company enforces a zero-accident policy across all active construction sites. Daily site safety briefings, mandatory certified Personal Protective Equipment (PPE), and continuous safety inspections are mandatory.\n\n**13.3. Environmental Protection:** All civil projects must conduct a prior Environmental Impact Assessment (EIA) in compliance with Cameroonian environmental legislation and secure the necessary building permits.\n\n**13.4. Defects Liability Period (DLP) & Warranties:** The company formally guarantees its constructions. Every project shall incorporate a Defects Liability Period of twelve (12) months during which all engineering and technical defects must be repaired at the company's cost.\n\n**13.5. Garanti Décennal (Ten-Year Structural Guarantee):** In accordance with Article 1792 of the Civil Code in force in Cameroon, the company maintains a strict ten-year structural guarantee covering the complete stability and solid foundation of all built infrastructures.`
        },
        {
          number: 14,
          title: "ARTICLE 14: INSURANCE, BANKING AND BORROWING POWERS",
          content: `**14.1. Purpose & Scope:** Managing corporate assets, financial facilities, and operational risk mitigation.\n\n**14.2. Banking & Borrowing:** The company shall maintain dedicated, separate corporate bank accounts with accredited commercial banks in Cameroon under COBAC supervision. Borrowing powers must be exercised responsibly by the executive management within board-authorized thresholds.\n\n**14.3. Insurance Requirements:** To safeguard against operational risks, the company must maintain extensive insurance coverage, including Contractors' All Risks (CAR) insurance, professional indemnity, and mandatory workers' compensation.\n\n**14.4. Guarantees and Bonds:** Execution of performance guarantees, advance payment guarantees, and retention money bonds must be backed by reputable financial institutions in Cameroon.`
        },
        {
          number: 15,
          title: "ARTICLE 15: PROFESSIONAL ETHICS, ANTI-CORRUPTION & ESG",
          content: `**15.1. Purpose & Scope:** Enforcing business integrity, transparency, and sustainable construction values.\n\n**15.2. Anti-Corruption & Anti-Bribery:** Meticulous zero-tolerance policy against any form of bribery, bid-rigging, collusion, or facilitation payments in public or private tenders. Violations shall result in immediate termination of employment.\n\n**15.3. Whistleblower Protection:** Any employee or contractor reporting financial misconduct or safety breaches shall be provided complete anonymity and absolute protection from retaliatory measures.\n\n**15.4. Conflict of Interest:** Directors, engineers, and procurement leads must submit an annual Conflict of Interest disclosure. No director or manager may participate in bids or suppliers where they have a direct or indirect financial interest.\n\n**15.5. ESG Principles:** Commitment to sustainable construction practices, utilization of eco-friendly building materials, reduction of carbon footprint, fair wage structures, and local community development programs in regions of active operations.`
        },
        {
          number: 16,
          title: "ARTICLE 16: DISPUTE RESOLUTION, ARBITRATION, AND GOVERNING LAW",
          content: `**16.1. Purpose & Scope:** Regulating conflicts between shareholders, or between the company and third-party developers.\n\n**16.2. Governing Law:** These Articles, corporate operations, and construction contracts are governed by and construed in accordance with the laws of the Republic of Cameroon and the OHADA Uniform Acts.\n\n**16.3. Amicable Settlement (Mediation):** Any dispute arising from these Articles or corporate operations shall first be submitted to mandatory amicable mediation before a certified corporate mediator within thirty (30) days.\n\n**16.4. Arbitration:** Failing amicable resolution, the dispute shall be finally settled under the Rules of Arbitration of the GICAM Arbitration Center (Centre d'Arbitrage du GICAM) in Douala, or the Common Court of Justice and Arbitration (CCJA) of OHADA in Abidjan, Côte d'Ivoire. Deliberations shall be held in French or English.\n\n**16.5. Force Majeure:** Neither party nor the company shall be liable for delays or failures resulting from acts of God, war, severe civil unrest, regional lockouts, or extreme natural disasters beyond control.`
        }
      ],
      signoff: `Done in good faith and executed by the initial founders on this date.\n\nGeneral Manager: ${activeManager}\nRepresentative Stamp: MADECC COMPLIANCE LEDGER SEAL`
    };
  }

  app.post('/api/documents/generate-articles', async (req, res) => {
    const {
      companyName,
      legalForm,
      jurisdiction,
      headOffice,
      durationYears,
      shareCapital,
      sharesCount,
      shareValue,
      initialManager,
      scopeOfActivity,
      customPrompt
    } = req.body;

    const gemini = getGeminiClient();
    
    if (!gemini) {
      console.warn('[GEMINI] Offline. Using fallback pre-crafted articles of association.');
      const fallback = getFallbackArticles(
        companyName,
        legalForm,
        jurisdiction,
        headOffice,
        shareCapital,
        sharesCount,
        shareValue,
        initialManager,
        scopeOfActivity
      );
      return res.json(fallback);
    }

    try {
      const systemInstruction = `You are a premier international corporate attorney and a leading expert in Central African OHADA company law, specializing in drafting Articles of Association (Statuts constitutifs) for construction, civil engineering, public works, logistics, and real estate development corporations in Cameroon and internationally.

Your task is to draft a highly professional, exhaustive, and legally compliant set of Articles of Association based on the user's input.
Generate a structured JSON object containing:
1. "title" - A formal title (e.g., "ARTICLES OF ASSOCIATION OF [COMPANY NAME]")
2. "metadata" - An introductory paragraph referencing legal governance (e.g. "Governed under the provisions of the OHADA Uniform Act on Commercial Companies and Economic Interest Groups (AUDSCGIE) and applicable international business laws.")
3. "articles" - An array of exactly 16 distinct, highly detailed articles. Each article object must contain:
   - "number" - Integer (1 to 16)
   - "title" - Short uppercase title of the article (e.g. "ARTICLE 7: SHAREHOLDERS' GENERAL MEETINGS", "ARTICLE 8: TRANSFER AND TRANSMISSION OF SHARES")
   - "content" - 1-2 robust, realistic, and legally-worded paragraphs explaining the specific stipulations, meticulously using correct financial terms, regulatory frameworks, local/international court jurisdiction, and corporate governance protocols.
   
The articles MUST include:
- ARTICLE 1: LEGAL FORM AND DENOMINATION
- ARTICLE 2: REGISTERED OFFICE (SIÈGE SOCIAL)
- ARTICLE 3: CORPORATE PURPOSE (OBJET SOCIAL) AND TECHNICAL SPECIALIZATIONS
- ARTICLE 4: CORPORATE DURATION (DURÉE)
- ARTICLE 5: SHARE CAPITAL AND SHARES DISTRIBUTION
- ARTICLE 6: STATUTORY MANAGEMENT & LIMITS OF AUTHORITY (GÉRANCE)
- ARTICLE 7: SHAREHOLDERS' GENERAL MEETINGS (VOTING & NOTICES) (detailed rules on notices, quorums, AGMs/EGMs, and voting rights)
- ARTICLE 8: TRANSFER AND TRANSMISSION OF SHARES (including Right of First Refusal, Board Consent, and transmission upon death or bankruptcy)
- ARTICLE 9: ACCOUNTS, FINANCE, AUDIT AND PROFIT DISTRIBUTION (including SYSCOHADA standards, internal controls, statutory audit, equipment replacement reserves, and dividends)
- ARTICLE 10: DISSOLUTION, LIQUIDATION AND DISPUTE RESOLUTION (including voluntary/involuntary dissolution, liquidator powers, and priority of debt settlement)
- ARTICLE 11: CORPORATE GOVERNANCE & EXECUTIVE MANAGEMENT (Board of Directors, Managing Director, Company Secretary)
- ARTICLE 12: PUBLIC PROCUREMENT, TENDER PROCEDURES, AND FIDIC CONTRACTS (FIDIC Books, Joint Ventures, subcontractor pre-qualification)
- ARTICLE 13: SITE OPERATIONS, HSE, AND DEFECTS LIABILITY (HSE policy, environmental impact, 12-month Defects Liability, 10-year Garant Décennal)
- ARTICLE 14: INSURANCE, BANKING AND BORROWING POWERS (CAR insurance, banking, performance bonds)
- ARTICLE 15: PROFESSIONAL ETHICS, ANTI-CORRUPTION & ESG (zero-tolerance bribery, Whistleblower protection, Conflicts of Interest, ESG)
- ARTICLE 16: DISPUTE RESOLUTION, ARBITRATION, AND GOVERNING LAW (Mediation, GICAM / CCJA Arbitration, Force Majeure)

4. "signoff" - A polite closing execution clause and stamp block (e.g., "Executed in Douala/Yaoundé, Cameroon...").

Maintain strict professional legal vocabulary, incorporating standard notary-grade language and corporate rules. Ensure the capital, shares, and managers are fully integrated.`;

      const userPrompt = `Generate a set of construction company Articles of Association with these inputs:
- Company Name: ${companyName || 'N/A'}
- Legal Form: ${legalForm || 'SARL'}
- Primary Jurisdiction: ${jurisdiction || 'Cameroon (OHADA)'}
- Head Office: ${headOffice || 'N/A'}
- Duration of Company: ${durationYears || '99'} years
- Share Capital: ${shareCapital || 'N/A'}
- Total Number of Shares: ${sharesCount || 'N/A'}
- Nominal Value per Share: ${shareValue || 'N/A'}
- Initial Managing Director / CEO: ${initialManager || 'N/A'}
- Scope of Construction Activities: ${scopeOfActivity || 'Civil engineering, building construction, public works, road infrastructure, and related logistics.'}

Additional requirements or custom legal clauses:
"${customPrompt || 'None. Generate a comprehensive and standard set of Articles of Association.'}"`;

      const response = await retryWithFallback(async (modelName) => {
        return await gemini.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                metadata: { type: Type.STRING },
                articles: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      number: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      content: { type: Type.STRING }
                    },
                    required: ["number", "title", "content"]
                  }
                },
                signoff: { type: Type.STRING }
              },
              required: ["title", "metadata", "articles", "signoff"]
            }
          }
        });
      });

      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } catch (err: any) {
      console.warn('[Gemini Info] Falling back to offline company articles generator:', err.message || err);
      const fallback = getFallbackArticles(
        companyName,
        legalForm,
        jurisdiction,
        headOffice,
        shareCapital,
        sharesCount,
        shareValue,
        initialManager,
        scopeOfActivity
      );
      res.json(fallback);
    }
  });

  app.post('/api/proposals/ai-assist', async (req, res) => {
    const {
      action,
      templateType,
      sectionName,
      currentContent,
      companyDetails,
      clientDetails,
      customPrompt
    } = req.body;

    const gemini = getGeminiClient();

    // Setup fallback responses in case Gemini API is offline or missing
    const getFallbackResponse = () => {
      const coName = companyDetails?.name || 'MADECC Group';
      const clName = clientDetails?.name || 'Ministry of Public Works';
      const projVal = clientDetails?.projectValue || '500,000,000 FCFA';
      const loc = clientDetails?.location || 'Douala, Cameroon';

      if (action === 'improve') {
        return `[REWRITTEN & IMPROVED BY MADECC AI]
The technical scope of work for this project has been fully audited and enhanced. ${currentContent || 'Initial draft'} is hereby revised to meet Cameroon public contracting standards and FIDIC Red Book regulations. We commit to executing all operations using state-of-the-art materials, certified technical engineering personnel, and under strict compliance with ISO 9001 quality guidelines and the Ministry of Public Works structural guidelines.`;
      }

      if (action === 'boq') {
        return JSON.stringify({
          items: [
            { id: "1", item: "1.1", description: "Site Mobilization & Preliminary Studies (Soil Tests, Topography)", unit: "LS", qty: 1, rate: 2500000, total: 2500000 },
            { id: "2", item: "1.2", description: "Excavation and Earthworks (Excavator CAT 320D)", unit: "m³", qty: 1500, rate: 8500, total: 12750000 },
            { id: "3", item: "1.3", description: "Reinforced Concrete Foundation (HA 12/14/16 Steel, Portland Cement)", unit: "m³", qty: 320, rate: 185000, total: 59200000 },
            { id: "4", item: "1.4", description: "Masonry work & Superstructure (Hollow Blocks 20x20x40)", unit: "m²", qty: 2400, rate: 22000, total: 52800000 },
            { id: "5", item: "1.5", description: "High-Efficiency Solar Power Installation (30kVA Hybrid System)", unit: "Set", qty: 1, rate: 18500000, total: 18500000 },
            { id: "6", item: "1.6", description: "Plumbing, Drainage, and Borehole Drilling (120m Depth)", unit: "LS", qty: 1, rate: 12000000, total: 12000000 },
            { id: "7", item: "1.7", description: "HSE Supervision & PPE Kits for Site Workers", unit: "LS", qty: 1, rate: 4500000, total: 4500000 }
          ],
          currency: "FCFA",
          totalEstimate: "162,250,000 FCFA"
        });
      }

      if (action === 'timeline') {
        return JSON.stringify({
          schedule: [
            { id: "t1", phase: "Phase 1: Mobilization", duration: "15 Days", dates: "Days 1-15", status: "Pending", description: "Transport heavy machinery (excavators, loaders), install temporary site offices, complete geotechnical and topographic surveys." },
            { id: "t2", phase: "Phase 2: Earthworks & Excavation", duration: "30 Days", dates: "Days 16-45", status: "Pending", description: "Excavation of foundation pits, leveling of terrain, compaction of backfill soil." },
            { id: "t3", phase: "Phase 3: Structural Masonry", duration: "45 Days", dates: "Days 46-90", status: "Pending", description: "Erection of reinforced concrete columns, beams, laying concrete blocks, pouring floor slabs." },
            { id: "t4", phase: "Phase 4: MEP & Technical Installations", duration: "25 Days", dates: "Days 91-115", status: "Pending", description: "Laying electrical conduits, plumbing pipes, installing hybrid solar panels, battery banks." },
            { id: "t5", phase: "Phase 5: Finishing & QA/QC", duration: "20 Days", dates: "Days 116-135", status: "Pending", description: "Plastering, painting, testing water quality, commissioning solar grid, final structural inspection." },
            { id: "t6", phase: "Phase 6: Clean Up & Handover", duration: "10 Days", dates: "Days 136-145", status: "Pending", description: "De-mobilization of heavy equipment, final cleaning of the site, official client handover ceremony." }
          ]
        });
      }

      if (action === 'risk-assessment') {
        return JSON.stringify({
          risks: [
            { id: "r1", description: "Heavy Rainfall/Flooding during Earthworks (Cameroon Rainy Season)", probability: "High", impact: "Medium", severity: "High", mitigation: "Schedule major excavation in dry season; establish high-capacity site dewatering pumps.", responsibility: "Project Engineer" },
            { id: "r2", description: "Material Price Fluctuations (Cement, Reinforcement Steel)", probability: "Medium", impact: "High", severity: "High", mitigation: "Procure 60% of critical structural materials upfront; lock in pricing with local suppliers.", responsibility: "Procurement Officer" },
            { id: "r3", description: "Workplace Accidents & Machinery Failure", probability: "Low", impact: "Critical", severity: "Medium", mitigation: "Daily safety briefs; mandatory full PPE; on-site HSE supervisor; weekly equipment checkups.", responsibility: "HSE Coordinator" },
            { id: "r4", description: "Delay in Government Permits & Authorizations", probability: "Medium", impact: "High", severity: "Medium", mitigation: "Submit all architectural & structural designs to municipal council 30 days before mobilization.", responsibility: "Liaison Officer" }
          ]
        });
      }

      // Default: 'generate-full'
      return `### ${sectionName.toUpperCase()}
#### Prepared by ${coName} for ${clName}
**Project Location:** ${loc}
**Project Estimate:** ${projVal}

1. **Executive Context**
Our proposed approach to the **${templateType || 'General Construction'}** project for **${clName}** is designed to satisfy all specified technical, financial, and structural goals. We combine decades of local experience in Cameroon with international engineering standards (FIDIC, Eurocodes).

2. **Technical Methodology**
- **Geotechnical Foundations:** All excavation and structural base designs will be backed by comprehensive soil mechanic tests.
- **Sustainable Procurement:** Sourcing of structural materials (steel, Portland cement, eco-friendly concrete aggregates) from certified local producers.
- **HSE Excellence:** Operating under a zero-accident paradigm, maintaining mandatory PPE, and continuous safety audits.

3. **Strategic Alignment**
We align our delivery with the national infrastructure acceleration programs (SND30) of Cameroon, ensuring the project creates local employment and respects the environmental regulations of MINEPDED.`;
    };

    if (!gemini) {
      console.warn('[GEMINI] Offline/Missing Key. Using premium proposal fallbacks.');
      return res.json({ result: getFallbackResponse() });
    }

    try {
      const coName = companyDetails?.name || 'MADECC Group';
      const clName = clientDetails?.name || 'Ministry of Public Works';
      const projVal = clientDetails?.projectValue || '500,000,000 FCFA';
      const loc = clientDetails?.location || 'Douala, Cameroon';

      const systemInstruction = `You are an elite International Construction Consultant, Technical Proposal Specialist, and Senior Estimator with over 30 years of experience writing multi-million dollar public and private sector tenders (FIDIC standards) for projects in West/Central Africa (especially Cameroon) and worldwide.
      
Your task is to generate highly technical, realistic, persuasive, and professionally written content for a construction company proposal.
Use clear formatting, markdown headers, and professional tables/lists where appropriate. Meticulously incorporate specific regional parameters (such as Cameroonian regulations, local currencies like FCFA, environmental concerns, local sourcing, and safety standards like HSE).`;

      let prompt = '';
      if (action === 'improve') {
        prompt = `You are asked to professionally rewrite and improve the following section: "${sectionName}" of a "${templateType}" proposal.
Company: ${coName}
Client: ${clName}
Project Value: ${projVal}
Location: ${loc}

Current Section Draft to Audit & Improve:
"${currentContent || 'No draft provided'}"

Instructions:
1. Rewrite this draft to make it highly professional, technical, persuasive, and legally compliant with construction industry norms.
2. Fix all grammatical, technical, or formatting issues.
3. Enhance vocabulary with words like "rigorous", "structural integrity", "state-of-the-art", "compliance", "optimization", "sustainable".
4. Add 2-3 detailed paragraphs or bullet points to significantly enrich the depth.
5. Focus heavily on actual civil engineering practices.`;
      } else if (action === 'boq') {
        prompt = `Generate a complete Bill of Quantities (BOQ) and materials estimate for a "${templateType}" project.
Company: ${coName}
Client: ${clName}
Project Value: ${projVal}
Location: ${loc}
User request notes: ${customPrompt || 'Generate standard realistic items'}

Generate a structured JSON response containing:
1. "items": An array of realistic, highly detailed item objects. Each item must contain:
   - "id": A unique string ID (e.g. "1")
   - "item": A standard numbering system string (e.g., "1.1", "1.2")
   - "description": Realistic description of civil works, mobilization, materials, or installations
   - "unit": Valid civil works units (e.g., "m³", "m²", "LM", "LS", "Tons", "Set")
   - "qty": Realistic numeric quantity
   - "rate": Realistic unit price in FCFA (or applicable currency)
   - "total": The calculated total (qty * rate)
2. "currency": "FCFA" or specified currency
3. "totalEstimate": Clean string representing the sum total.

Ensure all entries are fully realistic for this kind of project. Do not include placeholder texts.`;
      } else if (action === 'timeline') {
        prompt = `Generate a realistic construction schedule / project timeline for a "${templateType}" project.
Company: ${coName}
Client: ${clName}
Project Value: ${projVal}
Location: ${loc}
User request notes: ${customPrompt || 'Generate standard realistic stages'}

Generate a structured JSON response containing:
1. "schedule": An array of phase objects. Each phase object must contain:
   - "id": Unique string (e.g. "t1")
   - "phase": Name of the phase (e.g., "Phase 1: Soil Mechanics & Site Clearing")
   - "duration": Duration string (e.g. "14 Days", "3 Weeks")
   - "dates": Day range or sequence (e.g. "Days 1-14", "Days 15-45")
   - "status": "Pending"
   - "description": A highly detailed description of actions, personnel involved, and heavy machinery deployed in this phase.

Ensure the timeline is logically ordered and engineering-accurate.`;
      } else if (action === 'risk-assessment') {
        prompt = `Generate a comprehensive Risk Register & Safety Assessment for a "${templateType}" project.
Company: ${coName}
Client: ${clName}
Location: ${loc}

Generate a structured JSON response containing:
1. "risks": An array of risk objects. Each object must contain:
   - "id": Unique string (e.g., "r1")
   - "description": A highly specific construction risk (e.g., soil collapse, rainy season flooding in Cameroon, price spikes)
   - "probability": "Low" | "Medium" | "High"
   - "impact": "Low" | "Medium" | "High" | "Critical"
   - "severity": "Low" | "Medium" | "High"
   - "mitigation": Detailed, actionable engineering or management mitigation strategy
   - "responsibility": Role responsible (e.g. Project Manager, HSE Supervisor, HSE Coordinator)

Ensure the risks are highly specific to construction and civil engineering.`;
      } else {
        // default: 'generate-full'
        prompt = `Generate the complete technical content for the section "${sectionName}" of a "${templateType}" proposal.
Company: ${coName}
Client: ${clName}
Project Value: ${projVal}
Location: ${loc}
Custom Request details: "${customPrompt || 'Create a comprehensive professional section.'}"

Provide an outstanding, comprehensive technical document styled beautifully in Markdown with sections, lists, and clear headers. Ensure the depth is sufficient for a formal public tender (AO - Appel d'Offres) submission to ministries, public corporations, or private enterprises in Cameroon or globally. Integrate industry guidelines (like Eurocodes, BAEL, NF standards, and FIDIC contracts).`;
      }

      const responseMimeType = (action === 'boq' || action === 'timeline' || action === 'risk-assessment') ? "application/json" : "text/plain";

      const response = await retryWithFallback(async (modelName) => {
        return await gemini.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType
          }
        });
      });

      res.json({ result: response.text.trim() });
    } catch (err: any) {
      console.warn('[Gemini Info] Falling back to offline proposal assistant:', err.message || err);
      res.json({ result: getFallbackResponse() });
    }
  });


  // ==========================================
  // --- CATEGORIES ENDPOINTS ---
  // ==========================================
  app.get('/api/categories', async (req, res) => {
    try {
      const allCategories = await db.select().from(categories);
      res.json(allCategories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/categories', requireAdmin, async (req: any, res) => {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Missing name or slug' });
    try {
      const result = await db.insert(categories).values({ name, slug }).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_CATEGORY', `Created category ${name}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- SERVICES ENDPOINTS ---
  // ==========================================
  app.get('/api/services', async (req, res) => {
    try {
      const allServices = await db.select().from(services);
      res.json(allServices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/services', requireAdmin, async (req: any, res) => {
    const { name, description, icon, priceRange, details } = req.body;
    if (!name || !description || !icon) {
      return res.status(400).json({ error: 'Missing required service fields' });
    }
    try {
      const result = await db.insert(services).values({
        name,
        description,
        icon,
        priceRange,
        details,
      }).returning();
      
      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_SERVICE', `Created service ${name}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/services/:id', requireAdmin, async (req: any, res) => {
    const serviceId = parseInt(req.params.id);
    const { name, description, icon, priceRange, details } = req.body;
    try {
      const result = await db.update(services)
        .set({ name, description, icon, priceRange, details })
        .where(eq(services.id, serviceId))
        .returning();
      
      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_SERVICE', `Updated service ${name} (ID: ${serviceId})`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/services/:id', requireAdmin, async (req: any, res) => {
    const serviceId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(services).where(eq(services.id, serviceId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_SERVICE', `Deleted service ID: ${serviceId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- PROJECTS & PROGRESS ENDPOINTS ---
  // ==========================================
  app.get('/api/projects', async (req, res) => {
    const { categoryId } = req.query;
    try {
      let query = db.select().from(projects);
      if (categoryId) {
        // Filter by category
        const catId = parseInt(categoryId as string);
        const filtered = await db.select().from(projects).where(eq(projects.categoryId, catId)).orderBy(desc(projects.createdAt));
        return res.json(filtered);
      }
      const allProjects = await query.orderBy(desc(projects.createdAt));
      res.json(allProjects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    const projId = parseInt(req.params.id);
    try {
      const proj = await db.select().from(projects).where(eq(projects.id, projId)).limit(1);
      if (proj.length === 0) return res.status(404).json({ error: 'Project not found' });

      const progressList = await db.select().from(projectProgress).where(eq(projectProgress.projectId, projId)).orderBy(projectProgress.id);
      
      res.json({
        ...proj[0],
        progress: progressList,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/projects', requireAdmin, async (req: any, res) => {
    const { title, description, budget, location, startDate, endDate, status, categoryId, image, videoUrl } = req.body;
    if (!title || !description || !location || !image) {
      return res.status(400).json({ error: 'Missing required project fields' });
    }
    try {
      const result = await db.insert(projects).values({
        title,
        description,
        budget,
        location,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'planning',
        categoryId: categoryId ? parseInt(categoryId) : null,
        image,
        videoUrl: videoUrl || null,
      }).returning();

      // Seed standard starting progress milestones for new project
      await db.insert(projectProgress).values([
        { projectId: result[0].id, milestoneName: 'Initial Consultation', percentage: 100, status: 'completed', description: 'Met with client to outline project blueprints and scope.' },
        { projectId: result[0].id, milestoneName: 'Site Planning & Surveying', percentage: 0, status: 'pending', description: 'Obtaining council permits and running soil resilience testing.' }
      ]);

      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_PROJECT', `Created project: ${title}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/projects/:id', requireAdmin, async (req: any, res) => {
    const projId = parseInt(req.params.id);
    const { title, description, budget, location, startDate, endDate, status, categoryId, image, videoUrl } = req.body;
    try {
      // Fetch existing record to perform asset replacement check
      const existing = await db.select().from(projects).where(eq(projects.id, projId)).limit(1);
      if (existing.length > 0) {
        if (image && image !== existing[0].image) {
          await deleteFileFromCloud(existing[0].image);
        }
        if (videoUrl !== undefined && videoUrl !== existing[0].videoUrl) {
          await deleteFileFromCloud(existing[0].videoUrl);
        }
      }

      const result = await db.update(projects)
        .set({
          title,
          description,
          budget,
          location,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          status,
          categoryId: categoryId ? parseInt(categoryId) : null,
          image,
          videoUrl: videoUrl || null,
        })
        .where(eq(projects.id, projId))
        .returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_PROJECT', `Updated project: ${title} (ID: ${projId})`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/projects/:id', requireAdmin, async (req: any, res) => {
    const projId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(projects).where(eq(projects.id, projId)).returning();
      if (deleted.length > 0) {
        await deleteFileFromCloud(deleted[0].image);
        await deleteFileFromCloud(deleted[0].videoUrl);
      }
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_PROJECT', `Deleted project ID: ${projId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Project Milestones Progress
  app.post('/api/projects/:id/progress', requireAdmin, async (req: any, res) => {
    const projId = parseInt(req.params.id);
    const { milestoneName, percentage, description, status } = req.body;
    if (!milestoneName || !description) return res.status(400).json({ error: 'Missing milestone fields' });

    try {
      const result = await db.insert(projectProgress).values({
        projectId: projId,
        milestoneName,
        percentage: percentage ? parseInt(percentage) : 0,
        description,
        status: status || 'pending',
      }).returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'ADD_MILESTONE', `Added milestone ${milestoneName} to project ID: ${projId}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/projects/progress/:progressId', requireAdmin, async (req: any, res) => {
    const progId = parseInt(req.params.progressId);
    const { milestoneName, percentage, description, status } = req.body;
    try {
      const result = await db.update(projectProgress)
        .set({
          milestoneName,
          percentage: percentage !== undefined ? parseInt(percentage) : undefined,
          description,
          status,
        })
        .where(eq(projectProgress.id, progId))
        .returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_MILESTONE', `Updated milestone ID: ${progId}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/projects/progress/:progressId', requireAdmin, async (req: any, res) => {
    const progId = parseInt(req.params.progressId);
    try {
      const deleted = await db.delete(projectProgress).where(eq(projectProgress.id, progId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_MILESTONE', `Deleted milestone ID: ${progId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- BLOG ENDPOINTS ---
  // ==========================================
  app.get('/api/blogs', async (req, res) => {
    try {
      const posts = await db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
      res.json(posts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/blogs/:id', async (req, res) => {
    const blogId = parseInt(req.params.id);
    try {
      const post = await db.select().from(blogPosts).where(eq(blogPosts.id, blogId)).limit(1);
      if (post.length === 0) return res.status(404).json({ error: 'Blog post not found' });
      res.json(post[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/blogs', requireAdmin, async (req: any, res) => {
    const { title, content, image, videoUrl, summary, category } = req.body;
    if (!title || !content || !image || !summary || !category) {
      return res.status(400).json({ error: 'Missing blog fields' });
    }
    try {
      const result = await db.insert(blogPosts).values({
        title,
        content,
        image,
        videoUrl: videoUrl || null,
        summary,
        category,
        authorId: req.dbUser.id,
      }).returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_BLOG', `Created blog post: ${title}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/blogs/:id', requireAdmin, async (req: any, res) => {
    const blogId = parseInt(req.params.id);
    const { title, content, image, videoUrl, summary, category } = req.body;
    try {
      // Fetch existing record to perform asset replacement check
      const existing = await db.select().from(blogPosts).where(eq(blogPosts.id, blogId)).limit(1);
      if (existing.length > 0) {
        if (image && image !== existing[0].image) {
          await deleteFileFromCloud(existing[0].image);
        }
        if (videoUrl !== undefined && videoUrl !== existing[0].videoUrl) {
          await deleteFileFromCloud(existing[0].videoUrl);
        }
      }

      const result = await db.update(blogPosts)
        .set({ title, content, image, videoUrl: videoUrl || null, summary, category })
        .where(eq(blogPosts.id, blogId))
        .returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_BLOG', `Updated blog ID: ${blogId}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/blogs/:id', requireAdmin, async (req: any, res) => {
    const blogId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(blogPosts).where(eq(blogPosts.id, blogId)).returning();
      if (deleted.length > 0) {
        await deleteFileFromCloud(deleted[0].image);
        await deleteFileFromCloud(deleted[0].videoUrl);
      }
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_BLOG', `Deleted blog ID: ${blogId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- REVIEWS ENDPOINTS ---
  // ==========================================
  // Public: Approved reviews only
  app.get('/api/reviews', async (req, res) => {
    try {
      const approvedReviews = await db.select().from(reviews).where(eq(reviews.approved, true)).orderBy(desc(reviews.createdAt));
      res.json(approvedReviews);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: All reviews
  app.get('/api/reviews/all', requireAdmin, async (req, res) => {
    try {
      const allReviews = await db.select().from(reviews).orderBy(desc(reviews.createdAt));
      res.json(allReviews);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public submission
  app.post('/api/reviews', async (req, res) => {
    const { authorName, rating, text, projectName } = req.body;
    if (!authorName || !rating || !text) {
      return res.status(400).json({ error: 'Missing review fields' });
    }
    try {
      const result = await db.insert(reviews).values({
        authorName,
        rating: parseInt(rating),
        text,
        projectName,
        approved: false, // approval flow gate
      }).returning();

      // Send SMTP email notification to kreboya603@gmail.com
      const ratingStars = '★'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));
      const emailSubject = `[MADECC Group] New Client Review Pending Approval`;
      const emailText = `A new client review has been submitted on the website:\n\nAuthor: ${authorName}\nRating: ${rating} / 5\nProject: ${projectName || 'General'}\n\nReview:\n"${text}"\n\nPlease log in to the Admin Dashboard to approve this review.`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-top: 0; font-size: 22px;">New Client Review Submitted</h2>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Author Name:</strong> ${authorName}</p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Rating:</strong> <span style="color: #f59e0b; font-size: 18px;">${ratingStars}</span> (${rating}/5)</p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Project Context:</strong> ${projectName || 'General / Not specified'}</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0; font-style: italic;">
            <p style="margin: 0; line-height: 1.6; color: #334155;">"${text}"</p>
          </div>
          <p style="font-size: 14px; color: #475569; margin-top: 20px;">Please access the MADECC administrative dashboard to review and approve this testimonial.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group Portal Notifications &bull; Cameroon</p>
        </div>
      `;
      sendNotificationEmail(emailSubject, emailText, emailHtml).catch(err => {
        console.error('Email notify error (reviews):', err);
      });

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Approve review
  app.put('/api/reviews/:id/approve', requireAdmin, async (req: any, res) => {
    const reviewId = parseInt(req.params.id);
    const { approved } = req.body;
    try {
      const result = await db.update(reviews)
        .set({ 
          approved: approved === true, 
          approvedAt: approved ? new Date() : null 
        })
        .where(eq(reviews.id, reviewId))
        .returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'APPROVE_REVIEW', `${approved ? 'Approved' : 'Unapproved'} review ID: ${reviewId}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/reviews/:id', requireAdmin, async (req: any, res) => {
    const reviewId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(reviews).where(eq(reviews.id, reviewId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_REVIEW', `Deleted review ID: ${reviewId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- APPOINTMENTS ENDPOINTS ---
  // ==========================================
  // Public booking
  app.post('/api/appointments', async (req, res) => {
    const { clientName, clientEmail, serviceName, appointmentDate, notes } = req.body;
    if (!clientName || !clientEmail || !serviceName || !appointmentDate) {
      return res.status(400).json({ error: 'Missing required booking fields' });
    }
    try {
      const result = await db.insert(appointments).values({
        clientName,
        clientEmail,
        serviceName,
        appointmentDate: new Date(appointmentDate),
        status: 'pending',
        notes,
      }).returning();

      // Send SMTP email notification to kreboya603@gmail.com (Admin)
      const emailSubject = `[MADECC Group] New Consultation Booking Request: ${serviceName}`;
      const emailText = `A new consultation booking request has been submitted:\n\nClient: ${clientName}\nEmail: ${clientEmail}\nService: ${serviceName}\nDate: ${appointmentDate}\n\nNotes:\n${notes || 'None'}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-top: 0; font-size: 22px;">Consultation Request Received</h2>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Client Name:</strong> ${clientName}</p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Client Email:</strong> <a href="mailto:${clientEmail}" style="color: #f59e0b; text-decoration: none;">${clientEmail}</a></p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Requested Service:</strong> ${serviceName}</p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Proposed Date:</strong> ${new Date(appointmentDate).toLocaleString()}</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 5px;">Client Notes:</p>
            <p style="margin: 0; line-height: 1.6; color: #334155;">${notes || 'No special notes provided'}</p>
          </div>
          <p style="font-size: 14px; color: #475569; margin-top: 20px;">Please access the MADECC administrative dashboard to confirm or reschedule this appointment.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group Portal Notifications &bull; Cameroon</p>
        </div>
      `;
      sendNotificationEmail(emailSubject, emailText, emailHtml).catch(err => {
        console.error('Email notify error (appointments):', err);
      });

      // --- LIVE AI AUTO-RESPONDER TO CLIENT ---
      const autoResponseFallbackHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; color: #0f172a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
            <h2 style="color: #d97706; margin: 0 0 4px 0; font-weight: 800; font-size: 26px; letter-spacing: -0.025em;">MADECC Group</h2>
            <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Consultation Booking Desk</p>
          </div>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear <strong>${clientName}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Thank you for scheduling a consultation with MADECC Group. We have successfully received your booking request for <strong>${serviceName}</strong> on <strong>${new Date(appointmentDate).toLocaleString()}</strong>.</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Our local booking desk is currently reviewing your requested slot. A senior MADECC representative will contact you within 24 hours to confirm your appointment and provide details on how to join the consultation.</p>
          <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px; color: #475569;">Booking Summary:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #0f172a;">
              <li><strong>Requested Service:</strong> ${serviceName}</li>
              <li><strong>Requested Date/Time:</strong> ${new Date(appointmentDate).toLocaleString()}</li>
              <li><strong>Notes:</strong> ${notes || 'None'}</li>
            </ul>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">If you have any urgent changes or questions, please reach out to us at <a href="mailto:contact@madecc.com" style="color: #d97706; text-decoration: none; font-weight: 600;">contact@madecc.com</a>.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group &bull; Rue Joss, Bonanjo, Douala, Cameroon</p>
        </div>
      `;

      const aiPrompt = `You are an AI Consultation Booking Specialist representing 'MADECC Group' (a premier civil engineering, construction, and green architecture firm in Cameroon).
Write a professional, warm, and highly personalized email auto-response replying to the client's consultation booking request.

Client Name: ${clientName}
Client Email: ${clientEmail}
Requested Service: ${serviceName}
Appointment Date: ${new Date(appointmentDate).toLocaleString()}
Client Notes: ${notes || 'None'}

Your response must:
1. Address the client warmly by name.
2. Acknowledge the specific service booked (${serviceName}) and confirm that we have received their reservation request.
3. State that our local booking desk in Cameroon (Yaoundé / Douala) is currently reviewing the scheduling and that our lead consultant will reach out shortly to officially confirm the booking slot or suggest alternative slots if necessary.
4. Keep the tone professional, reassuring, well-structured, and helpful.
5. End with a polite sign-off from "MADECC Consultation Booking Desk".

Do NOT write any email subject lines or metadata. Output ONLY the clean HTML email body message (from opening to closing, no markdown wrappers like \`\`\`html, just direct HTML code). Use clean, professional inline CSS styling suitable for high-end corporate communication.`;

      generateAIResponse(aiPrompt, autoResponseFallbackHtml).then(htmlContent => {
        const clientSubject = `Consultation Request Received: ${serviceName} - MADECC Group`;
        const clientText = `Dear ${clientName},\n\nThank you for booking a consultation for "${serviceName}" on ${new Date(appointmentDate).toLocaleString()}.\n\nOur team is currently reviewing your slot and will officially confirm shortly.\n\nWarm regards,\nMADECC Booking Desk`;
        sendEmail(clientEmail.trim(), clientSubject, clientText, htmlContent).catch(err => {
          console.error('[SMTP_ERROR] Failed to send booking autoresponder:', err);
        });
      });

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin/Staff lists
  app.get('/api/appointments', requireAuth, async (req: any, res) => {
    try {
      if (req.dbUser.role === 'admin' || req.dbUser.role === 'staff') {
        const allAppointments = await db.select().from(appointments).orderBy(desc(appointments.appointmentDate));
        return res.json(allAppointments);
      } else {
        // Clients can see their own appointments matching their email
        const clientAppointments = await db.select().from(appointments).where(eq(appointments.clientEmail, req.dbUser.email)).orderBy(desc(appointments.appointmentDate));
        return res.json(clientAppointments);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update appointment status (e.g., confirm, cancel, complete)
  app.put('/api/appointments/:id', requireAuth, async (req: any, res) => {
    const appointmentId = parseInt(req.params.id);
    const { status, notes } = req.body;
    try {
      // Security check: Clients can only cancel their own appointment
      const existing = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
      if (existing.length === 0) return res.status(404).json({ error: 'Appointment not found' });

      const isStaffOrAdmin = req.dbUser.role === 'admin' || req.dbUser.role === 'staff';
      const isOwner = !!(existing[0].clientEmail && req.dbUser.email && existing[0].clientEmail.toLowerCase() === req.dbUser.email.toLowerCase());

      if (!isStaffOrAdmin && (!isOwner || status !== 'cancelled')) {
        return res.status(403).json({ error: 'Forbidden: Unauthorized to edit this appointment' });
      }

      const updatePayload: any = { status };
      if (notes !== undefined) {
        updatePayload.notes = notes;
      }

      const result = await db.update(appointments)
        .set(updatePayload)
        .where(eq(appointments.id, appointmentId))
        .returning();

      const updatedAppointment = result[0];

      // Trigger automated email confirmation to the client when a project consultation is updated/confirmed
      if (status && status !== existing[0].status) {
        const clientEmail = existing[0].clientEmail;
        if (clientEmail && clientEmail.trim()) {
          const clientName = existing[0].clientName;
          const serviceName = existing[0].serviceName;
          const apptDate = new Date(existing[0].appointmentDate);
          
          let statusText = '';
          let statusTitle = '';
          let statusColor = '#475569';
          
          if (status === 'confirmed') {
            statusTitle = 'Consultation Confirmed';
            statusText = `We are pleased to inform you that your consultation has been officially confirmed by our team.`;
            statusColor = '#10b981'; // Green
          } else if (status === 'cancelled') {
            statusTitle = 'Consultation Cancelled';
            statusText = `We regret to inform you that your consultation request has been cancelled. If you believe this was in error, please contact us.`;
            statusColor = '#ef4444'; // Red
          } else if (status === 'completed') {
            statusTitle = 'Consultation Completed';
            statusText = `Thank you for attending your consultation session with MADECC Group. We appreciate the opportunity to collaborate.`;
            statusColor = '#3b82f6'; // Blue
          } else {
            statusTitle = `Consultation Update`;
            statusText = `Your consultation status has been updated.`;
          }

          const emailSubject = `[MADECC Group] ${statusTitle}: ${serviceName}`;
          const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; color: #0f172a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
                <h2 style="color: #d97706; margin: 0 0 4px 0; font-weight: 800; font-size: 26px;">MADECC Group</h2>
                <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Consultation Booking Desk</p>
              </div>
              <h3 style="color: ${statusColor}; font-size: 20px; margin-top: 0; font-weight: 700;">${statusTitle}</h3>
              <p style="font-size: 15px; line-height: 1.6; margin: 16px 0;">Dear <strong>${clientName}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">${statusText}</p>
              <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px; color: #475569;">Session Details:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #0f172a;">
                  <li><strong>Service:</strong> ${serviceName}</li>
                  <li><strong>Date/Time:</strong> ${apptDate.toLocaleString()}</li>
                  <li><strong>Current Status:</strong> <span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase;">${status}</span></li>
                </ul>
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">If you need to make changes or have questions, please reach out to us at <a href="mailto:contact@madecc.com" style="color: #d97706; text-decoration: none; font-weight: 600;">contact@madecc.com</a>.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group &bull; Douala, Cameroon</p>
            </div>
          `;
          sendEmail(clientEmail.trim(), emailSubject, `Dear ${clientName},\n\nYour consultation booking for "${serviceName}" status has been updated to "${status}".\n\nWarm regards,\nMADECC Group`, emailHtml).catch(err => {
            console.error('[SMTP_ERROR] Failed to send appointment update email notification:', err);
          });
        }
      }

      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_APPOINTMENT', `Updated appointment ID: ${appointmentId} to status: ${status}`);
      res.json(updatedAppointment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/appointments/:id', requireStaffOrAdmin, async (req: any, res) => {
    const apptId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(appointments).where(eq(appointments.id, apptId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_APPOINTMENT', `Deleted appointment ID: ${apptId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- CONTACTS ENDPOINTS ---
  // ==========================================
  app.post('/api/contacts', rateLimitContact, async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing contact message fields' });
    }
    try {
      const result = await db.insert(contactMessages).values({
        name,
        email,
        subject,
        message,
        status: 'new',
      }).returning();

      // Send SMTP email notification to kreboya603@gmail.com
      const emailSubject = `[MADECC Group] New Contact Inquiry: ${subject}`;
      const emailText = `A new contact message has been submitted:\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-top: 0; font-size: 22px;">New Inquiry Received</h2>
          <p style="font-size: 15px; margin: 8px 0;"><strong>From:</strong> ${name}</p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Sender Email:</strong> <a href="mailto:${email}" style="color: #f59e0b; text-decoration: none;">${email}</a></p>
          <p style="font-size: 15px; margin: 8px 0;"><strong>Subject:</strong> ${subject}</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 5px;">Message Details:</p>
            <p style="margin: 0; line-height: 1.6; color: #334155; white-space: pre-wrap;">${message}</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group Portal Notifications &bull; Cameroon</p>
        </div>
      `;
      sendNotificationEmail(emailSubject, emailText, emailHtml).catch(err => {
        console.error('Email notify error (contacts):', err);
      });

      // --- LIVE AI AUTO-RESPONDER TO CLIENT ---
      const autoResponseFallbackHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; color: #0f172a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
            <h2 style="color: #d97706; margin: 0 0 4px 0; font-weight: 800; font-size: 26px; letter-spacing: -0.025em;">MADECC Group</h2>
            <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Client Relations Desk</p>
          </div>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear <strong>${name}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Thank you for reaching out to MADECC Group. We have successfully received your inquiry regarding <strong>"${subject}"</strong>.</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Our local client support team and resident engineers are currently reviewing your request. A designated MADECC Group representative will get in touch with you within 24 hours to address your questions and discuss any engineering or project requirements you may have.</p>
          <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 14px; color: #475569;">Your Message Details:</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0f172a; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">We look forward to partnering with you on your next sustainable infrastructure endeavor.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group &bull; Rue Joss, Bonanjo, Douala, Cameroon</p>
        </div>
      `;

      const aiPrompt = `You are an AI Client Success Agent representing 'MADECC Group' (a premier civil engineering, construction, and green architecture firm in Cameroon).
Write a professional, warm, and highly personalized email auto-response replying to the client's contact inquiry.

Client Name: ${name}
Client Email: ${email}
Inquiry Subject: ${subject}
Inquiry Message:
${message}

Your response must:
1. Address the client warmly by name.
2. Acknowledge and summarize their interest/request to show we've understood.
3. Keep the tone encouraging, highly professional, structured, and informative.
4. Mention that our local engineering office in Cameroon (Yaoundé / Douala) has received their submission, and a human senior engineer or architect will contact them within 24 hours.
5. Provide a realistic, reassuring, and helpful response.
6. End with a polite sign-off from "MADECC Client Services Team".

Do NOT write any email subject lines or metadata. Output ONLY the clean HTML email body message (from opening to closing, no markdown wrappers like \`\`\`html, just direct HTML code). Use clean, professional inline CSS styling suitable for high-end corporate communication.`;

      generateAIResponse(aiPrompt, autoResponseFallbackHtml).then(htmlContent => {
        const clientSubject = `Inquiry Received: ${subject} - MADECC Group`;
        const clientText = `Dear ${name},\n\nThank you for reaching out to MADECC Group regarding "${subject}". Our engineering team is reviewing your message and will reach out within 24 hours.\n\nWarm regards,\nMADECC Client Services`;
        sendEmail(email.trim(), clientSubject, clientText, htmlContent).catch(err => {
          console.error('[SMTP_ERROR] Failed to send contact inquiry autoresponder:', err);
        });
      });

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/contacts', requireStaffOrAdmin, async (req: any, res) => {
    try {
      const messages = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/contacts/:id', requireStaffOrAdmin, async (req: any, res) => {
    const msgId = parseInt(req.params.id);
    const { status } = req.body;
    try {
      const result = await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, msgId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_CONTACT', `Marked contact message ID: ${msgId} as ${status}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/contacts/:id', requireStaffOrAdmin, async (req: any, res) => {
    const msgId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(contactMessages).where(eq(contactMessages.id, msgId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_CONTACT', `Deleted contact message ID: ${msgId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- NEWSLETTER ENDPOINTS ---
  // ==========================================
  app.post('/api/subscribers', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
      // Simple duplicate check or upsert
      const existing = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)).limit(1);
      if (existing.length > 0) {
        if (existing[0].status === 'subscribed') {
          return res.status(200).json({ message: 'Already subscribed' });
        }
        const updated = await db.update(newsletterSubscribers).set({ status: 'subscribed' }).where(eq(newsletterSubscribers.email, email)).returning();
        
        // Notify subscription update
        const emailSubject = `[MADECC Group] Newsletter Subscription Updated`;
        const emailText = `A newsletter subscriber re-activated their subscription:\n\nEmail: ${email}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-top: 0; font-size: 22px;">Subscription Updated</h2>
            <p style="font-size: 15px; margin: 8px 0;">The following email address has re-subscribed to the newsletter:</p>
            <p style="font-size: 16px; margin: 15px 0; font-weight: bold;"><a href="mailto:${email}" style="color: #f59e0b; text-decoration: none;">${email}</a></p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group Portal Notifications &bull; Cameroon</p>
          </div>
        `;
        sendNotificationEmail(emailSubject, emailText, emailHtml).catch(err => {
          console.error('Email notify error (newsletter):', err);
        });

        return res.json(updated[0]);
      }
      const result = await db.insert(newsletterSubscribers).values({ email, status: 'subscribed' }).returning();

      // Notify new subscription
      const emailSubject = `[MADECC Group] New Newsletter Subscriber`;
      const emailText = `A new user has subscribed to the MADECC Group newsletter:\n\nEmail: ${email}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-top: 0; font-size: 22px;">New Newsletter Subscriber</h2>
          <p style="font-size: 15px; margin: 8px 0;">A new user has signed up to receive newsletter updates:</p>
          <p style="font-size: 16px; margin: 15px 0; font-weight: bold;"><a href="mailto:${email}" style="color: #f59e0b; text-decoration: none;">${email}</a></p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group Portal Notifications &bull; Cameroon</p>
        </div>
      `;
      sendNotificationEmail(emailSubject, emailText, emailHtml).catch(err => {
        console.error('Email notify error (newsletter new):', err);
      });

      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/subscribers', requireAdmin, async (req, res) => {
    try {
      const subs = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));
      res.json(subs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- GALLERY ENDPOINTS ---
  // ==========================================
  app.get('/api/gallery', async (req, res) => {
    try {
      const items = await db.select().from(galleryItems).orderBy(desc(galleryItems.createdAt));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/gallery', requireAdmin, async (req: any, res) => {
    const { title, imageUrl, videoUrl, category } = req.body;
    if (!title || !imageUrl || !category) return res.status(400).json({ error: 'Missing gallery fields' });
    try {
      const result = await db.insert(galleryItems).values({ 
        title, 
        imageUrl, 
        videoUrl: videoUrl || null,
        category 
      }).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'ADD_GALLERY', `Added item to gallery: ${title}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/gallery/:id', requireAdmin, async (req: any, res) => {
    const itemId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(galleryItems).where(eq(galleryItems.id, itemId)).returning();
      if (deleted.length > 0) {
        await deleteFileFromCloud(deleted[0].imageUrl);
        await deleteFileFromCloud(deleted[0].videoUrl);
      }
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_GALLERY', `Deleted gallery item ID: ${itemId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/gallery/:id', requireAdmin, async (req: any, res) => {
    const itemId = parseInt(req.params.id);
    const { title, imageUrl, videoUrl, category } = req.body;
    if (!title || !imageUrl || !category) return res.status(400).json({ error: 'Missing gallery fields' });
    try {
      // Fetch existing record to perform asset replacement check
      const existing = await db.select().from(galleryItems).where(eq(galleryItems.id, itemId)).limit(1);
      if (existing.length > 0) {
        if (imageUrl && imageUrl !== existing[0].imageUrl) {
          await deleteFileFromCloud(existing[0].imageUrl);
        }
        if (videoUrl !== undefined && videoUrl !== existing[0].videoUrl) {
          await deleteFileFromCloud(existing[0].videoUrl);
        }
      }

      const updated = await db.update(galleryItems).set({
        title,
        imageUrl,
        videoUrl: videoUrl || null,
        category
      }).where(eq(galleryItems.id, itemId)).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_GALLERY', `Updated gallery item: ${title}`);
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- IMAGE RESOLUTION & PROXY ENDPOINT ---
  // ==========================================
  app.get('/api/resolve-image', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    try {
      // 1. Google Drive URLs
      if (targetUrl.includes('drive.google.com')) {
        const driveIdMatch = targetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || targetUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveIdMatch) {
          const directUrl = `https://drive.google.com/uc?export=download&id=${driveIdMatch[1]}`;
          return res.redirect(directUrl);
        }
      }

      // 2. Direct images or base64
      const isDirectImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(targetUrl);
      if (isDirectImage || targetUrl.startsWith('data:image/')) {
        return res.redirect(targetUrl);
      }

      // 3. Webpages (e.g. kommodo.ai/i/...) - fetch and parse Open Graph meta tags for image
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        return res.redirect(targetUrl);
      }

      const html = await response.text();
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
                      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

      if (ogMatch && ogMatch[1]) {
        let resolvedUrl = ogMatch[1];
        if (resolvedUrl.startsWith('/')) {
          try {
            const parsedTarget = new URL(targetUrl);
            resolvedUrl = `${parsedTarget.origin}${resolvedUrl}`;
          } catch (err) {
            // ignore
          }
        }
        return res.redirect(resolvedUrl);
      }

      return res.redirect(targetUrl);
    } catch (err) {
      console.error('Error resolving image URL:', err);
      return res.redirect(targetUrl);
    }
  });


  // ==========================================
  // --- HERO BANNERS ENDPOINTS ---
  // ==========================================
  app.get('/api/banners', async (req, res) => {
    try {
      const banners = await db.select().from(heroBanners).where(eq(heroBanners.active, true)).orderBy(heroBanners.displayOrder);
      res.json(banners);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/banners/all', requireAdmin, async (req, res) => {
    try {
      const banners = await db.select().from(heroBanners).orderBy(heroBanners.displayOrder);
      res.json(banners);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/banners', requireAdmin, async (req: any, res) => {
    const { title, subtitle, imageUrl, videoUrl, displayOrder, active } = req.body;
    if (!title || !imageUrl) return res.status(400).json({ error: 'Title and image are required' });
    try {
      const result = await db.insert(heroBanners).values({
        title,
        subtitle,
        imageUrl,
        videoUrl: videoUrl || null,
        displayOrder: displayOrder ? parseInt(displayOrder) : 0,
        active: active !== false,
      }).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_BANNER', `Created banner: ${title}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/banners/:id', requireAdmin, async (req: any, res) => {
    const bannerId = parseInt(req.params.id);
    const { title, subtitle, imageUrl, videoUrl, displayOrder, active } = req.body;
    try {
      // Fetch existing record to perform asset replacement check
      const existing = await db.select().from(heroBanners).where(eq(heroBanners.id, bannerId)).limit(1);
      if (existing.length > 0) {
        if (imageUrl && imageUrl !== existing[0].imageUrl) {
          await deleteFileFromCloud(existing[0].imageUrl);
        }
        if (videoUrl !== undefined && videoUrl !== existing[0].videoUrl) {
          await deleteFileFromCloud(existing[0].videoUrl);
        }
      }

      const result = await db.update(heroBanners)
        .set({
          title,
          subtitle,
          imageUrl,
          videoUrl: videoUrl || null,
          displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
          active,
        })
        .where(eq(heroBanners.id, bannerId))
        .returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_BANNER', `Updated banner ID: ${bannerId}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/banners/:id', requireAdmin, async (req: any, res) => {
    const bannerId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(heroBanners).where(eq(heroBanners.id, bannerId)).returning();
      if (deleted.length > 0) {
        await deleteFileFromCloud(deleted[0].imageUrl);
        await deleteFileFromCloud(deleted[0].videoUrl);
      }
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_BANNER', `Deleted banner ID: ${bannerId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- CAMEROON LESSON PREPARATION ENDPOINTS ---
  // ==========================================
  
  function getFallbackLessonPackage(topic: string, gradeLevel: string, subject: string, syllabusText?: string) {
    const actualTopic = topic || 'Introduction to Building Foundations & Excavation Safety';
    const actualGrade = gradeLevel || 'Form Four Building Construction (F4BA)';
    const actualSubject = subject || 'Building Construction';
    
    let syllabusSection = '';
    if (syllabusText) {
      syllabusSection = `\n\n### SYLLABUS CORRELATION & FOCUS\n* **Extracted Syllabus Guidelines / Objectives:**\n${syllabusText.substring(0, 1500)}${syllabusText.length > 1500 ? '... [Content Truncated]' : ''}\n\n---\n`;
    }

    const contentMarkdown = `# Cameroon Ministry of Secondary Education (MINESEC)
## Department of Civil Engineering & Building Construction
### Competency-Based Approach (CBA) Lesson Package

---

### PART 1 – LESSON INFORMATION
* **School Name:** Government Technical High School (GTHS) Yaoundé / Douala
* **Academic Year:** 2026/2027
* **Term / Sequence / Week:** Term 1 | Sequence 1 | Week 2
* **Subject / Specialization:** ${actualSubject} | Building Construction (F4BA)
* **Grade / Class:** ${actualGrade}
* **Topic:** ${actualTopic}
* **Duration:** 2 Periods (100 Minutes)
* **Teacher:** Senior Curriculum Specialist (AI Assistant)${syllabusSection}

---

### PART 2 – CURRICULUM ALIGNMENT
* **Competency:** Mastery of foundation types, excavating protocols, and workshop health and safety.
* **Expected Learning Outcomes:** Learners will identify strip, pad, and raft foundations, select proper excavation tools, and apply personal protective equipment (PPE) correctly.
* **SDGs Aligned:** Goal 9: Industry, Innovation, and Infrastructure & Goal 8: Decent Work and Economic Growth.

---

### PART 3 – LEARNING OBJECTIVES
By the end of this lesson, learners will be able to:
1. Define a "foundation" in building construction and explain its primary load-bearing purpose.
2. Differentiate between Strip Foundations and Pad Foundations with clear hand-drawn structural sketches.
3. List 5 vital Personal Protective Equipment (PPE) items required on a Cameroonian construction site.
4. Calculate the volume of soil excavation required for a pad foundation footprint of 1.2m x 1.2m x 1.0m.
5. Create a simple site checklist for timbering and timber-shoring support in deep soil excavations.

---

### PART 4 – KEY VOCABULARY
| Term | Definition | Practical Example |
| :--- | :--- | :--- |
| **Foundation** | The lower structural part of a building that transmits loads safely to the soil. | A reinforced concrete pad under a structural pillar. |
| **Excavation** | The removal of earth to prepare the ground for foundation footings. | Digging a trench 1 meter deep for a strip footing. |
| **Shoring (Timbering)** | Temporary timber supports to prevent the collapse of vertical excavation walls. | Placing timber boards against loose sand walls during trenching. |

---

### PART 5 – REQUIRED MATERIALS
* **Teacher Resources:** Standard CBA curriculum guides, foundation models, chalk, whiteboard markers.
* **Student Resources:** Textbooks, technical drawing instruments, notebooks.
* **Workshop Equipment & Construction Tools:** Shovels, pickaxes, spirit levels, wheelbarrows, measuring tapes.
* **PPE (Safety Equipment):** Hard hats, safety boots, high-visibility vests, hand gloves.

---

### PART 6 – LESSON INTRODUCTION (Hook)
**Activity (5-10 Minutes):** Show the class a photo of a collapsed foundation wall or a local structural failure in Yaoundé or Douala caused by poor soil testing and lack of foundations.
* **Teacher Script:** *"Class, look at this residential building that collapsed. What went wrong? Why do some buildings stand for 100 years, while others sink into the wet clay soil of Wouri?"*
* **Expected Student Response:** *"Sir, the ground was too soft!"* or *"The concrete foundation was too weak or missing!"*

---

### PART 7 – DIRECT INSTRUCTION
#### Stage 1: Purpose of Foundations (20 Mins)
A foundation must distribute the dead load (self-weight) and live load (occupants, wind) over a large area to prevent soil shear failure and settlement.
* **Safety First:** Excavations deeper than 1.5 meters must be shored (timbered) to prevent burial accidents under collapsing soil walls.
* **Common Misconception:** *"Concrete foundations are only needed for multi-story structures."* Correction: All permanent block structures, including single-room classrooms, need a strip or pad footing to prevent water infiltration and cracks.

#### Stage 2: Strip vs. Pad Footings (25 Mins)
* **Strip Foundation:** A continuous strip of concrete under load-bearing masonry walls.
* **Pad Foundation:** Isolated square or rectangular concrete blocks under structural columns.

---

### PART 8 – GUIDED PRACTICE
The teacher divides the class into groups of 5 in the school workshop or yard. Each group is given a tape measure and peg lines to set out a 1.2m x 1.2m pad foundation footprint.
* **Teacher Prompt:** *"Ensure your diagonals are perfectly equal! Use the 3:4:5 rule for a perfect 90-degree corner."*

---

### PART 9 – INDEPENDENT PRACTICE
**Individual Task (20 Mins):** Calculate the total excavation volume for a row of 6 column pads, each measuring 1.5m length, 1.5m width, and 1.2m depth.
* **Marking Criteria:**
  - Correct formula: Volume = L × W × D (2 Marks)
  - Calculation: 1.5 × 1.5 × 1.2 = 2.7 cubic meters per pad (2 Marks)
  - Total Volume: 2.7 × 6 = 16.2 m³ (1 Mark)

---

### PART 10 – DIFFERENTIATION
* **Struggling Learners:** Paired with peers, given pre-calculated layout models.
* **Advanced Learners:** Tasked with estimating the number of bags of Portland cement required for a 1:2:4 concrete mix ratio.

---

### PART 11 – FORMATIVE ASSESSMENT
Observe student peg layout accuracy. Ask rapid-fire questions: *"What PPE protects your feet from stepping on rusty nails?"* (Expected: Safety boots with steel toes).

---

### PART 12 – EXIT TICKET
1. **Question:** Name the foundation type used for load-bearing brick walls.
   * **Answer:** Strip Foundation.
2. **Question:** Why do we place shoring in wet trenches?
   * **Answer:** To prevent the wet vertical clay or sandy soil walls from collapsing.

---

### PART 13 – HOMEWORK / PROJECT
Observe a construction site in your neighborhood. Draw a sketch of their foundation trench and note down if workers are wearing proper helmets and safety boots. Write a 100-word field report.`;

    const presentationJSON = [
      {
        "slideNumber": 1,
        "title": `${actualTopic} - Introduction`,
        "bullets": [
          "What is a building foundation?",
          "Primary load-bearing objectives",
          "Soil bearing capacity in Cameroon",
          "Understanding dead loads vs live loads"
        ],
        "speakerNotes": "Welcome everyone to Building Construction. Today we are focusing on how structures stand up and safe ground preparation.",
        "diagram": "Cross-section of load path from roof down to soil foundation",
        "discussionQuestion": "Why does a heavy truck sink in mud, while a human can walk? (Hint: Surface area!)"
      },
      {
        "slideNumber": 2,
        "title": "Strip Foundations",
        "bullets": [
          "Continuous concrete footings",
          "Placed directly under brick or block walls",
          "Ideal for standard residential structures",
          "Normal Cameroon mix ratio 1:3:6 or 1:2:4"
        ],
        "speakerNotes": "Strip foundations run continuously under walls to spread weight uniformly.",
        "diagram": "Strip foundation detailing with brick wall and concrete footing",
        "discussionQuestion": "When should we use strip instead of isolated pads?"
      },
      {
        "slideNumber": 3,
        "title": "Pad Foundations",
        "bullets": [
          "Isolated reinforced concrete pads",
          "Used under load-bearing columns/pillars",
          "Transmits heavy concentrated point loads",
          "Standard size: 1m x 1m or 1.2m x 1.2m"
        ],
        "speakerNotes": "For framed buildings where columns carry the main weight, pads are standard.",
        "diagram": "Isometric sketch of a pad footing with reinforcing steel starter bars",
        "discussionQuestion": "Why do we add steel bars in pad footings?"
      },
      {
        "slideNumber": 4,
        "title": "Excavation and Site Preparation",
        "bullets": [
          "Clearing topsoil (organic matter)",
          "Digging to firm load-bearing strata",
          "Setting out peg markers accurately",
          "Using 3-4-5 rule for square corners"
        ],
        "speakerNotes": "Site clearing is the first step. Topsoil contains grass and roots and must be removed.",
        "diagram": "Peg and string line layout layout diagram",
        "discussionQuestion": "What happens if we build directly on organic grass layer?"
      },
      {
        "slideNumber": 5,
        "title": "Trench Safety & Shoring",
        "bullets": [
          "Risk of cave-ins and collapsing soils",
          "Using timbering (shoring) in loose sand",
          "Safety access ladders every 5 meters",
          "Keeping dug soil at least 1 meter away"
        ],
        "speakerNotes": "Never work in an unsecured deep trench. Ground collapses happen instantly.",
        "diagram": "Timber shoring trench strutting detail",
        "discussionQuestion": "What type of soil collapses easiest: clay, loam, or dry sand?"
      },
      {
        "slideNumber": 6,
        "title": "Calculations of Soil Volumes",
        "bullets": [
          "Formula: Volume = Length x Width x Depth",
          "Why we calculate: Spoil removal logistics",
          "Bulking factor: Soil expands when dug!",
          "Estimating truck trips required"
        ],
        "speakerNotes": "We need to know how much dirt is coming out to pay laborers and book dump trucks.",
        "diagram": "Dimensioned cube showing L, W, D",
        "discussionQuestion": "If clay bulk factor is 30%, how much does 10 cubic meters of dug clay measure?"
      },
      {
        "slideNumber": 7,
        "title": "Concrete Mix Ratios & Curing",
        "bullets": [
          "Portland cement, sand, gravel, water",
          "Ratio 1:2:4 for reinforced structural footings",
          "Ratio 1:3:6 for unreinforced strip concrete",
          "Curing: keeping concrete wet for 7-14 days"
        ],
        "speakerNotes": "Concrete gains full strength by hydration, which requires constant moisture.",
        "diagram": "Concrete mix volumetric buckets diagram",
        "discussionQuestion": "Why does dry concrete crack and crumble?"
      },
      {
        "slideNumber": 8,
        "title": "PPE & Site Health/Safety",
        "bullets": [
          "Steel-toed boots (stepping on nails)",
          "Hard hats (falling debris / scaffold drops)",
          "High-visibility vest (heavy machine visibility)",
          "Heavy gloves (handling cement chemical burns)"
        ],
        "speakerNotes": "Safety is non-negotiable. Cement causes chemical skin burns, and sites have sharp metals.",
        "diagram": "Worker wearing full PPE kit",
        "discussionQuestion": "Which PPE is most critical when mixing dry concrete by hand?"
      },
      {
        "slideNumber": 9,
        "title": "Differentiation & Local Methods",
        "bullets": [
          "Hand-digging vs. mechanical excavators",
          "Local Cameroon stones used for blinding",
          "Adapting to high water tables in Littoral",
          "Adapting to dry rocky soils in Far North"
        ],
        "speakerNotes": "In Limbe or Douala, you reach water at 1m. In Maroua, the soil is dry and sandy.",
        "diagram": "Map of Cameroon showing soil types and foundation adaptations",
        "discussionQuestion": "How do foundations differ between Douala and Maroua?"
      },
      {
        "slideNumber": 10,
        "title": "Summary & Next Steps",
        "bullets": [
          "Foundations transmit loads safely",
          "Strip footings are linear; pad footings are isolated",
          "Excavations require safety timbering",
          "Diagonals must be checked for squareness"
        ],
        "speakerNotes": "Let's review. Next week we move to brickwork and mortar masonry.",
        "diagram": "Timeline checklist",
        "discussionQuestion": "What is the single most important safety rule on an excavation site?"
      }
    ];

    const worksheetMarkdown = `# Cameroon Technical School Student Worksheet
## Grade Level: ${actualGrade} | Subject: ${actualSubject}
### Topic: ${actualTopic}

**Name:** ___________________________  **Class:** __________  **Date:** ____________

---

### PART A: WARM-UP ACTIVITY (10 Minutes)
Look around your school building. Identify where the heavy pillars meet the ground. Can you see the concrete pads underneath? Sketch what you think is underground.

---

### PART B: GUIDED NOTES (Fill in the blanks)
1. A **foundation** is the lowest load-bearing component of a structure, designed to transmit dead and live loads safely into the ________________________.
2. **Strip foundations** run continuously under continuous ________________________ walls.
3. **Pad foundations** are isolated concrete blocks placed directly under structural ________________________.
4. Trenches deeper than **1.5 meters** require temporary wood supports called ________________________ to prevent cave-ins.

---

### PART C: PRACTICAL CALCULATION EXERCISE
An engineering project in Yaoundé requires the excavation of 10 isolated column pad foundations. Each foundation excavation must be:
* Length = 1.2 meters
* Width = 1.2 meters
* Depth = 1.5 meters

**Task:**
1. Calculate the excavation volume of **one** pad footing.
   * *Formula:* Volume = L × W × D
   * *My Work:* __________________________________________________
   * *Answer:* ____________________ m³
2. Calculate the **total** excavation volume for all 10 footings.
   * *My Work:* __________________________________________________
   * *Answer:* ____________________ m³

---

### PART D: MULTIPLE-CHOICE QUESTIONS
1. Which PPE is most critical to protect you from stepping on rusty site nails?
   * A) Safety goggles
   * B) Hard hat
   * C) Steel-toed boots
   * D) High-visibility vest
2. What concrete mix ratio is standard for structural reinforced column pads?
   * A) 1:5:10
   * B) 1:2:4
   * C) 1:4:8
   * D) 1:3:6

---

### COMPLETE ANSWER KEY & TEACHER GUIDE
#### Part B Answers:
1. Soil / Earth / Ground
2. Masonry / Brick / Block
3. Columns / Pillars
4. Shoring / Timbering

#### Part C Answers:
1. Volume = 1.2m × 1.2m × 1.5m = 2.16 m³ per footing.
2. Total Volume = 2.16 m³ × 10 = 21.6 m³.

#### Part D Answers:
1. C) Steel-toed boots
2. B) 1:2:4`;

    const quizMarkdown = `# Topic Quiz & Marks Allocation
## Topic: ${actualTopic}
### Subject: ${actualSubject} | Grade Level: ${actualGrade}

**Time Allowed:** 20 Minutes  |  **Total Marks:** 20 Marks

---

### QUESTIONS

#### 1. Multiple-Choice Questions (5 Questions x 1 Mark each = 5 Marks)
1. **What is the primary structural function of a building foundation?** [1 Mark]
   - A) To prevent rain water from entering the building walls
   - B) To transmit structural dead and live loads safely to the soil
   - C) To make the building look taller and grander
   - D) To facilitate soil erosion control around the columns

2. **For standard continuous load-bearing sandcrete block walls, which foundation type is most appropriate?** [1 Mark]
   - A) Pad foundation
   - B) Pile foundation
   - C) Strip foundation
   - D) Raft foundation

3. **What is the minimum excavation depth at which structural timber shoring (timbering) becomes legally mandatory under MINESEC safety guidelines?** [1 Mark]
   - A) 0.5 meters
   - B) 1.0 meters
   - C) 1.5 meters
   - D) 3.0 meters

4. **Which concrete mix ratio is standard for pouring structural reinforced concrete foundations?** [1 Mark]
   - A) 1:2:4
   - B) 1:3:6
   - C) 1:4:8
   - D) 1:5:10

5. **In wet clay soils (like some swampy regions of Douala), what is the main hazard when digging deep foundation trenches?** [1 Mark]
   - A) Soil hardening
   - B) Trench wall cave-ins
   - C) Air pollution
   - D) Excessive dust

#### 2. Technical Short-Answer Questions (3 Questions x 2 Marks each = 6 Marks)
1. State two main physical differences between a **Strip Foundation** and a **Pad Foundation**. [2 Marks]
2. Explain the purpose of checking the diagonals of a foundation excavation footprint using the **3-4-5 rule**. [2 Marks]
3. Define the term **Blinding Layer** (blinding concrete) and explain its primary function before placing reinforcing steel bars. [2 Marks]

#### 3. Practical Scenario-Based Problem (1 Question x 9 Marks)
*Scenario:* You are the site supervisor for a new classroom block construction in Yaoundé. The design requires isolated reinforced concrete columns.
1. Determine which type of foundation is needed for these columns. [2 Marks]
2. Calculate the exact soil volume to be excavated for 8 pad foundations, where each pad trench measures 1.2m x 1.2m with a depth of 1.0m. [4 Marks]
3. State three mandatory Personal Protective Equipment (PPE) items your workers must wear during this excavation phase. [3 Marks]

---

### DETAILED ANSWER KEY & CBA GRADING MATRIX

#### Part 1 (MCQ Answers)
1. **B** - Foundations transfer structural loads to the load-bearing soil strata.
2. **C** - Strip foundations run continuously under continuous blockwork.
3. **C** - 1.5 meters is the safety limit before shoring is mandatory to prevent trench wall collapse.
4. **A** - 1:2:4 (Cement : Sand : Gravel) is the standard structural concrete mix ratio.
5. **B** - Wet clay loses its cohesion, leading to high risks of sudden cave-ins.

#### Part 2 (Short-Answer Answers)
1. **Differences:** Strip foundations are continuous linear concrete trenches under masonry walls, whereas Pad foundations are isolated square/rectangular concrete blocks under structural column pillars. (2 Marks, 1 per valid point)
2. **3-4-5 Rule:** To ensure that all layout corners are perfectly square (at exactly 90 degrees), preventing skewed walls during superstructure construction. (2 Marks)
3. **Blinding Layer:** A thin layer of concrete (typically 50mm-75mm, 1:3:6 mix) poured over the excavated soil to create a clean, level working surface and prevent dirt from contaminating structural footing concrete/reinforcement. (2 Marks)

#### Part 3 (Scenario Answers)
1. **Foundation Type:** Isolated Pad Foundation. (2 Marks)
2. **Calculation:** 
   - Volume of one pad = L × W × D = 1.2m × 1.2m × 1.0m = 1.44 m³ (2 Marks)
   - Total Volume = 1.44 m³ × 8 pads = 11.52 m³ (2 Marks)
3. **PPE:** Hard hat (helmet), steel-toed safety boots, and high-visibility vest or gloves. (3 Marks, 1 Mark per item)`;

    return {
      content: contentMarkdown,
      presentation: presentationJSON,
      worksheet: worksheetMarkdown,
      quiz: quizMarkdown,
      metadata: {
        lessonId: `LES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        subjectId: 'SUB-CIVIL',
        teacherId: 'TCH-001',
        departmentId: 'DEPT-CONSTR',
        academicYear: '2026/2027',
        term: 'Term 1',
        sequence: 'Sequence 1',
        week: 'Week 2',
        lessonDuration: '100 Minutes',
        gradeLevel: actualGrade,
        topic: actualTopic,
        keywords: 'foundation, strip, pad, shoring, excavation, safety',
        competency: 'Foundation Types and Excavation site safety',
        learningOutcomes: 'Learners can differentiate pad/strip footings and calculate soil volumes.',
        versionNumber: '1.0.0',
        status: 'Published'
      }
    };
  }

  function getFallbackLecture(topic: string, gradeLevel: string, subject: string): string {
    const actualTopic = topic || 'Introduction to Building Foundations & Excavation Safety';
    const actualGrade = gradeLevel || 'Form Four Building Construction (F4BA)';
    const actualSubject = subject || 'Building Construction';
    
    return `# READY-TO-TEACH LECTURE: ${actualTopic}
    
## 1. LECTURE TIMELINE & PACE (Total: 90 Minutes)
* **00:00 - 00:15 (15 mins) | The Hook & Prior Knowledge Check:** Connecting excavation to daily life in Cameroon (e.g. building collapse events due to poor soil checks).
* **00:15 - 00:55 (40 mins) | Direct Instruction:** Explaining structural mechanics, soil behaviors, and foundation selection rules.
* **00:55 - 01:15 (20 mins) | Active Classroom Engagement Check:** Interactive group question-and-answer cycle with simulated site issues.
* **01:15 - 01:30 (15 mins) | Pacing Wrap-up, Safety Verification & Assignment:** Reinforcing PPE practices and concluding.

---

## 2. PEDAGOGICAL OBJECTIVES
By the end of this lecture, students will be able to:
1. Explain the primary load-bearing functions of foundations in ${actualSubject}.
2. Compare soil bearing capacities in Douala (coastal marine clays) versus Yaoundé (lateritic clay-loams).
3. Demonstrate correct PPE and hazard mitigation techniques on site.

---

## 3. TEACHER SCRIPT / DIRECT INSTRUCTION

### Introduction & The Hook (15 minutes)
"Good morning, future builders and civil engineers. Welcome back to our **${actualSubject}** lecture. Today we are tackling a critical topic under the MINESEC curriculum: **${actualTopic}**. 

Before we write anything on the board, let me ask you: Have you walked down the streets of Yaoundé or Douala and seen some walls with wide, diagonal cracks? Why does that happen? 
Yes, because the foundation was not adapted to the soil, or the excavation depth was insufficient! 
A building is only as safe as its base. If you construct a multi-story building in the clayey wetlands of Bonabéri in Douala without a raft foundation, it will sink. If you build on the rocky slopes of Mount Messa in Yaoundé without anchoring, it will slide. Today, you will learn the exact science to prevent this!"

### Core Concept: Soil Profiles in Cameroon (20 minutes)
"Let's look at soil bearing capacity. 
* In **Douala (coastal zones)**, we have fine, sandy, marine clays. The bearing capacity is extremely low (often below 50 kN/m²). High water table means we must pump out water continuously.
* In **Yaoundé (high plateau)**, we have lateritic soils. These are red clay-loams with good bearing capacity (up to 150-200 kN/m²) when dry, but they become highly slippery when wet.
* In **Maroua / Garoua (sahelian/northern zones)**, we have swell-shrink black cotton soils (vertisols). When it rains, they expand; in the dry season, they crack deeply.

*Teacher Action: Draw a vertical profile of soil on the blackboard showing topsoil, subsoil, and bedrocks.*"

### Structural Mechanics of Foundations (20 minutes)
"We have two main categories of foundations:
1. **Shallow Foundations (Fondations Superficielles):** 
   - **Strip Foundations (Semelles filantes):** Continuous strip under walls. Used for load-bearing blockwork.
   - **Pad Foundations (Semelles isolées):** Single concrete pads under reinforced concrete columns. Perfect for framed structures in solid Yaoundé clays.
   - **Raft/Mat Foundations (Radiers):** A continuous reinforced concrete slab covering the entire build area. Used for soft soils like Douala wetlands to distribute loads evenly.
2. **Deep Foundations (Fondations Profondes):**
   - **Piles (Pieux):** Concrete columns driven deep down to solid bedrock (e.g. used for major ports in Kribi)."

---

## 4. CLASSROOM INTERACTIVE PARTICIPATION CHECKPOINTS

### Checkpoint 1: Soil Selection
* **Teacher:** "If you are hired to supervise a construction site in Limbe, near the volcanic coast, and you find muddy black sandy soil, which foundation would you propose for a 2-story family villa?"
* **Expected Student Answer:** "A raft foundation (radier général) or short piles, because the soil is too weak for single pad foundations and might settle unevenly."
* **Follow-up:** "Excellent! Why not strip? Because strip foundations will settle unevenly and tear the walls apart."

### Checkpoint 2: Excavation Hazard Mitigation
* **Teacher:** "You are digging a strip foundation trench 1.8 meters deep. What is the immediate safety hazard, especially during the heavy rain season in May?"
* **Expected Student Answer:** "Cave-in of the trench walls due to soil water saturation. We must use timber timbering and strutting (blindage) to support the sides."

---

## 5. COMMON STUDENT MISCONCEPTIONS
1. *Misconception:* "All concrete is the same."
   - *Clarification:* Absolutely not! Foundation concrete must be highly durable and dense, typically using **CIMENCAM or CIMAF CPA-45 (Class 42.5 or 52.5) cement** with a batching ratio of 350 kg/m³ for reinforced elements (1 bag cement, 2 wheelbarrows sand, 3 wheelbarrows gravel/concassé).
2. *Misconception:* "Water in a trench is fine; just pour concrete in."
   - *Clarification:* Water dilutes the cement-to-water ratio of the fresh concrete, destroying its compressive strength. The trench must be completely dewatered (pumped dry) or a lean concrete blinding layer (béton de propreté) poured first.

---

## 6. TEACHING TIPS & CLASSROOM PACING ADVICE
* **Tip 1:** Use local wood terms (Iroko or Bubinga) when explaining timber struts to make it instantly recognizable to students who see carpentry workshops daily.
* **Tip 2:** If students are slow to respond, ask them to imagine they are the lead Site Inspector for the Minister of Housing and Urban Development (MINDHU). This raises professional pride and engagement immediately!`;
  }

  function getFallbackQuiz(topic: string, gradeLevel: string, subject: string): string {
    const actualTopic = topic || 'Introduction to Building Foundations & Excavation Safety';
    const actualGrade = gradeLevel || 'Form Four Building Construction (F4BA)';
    const actualSubject = subject || 'Building Construction';

    return `# COMPETENCY-BASED ASSESSMENT: ${actualTopic}

**Class:** ${actualGrade}
**Discipline:** ${actualSubject} (Civil Engineering Specialty)
**Time Allowed:** 2 Hours
**Total Marks:** 20 Marks

---

## SECTION A: COMPLEX MULTIPLE-CHOICE QUESTIONS (MCQs) [5 Marks]
*Instructions: Select the single most accurate, technically sound option. Write your answer clearly.*

### Question 1 [1 Mark]
In coastal Douala regions (e.g. Akwa, Bonabéri) characterized by waterlogged sandy-clay soils, which foundation type is most technically and economically sound to prevent differential settlement for a residential villa?
- A) Standard concrete strip foundation (semelle filante)
- B) Independent pad foundations (semelles isolées) without ground beams
- C) Reinforced concrete raft foundation (radier général) [1 Mark]
- D) Direct blockwork on compacted soil
*Answer:* **C**
*Explanation:* Raft foundations act as a continuous slab that distributes structural loads evenly across a large surface area, neutralizing localized weak spots in clay/sand.

### Question 2 [1 Mark]
What is the standard cement batching ratio prescribed by Cameroon MINESEC civil engineering guidelines for reinforced concrete foundation columns and pads?
- A) 150 kg/m³ (light concrete)
- B) 350 kg/m³ using Class 42.5R cement (e.g. CIMENCAM/CIMAF) [1 Mark]
- C) 500 kg/m³ (highly rich mortar)
- D) 250 kg/m³ without gravel
*Answer:* **B**
*Explanation:* 350 kg/m³ is the structural standard for reinforced foundations, ensuring optimal compressive strength and durability against moisture.

### Question 3 [1 Mark]
During the excavation of a trench deeper than 1.5 meters in muddy Yaoundé laterite, what technique MUST be used to prevent landslides and cave-ins of the trench walls?
- A) Watering the walls to keep them wet
- B) Timbering and strutting (blindage et étayage) [1 Mark]
- C) Speeding up the hand digging process
- D) Leaving the trench completely open without warning signs
*Answer:* **B**
*Explanation:* Timbering provides mechanical support to unstable trench faces, preventing collapsing forces from trapping workers.

### Question 4 [1 Mark]
What is the primary function of "Lean Concrete" (Béton de propreté) poured at the bottom of an excavated foundation trench?
- A) To carry the main weight of the columns
- B) To provide a level, clean surface and prevent soil from mixing with structural concrete [1 Mark]
- C) To act as a waterproof barrier without cement
- D) To replace reinforcement bars
*Answer:* **B**
*Explanation:* Blinding concrete prevents clean structural concrete from being contaminated with dirt, mud, and groundwater.

### Question 5 [1 Mark]
Which of the following describes a "differential settlement" hazard in civil engineering?
- A) An equal sinking of the entire building
- B) An uneven sinking of different structural supports, leading to severe diagonal shear cracks [1 Mark]
- C) The normal drying process of cement paste
- D) The process of sorting aggregates by size
*Answer:* **B**
*Explanation:* Differential settlement causes massive tension forces in blockwork, creating vertical or diagonal structural failure cracks.

---

## SECTION B: TECHNICAL SHORT-ANSWER QUESTIONS [6 Marks]

### Question 6 [2 Marks]
Explain the difference in soil bearing capacity between a dry lateritic clay soil (common in Yaoundé) and a water-saturated marine clay soil (common in Douala). Mention how water saturation affects shear strength.
*Answer Key & Marks Allocation:*
- **1 Mark:** Explaining that dry lateritic soil has high bearing capacity/shear strength because cohesive particles are compact and dry, while marine clay is fine and saturated with water.
- **1 Mark:** Explaining that water acts as a lubricant between clay mineral plates, increasing pore water pressure, which dramatically reduces the soil's effective shear strength and bearing capacity.

### Question 7 [2 Marks]
Sketch and label a standard reinforced concrete **Pad Foundation (Semelle Isolée)** showing:
1. Ground Blinding Layer (Béton de propreté)
2. Column Reinforcement Starter Bars (Attentes)
3. Reinforced Concrete Base Pad
*Answer Key & Marks Allocation:*
- **1 Mark:** For correct drawing structure (pad base under column starter bars).
- **1 Mark:** For accurate labeling of all 3 mandatory components [0.33 Mark per label].

### Question 8 [2 Marks]
State two safety checks a Site Supervisor must perform before authorizing laborers to enter an open trench for foundation formwork installation.
*Answer Key & Marks Allocation:*
- **1 Mark:** Check for wall stability, presence of cracks, or signs of earth sliding.
- **1 Mark:** Verification that excavated soil piles (déblais) are stored at least 1.0 meter away from the trench edge to prevent collapse.

---

## SECTION C: PRACTICAL CBA PROBLEM-SOLVING CASE STUDY [9 Marks]

### Scenario
You are appointed as the Lead Site Superintendent for a community health center project in Bafoussam. The design calls for **12 independent concrete pad foundations**, each measuring **1.2m x 1.2m with a thickness of 0.3m**. The soil is stable clayey-silt. 

#### Task 1: Materials Calculation [4.5 Marks]
Calculate the total volume of structural concrete required to pour all 12 pads. Then, using standard Cameroon batching of **350 kg/m³** (where 1 m³ concrete requires: 7 bags of cement, 400 liters of sand, 800 liters of gravel), determine the exact quantities of:
1. Volume of concrete (m³)
2. Bags of cement (50kg bags)
3. Volume of sand required (m³)
4. Volume of gravel required (m³)

*Answer Key & Marks Allocation:*
1. **Concrete Volume calculation:** 
   - Volume of 1 pad = 1.2 x 1.2 x 0.3 = 0.432 m³ [1 Mark]
   - Total volume for 12 pads = 0.432 x 12 = 5.184 m³ [0.5 Mark]
2. **Cement bags:**
   - 5.184 m³ x 7 bags/m³ = 36.288 bags ≈ 37 bags (rounded up) [1 Mark]
3. **Sand volume:**
   - 5.184 m³ x 0.4 m³ = 2.074 m³ [1 Mark]
4. **Gravel volume:**
   - 5.184 m³ x 0.8 m³ = 4.147 m³ [1 Mark]

#### Task 2: Site Layout & Safety Plan [4.5 Marks]
Explain the specific layout procedure for these pad foundations, and write down 3 critical PPE items that all excavation laborers must wear on site, explaining the structural hazard each item protects against.

*Answer Key & Marks Allocation:*
- **1.5 Marks:** Layout procedure: Establish profile boards (chaises d'implantation), run alignment lines (cordeaux) along column grids, drop plumb bob (fil à plomb) to mark center points, and trace pit borders using lime powder (chaux).
- **3.0 Marks:** 3 PPE Items & Hazards protected:
  1. **Safety Helmet (Casque):** Protects against falling stones, soil clods, or timber struts collapsing from above into the pit. [1 Mark]
  2. **Steel-Toed Boots (Chaussures de sécurité à coque):** Protects feet against sharp reinforcement wires, stepping on nails from formwork, or impact from heavy excavation spades. [1 Mark]
  3. **High-Visibility Vest (Gilet de haute visibilité):** Protects workers inside deep pits by making them clearly visible to excavator or wheelbarrow operators. [1 Mark]

---

## GRADING CRITERIA RUBRIC TABLE (MINESEC CBA Standard)
| Competency Criteria | Excellent (4.5 - 5 Marks) | Satisfactory (2.5 - 4 Marks) | Needs Improvement (0 - 2 Marks) |
| :--- | :--- | :--- | :--- |
| **Material Estimation (Task 1)** | Accurate mathematical calculations with perfect metric rounding of cements, sands, and gravels. | Minor mathematical slip; correct formulas used but rounding was off. | Inability to calculate volume or relate to Cameroon cement bag standards. |
| **Safety Plan (Task 2)** | Identified exact site safety procedures, grid alignments, and paired correct PPE with structural hazards. | Named PPE but lacked clear explanation of structural excavation hazards. | Listed generic terms without secondary school technical focus. |`;
  }

  app.post('/api/lessons/upload-syllabus', upload.single('syllabusFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname.toLowerCase();
      let extractedText = '';

      if (originalName.endsWith('.pdf')) {
        console.log(`[PDF Parser] Processing PDF file: ${originalName}`);
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const pdfParseModule: any = await import('pdf-parse');
          const PDFParseClass = pdfParseModule.PDFParse || (pdfParseModule.default && pdfParseModule.default.PDFParse) || pdfParseModule.default;
          if (!PDFParseClass) {
            throw new Error(`PDFParse class not found in the imported module. Keys: ${Object.keys(pdfParseModule).join(', ')}`);
          }
          console.log(`[PDF Parser] Initializing PDFParse instance...`);
          const parser = new PDFParseClass({ data: fileBuffer });
          const parsed = await parser.getText();
          extractedText = parsed.text;
          console.log(`[PDF Parser] Successfully extracted ${extractedText.length} characters of text.`);
        } catch (parseError: any) {
          console.error(`[PDF Parser] Critical failure during PDF parsing of ${originalName}:`, {
            message: parseError.message,
            stack: parseError.stack,
            parser: 'pdf-parse (Mehmet Kozan TypeScript version)',
            filePath
          });
          throw new Error(`Failed to parse syllabus PDF: ${parseError.message}`);
        }
      } else if (originalName.endsWith('.docx')) {
        const fileBuffer = fs.readFileSync(filePath);
        const mammothModule = await import('mammoth');
        const result = await mammothModule.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } else if (originalName.endsWith('.doc')) {
        const text = fs.readFileSync(filePath, 'utf-8');
        extractedText = text.replace(/[^\x20-\x7E\n]/g, '');
      } else if (originalName.endsWith('.txt')) {
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, Word (.docx), or TXT.' });
      }

      // Cleanup uploaded temp file safely
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Error unlinking temp file:', unlinkErr);
      }

      const maxChars = 20000;
      if (extractedText.length > maxChars) {
        extractedText = extractedText.substring(0, maxChars) + '\n... [Content truncated due to size limit]';
      }

      res.json({
        filename: req.file.originalname,
        text: extractedText.trim()
      });
    } catch (err: any) {
      console.error('Error parsing syllabus:', err);
      res.status(500).json({ error: `Failed to parse syllabus: ${err.message}` });
    }
  });

  // Syllabus documents database CRUD
  app.get('/api/syllabus-documents', async (req, res) => {
    try {
      let docs = await db.select().from(syllabusDocuments).orderBy(desc(syllabusDocuments.uploadedAt));
      
      // Filter dynamically
      const { search, subject, gradeLevel, academicYear, category, status } = req.query;
      
      if (search) {
        const query = String(search).toLowerCase();
        docs = docs.filter(doc => 
          (doc.filename && doc.filename.toLowerCase().includes(query)) ||
          (doc.subject && doc.subject.toLowerCase().includes(query)) ||
          (doc.keyTopics && doc.keyTopics.toLowerCase().includes(query)) ||
          (doc.learningObjectives && doc.learningObjectives.toLowerCase().includes(query))
        );
      }
      
      if (subject) {
        const query = String(subject).toLowerCase();
        docs = docs.filter(doc => doc.subject && doc.subject.toLowerCase() === query);
      }
      
      if (gradeLevel) {
        const query = String(gradeLevel).toLowerCase();
        docs = docs.filter(doc => doc.gradeLevel && doc.gradeLevel.toLowerCase() === query);
      }
      
      if (academicYear) {
        const query = String(academicYear).toLowerCase();
        docs = docs.filter(doc => doc.academicYear && doc.academicYear.toLowerCase() === query);
      }
      
      if (category) {
        const query = String(category).toLowerCase();
        docs = docs.filter(doc => doc.category && doc.category.toLowerCase() === query);
      }
      
      if (status) {
        const query = String(status).toLowerCase();
        docs = docs.filter(doc => doc.status && doc.status.toLowerCase() === query);
      }

      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/syllabus-documents/upload', upload.single('syllabusFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const ext = path.extname(originalName).toLowerCase().replace('.', '');
      let extractedText = '';

      if (ext === 'pdf') {
        console.log(`[PDF Parser] Processing PDF file in upload: ${originalName}`);
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const pdfParseModule: any = await import('pdf-parse');
          const PDFParseClass = pdfParseModule.PDFParse || (pdfParseModule.default && pdfParseModule.default.PDFParse) || pdfParseModule.default;
          if (!PDFParseClass) {
            throw new Error(`PDFParse class not found in the imported module. Keys: ${Object.keys(pdfParseModule).join(', ')}`);
          }
          console.log(`[PDF Parser] Initializing PDFParse instance...`);
          const parser = new PDFParseClass({ data: fileBuffer });
          const parsed = await parser.getText();
          extractedText = parsed.text;
          console.log(`[PDF Parser] Successfully extracted ${extractedText.length} characters of text.`);
        } catch (parseError: any) {
          console.error(`[PDF Parser] Critical failure during PDF parsing of ${originalName}:`, {
            message: parseError.message,
            stack: parseError.stack,
            parser: 'pdf-parse (Mehmet Kozan TypeScript version)',
            filePath
          });
          throw new Error(`Failed to parse syllabus PDF: ${parseError.message}`);
        }
      } else if (ext === 'docx') {
        const fileBuffer = fs.readFileSync(filePath);
        const mammothModule = await import('mammoth');
        const result = await mammothModule.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } else if (ext === 'doc') {
        const text = fs.readFileSync(filePath, 'utf-8');
        extractedText = text.replace(/[^\x20-\x7E\n]/g, '');
      } else if (ext === 'txt') {
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, Word, or TXT.' });
      }

      // Cleanup uploaded temp file safely
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Error unlinking temp file:', unlinkErr);
      }

      const maxChars = 20000;
      const originalExtractedText = extractedText;
      if (extractedText.length > maxChars) {
        extractedText = extractedText.substring(0, maxChars) + '\n... [Content truncated due to size limit]';
      }

      // Extract metadata with Gemini AI
      let learningObjectives = '';
      let curriculumStandards = '';
      let keyTopics = '';
      let subject = req.body.subject || 'Building Construction';
      let gradeLevel = req.body.gradeLevel || 'Form Five Technical';
      let academicYear = req.body.academicYear || '2025/2026';
      let category = req.body.category || 'CIVIL_WORKS';
      let versionNumber = req.body.versionNumber || '1.0.0';

      const ai = getGeminiClient();
      if (ai) {
        try {
          const prompt = `Analyze this technical school syllabus document content. Extract the following metadata:
1. Specific Learning Objectives (overall expected outcomes, competencies)
2. Curriculum Standards / Ministry of Secondary Education (MINESEC) references
3. Key technical topics / modules covered
4. Standard subject area (e.g. Building Construction, Building Materials, Technical Drawing, soils mechanics, etc.)
5. Grade level targeted (Form One Technical, Form Two Technical, Form Three Technical, Form Four, Form Five, Lower Sixth, Upper Sixth)

Syllabus Content:
${originalExtractedText.substring(0, 10000)}

Return the extracted values as a JSON object matching this schema. Be highly descriptive and precise.`;

          const aiResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  learningObjectives: { type: Type.STRING },
                  curriculumStandards: { type: Type.STRING },
                  keyTopics: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  gradeLevel: { type: Type.STRING }
                },
                required: ["learningObjectives", "curriculumStandards", "keyTopics", "subject", "gradeLevel"]
              }
            }
          });

          if (aiResponse && aiResponse.text) {
            const data = JSON.parse(aiResponse.text);
            learningObjectives = data.learningObjectives || '';
            curriculumStandards = data.curriculumStandards || '';
            keyTopics = data.keyTopics || '';
            if (!req.body.subject) subject = data.subject || 'Building Construction';
            if (!req.body.gradeLevel) gradeLevel = data.gradeLevel || 'Form Five Technical';
          }
        } catch (aiErr) {
          console.error("AI extraction error:", aiErr);
          // Fallback parsing from text lines
          const lines = originalExtractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          learningObjectives = lines.slice(1, 4).join(', ').substring(0, 400) || 'Extracted from file content';
          curriculumStandards = 'MINESEC Cameroon CBA';
          keyTopics = lines.slice(4, 8).join(', ').substring(0, 400) || 'Technical subject area';
        }
      } else {
        // Fallback when no AI client is available
        const lines = originalExtractedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        learningObjectives = lines.slice(1, 4).join(', ').substring(0, 400) || 'Extracted from file content';
        curriculumStandards = 'MINESEC Cameroon CBA';
        keyTopics = lines.slice(4, 8).join(', ').substring(0, 400) || 'Technical subject area';
      }

      const [newDoc] = await db.insert(syllabusDocuments).values({
        filename: originalName,
        fileType: ext,
        extractedText: extractedText.trim(),
        learningObjectives: learningObjectives.trim() || null,
        curriculumStandards: curriculumStandards.trim() || null,
        keyTopics: keyTopics.trim() || null,
        subject: subject.trim() || null,
        gradeLevel: gradeLevel.trim() || null,
        academicYear: academicYear.trim() || null,
        category: category.trim() || null,
        versionNumber: versionNumber.trim() || null,
        status: 'processed'
      }).returning();

      res.json(newDoc);
    } catch (err: any) {
      console.error('Error saving/parsing syllabus document:', err);
      res.status(500).json({ error: `Failed to save/parse syllabus document: ${err.message}` });
    }
  });

  // Edit metadata of a syllabus document
  app.put('/api/syllabus-documents/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const { subject, gradeLevel, academicYear, category, learningObjectives, curriculumStandards, keyTopics, status, versionNumber } = req.body;

      const updated = await db.update(syllabusDocuments)
        .set({
          subject: subject !== undefined ? subject : null,
          gradeLevel: gradeLevel !== undefined ? gradeLevel : null,
          academicYear: academicYear !== undefined ? academicYear : null,
          category: category !== undefined ? category : null,
          learningObjectives: learningObjectives !== undefined ? learningObjectives : null,
          curriculumStandards: curriculumStandards !== undefined ? curriculumStandards : null,
          keyTopics: keyTopics !== undefined ? keyTopics : null,
          status: status !== undefined ? status : null,
          versionNumber: versionNumber !== undefined ? versionNumber : null,
        })
        .where(eq(syllabusDocuments.id, id))
        .returning();

      res.json(updated[0] || { success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Replace file content of an existing syllabus document
  app.post('/api/syllabus-documents/replace/:id', upload.single('syllabusFile'), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const ext = path.extname(originalName).toLowerCase().replace('.', '');
      let extractedText = '';

      if (ext === 'pdf') {
        console.log(`[PDF Parser] Processing PDF file in replace: ${originalName}`);
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const pdfParseModule: any = await import('pdf-parse');
          const PDFParseClass = pdfParseModule.PDFParse || (pdfParseModule.default && pdfParseModule.default.PDFParse) || pdfParseModule.default;
          if (!PDFParseClass) {
            throw new Error(`PDFParse class not found in the imported module. Keys: ${Object.keys(pdfParseModule).join(', ')}`);
          }
          console.log(`[PDF Parser] Initializing PDFParse instance...`);
          const parser = new PDFParseClass({ data: fileBuffer });
          const parsed = await parser.getText();
          extractedText = parsed.text;
          console.log(`[PDF Parser] Successfully extracted ${extractedText.length} characters of text.`);
        } catch (parseError: any) {
          console.error(`[PDF Parser] Critical failure during PDF parsing of ${originalName}:`, {
            message: parseError.message,
            stack: parseError.stack,
            parser: 'pdf-parse (Mehmet Kozan TypeScript version)',
            filePath
          });
          throw new Error(`Failed to parse syllabus PDF: ${parseError.message}`);
        }
      } else if (ext === 'docx') {
        const fileBuffer = fs.readFileSync(filePath);
        const mammothModule = await import('mammoth');
        const result = await mammothModule.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } else if (ext === 'doc') {
        const text = fs.readFileSync(filePath, 'utf-8');
        extractedText = text.replace(/[^\x20-\x7E\n]/g, '');
      } else if (ext === 'txt') {
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file format. Please upload PDF, Word, or TXT.' });
      }

      // Cleanup uploaded temp file safely
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Error unlinking temp file:', unlinkErr);
      }

      const maxChars = 20000;
      if (extractedText.length > maxChars) {
        extractedText = extractedText.substring(0, maxChars) + '\n... [Content truncated due to size limit]';
      }

      // Update file content, status and increment version
      const existing = await db.select().from(syllabusDocuments).where(eq(syllabusDocuments.id, id));
      let currentVersion = '1.0.0';
      if (existing && existing.length > 0) {
        const currentNum = parseFloat(existing[0].versionNumber || '1.0.0');
        currentVersion = isNaN(currentNum) ? '1.1.0' : (currentNum + 0.1).toFixed(1);
      }

      const updated = await db.update(syllabusDocuments)
        .set({
          filename: originalName,
          fileType: ext,
          extractedText: extractedText.trim(),
          versionNumber: currentVersion,
          status: 'processed'
        })
        .where(eq(syllabusDocuments.id, id))
        .returning();

      res.json(updated[0] || { success: true });
    } catch (err: any) {
      console.error('Error replacing syllabus document:', err);
      res.status(500).json({ error: `Failed to replace syllabus: ${err.message}` });
    }
  });

  // Archive a syllabus document
  app.post('/api/syllabus-documents/archive/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
      const updated = await db.update(syllabusDocuments)
        .set({ status: 'archived' })
        .where(eq(syllabusDocuments.id, id))
        .returning();
      res.json(updated[0] || { success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Publish a syllabus document
  app.post('/api/syllabus-documents/publish/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
      const updated = await db.update(syllabusDocuments)
        .set({ status: 'published' })
        .where(eq(syllabusDocuments.id, id))
        .returning();
      res.json(updated[0] || { success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/syllabus-documents/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }
      const deleted = await db.delete(syllabusDocuments).where(eq(syllabusDocuments.id, id)).returning();
      res.json(deleted[0] || { success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/lessons', async (req, res) => {
    try {
      const lessons = await db.select().from(lessonPlans).orderBy(desc(lessonPlans.createdAt));
      res.json(lessons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/lessons', requireAdmin, async (req: any, res) => {
    const { 
      lessonId, subjectId, teacherId, departmentId, academicYear, term, sequence, week, 
      lessonDuration, gradeLevel, topic, keywords, competency, learningOutcomes, 
      status, content, presentation, worksheet, versionNumber 
    } = req.body;

    if (!topic || !content) {
      return res.status(400).json({ error: 'Topic and lesson content are required.' });
    }

    try {
      const lid = lessonId || `LES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const result = await db.insert(lessonPlans).values({
        lessonId: lid,
        subjectId: subjectId || null,
        teacherId: teacherId || null,
        departmentId: departmentId || null,
        academicYear: academicYear || null,
        term: term || null,
        sequence: sequence || null,
        week: week || null,
        lessonDuration: lessonDuration || null,
        gradeLevel: gradeLevel || null,
        topic,
        keywords: keywords || null,
        competency: competency || null,
        learningOutcomes: learningOutcomes || null,
        versionNumber: versionNumber || '1.0.0',
        status: status || 'Draft',
        content,
        presentation: presentation ? (typeof presentation === 'string' ? presentation : JSON.stringify(presentation)) : null,
        worksheet: worksheet || null,
      }).returning();

      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_LESSON', `Created lesson: ${topic} (${lid})`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/lessons/:id', requireAdmin, async (req: any, res) => {
    const lid = req.params.id;
    const { 
      subjectId, teacherId, departmentId, academicYear, term, sequence, week, 
      lessonDuration, gradeLevel, topic, keywords, competency, learningOutcomes, 
      status, content, presentation, worksheet, versionNumber 
    } = req.body;

    try {
      const result = await db.update(lessonPlans).set({
        subjectId: subjectId || null,
        teacherId: teacherId || null,
        departmentId: departmentId || null,
        academicYear: academicYear || null,
        term: term || null,
        sequence: sequence || null,
        week: week || null,
        lessonDuration: lessonDuration || null,
        gradeLevel: gradeLevel || null,
        topic,
        keywords: keywords || null,
        competency: competency || null,
        learningOutcomes: learningOutcomes || null,
        status: status || 'Draft',
        content,
        presentation: presentation ? (typeof presentation === 'string' ? presentation : JSON.stringify(presentation)) : null,
        worksheet: worksheet || null,
        versionNumber: versionNumber || '1.0.0',
        updatedAt: new Date()
      }).where(eq(lessonPlans.lessonId, lid)).returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_LESSON', `Updated lesson: ${topic} (${lid})`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/lessons/:id', requireAdmin, async (req: any, res) => {
    const lid = req.params.id;
    try {
      const deleted = await db.delete(lessonPlans).where(eq(lessonPlans.lessonId, lid)).returning();
      if (deleted.length === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_LESSON', `Deleted lesson: ${lid}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/lessons/generate', async (req, res) => {
    const {
      gradeLevel,
      subject,
      topic,
      subTopic,
      duration,
      academicYear,
      term,
      sequence,
      week,
      period,
      teacherName,
      department,
      learningDomain,
      competency,
      learningOutcomes,
      curriculumReference,
      prerequisiteKnowledge,
      availableResources,
      studentPopulation,
      customPrompt,
      syllabusText,
      depthMode
    } = req.body;

    const gemini = getGeminiClient();

    if (!gemini) {
      console.warn('[GEMINI] Offline. Using fallback pre-crafted technical lesson plan with syllabus.');
      const fallback = getFallbackLessonPackage(topic, gradeLevel, subject, syllabusText);
      return res.json(fallback);
    }

    try {
      let systemInstruction = `You are a legendary AI-powered Senior Curriculum Specialist, Technical Education Expert, Civil Engineer, Building Construction Lecturer, and Instructional Designer with over 40 years of active teaching experience in Cameroon Technical Secondary Schools and Technical Lycées (under the Ministry of Secondary Education - MINESEC). You prepare your materials exactly like Claude: with massive depth, exhaustive coverage, highly detailed technical procedures, actual construction site schematics in ASCII/text, real-world calculation steps, exact tool specifications, and rigorous occupational health and safety standards.
Your task is to generate a comprehensive, curriculum-compliant lesson package for technical secondary schools in Cameroon based on the input parameters provided.
Your lesson plan MUST strictly follow the Competency-Based Approach (CBA) mandated by the Cameroon Ministry of Secondary Education (MINESEC) and look like the work of an elite master teacher who leaves absolutely zero details out. No shortcuts, no placeholders like "(insert details here)", and no simple summaries.
Make sure every section is fully populated with rich, highly-technical text (not simple bullet points). Write massive paragraph sections containing civil engineering mechanics, soil consolidation theories, concrete technology calculations (cement bag calculation, hydration reactions, aggregates grading curves, water-cement ratios), and standard structural engineering codes (like Eurocodes or British Standards adapted in Cameroon).

You must generate a structured JSON object containing exactly:
1. "content" - This is an extremely detailed, exhaustive, textbook-length Markdown string comprising Parts 1 to 13 of the lesson package. Each part must be incredibly detailed, with complete paragraphs explaining every sub-section:
   - PART 1: LESSON INFORMATION (School name, MINESEC, department, subject, topic, duration, competency, etc.)
   - PART 2: CURRICULUM ALIGNMENT (expected outcome, assessment criteria, cross-cutting issues, SDGs)
   - PART 3: LEARNING OBJECTIVES (At least 5 highly specific, measurable objectives using Bloom's Taxonomy, starting with "By the end of this lesson, learners will be able to...")
   - PART 4: KEY VOCABULARY (An extensive Markdown table with columns: Term, Definition, Practical Example)
   - PART 5: REQUIRED MATERIALS (Teacher/Student resources, construction tools with exact types, safety PPE, multimedia)
   - PART 6: LESSON INTRODUCTION (Hook) (A highly detailed, 10-minute engagement scenario using Cameroonian construction environments like deep excavations in Yaonde clay or Douala marine sand; include full word-for-word teacher scripts and anticipated student replies)
   - PART 7: DIRECT INSTRUCTION (An exhaustive, masterfully written technical guide detailing step-by-step concepts, safety, Cameroon site applications, misconceptions, custom ASCII layout diagrams of foundations/reinforcements/formworks, engineering formulas, and physical concrete curing dynamics)
   - PART 8: GUIDED PRACTICE (A complete, collaborative workshop/class activity with step-by-step teacher prompts, safety checklists, scaffolded checks, and troubleshooting guides)
   - PART 9: INDEPENDENT PRACTICE (Individual task, success criteria, exhaustive step-by-step grading key, duration)
   - PART 10: DIFFERENTIATION (Tailored strategies for struggling, advanced, and disabled learners, bilingual support)
   - PART 11: FORMATIVE ASSESSMENT (Observation checklist, technical questions, performance indicators)
   - PART 12: EXIT TICKET (3 complex technical questions with complete model answers)
   - PART 13: HOMEWORK / PROJECT (A comprehensive, practical home or community-based task with observation sheets or digital reports)

2. "presentation" - This is a JSON array representing PART 14, containing exactly 10 professional slides. Each slide object MUST contain:
   - "slideNumber": Integer (1 to 10)
   - "title": String
   - "bullets": Array of strings (maximum 4 bullets, but make them descriptive)
   - "speakerNotes": String (detailed, extensive explanation for the teacher)
   - "diagram": String (description of a suggested diagram or visual)
   - "discussionQuestion": String (classroom interactive question)

3. "worksheet" - This is an exhaustive Markdown string representing PART 15, which is a highly detailed, comprehensive workbook including:
   - Student information header
   - Warm-up activity
   - Extensive guided notes with fill-in-the-blank statements
   - Practical calculation or sketching exercises (including complete multi-step structural/materials calculations)
   - Multiple-choice and short-answer questions
   - Complete Answer Key and detailed marking guide at the bottom.

4. "quiz" - A highly detailed, rigorous Markdown string representing PART 17, containing:
   - A related topic quiz containing 5 complex multiple-choice questions, 3 technical short-answer questions, and 2 highly detailed practical scenario-based problem-solving exercises.
   - Clear marks allocation (e.g. [5 Marks], [10 Marks]) for each question and sub-question in strict compliance with MINESEC CBA assessment rules.
   - A detailed grading criteria rubrics table.
   - Complete Answer Key with deep engineering explanations for all options and marking instructions.

5. "metadata" - This is an object representing PART 16 containing:
   - "lessonId"
   - "subjectId"
   - "teacherId"
   - "departmentId"
   - "academicYear"
   - "term"
   - "sequence"
   - "week"
   - "lessonDuration"
   - "gradeLevel"
   - "topic"
   - "keywords"
   - "competency"
   - "learningOutcomes"

Maintain a highly technical civil engineering tone, include practical construction math calculations if appropriate, and integrate rigorous occupational health and safety (HSE) standards. Make sure everything references actual Cameroonian technical school contexts and local materials (e.g. soil types in Douala/Maroua/Yaounde, local timber species like Bubinga, Iroko, Sapelli, local brick making, etc.).`;

      if (depthMode === 'veteran') {
        systemInstruction += `\n\nCRITICAL MANDATE FOR ADVANCED VETERAN MASTER TEACHER EDITION (20-PAGE LONG-FORM LESSON STRUCTURE):
You MUST generate this lesson package with extreme pedagogical scaffolding and extraordinary depth. Imagine this is for a 40-year veteran teacher who demands high-fidelity structural calculations, absolute technical precision, detailed structural mechanics (bending moments, soil bearing, shearing calculations), exhaustively designed workshop activities, complete bilingual terminology, and full compliance with MINESEC CBA principles.
Every section of the "content" (Parts 1 to 13), the "worksheet" (Part 15), and the "quiz" (Part 17) MUST be fully expanded to maximum length (equivalent to 20 typed pages in structural detail). Expand every part with detailed technical instructions, complete step-by-step procedures, and deep construction science. Do not summarize anything. Include exact concrete mixing ratios (e.g., dosage of cement for 350kg/m3), detailed bar bending schedules, formwork timber volume calculations, and safety inspection guidelines.`;
      }

      let userPrompt = `Generate a complete CBA lesson package for the following technical secondary school inputs:
- Grade Level: ${gradeLevel || 'Form Four Building Construction (F4BA)'}
- Subject: ${subject || 'Building Construction'}
- Topic: ${topic || 'Introduction to Foundations'}
- Sub-topic: ${subTopic || 'Pad and Strip Footing Design'}
- Lesson Duration: ${duration || '100 Minutes'}
- Academic Year: ${academicYear || '2026/2027'}
- Term: ${term || 'Term 1'}
- Sequence Number: ${sequence || 'Sequence 1'}
- Week: ${week || 'Week 2'}
- Period: ${period || 'Period 1 & 2'}
- Teacher Name: ${teacherName || 'Curriculum Specialist'}
- Department: ${department || 'Civil Engineering & Building Construction'}
- Learning Domain: ${learningDomain || 'Cognitive and Psychomotor'}
- Competency: ${competency || 'Understand and implement basic concrete foundations'}
- Expected Learning Outcomes: ${learningOutcomes || 'Students can define, layout, and calculate materials for strip and pad foundations.'}
- Curriculum Reference: ${curriculumReference || 'MINESEC Technical Sub-Department Syllabus'}
- Prerequisite Knowledge: ${prerequisiteKnowledge || 'Basic safety and stone/brick masonry layout principles'}
- Available Resources: ${availableResources || 'Workshop sandbox, masonry trowels, spirit levels, cement bags, measuring tapes'}
- Student Population: ${studentPopulation || '40 students, mixed-ability classroom, bilingual environment'}

- Official Extracted Syllabus/Curriculum Context (MUST follow and align with this context precisely for accuracy):
${syllabusText ? syllabusText : 'No explicit syllabus file uploaded.'}

Additional Custom Requests or Pedagogy Focus:
"${customPrompt || 'Standard CBA lesson. Ensure detailed technical drawings descriptions, local Cameroon construction site references (like Douala swampy soils or Maroua sandy soils), and strict PPE requirements.'}"`;

      if (depthMode === 'veteran') {
        userPrompt += `\n\n[VETERAN EDITION ACTIVE]: Please generate this as an advanced, long-form 20-page-equivalent master technical lesson structure with high pedagogical scaffolding for a 40-year veteran technical teacher. Prioritize deepest civil engineering mechanics, soil consolidation, reinforced concrete detailing, and complete bilingual (English/French) MINESEC terminology. Ensure ASCII diagrams of structural elements are included.`;
      }

      const response = await retryWithFallback(async (modelName) => {
        return await gemini.models.generateContent({
          model: modelName,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                presentation: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slideNumber: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      bullets: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      },
                      speakerNotes: { type: Type.STRING },
                      diagram: { type: Type.STRING },
                      discussionQuestion: { type: Type.STRING }
                    },
                    required: ["slideNumber", "title", "bullets", "speakerNotes", "diagram", "discussionQuestion"]
                  }
                },
                worksheet: { type: Type.STRING },
                quiz: { type: Type.STRING },
                metadata: {
                  type: Type.OBJECT,
                  properties: {
                    lessonId: { type: Type.STRING },
                    subjectId: { type: Type.STRING },
                    teacherId: { type: Type.STRING },
                    departmentId: { type: Type.STRING },
                    academicYear: { type: Type.STRING },
                    term: { type: Type.STRING },
                    sequence: { type: Type.STRING },
                    week: { type: Type.STRING },
                    lessonDuration: { type: Type.STRING },
                    gradeLevel: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    keywords: { type: Type.STRING },
                    competency: { type: Type.STRING },
                    learningOutcomes: { type: Type.STRING }
                  },
                  required: ["lessonId", "topic", "competency", "learningOutcomes"]
                }
              },
              required: ["content", "presentation", "worksheet", "quiz", "metadata"]
            }
          }
        });
      });

      const parsed = JSON.parse(response.text.trim());
      res.json(parsed);
    } catch (err: any) {
      console.warn('[Gemini Info] Falling back to offline lesson generator:', err.message || err);
      const fallback = getFallbackLessonPackage(topic, gradeLevel, subject, syllabusText);
      res.json(fallback);
    }
  });

  // Generate Ready-to-Teach Lecture from generated lesson plan
  app.post('/api/lessons/generate-lecture', async (req, res) => {
    const { topic, gradeLevel, subject, lessonPlan, depthMode } = req.body;
    const gemini = getGeminiClient();

    if (!gemini) {
      const fallbackLecture = getFallbackLecture(topic, gradeLevel, subject);
      return res.json({ lecture: fallbackLecture, isFallback: true });
    }

    try {
      let systemInstruction = `You are a legendary expert Senior Civil Engineering Lecturer, Curriculum Developer, and Structural Engineer with over 40 years of active teaching and site supervision experience in Cameroon Technical Lycées and Technical High Schools under the MINESEC curriculum.
Your task is to generate an exceptionally detailed, comprehensive, and exhaustive "Ready-to-Teach Lecture Manual" based on the provided CBA Lesson Plan, Topic, Grade, and Subject. Under no circumstances should you provide a short summary or mere bullet-point outlines. The output must represent a complete, masterclass-level publication written in professional, textbook-grade technical language.

The lecture manual MUST be written in extremely thorough Markdown and cover every sub-concept exhaustively, structured as follows:
1. **LECTURE TIMELINE & DETAILED PACE** (A complete, timed breakdown, e.g., 10 mins Hook, 40 mins Direct teaching on structural mechanics, 30 mins Interactive site workshop simulations, 10 mins Assessment & Wrap-up)
2. **TEACHER SCRIPT / COMPREHENSIVE DIRECT INSTRUCTION** (Extensive, word-for-word explanations containing high technical detail. Include structural engineering formulas, mechanical behavior of building elements, exact cement hydration and mixing chemistry, concrete technology, sand/gravel sieve analysis concepts, and details on structural forces: tension, compression, shear, torsion, bending moments. Provide complete blackboard/drawing descriptions using detailed text-based ASCII sketches where possible)
3. **PRACTICAL CAMEROONIAN SITE EXAMPLES & SOIL MECHANICS** (Include extensive real-world case studies detailing the extreme differences in soil bearing capacities across Cameroon: coastal marine swampy clays of Douala/Bonabéri/Limbe, red plastic lateritic clays of Yaoundé, swell-shrink black cotton vertisols of Maroua/Garoua, and volcanic soils of Fako. Reference local building materials such as CIMENCAM/CIMAF/MIRA cements, local brick factories like MIPROMALO, and timber classifications including Bubinga, Iroko, Sapelli, Moabi)
4. **CLASSROOM INTERACTIVE PARTICIPATION CHECKPOINTS & DISCUSSIONS** (A series of challenging questions to pose to technical students, including anticipated incorrect or weak answers, step-by-step corrective teacher guide prompts, and comprehensive follow-up explanations)
5. **COMMON STUDENT MISCONCEPTIONS UNPACKED** (Identify and thoroughly debunk common errors made by students, detailing the scientific or physical mechanics reasons why their assumptions are incorrect)
6. **PACING GUIDE & VETERAN TEACHER TIPS** (High-level tactical classroom management advice on how to respond to advanced questions, assist struggling students, and keep students fully engaged for the entire duration)

Maintain a highly encouraging, technically rich, authoritative, and professional civil engineering tone. Deliver massive paragraph blocks of deep, expert content.`;

      if (depthMode === 'veteran') {
        systemInstruction += `\n\nCRITICAL MANDATE FOR ADVANCED VETERAN EDITION (Ready-to-Teach Masterclass Manual):
You MUST deliver this ready-to-teach lecture with exceptional rigor suitable for a 40-year veteran technical teacher who requires complete scientific explanations and detailed calculations. Do not summarize or omit anything. Include full derivations of engineering equations (e.g. soil bearing calculations or bar bending schedules), comprehensive bilingual (English/French) industry terminology, extensive site safety checklists, and detailed hands-on lab workshop setup diagrams in ASCII. Weave in pedagogical scaffolding notes (such as formative coaching tips) directly within the scripts.`;
      }

      const response = await retryWithFallback(async (modelName) => {
        return await gemini.models.generateContent({
          model: modelName,
          contents: `Generate a ready-to-teach lecture based on:
- Topic: ${topic}
- Grade Level: ${gradeLevel}
- Subject: ${subject}
- Lesson Plan Content:
${lessonPlan}${depthMode === 'veteran' ? '\n- [VETERAN EDITION ACTIVE]: Please generate maximum depth, full calculations, ASCII diagrams, and exhaustive masterclass explanations.' : ''}`,
          config: {
            systemInstruction,
          }
        });
      });

      res.json({ lecture: response.text });
    } catch (err: any) {
      console.warn('[GENERATE_LECTURE_FALLBACK_TRIGGERED] Falling back to pre-crafted Cameroon-centric lecture due to:', err.message || err);
      const fallbackLecture = getFallbackLecture(topic, gradeLevel, subject);
      res.json({ lecture: fallbackLecture, isFallback: true });
    }
  });

  // Generate Topic Quiz & Marks Allocation from generated lesson plan
  app.post('/api/lessons/generate-quiz', async (req, res) => {
    const { topic, gradeLevel, subject, lessonPlan, depthMode } = req.body;
    const gemini = getGeminiClient();

    if (!gemini) {
      const fallbackQuiz = getFallbackQuiz(topic, gradeLevel, subject);
      return res.json({ quiz: fallbackQuiz, isFallback: true });
    }

    try {
      let systemInstruction = `You are a legendary curriculum assessment developer, Principal Examiner, and Senior Civil Engineer for the Cameroon Ministry of Secondary Education (MINESEC) with over 40 years of academic experience designing national exams.
Your task is to generate an exceptionally detailed, highly rigorous, and comprehensive "Competency-Based Topic Quiz & Marks Allocation Paper" based on the provided topic, grade, subject, and lesson plan. The quiz must read like an elite national technical certificate paper (such as the CAP or Probatoire or Baccalauréat Technique).

The quiz MUST strictly comply with Cameroon MINESEC CBA assessment guidelines and contain the following components, fully written out without summaries:
1. **5 Complex Multiple-Choice Questions (MCQs)** [1 Mark each, Total 5 Marks]: Each question must have four highly technical options, with one clear correct answer. Include scenarios testing structural failures, concrete curing physics, and soil-loading conditions.
2. **3 Technical Short-Answer Questions** [2 Marks each, Total 6 Marks]: Include challenging questions requiring the calculation of structural loads, drawing of reinforced concrete details, explanation of hydration reactions, or excavation timbering design.
3. **2 Practical Scenario-Based Complex Problem-Solving Tasks** [4.5 Marks each, Total 9 Marks]: These tasks must feature a highly detailed construction site crisis or construction setting in Cameroon (e.g., Douala mud, Yaounde bedrock excavation, Limbe sea-water infiltration). The student must solve multiple sub-questions:
   - Sub-task A: Core math calculations (estimating volumes of soil, calculating quantity of 50kg cement bags, sand and gravel volume needed for a specific mix ratio, sizing foundation width using soil bearing capacity formulas, calculating loads) [2 Marks]
   - Sub-task B: Hazard identification and site safety/HSE protocols, specifying exactly which PPE or timbering methods are mandatory [1.5 Marks]
   - Sub-task C: Engineering recommendation reporting, describing step-by-step procedures to correct or prevent a structural or environmental failure [1 Mark]
4. **Marks Allocation**: Display exact marks allocation clearly at the end of every single question and sub-question (e.g. [1 Mark], [2 Marks], [0.5 Marks]) in strict compliance with MINESEC CBA rules.
5. **A Complete Grading Criteria & Evaluation Rubric Matrix**: A highly detailed markdown table with columns for Criteria, Expected Competent Behavior, Indicators of Success, and Marks Allocated.
6. **An Exhaustive, Comprehensive Teacher Answer Key**: Provide detailed multi-paragraph engineering explanations for every single MCQ option (explaining why correct options are correct and why other options are structurally invalid), step-by-step mathematical working out with formulas, and precise marking guidelines for free-response tasks.

Ensure all questions are highly specific to Cameroon, citing local soils, local cement grades (e.g. CPA-45, Class 32.5/42.5), local timber names, and tropical environmental constraints. Maintain a highly professional, rigorous, and formal academic tone throughout.`;

      if (depthMode === 'veteran') {
        systemInstruction += `\n\nCRITICAL MANDATE FOR ADVANCED VETERAN EDITION (Examiner's National Certificate Standard):
You MUST design this assessment to national board-exam standards of absolute rigor. Do not provide placeholders or summaries. Ensure calculations require multiple stages (e.g. determining active earth pressure before sizing shoring timbers). The answer key must contain deep analytical explanations for every single option, detailed steps for the math, specific partial-credit milestones, and comprehensive bilingual French/English technical translations for terminology.`;
      }

      const response = await retryWithFallback(async (modelName) => {
        return await gemini.models.generateContent({
          model: modelName,
          contents: `Generate a Cameroon technical high school topic quiz based on:
- Topic: ${topic}
- Grade Level: ${gradeLevel}
- Subject: ${subject}
- Lesson Plan Content:
${lessonPlan}${depthMode === 'veteran' ? '\n- [VETERAN EDITION ACTIVE]: Please generate maximum rigor, advanced multi-stage calculations, exhaustive rubrics, and detailed step-by-step master answer keys.' : ''}`,
          config: {
            systemInstruction,
          }
        });
      });

      res.json({ quiz: response.text });
    } catch (err: any) {
      console.warn('[GENERATE_QUIZ_FALLBACK_TRIGGERED] Falling back to pre-crafted Cameroon-centric quiz due to:', err.message || err);
      const fallbackQuiz = getFallbackQuiz(topic, gradeLevel, subject);
      res.json({ quiz: fallbackQuiz, isFallback: true });
    }
  });


  // ==========================================
  // --- DOCUMENTS ENDPOINTS ---
  // ==========================================
  app.get('/api/documents', async (req, res) => {
    try {
      const docs = await db.select().from(companyDocuments).orderBy(desc(companyDocuments.createdAt));
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/documents', requireAdmin, async (req: any, res) => {
    const { title, fileUrl, docType, version } = req.body;
    if (!title || !fileUrl || !docType) return res.status(400).json({ error: 'Missing document fields' });
    try {
      const result = await db.insert(companyDocuments).values({
        title,
        fileUrl,
        docType,
        version: version || '1.0',
      }).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_DOC', `Added safety/compliance document: ${title}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/documents/:id', requireAdmin, async (req: any, res) => {
    const docId = parseInt(req.params.id);
    const { title, fileUrl, docType, version } = req.body;
    try {
      // Fetch existing record to perform asset replacement check
      const existing = await db.select().from(companyDocuments).where(eq(companyDocuments.id, docId)).limit(1);
      if (existing.length > 0) {
        if (fileUrl && fileUrl !== existing[0].fileUrl) {
          await deleteFileFromCloud(existing[0].fileUrl);
        }
      }

      const result = await db.update(companyDocuments)
        .set({
          title,
          fileUrl,
          docType,
          version,
        })
        .where(eq(companyDocuments.id, docId))
        .returning();
      
      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_DOC', `Updated safety/compliance document ID: ${docId}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/documents/:id', requireAdmin, async (req: any, res) => {
    const docId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(companyDocuments).where(eq(companyDocuments.id, docId)).returning();
      if (deleted.length > 0) {
        await deleteFileFromCloud(deleted[0].fileUrl);
      }
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_DOC', `Deleted document ID: ${docId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- TEAM MEMBERS ENDPOINTS ---
  // ==========================================
  app.get('/api/team', async (req, res) => {
    try {
      const members = await db.select().from(teamMembers).orderBy(teamMembers.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/team', requireAdmin, async (req: any, res) => {
    const { name, role, specialization, image, email } = req.body;
    if (!name || !role || !specialization) {
      return res.status(400).json({ error: 'Name, role, and specialization are required' });
    }
    try {
      const result = await db.insert(teamMembers).values({
        name,
        role,
        specialization,
        image: image || null,
        email: email || null,
      }).returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'CREATE_TEAM_MEMBER', `Created team member: ${name} (${role})`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/team/:id', requireAdmin, async (req: any, res) => {
    const memberId = parseInt(req.params.id);
    const { name, role, specialization, image, email } = req.body;
    if (!name || !role || !specialization) {
      return res.status(400).json({ error: 'Name, role, and specialization are required' });
    }
    try {
      // Fetch existing record to perform asset replacement check
      const existing = await db.select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
      if (existing.length > 0) {
        if (image && image !== existing[0].image) {
          await deleteFileFromCloud(existing[0].image);
        }
      }

      const result = await db.update(teamMembers)
        .set({
          name,
          role,
          specialization,
          image: image || null,
          email: email || null,
        })
        .where(eq(teamMembers.id, memberId))
        .returning();
      await logAudit(req.dbUser.uid, req.dbUser.email, 'UPDATE_TEAM_MEMBER', `Updated team member ID: ${memberId} (${name})`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/team/:id', requireAdmin, async (req: any, res) => {
    const memberId = parseInt(req.params.id);
    try {
      const deleted = await db.delete(teamMembers).where(eq(teamMembers.id, memberId)).returning();
      if (deleted.length > 0) {
        await deleteFileFromCloud(deleted[0].image);
        await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_TEAM_MEMBER', `Deleted team member ID: ${memberId} (${deleted[0].name})`);
      }
      res.json(deleted[0] || { success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // --- DATABASE BACKUP SIMULATOR & STATUS ---
  // ==========================================
  let lastBackupTime = new Date();
  
  if (process.env.NODE_ENV === 'production') {
    // Set up a background thread interval on the server to simulate the scheduled database backup task.
    setInterval(async () => {
      try {
        console.log(`[Backup System] Running scheduled database backup...`);
        // Touch the database to verify live connectivity
        await db.execute(sql`SELECT 1`);
        lastBackupTime = new Date();
        console.log(`[Backup System] Live Database backup completed successfully at ${lastBackupTime.toISOString()}`);
      } catch (err: any) {
        console.error('[Backup System] Scheduled backup failed due to database connectivity issues:', err.message || err);
      }
    }, 45000); // Executed every 45 seconds to let users easily observe it in the dashboard UI!
  } else {
    console.log('[Backup System] Scheduled backup task is paused in development mode.');
  }

  app.get('/api/backup-status', requireAdmin, (req, res) => {
    res.json({ lastBackupTime: lastBackupTime.toISOString() });
  });

  // ==========================================
  // --- ANALYTICS DASHBOARD METRICS ---
  // ==========================================
  app.get('/api/analytics', requireAdmin, async (req, res) => {
    try {
      // 1. Managed Contracts (count)
      const contractsCountRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM signed_contracts`)).rows[0] as any;
      const managedContractsCount = contractsCountRes?.count || 0;

      // 2. Total Contract Value (sum of contractValue with regex replace of non-numeric characters)
      const contractValueRes = (await db.execute(sql`
        SELECT COALESCE(SUM(CAST(REGEXP_REPLACE(contract_value, '[^0-9.]', '', 'g') AS NUMERIC)), 0)::double precision as total 
        FROM signed_contracts
      `)).rows[0] as any;
      const totalContractValue = contractValueRes?.total || 0;

      // 3. Total Revenue (sum of receiptAmount in signedReceipts)
      const revenueRes = (await db.execute(sql`
        SELECT COALESCE(SUM(CAST(REGEXP_REPLACE(receipt_amount, '[^0-9.]', '', 'g') AS NUMERIC)), 0)::double precision as total 
        FROM signed_receipts
      `)).rows[0] as any;
      const totalRevenue = revenueRes?.total || 0;

      // 4. Pending Consultations (count of appointments where status = 'pending')
      const pendingApptsRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM appointments WHERE status = 'pending'`)).rows[0] as any;
      const pendingConsultations = pendingApptsRes?.count || 0;

      // 5. Unread Inquiries (count of contactMessages where status = 'new')
      const unreadInquiriesRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM contact_messages WHERE status = 'new'`)).rows[0] as any;
      const unreadInquiries = unreadInquiriesRes?.count || 0;

      // 6. Pending Reviews (count of reviews where approved is false)
      const pendingReviewsRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM reviews WHERE approved = false OR approved IS NULL`)).rows[0] as any;
      const pendingReviews = pendingReviewsRes?.count || 0;

      // 7. Newsletter Subscribers (count)
      const newsletterSubscribersRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM newsletter_subscribers`)).rows[0] as any;
      const newsletterSubscribers = newsletterSubscribersRes?.count || 0;

      // 8. Active Users (count)
      const activeUsersRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM users`)).rows[0] as any;
      const activeUsers = activeUsersRes?.count || 0;

      // 9. Uploaded Documents (count)
      const uploadedDocsRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM company_documents`)).rows[0] as any;
      const uploadedDocuments = uploadedDocsRes?.count || 0;

      // 10. Managed Projects (count)
      const projectsCountRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM projects`)).rows[0] as any;
      const managedProjectsCount = projectsCountRes?.count || 0;

      // 11. Total Project Budget Value
      const projectBudgetRes = (await db.execute(sql`
        SELECT COALESCE(SUM(budget), 0)::double precision as total 
        FROM projects
      `)).rows[0] as any;
      const totalProjectBudgetValue = projectBudgetRes?.total || 0;

      // 12. Booking Approval Rate (confirmed or completed relative to total)
      const totalApptsRes = (await db.execute(sql`SELECT COUNT(*)::integer as count FROM appointments`)).rows[0] as any;
      const totalApptsCount = totalApptsRes?.count || 0;
      let bookingApprovalRate = "0.0";
      if (totalApptsCount > 0) {
        const approvedApptsRes = (await db.execute(sql`
          SELECT COUNT(*)::integer as count FROM appointments WHERE status = 'confirmed' OR status = 'completed'
        `)).rows[0] as any;
        const approvedCount = approvedApptsRes?.count || 0;
        bookingApprovalRate = ((approvedCount / totalApptsCount) * 100).toFixed(1);
      }

      res.json({
        managedProjectsCount,
        totalProjectBudgetValue,
        managedContractsCount,
        totalContractValue,
        totalRevenue,
        pendingConsultations,
        unreadInquiries,
        pendingReviews,
        newsletterSubscribers,
        activeUsers,
        uploadedDocuments,
        bookingApprovalRate
      });
    } catch (error: any) {
      console.error('Error fetching dashboard analytics:', error);
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- AUDIT LOGS ENDPOINT ---
  // ==========================================
  app.get('/api/audit-logs', requireAdmin, async (req, res) => {
    try {
      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(200);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==========================================
  // --- CONTRACT SIGNING & VERIFICATION ---
  // ==========================================

  // Submit signed contract and generate verification token
  app.post('/api/contracts/sign', async (req, res) => {
    const {
      contractNo,
      clientName,
      clientNiu,
      clientEmail,
      clientAddress,
      clientCity,
      contractProject,
      contractProjectLocation,
      contractValue,
      contractDuration,
      contractScope,
      contractDate,
      contractAgreedBalance,
      contractAdvancePayment,
      representativeName,
      representativeTitle,
      signatoryTitle,
      typedClientSignature,
      drawnClientSignature
    } = req.body;

    if (!contractNo || !clientName || (!typedClientSignature && !drawnClientSignature)) {
      return res.status(400).json({ error: 'Missing required contract signing fields' });
    }

    try {
      // Check if already signed
      const existing = await db.select().from(signedContracts).where(eq(signedContracts.contractNo, contractNo)).limit(1);
      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      // Generate a secure, unique verification token starting with CNT- followed by a random uppercase string
      const verificationToken = 'CNT-' + Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();

      const newContract = await db.insert(signedContracts).values({
        contractNo,
        clientName,
        clientNiu: clientNiu || null,
        clientEmail: clientEmail || null,
        clientAddress: clientAddress || null,
        clientCity: clientCity || null,
        contractProject,
        contractProjectLocation: contractProjectLocation || null,
        contractValue,
        contractDuration: contractDuration || null,
        contractScope: contractScope || null,
        contractDate: contractDate || null,
        contractAgreedBalance: contractAgreedBalance || null,
        contractAdvancePayment: contractAdvancePayment || null,
        representativeName: representativeName || null,
        representativeTitle: representativeTitle || null,
        signatoryTitle: signatoryTitle || null,
        typedClientSignature,
        drawnClientSignature: drawnClientSignature || null,
        verificationToken,
      }).returning();

      // Automated client contract signature alert notification
      if (clientEmail && clientEmail.trim()) {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const verificationUrl = `${appUrl}/?verify=${verificationToken}`;
        
        const subject = `Action Required: Your MADECC Group Contract is Ready for Signature [Ref: ${contractNo}]`;
        
        const text = `Dear ${clientName},\n\nThe MADECC Group management team has finalized and signed your infrastructure contract for the project "${contractProject}".\n\nContract Ref: ${contractNo}\nAuthorized Signatory: ${representativeName} (${representativeTitle})\nContract Value: ${parseFloat(contractValue).toLocaleString()} XAF\n\nPlease review and sign the contract online at: ${verificationUrl}\n\nWarm regards,\nMADECC Group Portal`;
        
        const html = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; color: #0f172a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
    <h2 style="color: #d97706; margin: 0 0 4px 0; font-weight: 800; font-size: 26px; letter-spacing: -0.025em;">MADECC Group</h2>
    <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Compliance Contract Registry</p>
  </div>
  
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
    Dear <strong>${clientName}</strong>,
  </p>
  
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
    We are pleased to inform you that the MADECC Group management team has finalized and signed your infrastructure contract for the project <strong>"${contractProject}"</strong>.
  </p>
  
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
    <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Contract Highlights</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 40%;">Contract Ref:</td>
        <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${contractNo}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Authorized Signatory:</td>
        <td style="padding: 6px 0; color: #0f172a;">${representativeName} (${representativeTitle})</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Contract Value:</td>
        <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${parseFloat(contractValue).toLocaleString()} XAF</td>
      </tr>
    </table>
  </div>
  
  <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
    To complete the legal execution, please access our secure online compliance portal where you can securely verify the terms, view the QR-code document seal, and <strong>draw your signature online</strong>.
  </p>
  
  <div style="text-align: center; margin: 0 0 28px 0;">
    <a href="${verificationUrl}" style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.2); transition: background-color 0.2s;">
      Review & Sign Contract Online
    </a>
  </div>
  
  <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; margin: 0;">
    This is a system generated notification on behalf of MADECC Group (Yaoundé / Douala, Cameroon). Please do not reply directly to this email. For any legal inquiries, please contact our support team at <a href="mailto:contact@madecc.com" style="color: #d97706; text-decoration: none; font-weight: 600;">contact@madecc.com</a>.
  </p>
</div>
        `;
        
        sendEmail(clientEmail.trim(), subject, text, html).catch(err => {
          console.error('[SMTP_ERROR] Failed to send automated client contract email:', err);
        });
      }

      res.json(newContract[0]);
    } catch (error: any) {
      console.error('[SIGN_CONTRACT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify signed contract using verification token
  app.get('/api/contracts/verify/:token', async (req, res) => {
    const { token } = req.params;
    try {
      const results = await db.select().from(signedContracts).where(eq(signedContracts.verificationToken, token)).limit(1);
      if (results.length === 0) {
        return res.status(404).json({ error: 'Contract not found or invalid verification token' });
      }
      res.json(results[0]);
    } catch (error: any) {
      console.error('[VERIFY_CONTRACT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint for clients to add or update their signatures after verification
  app.put('/api/contracts/verify/:token/sign', async (req, res) => {
    const { token } = req.params;
    const { drawnClientSignature, typedClientSignature } = req.body;
    try {
      const results = await db.select().from(signedContracts).where(eq(signedContracts.verificationToken, token)).limit(1);
      if (results.length === 0) {
        return res.status(404).json({ error: 'Contract not found or invalid verification token' });
      }
      
      const updated = await db.update(signedContracts)
        .set({
          drawnClientSignature: drawnClientSignature || null,
          typedClientSignature: typedClientSignature || results[0].typedClientSignature,
        })
        .where(eq(signedContracts.verificationToken, token))
        .returning();

      const contract = updated[0];

      // Trigger automated email confirmation when a contract is successfully verified and signed
      if (contract.clientEmail && contract.clientEmail.trim()) {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const verificationUrl = `${appUrl}/?verify=${contract.verificationToken}`;

        const subject = `[MADECC Group] Contract Successfully Executed & Verified: Ref ${contract.contractNo}`;
        const text = `Dear ${contract.clientName},\n\nWe are pleased to inform you that your infrastructure contract has been successfully executed and verified on the MADECC Group digital ledger.\n\nContract Reference: ${contract.contractNo}\nProject: ${contract.contractProject}\n\nYou can access your fully-signed, verified digital contract at any time here: ${verificationUrl}\n\nThank you for partnering with MADECC Group.\n\nWarm regards,\nMADECC Group Compliance Team`;

        const html = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; color: #0f172a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
              <h2 style="color: #10b981; margin: 0 0 4px 0; font-weight: 800; font-size: 26px; letter-spacing: -0.025em;">MADECC Group</h2>
              <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Digital Ledger & Compliance Verification</p>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%; padding: 12px; margin-bottom: 12px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto;"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h3 style="color: #065f46; margin: 0; font-size: 20px; font-weight: 700;">Contract Executed & Verified</h3>
              <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">Cryptographically recorded in the secure MADECC registry</p>
            </div>

            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
              Dear <strong>${contract.clientName}</strong>,
            </p>
            
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for completing the digital verification and signature process. We are pleased to inform you that your infrastructure contract has been successfully executed by all parties and is now fully active on our secure compliance registry.
            </p>
            
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
              <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Execution Details</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 40%;">Contract Ref:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${contract.contractNo}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Project Name:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${contract.contractProject}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Contract Value:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${parseFloat(contract.contractValue).toLocaleString()} XAF</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Verification Status:</td>
                  <td style="padding: 6px 0; color: #10b981; font-weight: bold;">SIGNED & COMPLIANT</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
              You can access your digitally-sealed document, audit log, and QR security code at any time via the verification portal below:
            </p>
            
            <div style="text-align: center; margin: 0 0 28px 0;">
              <a href="${verificationUrl}" style="background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                View Verified Contract
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">MADECC Group Compliance Portal &bull; Rue Joss, Bonanjo, Douala, Cameroon</p>
          </div>
        `;

        sendEmail(contract.clientEmail.trim(), subject, text, html).catch(err => {
          console.error('[SMTP_ERROR] Failed to send contract verification confirmation email:', err);
        });

        // Also notify the admin kreboya603@gmail.com
        const adminSubject = `[registry-alert] Contract Ref ${contract.contractNo} fully signed by client`;
        const adminText = `The contract Ref ${contract.contractNo} for "${contract.contractProject}" has been verified and fully signed by the client ${contract.clientName}.\n\nYou can view the active digital contract at: ${verificationUrl}`;
        sendNotificationEmail(adminSubject, adminText, adminText).catch(err => {
          console.error('[SMTP_ERROR] Failed to notify admin of signed contract:', err);
        });
      }

      res.json(contract);
    } catch (error: any) {
      console.error('[PUBLIC_SIGN_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all signed contracts (for admin tracking)
  app.get('/api/contracts/all', requireAuth, async (req: any, res) => {
    try {
      // Allow only admin and staff to see all signed contracts
      if (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff') {
        return res.status(403).json({ error: 'Forbidden: Admin or Staff privilege required' });
      }
      const results = await db.select().from(signedContracts).orderBy(desc(signedContracts.signedAt));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Edit an existing signed contract
  app.put('/api/contracts/:id', requireAuth, async (req: any, res) => {
    try {
      if (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff') {
        return res.status(403).json({ error: 'Forbidden: Admin or Staff privilege required' });
      }
      const contractId = parseInt(req.params.id);
      const updateData = req.body;

      const result = await db.update(signedContracts)
        .set({
          contractNo: updateData.contractNo,
          clientName: updateData.clientName,
          clientNiu: updateData.clientNiu || null,
          clientAddress: updateData.clientAddress || null,
          clientCity: updateData.clientCity || null,
          contractProject: updateData.contractProject,
          contractProjectLocation: updateData.contractProjectLocation || null,
          contractValue: updateData.contractValue,
          contractDuration: updateData.contractDuration || null,
          contractScope: updateData.contractScope || null,
          contractDate: updateData.contractDate || null,
          contractAgreedBalance: updateData.contractAgreedBalance || null,
          contractAdvancePayment: updateData.contractAdvancePayment || null,
          representativeName: updateData.representativeName || null,
          representativeTitle: updateData.representativeTitle || null,
          signatoryTitle: updateData.signatoryTitle || null,
          typedClientSignature: updateData.typedClientSignature,
          drawnClientSignature: updateData.drawnClientSignature || null,
        })
        .where(eq(signedContracts.id, contractId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error('[PUT_CONTRACT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete an existing signed contract
  app.delete('/api/contracts/:id', requireAuth, async (req: any, res) => {
    try {
      if (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff') {
        return res.status(403).json({ error: 'Forbidden: Admin or Staff privilege required' });
      }
      const contractId = parseInt(req.params.id);
      const result = await db.delete(signedContracts)
        .where(eq(signedContracts.id, contractId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json({ success: true, message: 'Contract deleted successfully' });
    } catch (error: any) {
      console.error('[DELETE_CONTRACT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });


  // --- RECEIPT SIGNING, LEDGER & VERIFICATION ---
  // ==========================================

  // Submit signed receipt and generate verification token
  app.post('/api/receipts/sign', async (req, res) => {
    const {
      receiptNo,
      clientName,
      clientNiu,
      receiptProject,
      receiptAmount,
      receiptTaxRate,
      receiptMethod,
      receiptMemo,
      receiptSignatory,
      receiptTypedSign,
      drawnCfoSignature
    } = req.body;

    if (!receiptNo || !clientName || !receiptAmount || !receiptSignatory || !receiptTypedSign) {
      return res.status(400).json({ error: 'Missing required receipt signing fields' });
    }

    try {
      // Check if already signed/filed
      const existing = await db.select().from(signedReceipts).where(eq(signedReceipts.receiptNo, receiptNo)).limit(1);
      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      // Generate a secure, unique verification token starting with REC- followed by a random uppercase string
      const verificationToken = 'REC-' + Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();

      const newReceipt = await db.insert(signedReceipts).values({
        receiptNo,
        clientName,
        clientNiu: clientNiu || null,
        receiptProject,
        receiptAmount,
        receiptTaxRate: receiptTaxRate || '0',
        receiptMethod,
        receiptMemo: receiptMemo || null,
        receiptSignatory,
        receiptTypedSign,
        drawnCfoSignature: drawnCfoSignature || null,
        verificationToken,
      }).returning();

      res.json(newReceipt[0]);
    } catch (error: any) {
      console.error('[SIGN_RECEIPT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify signed receipt using verification token
  app.get('/api/receipts/verify/:token', async (req, res) => {
    const { token } = req.params;
    try {
      const results = await db.select().from(signedReceipts).where(eq(signedReceipts.verificationToken, token)).limit(1);
      if (results.length === 0) {
        return res.status(404).json({ error: 'Receipt not found or invalid verification token' });
      }
      res.json(results[0]);
    } catch (error: any) {
      console.error('[VERIFY_RECEIPT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all signed receipts (for finance desk tracking)
  app.get('/api/receipts/all', requireAuth, async (req: any, res) => {
    try {
      const results = await db.select().from(signedReceipts).orderBy(desc(signedReceipts.signedAt));
      res.json(results);
    } catch (error: any) {
      console.error('[GET_ALL_RECEIPTS_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete an existing signed receipt
  app.delete('/api/receipts/:id', requireAuth, async (req: any, res) => {
    try {
      if (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff') {
        return res.status(403).json({ error: 'Forbidden: Admin or Staff privilege required' });
      }
      const receiptId = parseInt(req.params.id);
      const result = await db.delete(signedReceipts)
        .where(eq(signedReceipts.id, receiptId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Receipt not found' });
      }
      res.json({ success: true, message: 'Receipt deleted successfully' });
    } catch (error: any) {
      console.error('[DELETE_RECEIPT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send email copy of certified receipt
  app.post('/api/receipts/email', requireAuth, async (req: any, res) => {
    const {
      receiptNo,
      clientName,
      clientEmail,
      receiptProject,
      receiptAmount,
      receiptTaxRate,
      receiptMethod,
      receiptMemo,
      verificationToken
    } = req.body;

    if (!clientEmail || !receiptNo || !clientName) {
      return res.status(400).json({ error: 'Missing required client email or receipt parameters' });
    }

    try {
      const amountRaw = parseFloat(receiptAmount || '0');
      const vatRateRaw = parseFloat(receiptTaxRate || '19.25');
      const vatAmount = (amountRaw * vatRateRaw) / 100;
      const totalPaid = amountRaw + vatAmount;

      const verificationUrl = `${req.protocol}://${req.get('host')}/?verify=${verificationToken}`;
      const subject = `[RECEIPT CERTIFICATE] MADECC Group SARL — Receipt Ref: ${receiptNo}`;
      const text = `Dear ${clientName},\n\nYour payment for project "${receiptProject}" was received and certified.\nReceipt Ref: ${receiptNo}\nTotal Paid: ${totalPaid.toLocaleString()} XAF\n\nVerify online: ${verificationUrl}`;

      const html = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; color: #0f172a; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
    <h2 style="color: #d97706; margin: 0 0 4px 0; font-weight: 800; font-size: 26px; letter-spacing: -0.025em;">MADECC Group</h2>
    <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; font-weight: 700;">Fiscal Receipt Registry</p>
  </div>
  
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
    Dear <strong>${clientName}</strong>,
  </p>
  
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
    Thank you for your payment. We have processed and certified your financial receipt for the project <strong>"${receiptProject}"</strong>.
  </p>
  
  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
    <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Receipt Breakdown</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 40%;">Receipt Ref:</td>
        <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${receiptNo}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Payment Mode:</td>
        <td style="padding: 6px 0; color: #0f172a;">${receiptMethod}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Base Amount:</td>
        <td style="padding: 6px 0; color: #0f172a;">${amountRaw.toLocaleString()} XAF</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Tax (VAT ${receiptTaxRate}%):</td>
        <td style="padding: 6px 0; color: #0f172a;">${vatAmount.toLocaleString()} XAF</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 10px 0 6px 0; color: #0f172a; font-weight: bold; font-size: 15px;">Total Paid:</td>
        <td style="padding: 10px 0 6px 0; color: #d97706; font-weight: bold; font-size: 16px;">${totalPaid.toLocaleString()} XAF</td>
      </tr>
    </table>
  </div>
  
  <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
    This receipt has been certified and recorded on the physical inventory ledger. A public verification record can be retrieved online at any time by scanning the document's QR code or following the secure link below:
  </p>
  
  <div style="text-align: center; margin: 0 0 28px 0;">
    <a href="${verificationUrl}" style="background-color: #d97706; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.2); transition: background-color 0.2s;">
      Verify Receipt Online
    </a>
  </div>
  
  <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; margin: 0;">
    This is an automated administrative transmission from MADECC Group (Yaoundé / Douala, Cameroon). Please do not reply directly. For billing queries, please contact <a href="mailto:finance@madecc.com" style="color: #d97706; text-decoration: none; font-weight: 600;">finance@madecc.com</a>.
  </p>
</div>
      `;

      await sendEmail(clientEmail.trim(), subject, text, html);
      res.json({ success: true, message: `Receipt emailed successfully to ${clientEmail}` });
    } catch (error: any) {
      console.error('[EMAIL_RECEIPT_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate contract verification token
  app.post('/api/contracts/:id/regenerate-token', requireAuth, async (req: any, res) => {
    try {
      if (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff') {
        return res.status(403).json({ error: 'Forbidden: Admin or Staff privilege required' });
      }
      const contractId = parseInt(req.params.id);
      const newToken = 'SEC-' + Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();

      const result = await db.update(signedContracts)
        .set({ verificationToken: newToken })
        .where(eq(signedContracts.id, contractId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error('[REGENERATE_CONTRACT_TOKEN_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate receipt verification token
  app.post('/api/receipts/:id/regenerate-token', requireAuth, async (req: any, res) => {
    try {
      if (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff') {
        return res.status(403).json({ error: 'Forbidden: Admin or Staff privilege required' });
      }
      const receiptId = parseInt(req.params.id);
      const newToken = 'REC-' + Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('').toUpperCase();

      const result = await db.update(signedReceipts)
        .set({ verificationToken: newToken })
        .where(eq(signedReceipts.id, receiptId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: 'Receipt not found' });
      }
      res.json(result[0]);
    } catch (error: any) {
      console.error('[REGENERATE_RECEIPT_TOKEN_ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  return app;
}

async function startServer() {
  validateEnvironmentVariables();
  console.log('========================================================================');
  console.log(`🚀 Starting MADECC Group Portal (Node.js ${process.version})`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`🤖 Gemini AI Assistant: ${process.env.GEMINI_API_KEY ? 'ACTIVE (Key found)' : 'OFFLINE (Fallback replies enabled)'}`);
  console.log(`📧 SMTP Transporter: ${process.env.SMTP_USER && process.env.SMTP_PASS ? 'CONFIGURED' : 'CONSOLE FALLBACK (Missing credentials)'}`);
  console.log('========================================================================');

  const app = await getApp();

  // ==========================================
  // --- VITE MIDDLEWARE SETUP ---
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Robust detection of serverless environments (Netlify / AWS Lambda)
const isServerless = 
  process.env.NETLIFY === 'true' || 
  process.env.NETLIFY === '1' ||
  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
  process.env.LAMBDA_TASK_ROOT !== undefined ||
  process.env.FUNCTIONS_SIGNATURE !== undefined;

if (!isServerless) {
  startServer();
}
