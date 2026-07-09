// src/services/database.ts

import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class DatabaseService {
  // ==========================================
  // 1. User Account Operations
  // ==========================================
  static async getOrCreateUser(uid: string, email: string, name: string) {
    try {
      return await prisma.user.upsert({
        where: { uid },
        update: { email, name },
        create: { uid, email, name, role: 'client' },
      });
    } catch (error) {
      console.error('[DATABASE_SERVICE_ERROR] Failed getOrCreateUser:', error);
      throw new Error('Database transaction failed on profile synchronization');
    }
  }

  static async updateUserRole(id: number, role: string) {
    return prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  // ==========================================
  // 2. Project Management Operations
  // ==========================================
  static async getProjects(categoryId?: number) {
    return prisma.project.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: {
        category: true,
        progress: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getProjectDetails(id: number) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        category: true,
        progress: {
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  static async createProject(data: {
    title: string;
    description: string;
    budget?: number;
    location: string;
    startDate?: Date;
    endDate?: Date;
    categoryId?: number;
    image: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          title: data.title,
          description: data.description,
          budget: data.budget ? new Prisma.Decimal(data.budget) : null,
          location: data.location,
          startDate: data.startDate,
          endDate: data.endDate,
          image: data.image,
          categoryId: data.categoryId,
        },
      });

      // Default Initialization Milestone
      await tx.projectProgress.create({
        data: {
          projectId: project.id,
          milestoneName: 'Project Commissioned',
          percentage: 0,
          description: 'Project records registered into administration database.',
          status: 'completed',
        },
      });

      return project;
    });
  }

  static async updateProject(id: number, data: Partial<Prisma.ProjectUpdateInput>) {
    return prisma.project.update({
      where: { id },
      data,
    });
  }

  static async deleteProject(id: number) {
    return prisma.project.delete({
      where: { id },
    });
  }

  static async addProjectMilestone(data: {
    projectId: number;
    milestoneName: string;
    percentage: number;
    description: string;
    status: string;
  }) {
    return prisma.projectProgress.create({
      data,
    });
  }

  // ==========================================
  // 3. Document Administration
  // ==========================================
  static async getDocuments(docType?: string) {
    return prisma.companyDocument.findMany({
      where: docType ? { docType } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async uploadDocument(data: { title: string; fileUrl: string; docType: string; version?: string }) {
    return prisma.companyDocument.create({
      data,
    });
  }

  // ==========================================
  // 4. Client Communication Operations
  // ==========================================
  static async createAppointment(data: {
    clientName: string;
    clientEmail: string;
    serviceName: string;
    appointmentDate: Date;
    notes?: string;
  }) {
    return prisma.appointment.create({
      data,
    });
  }

  static async getAppointments() {
    return prisma.appointment.findMany({
      orderBy: { appointmentDate: 'desc' },
    });
  }

  static async updateAppointmentStatus(id: number, status: string) {
    return prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }

  // ==========================================
  // 5. Audit Logging Interface
  // ==========================================
  static async writeAuditLog(userId: string | null, userEmail: string | null, action: string, details: string) {
    return prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        action,
        details,
      },
    });
  }
}
