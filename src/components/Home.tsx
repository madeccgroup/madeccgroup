import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  CheckCircle, 
  Quote, 
  ShieldCheck, 
  Truck, 
  Cpu, 
  Hammer,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from 'lucide-react';
import { Service, Project, Review, HeroBanner } from '../types.ts';
import LucideIcon from './LucideIcon.tsx';
import { getOptimizedImageUrl } from '../lib/utils.ts';
import { HeroBannerSkeleton, ProjectListSkeleton } from './Skeleton.tsx';

interface HomeProps {
  setCurrentTab: (tab: string) => void;
  setSelectedProjectId: (id: number | null) => void;
}

const DEFAULT_BANNERS: HeroBanner[] = [
  {
    id: 1,
    title: 'Precision Construction. Absolute Integrity.',
    subtitle: 'MADECC Group is Cameroon’s premier multi-disciplinary construction and engineering firm turning architectural blueprints into iconic structural masterpieces.',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1600&q=80',
    displayOrder: 1,
    active: true,
  },
  {
    id: 2,
    title: 'Eco-Conscious Building For Central Africa',
    subtitle: 'We specialize in sustainable commercial complexes and residential smart estates with zero-carbon footprints in Cameroon.',
    imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80',
    displayOrder: 2,
    active: true,
  }
];

