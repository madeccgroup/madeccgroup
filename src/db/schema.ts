import { pgTable, serial, text, timestamp, integer, boolean, numeric, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users table (Admin, Staff, Clients)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('client'), // admin, staff, client
  theme: text('theme').notNull().default('dark'), // dark, light
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
  invoiceTotalAmount: text('invoice_total_amount'),
  receiptAmount: text('receipt_amount').notNull(),
  remainingBalance: text('remaining_balance'),
  receiptTaxRate: text('receipt_tax_rate'),
  receiptMethod: text('receipt_method').notNull(),
  receiptMemo: text('receipt_memo'),
  receiptSignatory: text('receipt_signatory').notNull(),
  receiptTypedSign: text('receipt_typed_sign').notNull(),
  drawnCfoSignature: text('drawn_cfo_signature'),
  verificationToken: text('verification_token').notNull().unique(),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
});

// 18. User sync data (replaces localStorage persistence for themes, proposals, cvs, Cover letters, compliance ledger overrides, kyc etc.)
export const userSyncData = pgTable('user_sync_data', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(), // Firebase Auth UID
  key: text('key').notNull(), // 'theme', 'madecc_career_cvs', 'madecc_career_letters', 'madecc_aoa_statuses', 'madecc_shareholders_directors', 'madecc_proposals_db'
  value: text('value').notNull(), // JSON payload string
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 19. Cameroon Technical School Lesson Plans table
export const lessonPlans = pgTable('lesson_plans', {
  id: serial('id').primaryKey(),
  lessonId: text('lesson_id').notNull().unique(),
  subjectId: text('subject_id'),
  teacherId: text('teacher_id'),
  departmentId: text('department_id'),
  academicYear: text('academic_year'),
  term: text('term'),
  sequence: text('sequence'),
  week: text('week'),
  lessonDuration: text('lesson_duration'),
  gradeLevel: text('grade_level'),
  topic: text('topic').notNull(),
  keywords: text('keywords'),
  competency: text('competency'),
  learningOutcomes: text('learning_outcomes'),
  versionNumber: text('version_number').default('1.0.0').notNull(),
  status: text('status').default('Draft').notNull(), // 'Draft' | 'Review' | 'Published'
  content: text('content').notNull(), // Full Markdown or rich JSON content representing Parts 1-13
  presentation: text('presentation'), // JSON string representing Part 14 PPT
  worksheet: text('worksheet'), // JSON or Markdown representing Part 15 Student Worksheet
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 20. Syllabus Documents table for metadata storage and automatic alignment
export const syllabusDocuments = pgTable('syllabus_documents', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(), // 'pdf', 'docx', 'doc', 'txt'
  extractedText: text('extracted_text').notNull(),
  learningObjectives: text('learning_objectives'),
  curriculumStandards: text('curriculum_standards'),
  keyTopics: text('key_topics'),
  subject: text('subject'),
  gradeLevel: text('grade_level'),
  academicYear: text('academic_year'),
  category: text('category'),
  versionNumber: text('version_number').default('1.0.0'),
  status: text('status').default('processed').notNull(), // 'processing' | 'processed' | 'error' | 'archived' | 'published'
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// 21. BOQs table
export const boqs = pgTable('boqs', {
  id: serial('id').primaryKey(),
  boqReference: text('boq_reference').notNull().unique(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: text('project_name').notNull(),
  clientId: integer('client_id').references(() => users.id, { onDelete: 'set null' }),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email'),
  clientNiu: text('client_niu'),
  clientAddress: text('client_address'),
  location: text('location').notNull(),
  description: text('description'),
  datePrepared: timestamp('date_prepared').defaultNow().notNull(),
  preparedBy: text('prepared_by').notNull(),
  revisionNumber: text('revision_number').default('REV-00').notNull(),
  currency: text('currency').default('XAF').notNull(),
  status: text('status').default('DRAFT').notNull(), // DRAFT, PENDING_REVIEW, APPROVED, REJECTED, ARCHIVED
  overheadPercent: numeric('overhead_percent').default('0').notNull(),
  contingencyPercent: numeric('contingency_percent').default('0').notNull(),
  profitPercent: numeric('profit_percent').default('0').notNull(),
  taxPercent: numeric('tax_percent').default('0').notNull(),
  subtotal: numeric('subtotal').default('0').notNull(),
  overheadAmount: numeric('overhead_amount').default('0').notNull(),
  contingencyAmount: numeric('contingency_amount').default('0').notNull(),
  profitAmount: numeric('profit_amount').default('0').notNull(),
  taxAmount: numeric('tax_amount').default('0').notNull(),
  grandTotal: numeric('grand_total').default('0').notNull(),
  pdfUrl: text('pdf_url'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  sentToClientAt: timestamp('sent_to_client_at'),
  sentToClientBy: text('sent_to_client_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 22. BOQ Sections table
export const boqSections = pgTable('boq_sections', {
  id: serial('id').primaryKey(),
  boqId: integer('boq_id').references(() => boqs.id, { onDelete: 'cascade' }).notNull(),
  sectionCode: text('section_code').notNull(),
  title: text('title').notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  subtotal: numeric('subtotal').default('0').notNull(),
});

// 23. BOQ Line Items table
export const boqItems = pgTable('boq_items', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id').references(() => boqSections.id, { onDelete: 'cascade' }).notNull(),
  boqId: integer('boq_id').references(() => boqs.id, { onDelete: 'cascade' }).notNull(),
  itemNumber: text('item_number').notNull(),
  description: text('description').notNull(),
  unit: text('unit').notNull(),
  quantity: numeric('quantity').default('0').notNull(),
  unitRate: numeric('unit_rate').default('0').notNull(),
  amount: numeric('amount').default('0').notNull(),
  notes: text('notes'),
  measurementBasis: text('measurement_basis'),
  internalMaterialCost: numeric('internal_material_cost').default('0').notNull(),
  internalLabourCost: numeric('internal_labour_cost').default('0').notNull(),
  internalPlantCost: numeric('internal_plant_cost').default('0').notNull(),
  internalOtherCost: numeric('internal_other_cost').default('0').notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
});

// 24. BOQ Revisions table
export const boqRevisions = pgTable('boq_revisions', {
  id: serial('id').primaryKey(),
  boqId: integer('boq_id').references(() => boqs.id, { onDelete: 'cascade' }).notNull(),
  revisionNumber: text('revision_number').notNull(),
  snapshotData: text('snapshot_data').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at').defaultNow().notNull(),
  pdfUrl: text('pdf_url'),
  notes: text('notes'),
});

// 25. BOQ Audit Logs table
export const boqAuditLogs = pgTable('boq_audit_logs', {
  id: serial('id').primaryKey(),
  boqId: integer('boq_id').references(() => boqs.id, { onDelete: 'cascade' }).notNull(),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  details: text('details').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Additional Relations
export const structuralProjects = pgTable('structural_projects', {
  id: serial('id').primaryKey(),
  projectCode: text('project_code').notNull(),
  projectName: text('project_name').notNull(),
  clientName: text('client_name').notNull(),
  clientEmail: text('client_email'),
  location: text('location').notNull(),
  preparedBy: text('prepared_by').notNull(),
  status: text('status').default('DRAFT').notNull(),
  designInputs: json('design_inputs'),
  drawings: json('drawings'),
  detectedElements: json('detected_elements'),
  calculationsResult: json('calculations_result'),
  revisionNumber: text('revision_number').default('REV-01').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const boqsRelations = relations(boqs, ({ one, many }) => ({
  project: one(projects, {
    fields: [boqs.projectId],
    references: [projects.id],
  }),
  client: one(users, {
    fields: [boqs.clientId],
    references: [users.id],
  }),
  sections: many(boqSections),
  items: many(boqItems),
  revisions: many(boqRevisions),
  auditLogs: many(boqAuditLogs),
}));

export const boqSectionsRelations = relations(boqSections, ({ one, many }) => ({
  boq: one(boqs, {
    fields: [boqSections.boqId],
    references: [boqs.id],
  }),
  items: many(boqItems),
}));

export const boqItemsRelations = relations(boqItems, ({ one }) => ({
  section: one(boqSections, {
    fields: [boqItems.sectionId],
    references: [boqSections.id],
  }),
  boq: one(boqs, {
    fields: [boqItems.boqId],
    references: [boqs.id],
  }),
}));


