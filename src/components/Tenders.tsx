import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Calendar,
  Clock,
  MapPin,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Send,
  X,
  Eye,
  Sparkles,
  Upload,
  ShieldCheck,
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { exportTenderNoticePDF, exportTenderNoticeDOCX } from '../lib/exportEngine.ts';

interface Tender {
  id: number;
  tenderNumber: string;
  title: string;
  slug: string;
  categoryName: string;
  clientProject: string;
  location: string;
  description: string;
  scopeOfWork: string;
  eligibility: string;
  requiredExperience?: string;
  requiredDocuments?: string;
  submissionMethod?: string;
  openingDate: string;
  closingDate: string;
  status: 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
  contactInstructions?: string;
  attachments?: { title: string; fileUrl: string; fileType?: string }[];
}

interface Props {
  onNavigateToTab?: (tab: string) => void;
}

export const Tenders: React.FC<Props> = ({ onNavigateToTab }) => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Tender for Modal Detail
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);

  // Expression of Interest (EOI) Modal
  const [eoiModalOpen, setEoiModalOpen] = useState(false);
  const [eoiCompany, setEoiCompany] = useState('');
  const [eoiContact, setEoiContact] = useState('');
  const [eoiEmail, setEoiEmail] = useState('');
  const [eoiPhone, setEoiPhone] = useState('');
  const [eoiStatement, setEoiStatement] = useState('');
  const [eoiDocs, setEoiDocs] = useState<{ title: string; fileUrl: string }[]>([]);
  const [uploadingEoi, setUploadingEoi] = useState(false);
  const [submittingEoi, setSubmittingEoi] = useState(false);
  const [eoiSuccess, setEoiSuccess] = useState<string | null>(null);
  const [eoiError, setEoiError] = useState('');

  useEffect(() => {
    fetch('/api/public/tenders')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.tenders)) {
          setTenders(data.tenders);
          const cats = Array.from(new Set(data.tenders.map((t: Tender) => t.categoryName))) as string[];
          setCategories(['All', ...cats]);
        } else {
          loadFallbackTenders();
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('Using fallback tender list:', err);
        loadFallbackTenders();
        setLoading(false);
      });
  }, []);

  const loadFallbackTenders = () => {
    const defaultTenders: Tender[] = [
      {
        id: 1,
        tenderNumber: 'TND-2026-MDCC-001',
        title: 'Subcontract Supply & Erection of Structural Steel Framing for Commercial Complex',
        slug: 'structural-steel-framing-douala',
        categoryName: 'Structural Works',
        clientProject: 'Douala Commercial Hub Phase II',
        location: 'Douala, Littoral Region',
        description: 'MADECC Group invites prequalified steel fabrication sub-contractors to submit Expressions of Interest (EOI) for the supply, fabrication, and site erection of 340 Metric Tons of structural steel frames and roof trusses.',
        scopeOfWork: '1. Supply of certified EN10025 grade S355 steel sections.\n2. Shop fabrication and anti-corrosion primer coating.\n3. On-site crane erection, torque bolting, and non-destructive weld testing.',
        eligibility: 'Subcontractors must possess proven track record in heavy steel structures in Cameroon, ISO 9001 certification or equivalent, and active tax compliance.',
        requiredExperience: 'At least 5 years operating in Central Africa with minimum 2 projects over 200 tons.',
        submissionMethod: 'Online EOI Submission via MADECC Portal or sealed envelope at MADECC Head Office Douala.',
        openingDate: '2026-02-01',
        closingDate: '2026-03-15',
        status: 'OPEN',
        contactInstructions: 'Direct clarifications to procurement@madeccgroup.com referencing TND-2026-MDCC-001.'
      },
      {
        id: 2,
        tenderNumber: 'TND-2026-MDCC-002',
        title: 'Bulk Supply of 42.5R Portland Cement & Deformed Steel Rebar (FeE500)',
        slug: 'bulk-cement-rebar-supply',
        categoryName: 'Materials Procurement',
        clientProject: 'Yaoundé Residential Estate & Infrastructure',
        location: 'Yaoundé, Centre Region',
        description: 'Prequalification tender for national building material suppliers to provide 12,000 bags of 42.5R Portland Cement and 180 Tons of High-Yield Rebar.',
        scopeOfWork: 'Scheduled phased delivery directly to active site storage in Yaoundé with batch quality test certificates.',
        eligibility: 'Licensed Cameroonian suppliers or direct cement mill representatives with warehouse logistics capacity.',
        openingDate: '2026-02-10',
        closingDate: '2026-02-28',
        status: 'CLOSING_SOON',
        contactInstructions: 'Contact Procurement Desk: +237 670 00 00 00.'
      }
    ];

    setTenders(defaultTenders);
    const cats = Array.from(new Set(defaultTenders.map(t => t.categoryName)));
    setCategories(['All', ...cats]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingEoi(true);
    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setEoiDocs([...eoiDocs, { title: files[0].name, fileUrl: data.url }]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploadingEoi(false);
    }
  };

  const handleEoiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTender) return;
    if (!eoiCompany || !eoiContact || !eoiEmail || !eoiPhone) {
      setEoiError('Please fill out all mandatory contact fields.');
      return;
    }

    setSubmittingEoi(true);
    setEoiError('');

    try {
      const res = await fetch(`/api/public/tenders/${selectedTender.id}/submit-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderReference: selectedTender.tenderNumber,
          companyName: eoiCompany,
          contactPerson: eoiContact,
          email: eoiEmail,
          phone: eoiPhone,
          expressionOfInterest: eoiStatement,
          supportingDocuments: eoiDocs
        })
      });

      const data = await res.json();
      if (data.success) {
        setEoiSuccess(data.submissionNumber || 'EOI-2026-RECEIVED');
      } else {
        throw new Error(data.error || 'Submission failed.');
      }
    } catch (err: any) {
      setEoiError(err.message || 'Failed to submit expression of interest.');
    } finally {
      setSubmittingEoi(false);
    }
  };

  const filteredTenders = tenders.filter(t => {
    const matchesCat = selectedCategory === 'All' || t.categoryName === selectedCategory;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      t.title.toLowerCase().includes(query) ||
      t.tenderNumber.toLowerCase().includes(query) ||
      t.location.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query);
    return matchesCat && matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold">OPEN</span>;
      case 'CLOSING_SOON':
        return <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono font-bold">CLOSING SOON</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-mono">CLOSED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">{status}</span>;
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {/* HERO BANNER */}
      <section className="relative py-20 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-widest mb-4">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <span>Procurement & Subcontracting Opportunities</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Tenders & Opportunities
          </h1>

          <p className="text-slate-300 text-base max-w-2xl mx-auto mb-8">
            Explore current procurement, subcontracting and partnership opportunities with MADECC Group.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by tender number, title, trade category or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* MAIN LISTINGS SECTION */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Category & Status Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {['ALL', 'OPEN', 'CLOSING_SOON', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-800 text-amber-400 border border-amber-500/40 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

        </div>

        {/* TENDER CARDS GRID */}
        {filteredTenders.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">No active tender notices match your query</h3>
            <p className="text-xs text-slate-400 mb-6">Check back soon or submit a supplier prequalification application.</p>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('suppliers')}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Register as Supplier / Subcontractor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTenders.map((tender) => (
              <div
                key={tender.id}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                      {tender.tenderNumber}
                    </span>
                    {getStatusBadge(tender.status)}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">
                    {tender.title}
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed mb-4 line-clamp-3">
                    {tender.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-slate-400 mb-6">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{tender.location}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Closes: {tender.closingDate ? new Date(tender.closingDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-slate-500">{tender.categoryName}</span>

                  <button
                    onClick={() => setSelectedTender(tender)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>View Opportunity Pack</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </section>

      {/* TENDER DETAIL MODAL */}
      {selectedTender && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 relative shadow-2xl my-8">

            <button
              onClick={() => setSelectedTender(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white p-1"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/30">
                {selectedTender.tenderNumber}
              </span>
              {getStatusBadge(selectedTender.status)}
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
              {selectedTender.title}
            </h2>

            <p className="text-xs font-mono text-slate-400 mb-6">
              Client/Project: {selectedTender.clientProject} • Location: {selectedTender.location}
            </p>

            <div className="space-y-6 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">

              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-amber-400 mb-2">1. Overview & Project Context</h4>
                <p className="whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800">{selectedTender.description}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-amber-400 mb-2">2. Detailed Scope of Work</h4>
                <p className="whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800">{selectedTender.scopeOfWork}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-amber-400 mb-2">3. Eligibility & Prequalification Criteria</h4>
                <p className="whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800">{selectedTender.eligibility}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block">Opening Date</span>
                  <span className="text-white font-bold">{selectedTender.openingDate ? new Date(selectedTender.openingDate).toLocaleDateString() : 'Immediate'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Closing Date</span>
                  <span className="text-amber-400 font-bold">{selectedTender.closingDate ? new Date(selectedTender.closingDate).toLocaleDateString() : 'Open'}</span>
                </div>
              </div>

            </div>

            {/* ACTION FOOTER */}
            <div className="pt-6 mt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportTenderNoticePDF(selectedTender)}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Notice PDF</span>
                </button>

                <button
                  onClick={() => exportTenderNoticeDOCX(selectedTender)}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Notice DOCX</span>
                </button>
              </div>

              {selectedTender.status !== 'CLOSED' && (
                <button
                  onClick={() => {
                    setEoiModalOpen(true);
                    setEoiSuccess(null);
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Expression of Interest (EOI)</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* EXPRESSION OF INTEREST (EOI) SUBMISSION MODAL */}
      {eoiModalOpen && selectedTender && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 relative shadow-2xl">

            <button
              onClick={() => setEoiModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-500" />
              <span>Submit Expression of Interest</span>
            </h3>
            <p className="text-xs font-mono text-amber-400 mb-6">
              Ref: {selectedTender.tenderNumber} — {selectedTender.title}
            </p>

            {eoiSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-base font-bold text-white mb-1">EOI Submitted Successfully!</h4>
                <p className="text-xs text-slate-300 mb-2">
                  Submission Code: <strong className="text-amber-400 font-mono">{eoiSuccess}</strong>
                </p>
                <p className="text-xs text-slate-400 mb-6">
                  Our procurement evaluation committee will review your company application file.
                </p>
                <button
                  onClick={() => {
                    setEoiModalOpen(false);
                    setSelectedTender(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleEoiSubmit} className="space-y-4">
                {eoiError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    {eoiError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Company / Enterprise Name *</label>
                  <input
                    type="text"
                    required
                    value={eoiCompany}
                    onChange={(e) => setEoiCompany(e.target.value)}
                    placeholder="e.g. Cameroonian Building Solutions SA"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Contact Person *</label>
                    <input
                      type="text"
                      required
                      value={eoiContact}
                      onChange={(e) => setEoiContact(e.target.value)}
                      placeholder="e.g. Eng. Paul Nkou"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={eoiEmail}
                      onChange={(e) => setEoiEmail(e.target.value)}
                      placeholder="tender@company.cm"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={eoiPhone}
                    onChange={(e) => setEoiPhone(e.target.value)}
                    placeholder="+237 670 00 00 00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Expression of Interest Statement</label>
                  <textarea
                    rows={3}
                    value={eoiStatement}
                    onChange={(e) => setEoiStatement(e.target.value)}
                    placeholder="Briefly state your technical capacity, available manpower, and equipment..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Attach Technical Dossier (PDF)</label>
                  <label className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>{uploadingEoi ? 'Uploading...' : 'Upload File'}</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>

                  {eoiDocs.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {eoiDocs.map((doc, i) => (
                        <div key={i} className="text-[11px] font-mono text-emerald-400">
                          ✓ {doc.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEoiModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEoi}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    {submittingEoi ? (
                      <span>Submitting EOI...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Confirm EOI Submission</span>
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
