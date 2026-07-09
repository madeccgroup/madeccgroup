// prisma/seed-migration.ts

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function migrateLegacyData() {
  console.log('🔄 Starting seed data migration strategy...');

  // 1. Locate and parse legacy JSON databases
  const legacyDataPath = path.join(process.cwd(), 'data/legacy-backup.json');
  if (!fs.existsSync(legacyDataPath)) {
    console.warn('⚠️ No backup JSON database file detected. Proceeding with static defaults.');
    return;
  }

  const legacyData = JSON.parse(fs.readFileSync(legacyDataPath, 'utf-8'));

  try {
    await prisma.$transaction(async (tx) => {
      // Migrate Core Categories
      if (legacyData.categories) {
        for (const cat of legacyData.categories) {
          await tx.category.upsert({
            where: { slug: cat.slug },
            update: { name: cat.name },
            create: { id: cat.id, name: cat.name, slug: cat.slug },
          });
        }
        console.log('✅ Categories migration completed.');
      }

      // Migrate Projects and preserve correct IDs (resetting sequences afterwards)
      if (legacyData.projects) {
        for (const proj of legacyData.projects) {
          await tx.project.upsert({
            where: { id: proj.id },
            update: {
              title: proj.title,
              description: proj.description,
              budget: proj.budget ? new Prisma.Decimal(proj.budget) : null,
              location: proj.location,
              status: proj.status,
              image: proj.image,
            },
            create: {
              id: proj.id,
              title: proj.title,
              description: proj.description,
              budget: proj.budget ? new Prisma.Decimal(proj.budget) : null,
              location: proj.location,
              status: proj.status,
              categoryId: proj.categoryId,
              image: proj.image,
              startDate: proj.startDate ? new Date(proj.startDate) : null,
              endDate: proj.endDate ? new Date(proj.endDate) : null,
            },
          });
        }
        console.log('✅ Projects database migration completed.');
      }
    });

    // 2. Adjust database autoincrement pools to avoid primary key duplicates on new inserts
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(max(id), 1) + 1, false) FROM categories;`;
    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE(max(id), 1) + 1, false) FROM projects;`;
    console.log('⚡ Autoincrement sequence ranges successfully adjusted.');

  } catch (error) {
    console.error('❌ Data migration failed. Changes rolled back.', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateLegacyData();