export default function Home({ setCurrentTab, setSelectedProjectId }: HomeProps) {
  const [banners, setBanners] = useState<HeroBanner[]>(DEFAULT_BANNERS);
  const [services, setServices] = useState<Service[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [approvedReviews, setApprovedReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Carousel State
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Review Submission State
  const [newAuthor, setNewAuthor] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState('');
  const [newProject, setNewProject] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewCaptcha, setReviewCaptcha] = useState('');
  const [reviewCaptchaError, setReviewCaptchaError] = useState(false);
  const [reviewErrorMsg, setReviewErrorMsg] = useState('');

  // Expanded Service Card index
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);

  // Accordion state for SEO FAQs section
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    // Fetch home data from backend APIs
    const fetchHomeData = async () => {
      setLoading(true);
      try {
        const [bannersRes, servicesRes, projectsRes, reviewsRes] = await Promise.all([
          fetch('/api/banners'),
          fetch('/api/services'),
          fetch('/api/projects'),
          fetch('/api/reviews')
        ]);

        if (bannersRes.ok) {
          const bannersData = await bannersRes.json();
          // If the backend has active banners, use them; otherwise stick with DEFAULT_BANNERS
          if (bannersData && bannersData.length > 0) {
            setBanners(bannersData);
          }
        }
        if (servicesRes.ok) setServices(await servicesRes.json());
        if (projectsRes.ok) {
          const allProjs = await projectsRes.json();
          setFeaturedProjects(allProjs.slice(0, 3)); // Grab first 3 as featured
        }
        if (reviewsRes.ok) setApprovedReviews(await reviewsRes.json());
      } catch (err) {
        console.error('Error fetching home data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  // Auto transition hero banners every 6s
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor || !newText) return;

    if (reviewCaptcha.trim() !== '5') {
      setReviewCaptchaError(true);
      setReviewErrorMsg('Incorrect anti-bot verification answer. Please solve the equation correctly.');
      return;
    }

    setReviewCaptchaError(false);
    setReviewErrorMsg('');
    setSubmittingReview(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: newAuthor,
          rating: newRating,
          text: newText,
          projectName: newProject,
        }),
      });

      if (response.ok) {
        setReviewSuccess(true);
        setNewAuthor('');
        setNewText('');
        setNewProject('');
        setNewRating(5);
        setReviewCaptcha('');
        setReviewErrorMsg('');
        // Alert stays active for 5 seconds
        setTimeout(() => setReviewSuccess(false), 5000);
      } else {
        setReviewErrorMsg('Failed to post review. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setReviewErrorMsg('Network failure. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleViewProject = (projId: number) => {
    setSelectedProjectId(projId);
    setCurrentTab('projects');
  };

  return (
    <div className="font-sans text-slate-200 bg-[#0A0A0B] min-h-screen">
      
      {/* ==========================================
          HERO BANNER CAROUSEL SECTION
          ========================================== */}
      <section className="relative h-[640px] bg-slate-950 overflow-hidden" id="hero-section">
        {loading ? (
          <HeroBannerSkeleton />
        ) : banners.length > 0 ? (
          banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentBannerIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Cover Image is ALWAYS rendered as the base background */}
              <img 
                src={getOptimizedImageUrl(banner.imageUrl, 1600, 80)}
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                fetchPriority={index === 0 ? "high" : "low"}
                loading={index === 0 ? "eager" : "lazy"}
                decoding={index === 0 ? "sync" : "async"}
                referrerPolicy="no-referrer"
              />

              {/* Overlapping active video background (if available) */}
              {banner.videoUrl && index === currentBannerIndex && (
                (() => {
                  const url = banner.videoUrl;
                  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                  const match = url.match(regExp);
                  const youtubeId = (match && match[2].length === 11) ? match[2] : null;
                  if (youtubeId) {
                    return (
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <iframe
                          className="absolute inset-0 w-full h-full object-cover scale-125 select-none"
                          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                          title="Banner Video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    );
                  } else {
                    return (
                      <video
                        src={url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                        poster={getOptimizedImageUrl(banner.imageUrl, 1600, 80)}
                      />
                    );
                  }
                })()
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-transparent animate-in fade-in duration-500" />
              
              <div className="absolute inset-0 flex items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                  <div className="max-w-2xl text-white space-y-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 border border-slate-850 bg-slate-900/50 text-xs font-mono font-bold uppercase tracking-widest text-amber-500">
                      <ShieldCheck className="w-3.5 h-3.5" /> ISO 9001 & 14001 Certified
                    </span>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none">
                      {banner.title}
                    </h1>
                    <p className="text-lg text-slate-300 leading-relaxed font-normal">
                      {banner.subtitle}
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <button
                        onClick={() => setCurrentTab('booking')}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-7 py-3.5 rounded-lg text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                      >
                        Book Free Consultation <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentTab('projects')}
                        className="bg-transparent hover:bg-slate-800 text-white font-bold px-6 py-3.5 rounded-lg text-sm border-2 border-slate-800 hover:border-slate-700 transition-all"
                      >
                        Explore Our Portfolio
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          /* Placeholder hero while loading */
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-400">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin mx-auto" />
              <p className="text-sm font-mono tracking-widest uppercase">Connecting to Database...</p>
            </div>
          </div>
        )}

        {/* Carousel controls */}
        {banners.length > 1 && (
          <>
            <button
              onClick={() => setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-900/40 hover:bg-slate-900 text-white p-2 rounded-full transition-colors border border-slate-800"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => setCurrentBannerIndex((prev) => (prev + 1) % banners.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900/40 hover:bg-slate-900 text-white p-2 rounded-full transition-colors border border-slate-800"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </section>

      {/* ==========================================
          CORPORATE HIGHLIGHTS / BENTO GRID
          ========================================== */}
      <section className="py-12 bg-[#0E0E10]/80 border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start p-4">
              <div className="bg-slate-800/50 text-amber-500 p-3 rounded-lg border border-slate-700/60">
                <Hammer className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Pristine Craftsmanship</h4>
                <p className="text-sm text-slate-400 mt-1">Every girder, column, and surface aligned with millimeter accuracy by elite specialists.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start p-4 border-y md:border-y-0 md:border-x border-slate-800/60">
              <div className="bg-slate-800/50 text-amber-500 p-3 rounded-lg border border-slate-700/60">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">On-Time Logistics</h4>
                <p className="text-sm text-slate-400 mt-1">Our comprehensive material supply chains guarantee zero operational delays on-site.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start p-4">
              <div className="bg-slate-800/50 text-amber-500 p-3 rounded-lg border border-slate-700/60">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Advanced Technology</h4>
                <p className="text-sm text-slate-400 mt-1">Leveraging state-of-the-art 3D BIM rendering and smart material sensors on structures.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          SERVICES SECTION (INTEGRATIVE CARDS)
          ========================================== */}
      <section className="py-24 bg-[#0A0A0B]" id="services-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">Expert Engineering Modules</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Our Professional Capabilities</h2>
            <p className="text-slate-400 leading-relaxed text-sm">
              From individual luxury residential frames to mega civil freeways, MADECC Group deploys comprehensive engineering and logistical machinery to accomplish pristine projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.map((service) => (
              <div
                key={service.id}
                className={`bg-slate-900/50 rounded-xl border p-6 transition-all duration-300 shadow-sm ${
                  expandedServiceId === service.id 
                    ? 'border-amber-500 ring-2 ring-amber-500/10 bg-slate-900/80' 
                    : 'border-slate-800/80 hover:border-slate-750 hover:bg-slate-900/70'
                }`}
                id={`service-card-${service.id}`}
              >
                <div className="flex items-start gap-5">
                  <div className="bg-amber-500 text-slate-950 p-3 rounded-xl shadow-md shrink-0">
                    <LucideIcon name={service.icon} className="w-6 h-6" />
                  </div>
                  <div className="space-y-2 flex-grow">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-white">{service.name}</h3>
                      <span className="text-xs font-mono font-bold bg-slate-850 px-2.5 py-1 text-slate-300 rounded border border-slate-800">
                        {service.priceRange || 'Consultation Req.'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {service.description}
                    </p>

                    {/* Expandable details */}
                    {expandedServiceId === service.id && service.details && (
                      <div className="pt-4 border-t border-slate-800 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Scope of Operations:</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {service.details.split(',').map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>{item.trim()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 flex justify-end">
                      <button
                        onClick={() => setExpandedServiceId(expandedServiceId === service.id ? null : service.id)}
                        className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 focus:outline-none"
                      >
                        {expandedServiceId === service.id ? 'Collapse Details' : 'View Core Scope'}
                        <ArrowRight className={`w-3.5 h-3.5 transition-transform ${expandedServiceId === service.id ? 'rotate-90' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==========================================
          FEATURED PROJECTS PORTFOLIO
          ========================================== */}
      <section className="py-24 bg-[#0E0E10]/40 border-y border-slate-800/60" id="featured-projects">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-16">
            <div className="space-y-3">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">Structural Landmark Case-studies</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Featured Projects</h2>
              <p className="text-slate-400 leading-relaxed text-sm max-w-xl">
                A highly-selective display of architectural landmarks and civil expansions built with sustainable net-zero foundations.
              </p>
            </div>
            <button
              onClick={() => setCurrentTab('projects')}
              className="group text-sm font-bold text-amber-500 hover:text-amber-450 transition-colors flex items-center gap-1"
            >
              Browse Full Portfolio <ArrowRight className="w-4.5 h-4.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          {loading ? (
            <ProjectListSkeleton count={3} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredProjects.map((project) => (
                <div 
                  key={project.id} 
                  className="bg-slate-900/50 border border-slate-800/85 rounded-xl overflow-hidden shadow-sm hover:border-slate-700/80 hover:bg-slate-900 transition-all flex flex-col h-full cursor-pointer group"
                  onClick={() => handleViewProject(project.id)}
                  id={`featured-project-${project.id}`}
                >
                  <div className="relative h-56 bg-slate-950 overflow-hidden">
                    <img
                      src={getOptimizedImageUrl(project.image, 800, 80)}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute top-4 right-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider text-white shadow ${
                        project.status === 'completed' ? 'bg-emerald-600' :
                        project.status === 'in-progress' ? 'bg-amber-500 text-slate-950' :
                        'bg-indigo-600'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col justify-between flex-grow space-y-4">
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500 block">{project.location}</span>
                      <h3 className="font-extrabold text-lg text-white line-clamp-1">{project.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {project.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-mono">Value Budget</span>
                        <span className="block font-bold text-white">
                          {project.budget ? `£${Number(project.budget).toLocaleString()}` : 'N/A'}
                        </span>
                      </div>
                      <span className="text-amber-500 group-hover:text-amber-400 transition-colors font-bold inline-flex items-center gap-1">
                        View Progress Timeline <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ==========================================
          REVIEWS & TESTIMONIALS + SUBMISSION
          ========================================== */}
      <section className="py-24 bg-[#0A0A0B]" id="testimonials-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
            
            {/* Reviews list */}
            <div className="lg:col-span-7 space-y-8">
              <div className="space-y-3">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">Unbiased Client Verification</span>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">Client Endorsements</h2>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                  Client trust is our primary corporate asset. Below are validated reviews regarding our handovers.
                </p>
              </div>

              {approvedReviews.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {approvedReviews.map((review) => (
                    <div key={review.id} className="bg-slate-900/50 rounded-xl border border-slate-800/80 p-6 relative shadow-sm">
                      <Quote className="absolute right-6 top-6 w-10 h-10 text-slate-800/40" />
                      
                      <div className="flex gap-1 text-amber-500 mb-3">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>

                      <p className="text-slate-300 text-sm leading-relaxed mb-4 italic">
                        "{review.text}"
                      </p>

                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-white block">{review.authorName}</span>
                          {review.projectName && (
                            <span className="text-[10px] text-slate-500 font-mono tracking-wider block uppercase">Project: {review.projectName}</span>
                          )}
                        </div>
                        <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Verified Handover
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900/50 border border-slate-800 p-12 text-center rounded-xl text-slate-500">
                  <p>No testimonials pre-seeded yet.</p>
                </div>
              )}
            </div>

            {/* Submit a Review Form */}
            <div className="lg:col-span-5 bg-[#0E0E10]/90 border border-slate-850 rounded-2xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
              <div className="space-y-4 mb-6">
                <h3 className="font-extrabold text-xl text-white">Submit Handover Review</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Have we recently completed a contract for you? Provide objective feedback. All reviews undergo an administrative approval checklist.
                </p>
              </div>

              {reviewSuccess ? (
                <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-300 p-6 rounded-lg text-sm flex flex-col items-center text-center gap-3">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                  <div>
                    <span className="font-bold block text-base mb-1">Feedback Submitted Successfully!</span>
                    <span>Your review is safely queued in our administrative pipeline and will display publicly once approved.</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Your Full Name</label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-850 focus:bg-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2.5 px-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                      placeholder="e.g. Richard Sterling"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Rating Score</label>
                      <select
                        className="w-full bg-slate-950 border border-slate-850 focus:bg-slate-900 focus:border-amber-500 rounded-lg py-2.5 px-3 text-sm text-white outline-none"
                        value={newRating}
                        onChange={(e) => setNewRating(parseInt(e.target.value))}
                      >
                        <option value="5">5 - Exceptional</option>
                        <option value="4">4 - High Quality</option>
                        <option value="3">3 - Satisfactory</option>
                        <option value="2">2 - Needs Work</option>
                        <option value="1">1 - Unsatisfactory</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Project Name</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-850 focus:bg-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2.5 px-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                        placeholder="e.g. Surrey Villa"
                        value={newProject}
                        onChange={(e) => setNewProject(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Your Feedback Text</label>
                    <textarea
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-850 focus:bg-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2.5 px-3 text-sm text-white placeholder-slate-600 outline-none transition-all resize-none"
                      placeholder="Detail your engineering/handover experience..."
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      required
                    />
                  </div>

                  <div className="bg-slate-950/60 border border-slate-850/80 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                        Anti-Bot Human Verification
                      </span>
                      <span className="text-[10px] font-mono text-amber-500 font-bold">
                        Required
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      To safeguard our portal against automated spam, please solve the equation:<br />
                      <span className="text-white font-mono font-bold bg-slate-900 px-2.5 py-1 rounded inline-block my-1.5">15x + 5x - 10 = 90</span><br />
                      Find the value of x.
                    </p>
                    <div>
                      <input
                        type="text"
                        className={`w-full bg-slate-950 border ${reviewCaptchaError ? 'border-red-500' : 'border-slate-850'} focus:bg-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg py-2.5 px-3 text-sm text-white placeholder-slate-600 outline-none transition-all`}
                        placeholder="Enter the value of x (numerical)"
                        value={reviewCaptcha}
                        onChange={(e) => {
                          setReviewCaptcha(e.target.value);
                          setReviewCaptchaError(false);
                        }}
                        required
                      />
                    </div>
                  </div>

                  {reviewErrorMsg && (
                    <div className="bg-red-950/40 border border-red-800 text-red-300 p-4 rounded-lg text-xs">
                      <span>{reviewErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                    id="submit-review-btn"
                  >
                    {submittingReview ? 'Submitting...' : 'Post Client Review'}
                  </button>
                </form>
              )}
            </div>

          </div>

        </div>
      </section>

      {/* ==========================================
          SEO FAQ & KNOWLEDGE ACCOUTREMENT
          ========================================== */}
      <section className="py-24 bg-[#0A0A0C] border-t border-slate-900" id="seo-faq-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest font-mono">Expert Answers & Support</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h2>
            <p className="text-slate-400 leading-relaxed text-sm max-w-2xl mx-auto">
              Learn more about our design-build methodology, Cameroon building permits, material sourcing, structural valuations, and how MADECC Group executes landmarks of pristine engineering.
            </p>
          </div>

          <div className="space-y-4" id="faq-accordions-group">
            {[
              {
                q: "What regions in Cameroon does MADECC Group cover for construction projects?",
                a: "While our administrative headquarters and logistics hub are located in Douala (Rue Joss, Bonanjo), MADECC Group executes complex civil engineering, road networks, residential villas, and industrial structures across the entire national territory of Cameroon. We have active sites and personnel deployed in Douala, Yaoundé, Kribi, Limbe, Bafoussam, and Garoua."
              },
              {
                q: "How are construction estimates, structural bills, and budgets formulated?",
                a: "Our certified quantity surveyors formulate detailed cost breakdowns based on current local and international market rates for cement (CPJ35/CPJ45), high-tensile steel rebar, aggregate, and specialized finishing materials. All financial calculations, project milestone contracts, and official invoices are handled transparently in Central African CFA Francs (XAF/FCFA)."
              },
              {
                q: "Does MADECC Group manage the acquisition of municipal building permits (Permis de Construire)?",
                a: "Absolutely. As a premium design-build engineering firm, we handle the entire administrative and technical pipeline. This includes conducting structural soil tests (geotechnical analysis), preparing certified structural calculation notes, drafting architectural plans, and representing clients before the Douala Urban Council (CUD), Yaoundé Urban Council (CUY), and other local municipal authorities to obtain building permits."
              },
              {
                q: "What is the typical timeline for constructing a custom modern villa in Cameroon?",
                a: "A high-end, luxury modern residential villa typically takes between 6 to 12 months from initial site excavation and foundation reinforcement (pouring the slab) to final interior finishing and handover. Commercial buildings and larger multi-story apartments generally require 12 to 24 months, guided by rigid Gantt schedules to avoid delays."
              },
              {
                q: "How does your Gemini AI Chatbot assist with real-time inquiries?",
                a: "Our virtual live assistant is powered by Google Gemini, trained specifically on MADECC Group's engineering profiles, services, projects, and regional parameters in Cameroon. It answers general inquiries about pricing brackets, structural methods, and services immediately. For technical estimations or site visits, the assistant triggers our automated SMTP and Twilio gateway to alert human managers immediately."
              },
              {
                q: "What safety protocols and quality standards are enforced on MADECC Group sites?",
                a: "We operate strictly under a Zero-Harm QHSE (Quality, Health, Safety, and Environment) corporate directive. All engineers, masons, welders, and heavy machinery operators are equipped with complete personal protective equipment (PPE), work heights are secured with certified harnesses, and all reinforced concrete structures undergo strict compression tests (cube crushing tests) at 7, 14, and 28 days to verify absolute load-bearing capacity."
              }
            ].map((faq, idx) => {
              const isExpanded = expandedFaqIndex === idx;
              return (
                <div 
                  key={idx}
                  className="bg-slate-900/40 border border-slate-850 rounded-xl overflow-hidden transition-all duration-300"
                  id={`faq-item-${idx}`}
                >
                  <button
                    onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 focus:outline-none hover:bg-slate-900/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <span className="font-bold text-sm text-slate-100 hover:text-white transition-colors">{faq.q}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-400 border-t border-slate-850/60 bg-slate-950/20 leading-relaxed font-sans animate-in fade-in slide-in-from-top-2 duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Call to action badge */}
          <div className="mt-12 text-center bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
            <p className="text-xs text-slate-300">
              Have a custom project or technical engineering inquiry not listed here?
            </p>
            <button 
              onClick={() => setCurrentTab('contact')}
              className="mt-3 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider py-2.5 px-6 rounded-lg transition-all"
            >
              Consult an Engineer <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </section>

    </div>
  );
}
