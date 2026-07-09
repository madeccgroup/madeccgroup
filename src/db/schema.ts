import { pgTable, serial, text, timestamp, integer, boolean, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users table (Admin, Staff, Clients)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('client'), // admin, staff, client
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
});

// 3. Projects table
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  budget: numeric('budget'),
  location: text('location').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: text('status').notNull().default('planning'), // planning, in-progress, completed, on-hold
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }),
  image: text('image').notNull(),
  videoUrl: text('video_url'), // Optional 150MB SEO Video Url
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. ProjectProgress table (milestones)
export const projectProgress = pgTable('project_progress', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  milestoneName: text('milestone_name').notNull(),
  percentage: integer('percentage').notNull().default(0),
  date: timestamp('date').notNull().defaultNow(),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'), // pending, active, completed
});

// 5. BlogPosts table
export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
  image: text('image').notNull(),
  videoUrl: text('video_url'), // Optional 150MB SEO Video Url
  summary: text('summary').notNull(),
  category: text('category').notNull(),
});

// 6. Reviews table (with approval system)
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  authorName: text('author_name').notNull(),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  approved: boolean('approved').notNull().default(false),
  approvedAt: timestamp('approved_at'),
  projectName: text('project_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Appointments table
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email').notNull(),
  serviceName: text('service_name').notNull(),
  appointmentDate: timestamp('appointment_date').notNull(),
  status: text('status').notNull().default('pending'), // pending, confirmed, cancelled, completed
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. ContactMessages table
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('new'), // new, read, replied
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. NewsletterSubscribers table
export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  status: text('status').notNull().default('subscribed'), // subscribed, unsubscribed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Services table
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  priceRange: text('price_range'),
  details: text('details'), // JSON list of bullet features, represented as raw text here
});

// 11. GalleryItems table
export const galleryItems = pgTable('gallery_items', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  imageUrl: text('image_url').notNull(),
  videoUrl: text('video_url'), // Optional 150MB SEO Video Url
  category: text('category').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. HeroBanners table
export const heroBanners = pgTable('hero_banners', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  imageUrl: text('image_url').notNull(),
  videoUrl: text('video_url'),
  displayOrder: integer('display_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

// 13. CompanyDocuments table
export const companyDocuments = pgTable('company_documents', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  docType: text('doc_type').notNull(), // safety_policy, certification, quote_template, general
  version: text('version').notNull().default('1.0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. AuditLogs table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id'), // Firebase Auth UID
  userEmail: text('user_email'),
  action: text('action').notNull(), // e.g., 'CREATE_PROJECT', 'APPROVE_REVIEW'
  details: text('details').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// 15. TeamMembers table
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // e.g., "Director", "Lead Architect", "Project Coordinator"
  specialization: text('specialization').notNull(), // e.g., "Civil Engineering", "Geotechnical Analysis"
  image: text('image'), // Photo URL
  email: text('email'), // Contact email
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


// Relationships definitions
export const usersRelations = relations(users, ({ many }) => ({
  blogPosts: many(blogPosts),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  category: one(categories, {
    fields: [projects.categoryId],
    references: [categories.id],
  }),
  progress: many(projectProgress),
}));

export const projectProgressRelations = relations(projectProgress, ({ one }) => ({
  project: one(projects, {
    fields: [projectProgress.projectId],
    references: [projects.id],
  }),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

// 16. Signed Contracts table for QR verification
export const signedContracts = pgTable('signed_contracts', {
  id: serial('id').primaryKey(),
  contractNo: text('contract_no').notNull().unique(),
  clientName: text('client_name').notNull(),
  clientNiu: text('client_niu'),
  clientEmail: text('client_email'),
  clientAddress: text('client_address'),
  clientCity: text('client_city'),
  contractProject: text('contract_project').notNull(),
  contractProjectLocation: text('contract_project_location'),
  contractValue: text('contract_value').notNull(),
  contractDuration: text('contract_duration'),
  contractScope: text('contract_scope'),
  contractDate: text('contract_date'),
  contractAgreedBalance: text('contract_agreed_balance'),
  contractAdvancePayment: text('contract_advance_payment'),
  representativeName: text('representative_name'),
  representativeTitle: text('representative_title'),
  signatoryTitle: text('signatory_title'),
  typedClientSignature: text('typed_client_signature').notNull(),
  drawnClientSignature: text('drawn_client_signature'),
  verificationToken: text('verification_token').notNull().unique(),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
});

// 17. Signed Receipts table for QR and BAR code verification
export const signedReceipts = pgTable('signed_receipts', {
  id: serial('id').primaryKey(),
  receiptNo: text('receipt_no').notNull().unique(),
  clientName: text('client_name').notNull(),
  clientNiu: text('client_niu'),
  receiptProject: text('receipt_project').notNull(),
  receiptAmount: text('receipt_amount').notNull(),
  receiptTaxRate: text('receipt_tax_rate'),
  receiptMethod: text('receipt_method').notNull(),
  receiptMemo: text('receipt_memo'),
  receiptSignatory: text('receipt_signatory').notNull(),
  receiptTypedSign: text('receipt_typed_sign').notNull(),
  drawnCfoSignature: text('drawn_cfo_signature'),
  verificationToken: text('verification_token').notNull().unique(),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
});
