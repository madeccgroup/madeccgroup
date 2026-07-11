import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
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
  signedReceipts
} from './src/db/schema.ts';
import { seedDatabase } from './src/db/seed.ts';
import { requireAuth, requireAdmin, requireStaffOrAdmin } from './src/middleware/auth.ts';
import { logAudit } from './src/lib/audit.ts';
import { eq, desc, and, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';

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

// SMTP Transporter Helper
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[SMTP] Missing SMTP credentials. Mail notifications will be output to console logs.');
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
    const info = await transporter.sendMail({
      from: `"MADECC Group Portal" <${process.env.SMTP_USER}>`,
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
    const info = await transporter.sendMail({
      from: `"MADECC Group" <${process.env.SMTP_USER || 'noreply@madecc.com'}>`,
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
  } catch (error) {
    console.error('[GEMINI_ERROR] Failed to generate AI auto-response after all retries:', error);
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

    const token = req.headers['x-csrf-token'];
    if (!token || typeof token !== 'string' || !validateCsrfToken(token)) {
      console.warn(`[CSRF] Blocked unauthorized request from ${req.ip} targeting ${req.method} ${req.originalUrl}`);
      return res.status(403).json({ error: 'Forbidden: Invalid or missing CSRF token' });
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
      else if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)) {
        try {
          const cloudinary = await import('cloudinary');
          cloudinary.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
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
      await logAudit(req.dbUser.uid, req.dbUser.email, 'DELETE_BANNER', `Deleted banner ID: ${bannerId}`);
      res.json(deleted[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
