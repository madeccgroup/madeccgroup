/**
 * MADECC Group â€” Advanced Google Analytics 4 Service
 *
 * Measurement ID: G-HPZDHNV205
 *
 * Centralized analytics layer for the public MADECC website.
 * Never send PII, authentication data, client data, database IDs,
 * private project information, document contents, or credentials.
 */

export const GA_MEASUREMENT_ID = 'G-HPZDHNV205';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type AnalyticsParams = Record<
  string,
  string | number | boolean | undefined
>;

const isBrowser = typeof window !== 'undefined';

const canTrack = (): boolean =>
  isBrowser && typeof window.gtag === 'function';

const cleanParams = (params: AnalyticsParams = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ''
    )
  );

export function trackEvent(
  eventName: string,
  params: AnalyticsParams = {}
): void {
  if (!canTrack()) return;

  window.gtag?.(
    'event',
    eventName,
    cleanParams({
      ...params,
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
    })
  );
}

/* ================================
   PAGE VIEWS
================================ */

export function trackPageView(): void {
  if (!canTrack()) return;

  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
  });
}

/* ================================
   REQUEST A QUOTE
================================ */

export function trackQuoteStart(
  service?: string,
  projectType?: string
): void {
  trackEvent('quote_start', {
    form_name: 'request_quote',
    service,
    project_type: projectType,
  });
}

export function trackQuoteSubmit(
  service?: string,
  projectType?: string,
  currency?: string
): void {
  trackEvent('quote_submit', {
    form_name: 'request_quote',
    service,
    project_type: projectType,
    currency,
  });
}

export function trackLead(
  leadType: string,
  source?: string
): void {
  trackEvent('generate_lead', {
    lead_type: leadType,
    lead_source: source,
  });
}

/* ================================
   CONTACT
================================ */

export function trackContactStart(): void {
  trackEvent('contact_start', {
    form_name: 'contact',
  });
}

export function trackContactSubmit(
  contactReason?: string
): void {
  trackEvent('contact_submit', {
    form_name: 'contact',
    contact_reason: contactReason,
  });
}

/* ================================
   SCHEDULE BID
================================ */

export function trackBidStart(): void {
  trackEvent('bid_start', {
    form_name: 'schedule_bid',
  });
}

export function trackBidSubmit(
  projectType?: string
): void {
  trackEvent('bid_submit', {
    form_name: 'schedule_bid',
    project_type: projectType,
  });

  trackLead('schedule_bid');
}

/* ================================
   WHATSAPP
================================ */

export function trackWhatsAppClick(
  placement: string
): void {
  trackEvent('whatsapp_click', {
    platform: 'whatsapp',
    placement,
  });
}

/* ================================
   PHONE
================================ */

export function trackPhoneClick(
  placement: string
): void {
  trackEvent('phone_click', {
    placement,
  });
}

/* ================================
   EMAIL
================================ */

export function trackEmailClick(
  placement: string
): void {
  trackEvent('email_click', {
    placement,
  });
}

/* ================================
   BUDGET CALCULATOR
================================ */

export function trackCalculatorStart(
  projectType?: string
): void {
  trackEvent('calculator_start', {
    calculator: 'project_budget',
    project_type: projectType,
  });
}

export function trackCalculatorComplete(
  projectType?: string,
  budgetRange?: string,
  currency?: string
): void {
  trackEvent('calculator_complete', {
    calculator: 'project_budget',
    project_type: projectType,
    budget_range: budgetRange,
    currency,
  });
}

export function trackBudgetRange(
  budgetRange: string
): void {
  trackEvent('budget_range_selected', {
    calculator: 'project_budget',
    budget_range: budgetRange,
  });
}

/* ================================
   SERVICES
================================ */

export function trackServiceView(
  serviceName: string
): void {
  trackEvent('service_view', {
    service_name: serviceName,
  });
}

export function trackServiceCTA(
  serviceName: string,
  placement: string
): void {
  trackEvent('service_cta_click', {
    service_name: serviceName,
    placement,
  });
}

/* ================================
   PROJECTS
================================ */

export function trackProjectView(
  projectCategory?: string,
  projectType?: string
): void {
  trackEvent('project_view', {
    project_category: projectCategory,
    project_type: projectType,
  });
}

export function trackProjectCTA(
  projectCategory?: string,
  placement?: string
): void {
  trackEvent('project_cta_click', {
    project_category: projectCategory,
    placement,
  });
}

/* ================================
   DOCUMENT DOWNLOADS
================================ */

export function trackDocumentDownload(
  documentType: string,
  fileExtension?: string,
  category?: string
): void {
  trackEvent('document_download', {
    document_type: documentType,
    file_extension: fileExtension,
    document_category: category,
  });
}

/* ================================
   CTA BUTTONS
================================ */

export function trackCTA(
  ctaName: string,
  placement: string
): void {
  trackEvent('cta_click', {
    cta_name: ctaName,
    placement,
  });
}

/* ================================
   SOCIAL MEDIA
================================ */

export function trackSocialClick(
  platform: string,
  placement: string
): void {
  trackEvent('social_click', {
    platform,
    placement,
  });
}

/* ================================
   SEARCH
================================ */

