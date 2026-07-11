import { db } from './index.ts';
import { 
  categories, 
  services, 
  projects, 
  projectProgress, 
  heroBanners, 
  blogPosts, 
  reviews, 
  galleryItems,
  users,
  signedContracts,
  teamMembers
} from './schema.ts';
import { eq, sql } from 'drizzle-orm';

export async function seedDatabase() {
  try {
    console.log('--- Starting Database Seeding Check ---');

    // Check if database connection is healthy first
    try {
      await db.execute(sql`SELECT 1`);
    } catch (connErr: any) {
      console.error('========================================================================');
      console.error('DATABASE CONNECTIVITY ERROR: Unable to connect to the database.');
      console.error('Please verify your DATABASE_URL environment variable is correct and');
      console.error('the database server is running.');
      console.error('Error Details:', connErr.message || connErr);
      console.error('========================================================================');
      return; // Exit gracefully instead of crashing
    }

    // Seeding specific contract for live verification testing
    console.log('Seeding specific contract CNT-0ZS6BJ8EF5I9QJ4ASHMZ for verification...');
    const existingContract = await db.select().from(signedContracts).where(eq(signedContracts.verificationToken, 'CNT-0ZS6BJ8EF5I9QJ4ASHMZ')).limit(1);
    if (existingContract.length === 0) {
      await db.insert(signedContracts).values({
        contractNo: 'MADECC-2026-LA-089',
        clientName: 'Jean-Pierre Belinga',
        clientNiu: 'M052614923184J',
        clientAddress: 'Bonanjo Boulevard',
        clientCity: 'Douala',
        contractProject: 'MADECC Eco-HQ Tower',
        contractProjectLocation: 'Douala, Littoral Region, Cameroon',
        contractValue: '2200000',
        contractDuration: '6 Months',
        contractScope: 'Foundation works\nBlockwork / Partitions\nReinforcements / Adjustments\nStaircase construction\nStructural masonry\nPlastering & Septic Tank',
        contractDate: 'July 5, 2026',
        contractAgreedBalance: '2200000',
        contractAdvancePayment: '1000000',
        representativeName: 'Dr. Marcel Mbida',
        representativeTitle: 'Managing Director',
        signatoryTitle: 'Client Legal Representative',
        typedClientSignature: 'Jean-Pierre Belinga',
        verificationToken: 'CNT-0ZS6BJ8EF5I9QJ4ASHMZ',
      });
      console.log('Successfully seeded verification key: CNT-0ZS6BJ8EF5I9QJ4ASHMZ');
    }

    // 1. Check if we already have categories seeded
    const categoryCountResult = await db.select({ count: sql<number>`count(*)` }).from(categories);
    const categoryCount = Number(categoryCountResult[0]?.count || 0);

    if (categoryCount > 0) {
      console.log('Database already has data. Running Cameroon localization on existing records...');
      try {
        await db.execute(sql`
          UPDATE projects 
          SET title = 'MADECC Eco-HQ Tower', 
              location = 'Rue Joss, Bonanjo, Douala, Cameroon', 
              budget = '14700000000',
              description = 'A cutting-edge 6-story commercial office tower in Douala featuring green facades, solar roofs, and zero-carbon building design adapted for tropical climates.'
          WHERE title LIKE '%Eco-HQ%' OR location LIKE '%London%';
        `);
        await db.execute(sql`
          UPDATE projects 
          SET title = 'Kribi Beachfront Luxury Estates', 
              location = 'Kribi, South Region, Cameroon', 
              budget = '8500000000',
              description = 'A collection of twelve premium custom-built net-zero smart homes nestled near the gorgeous sandy beaches of Kribi.'
          WHERE title LIKE '%Oakridge%' OR title LIKE '%Surrey%' OR location LIKE '%Surrey%';
        `);
        await db.execute(sql`
          UPDATE projects 
          SET title = 'The Sanaga Bridge Corridor', 
              location = 'Eda, Littoral Region, Cameroon', 
              budget = '43200000000',
              description = 'A vital civil infrastructure expansion spanning 2.4 kilometers of double-lane structural freeway and reinforced arch bridge across the Sanaga River.'
          WHERE title LIKE '%Viaduct%' OR title LIKE '%Devon%' OR location LIKE '%Devon%';
        `);
        await db.execute(sql`
          UPDATE projects 
          SET title = 'Douala Port Logistics Terminal', 
              location = 'Douala Port Area, Cameroon', 
              budget = '22800000000',
              description = 'Massive, highly-efficient industrial shipping terminal and distribution warehouse designed for autonomous logistics in Central Africa.'
          WHERE title LIKE '%Logistics Terminal%' OR location LIKE '%Manchester%';
        `);

        // Update services
        await db.execute(sql`
          UPDATE services 
          SET price_range = '30,000,000 - 6,000,000,000 FCFA'
          WHERE name = 'General Contracting';
        `);
        await db.execute(sql`
          UPDATE services 
          SET price_range = '3,000,000 - 300,000,000 FCFA'
          WHERE name = 'Architectural & Interior Design';
        `);
        await db.execute(sql`
          UPDATE services 
          SET price_range = '300,000,000 - 30,000,000,000 FCFA'
          WHERE name = 'Civil Infrastructure Planning';
        `);
        await db.execute(sql`
          UPDATE services 
          SET price_range = '60,000,000 - 12,000,000,000 FCFA'
          WHERE name = 'Green & Sustainable Building';
        `);

        // Update user contacts
        await db.execute(sql`
          UPDATE users
          SET email = 'madeccco5@gmail.com'
          WHERE email = 'info@madecc.com';
        `);
      } catch (err) {
        console.warn('Could not run existing record migration:', err);
      }
      return;
    }

    console.log('Database is empty. Seeding initial production data...');

    // 2. Seed Categories
    console.log('Seeding categories...');
    const insertedCategories = await db.insert(categories).values([
      { name: 'Residential Construction', slug: 'residential' },
      { name: 'Commercial Development', slug: 'commercial' },
      { name: 'Infrastructure & Civil', slug: 'infrastructure' },
      { name: 'Industrial & Warehouses', slug: 'industrial' },
    ]).returning();

    const catResidential = insertedCategories.find(c => c.slug === 'residential')?.id;
    const catCommercial = insertedCategories.find(c => c.slug === 'commercial')?.id;
    const catInfrastructure = insertedCategories.find(c => c.slug === 'infrastructure')?.id;
    const catIndustrial = insertedCategories.find(c => c.slug === 'industrial')?.id;

    // 3. Seed Services
    console.log('Seeding services...');
    await db.insert(services).values([
      {
        name: 'General Contracting',
        description: 'Comprehensive management of construction operations from groundbreaking to handover.',
        icon: 'HardHat',
        priceRange: '30,000,000 - 6,000,000,000 FCFA',
        details: 'Full site management, safety compliance, subcontractor coordination, material procurement, quality assurance.'
      },
      {
        name: 'Architectural & Interior Design',
        description: 'Creating innovative, functional, and visually striking residential and commercial designs.',
        icon: 'DraftingCompass',
        priceRange: '3,000,000 - 300,000,000 FCFA',
        details: 'Concept drafting, 3D building modeling (BIM), material selection, space optimization, local permit support.'
      },
      {
        name: 'Civil Infrastructure Planning',
        description: 'Large-scale civil projects including bridges, structural frameworks, highways, and transport hubs.',
        icon: 'Bridge',
        priceRange: '300,000,000 - 30,000,000,000 FCFA',
        details: 'Geotechnical surveys, environmental impact reporting, structural engineering, high-stress concrete work.'
      },
      {
        name: 'Green & Sustainable Building',
        description: 'Eco-conscious design and construction focused on energy efficiency and certified standards.',
        icon: 'Leaf',
        priceRange: '60,000,000 - 12,000,000,000 FCFA',
        details: 'LEED certification assistance, solar integration, geothermal HVAC setups, recycled building materials.'
      },
    ]);

    // 4. Seed Projects
    console.log('Seeding projects...');
    const insertedProjects = await db.insert(projects).values([
      {
        title: 'MADECC Eco-HQ Tower',
        description: 'A cutting-edge 6-story commercial office tower in Douala featuring green facades, solar roofs, and zero-carbon building design adapted for tropical climates.',
        budget: '14700000000',
        location: 'Rue Joss, Bonanjo, Douala, Cameroon',
        startDate: new Date('2025-01-10'),
        endDate: new Date('2026-12-15'),
        status: 'in-progress',
        categoryId: catCommercial,
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
      },
      {
        title: 'Kribi Beachfront Luxury Estates',
        description: 'A collection of twelve premium custom-built net-zero smart homes nestled near the gorgeous sandy beaches of Kribi.',
        budget: '8500000000',
        location: 'Kribi, South Region, Cameroon',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2025-09-30'),
        status: 'in-progress',
        categoryId: catResidential,
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      },
      {
        title: 'The Sanaga Bridge Corridor',
        description: 'A vital civil infrastructure expansion spanning 2.4 kilometers of double-lane structural freeway and reinforced arch bridge across the Sanaga River.',
        budget: '43200000000',
        location: 'Eda, Littoral Region, Cameroon',
        startDate: new Date('2023-06-15'),
        endDate: new Date('2025-05-10'),
        status: 'completed',
        categoryId: catInfrastructure,
        image: 'https://images.unsplash.com/photo-1545558014-868cfc47e053?auto=format&fit=crop&w=800&q=80',
      },
      {
        title: 'Douala Port Logistics Terminal',
        description: 'Massive, highly-efficient industrial shipping terminal and distribution warehouse designed for autonomous logistics in Central Africa.',
        budget: '22800000000',
        location: 'Douala Port Area, Cameroon',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2026-06-30'),
        status: 'planning',
        categoryId: catIndustrial,
        image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
      }
    ]).returning();

    const projEcoHQ = insertedProjects.find(p => p.title.includes('Eco-HQ'))?.id;
    const projOakridge = insertedProjects.find(p => p.title.includes('Kribi'))?.id;
    const projDevon = insertedProjects.find(p => p.title.includes('Sanaga'))?.id;

    // 5. Seed Project Progress (Milestones)
    console.log('Seeding project milestones...');
    if (projEcoHQ) {
      await db.insert(projectProgress).values([
        { projectId: projEcoHQ, milestoneName: 'Site Planning & Permits', percentage: 100, status: 'completed', description: 'Environmental impact surveys and commercial blueprints approved by Douala Council.' },
        { projectId: projEcoHQ, milestoneName: 'Foundation & Excavation', percentage: 100, status: 'completed', description: 'Deep excavation and pouring of smart-sensored foundation piles complete.' },
        { projectId: projEcoHQ, milestoneName: 'Steel Structure Framing', percentage: 100, status: 'completed', description: 'Core steel framework raised and certified by structural safety board.' },
        { projectId: projEcoHQ, milestoneName: 'Glass Facade & Cladding', percentage: 40, status: 'active', description: 'Double-glazed high insulation photovoltaic window panes currently being installed.' },
        { projectId: projEcoHQ, milestoneName: 'Interior HVAC & Handover', percentage: 0, status: 'pending', description: 'Installation of green energy grid and client sign-off.' },
      ]);
    }

    if (projOakridge) {
      await db.insert(projectProgress).values([
        { projectId: projOakridge, milestoneName: 'Land Clearing & Grading', percentage: 100, status: 'completed', description: 'Cleared individual plots and established access roadways.' },
        { projectId: projOakridge, milestoneName: 'Foundations & Utilities', percentage: 100, status: 'completed', description: 'High durability floor slabs poured with integrated underfloor cooling lines.' },
        { projectId: projOakridge, milestoneName: 'Structure Construction', percentage: 100, status: 'completed', description: 'Sustainable structures assembled for all 12 units.' },
        { projectId: projOakridge, milestoneName: 'Roofing & Solar Panels', percentage: 80, status: 'active', description: 'Installing smart roof shingles and high-capacity battery units.' },
        { projectId: projOakridge, milestoneName: 'Fittings, Landscaping & Handover', percentage: 15, status: 'pending', description: 'Premium kitchen fittings, smart home hubs, and perimeter landscaping.' },
      ]);
    }

    if (projDevon) {
      await db.insert(projectProgress).values([
        { projectId: projDevon, milestoneName: 'Geotechnical Soil Testing', percentage: 100, status: 'completed', description: 'Tested riverbed soil density and seismic resilience.' },
        { projectId: projDevon, milestoneName: 'Arch Support Concrete Pours', percentage: 100, status: 'completed', description: 'Finished massive pre-stressed arch supports.' },
        { projectId: projDevon, milestoneName: 'Deck Slab Cable Installation', percentage: 100, status: 'completed', description: 'Secured critical steel suspension cables across the viaduct.' },
        { projectId: projDevon, milestoneName: 'Final Tarmac & Safety Barriers', percentage: 100, status: 'completed', description: 'Completed paving and crash-tested side safety boundaries.' },
      ]);
    }

    // 6. Seed Hero Banners
    console.log('Seeding hero banners...');
    await db.insert(heroBanners).values([
      {
        title: 'Precision Construction. Absolute Integrity.',
        subtitle: 'MADECC Group is Cameroon’s premier multi-disciplinary construction and engineering firm turning architectural blueprints into iconic structural masterpieces.',
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1600&q=80',
        displayOrder: 1,
        active: true,
      },
      {
        title: 'Eco-Conscious Building For Central Africa',
        subtitle: 'We specialize in sustainable commercial complexes and residential smart estates with zero-carbon footprints in Cameroon.',
        imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80',
        displayOrder: 2,
        active: true,
      }
    ]);

    // 7. Seed Blog Posts
    console.log('Seeding blog posts...');
    // Create an author user for blog posts
    const seedAuthor = await db.insert(users).values({
      uid: 'seed-author-uid',
      email: 'madeccco5@gmail.com',
      name: 'Arthur Sterling',
      role: 'staff',
    }).returning();
    const authorId = seedAuthor[0]?.id;

    await db.insert(blogPosts).values([
      {
        title: 'The Rising Trend of Photovoltaic Glass Facades in Cameroon',
        content: `Commercial buildings consume up to 40% of standard city energy grids. At MADECC Group, we are bypassing traditional solar panels by integrating photovoltaic cells directly into structural glass facades.

Our upcoming project, the MADECC Eco-HQ Tower in Douala, uses clear double-glazed solar glass panels. In this post, we explore how building-integrated photovoltaics (BIPV) offset up to 35% of a skyscraper's operational carbon footprint in equatorial climates.`,
        authorId: authorId,
        image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        summary: 'Explore how building-integrated solar glass is transforming modern urban skyscrapers into autonomous green generators in Douala.',
        category: 'Sustainability',
      },
      {
        title: 'Pre-Construction Feasibility: The Secret to Under-Budget Delivery',
        content: `Delays in major civil engineering projects are typically caused by unforeseen geotechnical issues. By utilizing deep soil seismology profiling and full 3D BIM (Building Information Modeling) simulations before a single excavator enters the site, MADECC Group maintains a pristine track record of on-budget handovers in Central Africa.

This article reviews our pre-construction workflow used on the Sanaga Bridge project, highlighting risk-mitigation metrics.`,
        authorId: authorId,
        image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
        summary: 'Learn how advanced BIM soil rendering and digital stress simulations eliminate construction overruns before breaking ground.',
        category: 'Engineering',
      }
    ]);

    // 8. Seed Reviews
    console.log('Seeding reviews...');
    await db.insert(reviews).values([
      {
        authorName: 'Jean-Pierre Belinga',
        rating: 5,
        text: 'The structural integrity and speed of the MADECC engineering squad is outstanding. Our Douala logistics terminal was completed two weeks ahead of schedule.',
        projectName: 'Logistics Center Expansion',
        approved: true,
        approvedAt: new Date(),
      },
      {
        authorName: 'Therese Fotso',
        rating: 5,
        text: 'Building our family estate in Kribi with MADECC was an exceptional journey. They accommodated all custom smart-grid adjustments seamlessly. Highly recommended!',
        projectName: 'Kribi Beachfront Custom Eco-Home',
        approved: true,
        approvedAt: new Date(),
      },
      {
        authorName: 'Marcus Brodie',
        rating: 4,
        text: 'Outstanding pre-construction consultations. Their virtual 3D rendering of our corporate site saved us massive foundation planning errors.',
        projectName: 'Commercial Office Block',
        approved: false, // For testing approval flow!
      }
    ]);

    // 9. Seed Gallery Items
    console.log('Seeding gallery items...');
    await db.insert(galleryItems).values([
      { title: 'Excavators Preparing Foundation', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80', category: 'Civil Work' },
      { title: 'Steel Skeleton High-Rise', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80', category: 'Commercial' },
      { title: 'Photovoltaic Glass Placement', imageUrl: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&q=80', category: 'Sustainability' },
      { title: 'Kribi Beachfront Estates Construction', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80', category: 'Residential' },
    ]);

    // 10. Seed Team Members
    console.log('Seeding team members...');
    const existingTeam = await db.select().from(teamMembers).limit(1);
    if (existingTeam.length === 0) {
      await db.insert(teamMembers).values([
        {
          name: 'Eng. Dieudonné Kemgne',
          role: 'Managing Director & Principal Civil Engineer',
          specialization: 'Structural Engineering & Heavy Infrastructure Projects (MEng, SEC)',
          image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80',
          email: 'd.kemgne@madeccgroup.com'
        },
        {
          name: 'Marcus Ndip',
          role: 'Lead Architect & BIM Director',
          specialization: 'Eco-Conscious Building Design, 3D Soil Rendering & BIM Modeling (BArch, RIBA)',
          image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
          email: 'm.ndip@madeccgroup.com'
        },
        {
          name: 'Dr. Amélie Fotso',
          role: 'Director of Project Delivery',
          specialization: 'Strategic Contract Management & Construction Resource Optimization (PhD, PMP)',
          image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
          email: 'a.fotso@madeccgroup.com'
        },
        {
          name: 'Alain Tchouta',
          role: 'Senior Health & Safety Officer (HSE)',
          specialization: 'Regulatory Weekly Site Safety Audits & Compliance Standards (NEBOSH Cert)',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
          email: 'a.tchouta@madeccgroup.com'
        }
      ]);
    }

    console.log('--- Database Seeding Completed Successfully ---');
  } catch (error) {
    console.error('Error during database seeding:', error);
  }
}
