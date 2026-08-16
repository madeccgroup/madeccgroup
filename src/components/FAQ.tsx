import React, { useState, useEffect } from 'react';
import {
  Search,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  MessageSquare,
  FileText,
  Download,
  Send,
  Sparkles,
  X,
  Phone,
  Mail,
  Building2,
  HardHat
} from 'lucide-react';
import { exportFaqsPDF } from '../lib/exportEngine.ts';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  categoryName: string;
  tags?: string[];
  featured?: boolean;
  author?: string;
  relatedService?: string;
  relatedPage?: string;
}

interface FAQProps {
  onNavigateToTab?: (tab: string, state?: any) => void;
}

export const FAQ: React.FC<FAQProps> = ({ onNavigateToTab }) => {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal for asking a question
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [askName, setAskName] = useState('');
  const [askEmail, setAskEmail] = useState('');
  const [askPhone, setAskPhone] = useState('');
  const [askCategory, setAskCategory] = useState('General');
  const [askQuestion, setAskQuestion] = useState('');
  const [submittingAsk, setSubmittingAsk] = useState(false);
  const [askSuccess, setAskSuccess] = useState(false);
  const [askError, setAskError] = useState('');

  useEffect(() => {
    fetch('/api/public/faqs')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.faqs)) {
          setFaqs(data.faqs);
          const cats = Array.from(new Set(data.faqs.map((f: FAQItem) => f.categoryName))) as string[];
          setCategories(['All', ...cats]);
          // Open first 2 by default
          setOpenIds(data.faqs.slice(0, 2).map((f: FAQItem) => f.id));
        } else {
          loadFallbackFaqs();
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('Using fallback FAQ list:', err);
        loadFallbackFaqs();
        setLoading(false);
      });
  }, []);

  const loadFallbackFaqs = () => {
    const defaultFaqs: FAQItem[] = [
      {
        id: 1,
        question: 'How do I request a construction quote from MADECC Group?',
        answer: 'You can submit a detailed Request a Quote online via our portal. Select your project location (Region/City), building specifications, estimated floor area, and upload your drawings. Our quantity surveying team will process your intake and deliver an initial estimation within 24 to 48 hours.',
        categoryName: 'Request a Quote',
        tags: ['quote', 'estimation', 'intake'],
        relatedPage: 'request-a-quote'
      },
      {
        id: 2,
        question: 'Which geographical regions in Cameroon does MADECC Group cover?',
        answer: 'MADECC Group operates across all 10 regions of Cameroon, with direct operational headquarters in Douala (Littoral) and Yaoundé (Centre). We deploy site teams and heavy machinery for residential, commercial, industrial, and civil projects nationwide.',
        categoryName: 'Construction & Operations',
        tags: ['regions', 'douala', 'yaounde', 'location']
      },
      {
        id: 3,
        question: 'What is a Bill of Quantities (BOQ) and why is it essential?',
        answer: 'A Bill of Quantities (BOQ) is a itemized document prepared by a Quantity Surveyor that breaks down every material, labor hour, and machinery requirement for a construction project. A professional BOQ prevents cost overruns, ensures transparent contractor bidding, and guarantees material accountability.',
        categoryName: 'BOQ & Estimation',
        tags: ['boq', 'quantity surveying', 'cost control']
      },
      {
        id: 4,
        question: 'How does MADECC Group handle payment milestones and currency?',
        answer: 'All projects are priced in XAF (FCFA) by default, with option to view in EUR or USD. Payments are structured according to certified construction milestones (e.g., Foundations, Framing, Roofing, Finishing) accompanied by site inspection reports.',
        categoryName: 'Payments & Pricing',
        tags: ['xaf', 'fcfa', 'currency', 'milestones']
      },
      {
        id: 5,
        question: 'How can material suppliers or subcontractors register to work with MADECC?',
        answer: 'Local and international suppliers can submit a prequalification application through our "Suppliers & Subcontractors" portal. Upload your company registration, tax clearance, product catalog, or trade licenses for evaluation by our procurement committee.',
        categoryName: 'Suppliers & Tenders',
        tags: ['suppliers', 'subcontractors', 'procurement'],
        relatedPage: 'suppliers'
      },
      {
        id: 6,
        question: 'Can I verify the authenticity of a MADECC contract or receipt online?',
        answer: 'Yes. Every official contract and receipt issued by MADECC Group includes a unique verification token and QR code. You can verify document validity instantly using our online Contract Verification tool.',
        categoryName: 'General',
        tags: ['verification', 'contract', 'receipt'],
        relatedPage: 'verify'
      }
    ];

    setFaqs(defaultFaqs);
    const cats = Array.from(new Set(defaultFaqs.map(f => f.categoryName)));
    setCategories(['All', ...cats]);
    setOpenIds([1, 2]);
  };

  const toggleAccordion = (id: number) => {
    if (openIds.includes(id)) {
      setOpenIds(openIds.filter(i => i !== id));
    } else {
      setOpenIds([...openIds, id]);
    }
  };

  const handleCopyQuestion = (faq: FAQItem) => {
    navigator.clipboard.writeText(`Q: ${faq.question}\nA: ${faq.answer}`);
    setCopiedId(faq.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askName || !askEmail || !askQuestion) {
      setAskError('Please fill out all required fields.');
      return;
    }

    setSubmittingAsk(true);
    setAskError('');

    try {
      const res = await fetch('/api/public/faqs/submit-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: askName,
          email: askEmail,
          phone: askPhone,
          category: askCategory,
          question: askQuestion
        })
      });

      const data = await res.json();
      if (data.success) {
        setAskSuccess(true);
      } else {
        throw new Error(data.error || 'Failed to submit question.');
      }
    } catch (err: any) {
      setAskError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmittingAsk(false);
    }
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'All' || faq.categoryName === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      (faq.tags && faq.tags.some(t => t.toLowerCase().includes(query)));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {/* HEADER SECTION */}
      <section className="relative py-20 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-widest mb-4">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>MADECC Help Centre & Knowledge Base</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Frequently Asked Questions
          </h1>

          <p className="text-slate-300 text-base max-w-2xl mx-auto mb-8">
            Answers to common questions about construction, engineering, quantity surveying, cost estimation and working with MADECC Group.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by topic, keyword (e.g. BOQ, Quote, Regional coverage, Materials)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 shadow-xl transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT AREA */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Category Filters Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-mono whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Action Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
          <span className="text-xs font-mono text-slate-400">
            Showing <strong className="text-amber-400">{filteredFaqs.length}</strong> topics in <strong className="text-white">{selectedCategory}</strong>
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportFaqsPDF(filteredFaqs, selectedCategory)}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Export Dossier (PDF)</span>
            </button>

            <button
              onClick={() => {
                setAskModalOpen(true);
                setAskSuccess(false);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask a Question</span>
            </button>
          </div>
        </div>

        {/* ACCORDION LIST */}
        {filteredFaqs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No matching questions found</h3>
            <p className="text-xs text-slate-400 mb-6">Try searching with another keyword or ask our team directly.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-medium"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFaqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isOpen
                      ? 'bg-slate-900/90 border-amber-500/40 shadow-lg'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full p-5 text-left flex items-start justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-mono font-bold mt-0.5 shrink-0">
                        Q
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-white leading-snug">
                          {faq.question}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {faq.categoryName}
                          </span>
                          {faq.tags && faq.tags.map(t => (
                            <span key={t} className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                      {isOpen ? <ChevronUp className="w-5 h-5 text-amber-400" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 text-sm text-slate-300 leading-relaxed">
                      <p className="whitespace-pre-line mb-4">{faq.answer}</p>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 text-xs">
                        {faq.relatedPage && onNavigateToTab && (
                          <button
                            onClick={() => onNavigateToTab(faq.relatedPage!)}
                            className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Explore Related Tool</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => handleCopyQuestion(faq)}
                          className="text-slate-400 hover:text-white flex items-center gap-1 font-mono text-[11px] ml-auto"
                        >
                          {copiedId === faq.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Q&A</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* STILL NEED HELP CTA BLOCK */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest block mb-1">Direct Assistance</span>
            <h2 className="text-2xl font-bold text-white">Still Need Help or Have a Specific Project Requirement?</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-xl">
              Our engineering team is ready to provide tailored technical advice, site visits, or custom BOQ cost estimates.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            {onNavigateToTab && (
              <>
                <button
                  onClick={() => onNavigateToTab('request-a-quote')}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Request a Quote</span>
                </button>

                <button
                  onClick={() => onNavigateToTab('contact')}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>Contact MADECC</span>
                </button>
              </>
            )}
          </div>
        </div>

      </section>

      {/* ASK A QUESTION MODAL */}
      {askModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setAskModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              <span>Ask MADECC Group</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Submit your question directly to our technical desk. We respond via email within 24 hours.
            </p>

            {askSuccess ? (
              <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-base font-bold text-white mb-1">Question Submitted Successfully!</h4>
                <p className="text-xs text-slate-300 mb-4">
                  Thank you for reaching out. Our engineering team has received your query and will reply via email.
                </p>
                <button
                  onClick={() => setAskModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleAskSubmit} className="space-y-4">
                {askError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    {askError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={askName}
                    onChange={(e) => setAskName(e.target.value)}
                    placeholder="e.g. Jean-Paul Mbida"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={askEmail}
                      onChange={(e) => setAskEmail(e.target.value)}
                      placeholder="jp.mbida@company.cm"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Phone / WhatsApp</label>
                    <input
                      type="text"
                      value={askPhone}
                      onChange={(e) => setAskPhone(e.target.value)}
                      placeholder="+237 670 00 00 00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Topic Category</label>
                  <select
                    value={askCategory}
                    onChange={(e) => setAskCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="General">General Inquiry</option>
                    <option value="Construction & Execution">Construction & Execution</option>
                    <option value="BOQ & Quantity Surveying">BOQ & Quantity Surveying</option>
                    <option value="Request a Quote">Request a Quote</option>
                    <option value="Suppliers & Subcontractors">Suppliers & Subcontractors</option>
                    <option value="Tenders">Tenders</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Your Question *</label>
                  <textarea
                    rows={4}
                    required
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder="Describe your question or project inquiry..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAskModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAsk}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    {submittingAsk ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Question</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
