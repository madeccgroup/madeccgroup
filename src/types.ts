export interface User {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'client';
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  budget: string | null;
  location: string;
  startDate: string | null;
  endDate: string | null;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  categoryId: number | null;
  image: string;
  videoUrl?: string | null;
  createdAt: string;
  progress?: ProjectProgress[];
}

export interface ProjectProgress {
  id: number;
  projectId: number;
  milestoneName: string;
  percentage: number;
  date: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
}

export interface BlogPost {
  id: number;
  title: string;
  content: string;
  authorId: number | null;
  publishedAt: string;
  image: string;
  videoUrl?: string | null;
  summary: string;
  category: string;
}

export interface Review {
  id: number;
  authorName: string;
  rating: number;
  text: string;
  approved: boolean;
  approvedAt: string | null;
  projectName: string | null;
  createdAt: string;
}

export interface Appointment {
  id: number;
  clientName: string;
  clientEmail: string;
  serviceName: string;
  appointmentDate: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  createdAt: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  status: 'subscribed' | 'unsubscribed';
  createdAt: string;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  icon: string;
  priceRange: string | null;
  details: string | null;
}

export interface GalleryItem {
  id: number;
  title: string;
  imageUrl: string;
  videoUrl?: string | null;
  category: string;
  createdAt: string;
}

export interface HeroBanner {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  videoUrl?: string | null;
  displayOrder: number;
  active: boolean;
}

export interface CompanyDocument {
  id: number;
  title: string;
  fileUrl: string;
  docType: string;
  version: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId: string | null;
  userEmail: string | null;
  action: string;
  details: string;
  timestamp: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  specialization: string;
  image: string | null;
  email: string | null;
  createdAt: string;
}

export interface SignedContract {
  id: number;
  contractNo: string;
  clientName: string;
  clientNiu: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  clientCity: string | null;
  contractProject: string;
  contractProjectLocation: string | null;
  contractValue: string;
  contractDuration: string | null;
  contractScope: string | null;
  contractDate: string | null;
  contractAgreedBalance: string | null;
  contractAdvancePayment: string | null;
  representativeName: string | null;
  representativeTitle: string | null;
  signatoryTitle: string | null;
  typedClientSignature: string;
  drawnClientSignature: string | null;
  verificationToken: string;
  signedAt: string;
}

export interface SignedReceipt {
  id: number;
  receiptNo: string;
  clientName: string;
  clientNiu: string | null;
  receiptProject: string;
  receiptAmount: string;
  receiptTaxRate: string;
  receiptMethod: string;
  receiptMemo: string | null;
  receiptSignatory: string;
  receiptTypedSign: string;
  drawnCfoSignature: string | null;
  verificationToken: string;
  signedAt: string;
}

