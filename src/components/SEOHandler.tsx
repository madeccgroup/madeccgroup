import { useEffect } from 'react';

interface SEOHandlerProps {
  currentTab: string;
  selectedProjectId: number | null;
}

const TAB_META: Record<string, { title: string; description: string }> = {
  home: {
    title: 'MADECC Group | Premier Engineering & Construction Firm in Cameroon',
    description: 'Cameroon’s leading multi-disciplinary construction company. Turning blueprints into sustainable architectural masterpieces, custom commercial spaces, and smart estates.',
  },
  about: {
    title: 'About Us | MADECC Group Construction & Engineering',
    description: 'Learn about MADECC Group’s legacy of precision, ISO certified standards, and elite multi-disciplinary team driving sustainable development across Central Africa.',
  },
  projects: {
    title: 'Contract Portfolio & Landmark Projects | MADECC Group',
    description: 'Explore our construction milestones and landmark projects in Cameroon. View real-time value budgets, location updates, and completed works.',
  },
  blog: {
    title: 'Industry Insights, News & Civil Tech Blog | MADECC Group',
    description: 'Stay updated with civil engineering trends, construction updates, and expert structural guidelines from MADECC Group experts in Central Africa.',
  },
  contact: {
    title: 'Contact Engineering Support & Offices | MADECC Group',
    description: 'Get in touch with MADECC Group. Schedule secure on-site inspections, coordinate with engineers, or request professional service proposals.',
  },
  booking: {
    title: 'Book a Construction Consultation & Inspection | MADECC Group',
    description: 'Securely book professional structural assessments, project planning sessions, and soil testing with our multi-disciplinary experts.',
  },
  admin: {
    title: 'Secure Operations Command Center | MADECC Group Admin',
    description: 'Authorized administrative panel for managing contract progress, audit logs, banner slides, and appointment scheduling.',
  },
};

/**
 * High-fidelity SEO handler that dynamically updates document title and
 * meta description as the user navigates different applet sections.
 */
export default function SEOHandler({ currentTab, selectedProjectId }: SEOHandlerProps) {
  useEffect(() => {
    let title = TAB_META[currentTab]?.title || 'MADECC Group | Construction & Engineering';
    let description = TAB_META[currentTab]?.description || 'Cameroon’s leading multi-disciplinary construction and engineering firm.';

    if (currentTab === 'projects' && selectedProjectId) {
      title = `Project Timeline #${selectedProjectId} | MADECC Group Portfolio`;
      description = `View real-time construction progress, budget value, and project history for contract #${selectedProjectId}.`;
    }

    // Set document title
    document.title = title;

    // Set or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);
  }, [currentTab, selectedProjectId]);

  return null; // Renderless helper
}
