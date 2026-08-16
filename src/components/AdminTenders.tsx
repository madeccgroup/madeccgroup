import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  Search,
  Filter,
  Download,
  FileText,
  Save,
  X,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  History,
  Building2,
  Calendar,
  MapPin,
  Upload
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
  openingDate: string;
  closingDate: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'ARCHIVED';
  contactInstructions?: string;
}

interface EoiSubmission {
  id: number;
  submissionNumber: string;
  tenderId: number;
  tenderReference: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  expressionOfInterest: string;
  status: string;
  reviewNotes?: string;
  createdAt: string;
}

export const AdminTenders: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tenders' | 'eois' | 'audit'>('tenders');

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [eois, setEois] = useState<EoiSubmission[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Tender Modal
  const [tenderModalOpen, setTenderModalOpen] = useState(false);
  const [editingTender, setEditingTender] = useState<Partial<Tender> | null>(null);

  // EOI Detail Modal
  const [selectedEoi, setSelectedEoi] = useState<EoiSubmission | null>(null);
  const [eoiReviewNotes, setEoiReviewNotes] = useState('');
  const [eoiStatus, setEoiStatus] = useState('');

  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch('/api/admin/tenders')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.tenders) setTenders(data.tenders);
          if (data.eois) setEois(data.eois);
          if (data.auditLogs) setAuditLogs(data.auditLogs);
        }
      })
      .catch(err => console.error('Failed to load admin tenders:', err));
  };

  const handleSaveTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTender?.title || !editingTender?.tenderNumber) return;

    try {
      const res = await fetch('/api/admin/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTender)
      });
      const data = await res.json();
      if (data.success) {
        setTenderModalOpen(false);
        setEditingTender(null);
        setMsg({ text: 'Tender notice saved successfully!', type: 'success' });
        loadData();
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'Save failed', type: 'error' });
    }
  };

  const handleStatusChange = async (tender: Tender, newStatus: string) => {
    try {
      await fetch(`/api/admin/tenders/${tender.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTender = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tender notice?')) return;
    try {
      await fetch(`/api/admin/tenders/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicateTender = async (tender: Tender) => {
    try {
      await fetch('/api/admin/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tender,
          id: undefined,
          tenderNumber: `${tender.tenderNumber}-COPY`,
          title: `${tender.title} (Copy)`,
          status: 'DRAFT'
        })
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEoiReview = async () => {
    if (!selectedEoi) return;
    try {
      await fetch(`/api/admin/tenders/eois/${selectedEoi.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: eoiStatus,
          reviewNotes: eoiReviewNotes
        })
      });
      setSelectedEoi(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredTenders = tenders.filter(t => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQ = !q || t.title.toLowerCase().includes(q) || t.tenderNumber.toLowerCase().includes(q) || t.location.toLowerCase().includes(q);
    return matchesStatus && matchesQ;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">OPEN</span>;
      case 'CLOSING_SOON':
        return <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30">CLOSING SOON</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-slate-800 text-slate-400">CLOSED</span>;
      case 'DRAFT':
        return <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-slate-800 text-slate-300">DRAFT</span>;
      default:
        return <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-1">
            <Briefcase className="w-4 h-4" />
            <span>MADECC CMS • Procurement & Tenders</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Tenders & Opportunities CMS</h2>
        </div>

        <button
          onClick={() => {
            setEditingTender({
              categoryName: 'Structural Works',
              status: 'OPEN',
              tenderNumber: `TND-2026-MDCC-${Math.floor(100 + Math.random() * 900)}`,
              openingDate: new Date().toISOString().split('T')[0]
            });
            setTenderModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Tender Notice</span>
        </button>
      </div>

      {msg && (
        <div className={`mb-6 p-4 rounded-xl text-xs ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      {/* TABS & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('tenders')}
            className={`px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'tenders'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Tenders ({tenders.length})
          </button>

          <button
            onClick={() => setActiveTab('eois')}
            className={`px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'eois'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Expressions of Interest ({eois.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Audit History
          </button>
        </div>

        {activeTab === 'tenders' && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tender or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSING_SOON">CLOSING SOON</option>
              <option value="CLOSED">CLOSED</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: TENDERS TABLE */}
      {activeTab === 'tenders' && (
        <div className="space-y-3">
          {filteredTenders.map((tender) => (
            <div key={tender.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-amber-400">{tender.tenderNumber}</span>
                  <span className="text-sm font-bold text-white">{tender.title}</span>
                  {getStatusBadge(tender.status)}
                </div>
                <p className="text-xs text-slate-400">
                  Category: <strong className="text-slate-200">{tender.categoryName}</strong> • Location: {tender.location} • Closes: {tender.closingDate ? new Date(tender.closingDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={tender.status}
                  onChange={(e) => handleStatusChange(tender, e.target.value)}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSING_SOON">CLOSING SOON</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="AWARDED">AWARDED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>

                <button
                  onClick={() => exportTenderNoticePDF(tender)}
                  className="p-2 text-slate-400 hover:text-amber-400"
                  title="PDF Notice"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setEditingTender(tender);
                    setTenderModalOpen(true);
                  }}
                  className="p-2 text-slate-400 hover:text-white"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDuplicateTender(tender)}
                  className="p-2 text-slate-400 hover:text-amber-400"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteTender(tender.id)}
                  className="p-2 text-slate-400 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: EOIS */}
      {activeTab === 'eois' && (
        <div className="space-y-3">
          {eois.map((eoi) => (
            <div key={eoi.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-amber-400">{eoi.submissionNumber}</span>
                  <span className="text-sm font-bold text-white">{eoi.companyName}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">Ref: {eoi.tenderReference}</span>
                </div>
                <p className="text-xs text-slate-400">
                  Contact: {eoi.contactPerson} ({eoi.email} | {eoi.phone})
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedEoi(eoi);
                  setEoiReviewNotes(eoi.reviewNotes || '');
                  setEoiStatus(eoi.status || 'RECEIVED');
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Review EOI</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="space-y-2">
          {auditLogs.map((log, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between">
              <span className="text-amber-400">{log.action}</span>
              <span className="text-slate-300">{log.recordTitle}</span>
              <span className="text-slate-500">{log.performedBy}</span>
              <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* EDIT TENDER MODAL */}
      {tenderModalOpen && editingTender && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">Edit Tender Opportunity</h3>
            <form onSubmit={handleSaveTender} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Tender Reference No *</label>
                  <input
                    type="text"
                    required
                    value={editingTender.tenderNumber || ''}
                    onChange={(e) => setEditingTender({ ...editingTender, tenderNumber: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={editingTender.categoryName || ''}
                    onChange={(e) => setEditingTender({ ...editingTender, categoryName: e.target.value })}
                    placeholder="e.g. Structural Works"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Tender Title *</label>
                <input
                  type="text"
                  required
                  value={editingTender.title || ''}
                  onChange={(e) => setEditingTender({ ...editingTender, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Client / Project</label>
                  <input
                    type="text"
                    value={editingTender.clientProject || ''}
                    onChange={(e) => setEditingTender({ ...editingTender, clientProject: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Location</label>
                  <input
                    type="text"
                    value={editingTender.location || ''}
                    onChange={(e) => setEditingTender({ ...editingTender, location: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Overview Description</label>
                <textarea
                  rows={3}
                  value={editingTender.description || ''}
                  onChange={(e) => setEditingTender({ ...editingTender, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Scope of Work</label>
                <textarea
                  rows={3}
                  value={editingTender.scopeOfWork || ''}
                  onChange={(e) => setEditingTender({ ...editingTender, scopeOfWork: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Eligibility Requirements</label>
                <textarea
                  rows={2}
                  value={editingTender.eligibility || ''}
                  onChange={(e) => setEditingTender({ ...editingTender, eligibility: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Opening Date</label>
                  <input
                    type="date"
                    value={editingTender.openingDate || ''}
                    onChange={(e) => setEditingTender({ ...editingTender, openingDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Closing Date</label>
                  <input
                    type="date"
                    value={editingTender.closingDate || ''}
                    onChange={(e) => setEditingTender({ ...editingTender, closingDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Status</label>
                  <select
                    value={editingTender.status || 'OPEN'}
                    onChange={(e) => setEditingTender({ ...editingTender, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSING_SOON">CLOSING SOON</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="AWARDED">AWARDED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setTenderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Save Tender Notice
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* REVIEW EOI MODAL */}
      {selectedEoi && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 relative">

            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
              <div>
                <span className="font-mono text-xs text-amber-400 font-bold block">{selectedEoi.submissionNumber}</span>
                <h3 className="text-lg font-bold text-white">{selectedEoi.companyName}</h3>
              </div>
              <button onClick={() => setSelectedEoi(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                <div>Ref: {selectedEoi.tenderReference}</div>
                <div>Contact: {selectedEoi.contactPerson} ({selectedEoi.email})</div>
                <div>Phone: {selectedEoi.phone}</div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">Expression Statement:</h4>
                <p className="p-3 rounded-xl bg-slate-950 border border-slate-800">{selectedEoi.expressionOfInterest || 'No text provided.'}</p>
              </div>

              <div>
                <label className="block font-mono text-slate-400 mb-1">EOI Review Status</label>
                <select
                  value={eoiStatus}
                  onChange={(e) => setEoiStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                >
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="PREQUALIFIED">PREQUALIFIED FOR BIDDING</option>
                  <option value="SHORTLISTED">SHORTLISTED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-slate-400 mb-1">Internal Evaluation Remarks</label>
                <textarea
                  rows={3}
                  value={eoiReviewNotes}
                  onChange={(e) => setEoiReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEoi(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEoiReview}
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Save Review
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