export function trackSearch(
  searchTerm: string,
  resultCount?: number
): void {
  if (!searchTerm.trim()) return;

  trackEvent('search', {
    search_term: searchTerm.trim().slice(0, 100),
    result_count: resultCount,
  });
}

export function trackSearchResultClick(
  resultType?: string
): void {
  trackEvent('search_result_click', {
    result_type: resultType,
  });
}

/* ================================
   FORM ERRORS
================================ */

export function trackFormError(
  formName: string,
  errorType: string,
  fieldCategory?: string
): void {
  trackEvent('form_error', {
    form_name: formName,
    error_type: errorType,
    field_category: fieldCategory,
  });
}

export function trackValidationError(
  formName: string,
  errorType: string
): void {
  trackEvent('validation_error', {
    form_name: formName,
    error_type: errorType,
  });
}

/* ================================
   OUTBOUND LINKS
================================ */

export function trackOutboundClick(
  destinationType: string,
  placement?: string
): void {
  trackEvent('outbound_click', {
    destination_type: destinationType,
    placement,
  });
}

/* ================================
   CONVERSION
================================ */

export function trackConversion(
  conversionType: string,
  value?: number,
  currency?: string
): void {
  trackEvent('conversion', {
    conversion_type: conversionType,
    value,
    currency,
  });
}

/* ================================
   LEAD QUALIFICATION
================================ */

export function trackQualifiedLead(
  leadType: string
): void {
  trackEvent('lead_qualified', {
    lead_type: leadType,
  });
}

/* ============================================================
   MADECC GLOBAL BUSINESS EVENT TRACKING
   ============================================================ */

let madeccAnalyticsInitialized = false;

export function initializeMADECCAnalytics(): void {
  if (!isBrowser || madeccAnalyticsInitialized) return;

  madeccAnalyticsInitialized = true;

  /*
   * WhatsApp links
   */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('a') as HTMLAnchorElement | null;

    if (!link) return;

    const href = link.href || '';

    if (
      href.includes('wa.me/') ||
      href.includes('whatsapp.com/') ||
      href.startsWith('whatsapp:')
    ) {
      trackWhatsAppClick(
        link.dataset.analyticsPlacement ||
        link.closest('header') ? 'header' :
        link.closest('footer') ? 'footer' :
        'website'
      );
    }

    /*
     * Phone links
     */
    if (href.startsWith('tel:')) {
      trackPhoneClick(
        link.dataset.analyticsPlacement ||
        link.closest('header') ? 'header' :
        link.closest('footer') ? 'footer' :
        'website'
      );
    }

    /*
     * Email links
     */
    if (href.startsWith('mailto:')) {
      trackEmailClick(
        link.dataset.analyticsPlacement ||
        link.closest('header') ? 'header' :
        link.closest('footer') ? 'footer' :
        'website'
      );
    }

    /*
     * Social platforms
     */
    const socialPlatforms: Record<string, string> = {
      'facebook.com': 'facebook',
      'instagram.com': 'instagram',
      'youtube.com': 'youtube',
      'youtu.be': 'youtube',
      'tiktok.com': 'tiktok',
      'linkedin.com': 'linkedin',
      'x.com': 'x',
      'twitter.com': 'twitter',
    };

    for (const [domain, platform] of Object.entries(socialPlatforms)) {
      if (href.includes(domain)) {
        trackSocialClick(
          platform,
          link.dataset.analyticsPlacement || 'website'
        );
        break;
      }
    }

    /*
     * Document downloads
     */
    const downloadExtensions = [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.csv'
    ];

    const lowerHref = href.toLowerCase();

    if (
      link.hasAttribute('download') ||
      downloadExtensions.some(extension => lowerHref.includes(extension))
    ) {
      const extensionMatch = lowerHref.match(/\.(pdf|doc|docx|xls|xlsx|csv)(?:[?#]|$)/);

      trackDocumentDownload(
        link.dataset.documentType || 'document',
        extensionMatch?.[1] || undefined,
        link.dataset.documentCategory || 'website'
      );
    }

    /*
     * Generic CTA tracking.
     *
     * Use:
     * data-analytics-cta="request_quote"
     * data-analytics-placement="hero"
     *
     * on important buttons/links.
     */
    const ctaElement = target?.closest(
      '[data-analytics-cta]'
    ) as HTMLElement | null;

    if (ctaElement) {
      trackCTA(
        ctaElement.dataset.analyticsCta || 'unknown',
        ctaElement.dataset.analyticsPlacement || 'website'
      );
    }
  });

  /*
   * Form start tracking.
   *
   * Tracks first interaction with forms rather than every keystroke.
   */
  const startedForms = new WeakSet<HTMLFormElement>();

  document.addEventListener('focusin', (event) => {
    const target = event.target as HTMLElement | null;
    const form = target?.closest('form') as HTMLFormElement | null;

    if (!form || startedForms.has(form)) return;

    startedForms.add(form);

    const formName =
      form.dataset.analyticsForm ||
      form.getAttribute('name') ||
      form.id ||
      'unknown';

    if (/quote|request/i.test(formName)) {
      trackQuoteStart();
    } else if (/contact/i.test(formName)) {
      trackContactStart();
    } else if (/bid|schedule|consult/i.test(formName)) {
      trackBidStart();
    } else {
      trackEvent('form_start', {
        form_name: formName
      });
    }
  });
}

