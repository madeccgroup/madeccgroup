import React, { useState } from 'react';
import { 
  Award, 
  Briefcase, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Flame, 
  Globe2, 
  HelpCircle, 
  Lightbulb, 
  Quote, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Users2, 
  Video 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// 1. BEFORE AND AFTER INTERACTIVE SLIDER
// ==========================================
export function BeforeAfterGallery() {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number, containerRect: DOMRect) => {
    const x = clientX - containerRect.left;
    const percentage = Math.max(0, Math.min(100, (x / containerRect.width) * 100));
    setSliderPos(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = e.currentTarget.getBoundingClientRect();
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX, container);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && e.type !== 'click') return;
    const container = e.currentTarget.getBoundingClientRect();
    handleMove(e.clientX, container);
  };

  return (
    <div className="py-16 border-t border-slate-900 bg-slate-950/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold font-mono uppercase text-amber-500 tracking-widest block mb-2">Visual Showcase</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Before & After Comparisons</h2>
          <p className="text-sm text-slate-400 mt-2">
            Drag the slider handle laterally to inspect our structural conversion capability and completed green-retrofit projects.
          </p>
        </div>

        {/* Sliding Widget Frame */}
        <div 
          className="relative h-[32rem] w-full max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none cursor-ew-resize"
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onClick={(e) => {
            const container = e.currentTarget.getBoundingClientRect();
            handleMove(e.clientX, container);
          }}
        >
          {/* AFTER IMAGE (Background) */}
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80" 
              alt="After Rehabilitation" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-6 right-6 bg-emerald-600 text-white font-mono text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-md shadow-lg border border-emerald-400/40">
              After: Completed Ecological Hub
            </div>
          </div>

          {/* BEFORE IMAGE (Foreground clip-path) */}
          <div 
            className="absolute inset-0 transition-all duration-75"
            style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
          >
            <img 
              src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80" 
              alt="Before Rehabilitation" 
              className="w-full h-full object-cover filter grayscale contrast-125 brightness-75"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-6 left-6 bg-rose-900/90 text-white font-mono text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-md shadow-lg border border-rose-600/30">
              Before: Initial Civil Excavation
            </div>
          </div>

          {/* SLIDER CONTROLLER HANDLE */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-amber-500 cursor-ew-resize transition-all duration-75"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-amber-500 border-4 border-slate-950 text-slate-950 shadow-2xl flex items-center justify-center">
              <svg className="w-5 h-5 font-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 4 4 4m8 0l4-4-4-4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. COMPANY CHRONOLOGICAL TIMELINE
// ==========================================
export function CompanyTimeline() {
  const milestones = [
    {
      year: '2015',
      title: 'Foundation & Regional Entry',
      desc: 'MADECC Group was established to provide premier civil engineering and general contracting support, serving infrastructure development in Cameroon with premium execution standards.'
    },
    {
      year: '2018',
      title: 'Renewable Solar & Green Tech Integration',
      desc: 'Formed a specialized department for sustainable solar engineering, deploying mini-grid networks to support regional industrial clusters.'
    },
    {
      year: '2021',
      title: 'Digital Workspace & Document Studio Launch',
      desc: 'Pioneered custom enterprise management solutions, introducing automated contract signing, audit logs, and compliance verifiers for public tenders.'
    },
    {
      year: '2024',
      title: 'Multidisciplinary Consultancy Expansion',
      desc: 'Consolidated engineering, civil works, real estate development, and digital system integration under a unified pan-African advisory network.'
    },
    {
      year: '2026',
      title: 'Net-Zero Carbon Standard Certification',
      desc: 'Officially certified under rigorous global standards, ensuring 100% of our real estate projects utilize certified green materials and smart energy networks.'
    }
  ];

  return (
    <div className="py-16 border-t border-slate-900 bg-slate-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold font-mono uppercase text-amber-500 tracking-widest block mb-2">Corporate Journey</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">MADECC Growth Timeline</h2>
          <p className="text-sm text-slate-400 mt-2">
            A chronological overview of our key accomplishments, technological upgrades, and regional expansion.
          </p>
        </div>

        {/* Timeline Grid */}
        <div className="relative border-l border-slate-800 ml-4 md:ml-32 space-y-12">
          {milestones.map((item, idx) => (
            <div key={idx} className="relative pl-8 md:pl-12 group">
              {/* Year Label (Absolute on Desktop) */}
              <div className="absolute -left-4 md:-left-36 top-1 text-right w-24 hidden md:block">
                <span className="text-lg font-black text-amber-500 font-mono tracking-wider">{item.year}</span>
              </div>

              {/* Node Indicator Dot */}
              <div className="absolute -left-1.5 top-2 h-3.5 w-3.5 rounded-full bg-slate-950 border-2 border-amber-500 group-hover:bg-amber-500 transition-colors shadow-lg" />

              {/* Card */}
              <div className="bg-[#0E0E11] border border-slate-850/80 hover:border-slate-800 p-6 rounded-xl shadow-md transition-all">
                <div className="flex items-center gap-2 md:hidden mb-2">
                  <span className="text-sm font-black text-amber-500 font-mono bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">{item.year}</span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-500 transition-colors">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. FAQS INTERACTIVE ACCORDION
// ==========================================
export function FAQSection() {
  const faqs = [
    {
      q: "What specialized sectors does MADECC Group specialize in?",
      a: "MADECC Group is a diversified enterprise operating at the intersection of modern civil construction, environmental engineering, clean energy systems, architectural design, corporate advisory, and high-performance digital solutions."
    },
    {
      q: "How does the digital document verifier secure contracts?",
      a: "Our system generates secure, immutable SHA-256 tokens corresponding to each client-drawn signature and receipt log. This provides foolproof, verifiable cryptographic tracking, preventing document tampering in public tenders."
    },
    {
      q: "Is MADECC Group qualified to execute international green-building projects?",
      a: "Yes. All our active structures and infrastructure works conform to international net-zero building standards and regional regulatory guidelines, incorporating solar mini-grids, smart automation, and low-embodied-carbon aggregates."
    },
    {
      q: "How can I schedule a professional project consultation?",
      a: "Simply head over to our 'Consultation Booking' tab, select your required service sector (e.g., Heavy Infrastructure, Solar Power Grid, Tech Systems), pick an available slot, and submit. Our operational department will verify and confirm within 2 hours."
    },
    {
      q: "Does MADECC Group provide post-construction asset maintenance?",
      a: "Absolutely. We supply comprehensive structural, environmental, and computational maintenance agreements for all commercial estates, industrial solar arrays, and custom software systems."
    }
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="py-16 border-t border-slate-900 bg-slate-950/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-bold font-mono uppercase text-amber-500 tracking-widest block mb-2">Inquiry Support</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
          <p className="text-sm text-slate-400 mt-2">
            Clear responses to common questions regarding our capabilities, compliance, and corporate workflows.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div 
                key={idx}
                className="border border-slate-850/80 rounded-xl bg-slate-900/20 overflow-hidden"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-900/60 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    {faq.q}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="p-5 pt-0 border-t border-slate-850/30 text-xs text-slate-400 leading-relaxed font-sans">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. STATS COUNTERS GRID
// ==========================================
export function CompanyStats() {
  const stats = [
    { icon: <Briefcase className="w-6 h-6 text-amber-500" />, count: '145+', label: 'Managed Projects' },
    { icon: <Users2 className="w-6 h-6 text-emerald-400" />, count: '480+', label: 'Elite Operators' },
    { icon: <Globe2 className="w-6 h-6 text-sky-400" />, count: '5+', label: 'African Nations' },
    { icon: <Award className="w-6 h-6 text-amber-500" />, count: '18+', label: 'Industry Awards' }
  ];

  return (
    <div className="py-12 border-t border-slate-900 bg-[#0E0E11]/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-slate-900/40 border border-slate-850 p-6 rounded-xl flex items-center gap-4 hover:border-slate-800 transition-colors">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                {stat.icon}
              </div>
              <div>
                <span className="block text-xl sm:text-2xl font-black text-white font-mono">{stat.count}</span>
                <span className="block text-[10px] text-slate-500 uppercase font-mono mt-0.5">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. TESTIMONIALS & PARTNERS
// ==========================================
export function TestimonialsAndPartners() {
  const partners = [
    { name: 'Minsanté Cameroon', logo: 'https://images.unsplash.com/photo-1516841273335-e39b37888115?auto=format&fit=crop&w=120&q=80' },
    { name: 'Camwater', logo: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=120&q=80' },
    { name: 'Eneo Cameroon', logo: 'https://images.unsplash.com/photo-1455165814004-1126a7199f9b?auto=format&fit=crop&w=120&q=80' },
    { name: 'Minresi Cameroon', logo: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=120&q=80' },
  ];

  const reviews = [
    {
      quote: "MADECC Group executed our multi-megawatt off-grid solar installation with pristine design safety and met the accelerated deployment schedule flawlessly.",
      author: "Eng. Robert Ndip",
      role: "Eneo Grid Supervisor",
    },
    {
      quote: "The Document Studio automated contract verification has saved our legal compliance office over 40 hours of audit reviews every month. It's fully trustworthy.",
      author: "Dr. Sandrine Atangana",
      role: "Public Tenders Commissioner",
    }
  ];

  return (
    <div className="py-16 border-t border-slate-900 bg-slate-950/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Testimonials */}
          <div className="lg:col-span-7 space-y-8">
            <div>
              <span className="text-xs font-bold font-mono uppercase text-amber-500 tracking-widest block mb-2">Stakeholder Trust</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Client Testimonials</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((rev, idx) => (
                <div key={idx} className="bg-slate-900/30 border border-slate-850 p-6 rounded-xl relative space-y-4">
                  <Quote className="w-8 h-8 text-amber-500/10 absolute top-4 right-4" />
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{rev.quote}"
                  </p>
                  <div className="pt-4 border-t border-slate-850">
                    <span className="block text-xs font-bold text-white">{rev.author}</span>
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{rev.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Partner Logos */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0E0E11]/80 border border-slate-850 rounded-2xl p-8 space-y-6">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-amber-500 tracking-wider">Strategic Networks</span>
                <h3 className="text-lg font-extrabold text-white mt-1">Our Corporate Partners</h3>
                <p className="text-xs text-slate-400 mt-1">Leading institutions trusting MADECC Group across sub-Saharan regions.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {partners.map((partner, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-slate-950/80 border border-slate-900 p-3 rounded-lg hover:border-slate-800 transition-colors">
                    <div className="w-8 h-8 rounded-md bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                      <img src={partner.logo} alt={partner.name} className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 truncate">{partner.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 6. HERO AND SERVICES RECUP
// ==========================================
export function PortfolioHero() {
  return (
    <section className="bg-slate-950/80 border-b border-slate-850/60 text-white py-24 relative overflow-hidden" id="projects-header">
      {/* Visual background accents */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center max-w-3xl">
        <span className="text-xs font-black font-mono uppercase text-amber-500 tracking-widest bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-block mb-4">
          Corporate Portfolio & Case Files
        </span>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-white">
          MADECC Group <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-300">Engineering Portfolio</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed">
          Discover a curated log of our civil infrastructure developments, residential estates, high-tech carbon-neutral grids, and secure digital compliance frameworks. High performance. Sustainable execution.
        </p>

        {/* Highlight Badges */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>WCAG 2.2 Accessible</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>AI Guided Narration</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-300">
            <Flame className="w-4 h-4 text-orange-500" />
            <span>Enterprise-Grade Security</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// 7. GOOGLE ADSENSE PRIVACY AND DISCLAIMER LINKS
// ==========================================
export function AdSenseReadinessBlock() {
  return (
    <div className="py-8 bg-[#070709] border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-[10px] font-mono space-y-2">
        <p>This application operates under strict compliance with Google AdSense quality and publishing directives.</p>
        <div className="flex justify-center gap-4 text-slate-400">
          <a href="/privacy-policy" className="hover:text-amber-500 transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/terms" className="hover:text-amber-500 transition-colors">Terms of Service</a>
          <span>•</span>
          <a href="/cookie-policy" className="hover:text-amber-500 transition-colors">Cookie Policy</a>
          <span>•</span>
          <a href="/disclaimer" className="hover:text-amber-500 transition-colors">Disclaimer</a>
        </div>
      </div>
    </div>
  );
}
