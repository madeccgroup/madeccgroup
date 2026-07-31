import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Send, 
  Copy, 
  RefreshCw, 
  Search, 
  Filter, 
  Edit3, 
  Eye, 
  FileText, 
  Building2, 
  User, 
  MapPin, 
  DollarSign, 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Lock, 
  Printer, 
  Layers, 
  Calculator, 
  Info,
  Calendar,
  Sparkles
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { generateBoqDocx, generateBoqCsv } from '../utils/boqExport';
import { generateBoqPdf } from '../utils/boqPdfExport';

interface BoqItem {
  id?: number;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: string | number;
  unitRate: string | number;
  amount: string | number;
  notes?: string;
  measurementBasis?: string;
  internalMaterialCost?: string | number;
  internalLabourCost?: string | number;
  internalPlantCost?: string | number;
  internalOtherCost?: string | number;
  displayOrder?: number;
}

interface BoqSection {
  id?: number;
  sectionCode: string;
  title: string;
  displayOrder?: number;
  subtotal: string | number;
  items: BoqItem[];
}

interface BoqData {
  id?: number;
  boqReference: string;
  projectId?: number | null;
  projectName: string;
  clientId?: number | null;
  clientName: string;
  clientEmail?: string;
  clientNiu?: string;
  clientAddress?: string;
  location: string;
  description?: string;
  datePrepared?: string;
  preparedBy: string;
  revisionNumber: string;
  currency: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  overheadPercent: string | number;
  contingencyPercent: string | number;
  profitPercent: string | number;
  taxPercent: string | number;
  subtotal: string | number;
  overheadAmount: string | number;
  contingencyAmount: string | number;
  profitAmount: string | number;
  taxAmount: string | number;
  grandTotal: string | number;
  pdfUrl?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  sentToClientAt?: string | null;
  sentToClientBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sections?: BoqSection[];
  revisions?: any[];
  auditLogs?: any[];
}

interface BoqStudioProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  currentUser?: any;
}

const PREDEFINED_UNITS = [
  'm', 'm²', 'm³', 'kg', 't', 'No.', 'item', 'LS', 'day', 'hour', 'bag', 'set', 'lot', 'packet', 'bar', 'ml', 'l', 'mm', 'cm', 'boards'
];

const PREDEFINED_SECTIONS_TEMPLATES = [
  {
    code: 'A',
    title: 'PRELIMINARIES & GENERAL ITEMS',
    items: [
      { itemNumber: 'A1', description: 'Site mobilization, setup of site office, temporary fencing and security', unit: 'LS', quantity: 1, unitRate: 750000 },
      { itemNumber: 'A2', description: 'Temporary water and electrical power connection for construction duration', unit: 'LS', quantity: 1, unitRate: 350000 },
      { itemNumber: 'A3', description: 'Health, Safety & Environmental compliance, PPE supply and signage', unit: 'LS', quantity: 1, unitRate: 250000 }
    ]
  },
  {
    code: 'B',
    title: 'SUBSTRUCTURE (EARTHWORKS & FOUNDATIONS)',
    items: [
      { itemNumber: 'B1', description: 'Excavation in ordinary soil for pad and strip footings up to 1.80m depth', unit: 'm³', quantity: 85, unitRate: 8500 },
      { itemNumber: 'B2', description: 'Backfilling with selected granular soil around foundation structures, compacted in 150mm layers', unit: 'm³', quantity: 45, unitRate: 6000 },
      { itemNumber: 'B3', description: 'Plain concrete blinding bed (C15/20) 75mm thick under footings', unit: 'm³', quantity: 8.5, unitRate: 78000 },
      { itemNumber: 'B4', description: 'Reinforced concrete foundation footings & ground beams (C25/30) including formwork and steel', unit: 'm³', quantity: 24, unitRate: 285000 },
      { itemNumber: 'B5', description: 'Damp Proof Course (DPC) membrane under slab and masonry', unit: 'm²', quantity: 120, unitRate: 3500 }
    ]
  },
  {
    code: 'C',
    title: 'SUPERSTRUCTURE (MASONRY & CONCRETE FRAME)',
    items: [
      { itemNumber: 'C1', description: 'Hollow cement blockwork 20x20x40cm laid in cement mortar (1:4)', unit: 'm²', quantity: 340, unitRate: 8500 },
      { itemNumber: 'C2', description: 'Reinforced concrete columns and lintels (C25/30) including High Yield steel bars', unit: 'm³', quantity: 18, unitRate: 310000 },
      { itemNumber: 'C3', description: 'Reinforced suspended concrete slab 15cm thick including formwork & reinforcement', unit: 'm²', quantity: 140, unitRate: 42000 }
    ]
  },
  {
    code: 'D',
    title: 'ROOFING & WATERPROOFING',
    items: [
      { itemNumber: 'D1', description: 'Hardwood timber roof truss structure treated against termites & fungus', unit: 'm²', quantity: 165, unitRate: 14500 },
      { itemNumber: 'D2', description: 'Aluminum roof sheet coverage 0.55mm prepainted with ridge caps and accessories', unit: 'm²', quantity: 175, unitRate: 18500 }
    ]
  },
  {
    code: 'E',
    title: 'FINISHES (PLASTERING, TILING & PAINTING)',
    items: [
      { itemNumber: 'E1', description: 'Internal & external wall plastering 15mm thick in cement mortar (1:4) smooth troweled', unit: 'm²', quantity: 720, unitRate: 4200 },
      { itemNumber: 'E2', description: 'Vitrified porcelain floor tiles 60x60cm laid with high-grade tile adhesive', unit: 'm²', quantity: 130, unitRate: 16500 },
      { itemNumber: 'E3', description: 'Application of 1 coat primer & 2 coats weather-shield acrylic emulsion paint', unit: 'm²', quantity: 720, unitRate: 3200 }
    ]
  }
];

export default function BoqStudio({ showToast, currentUser }: BoqStudioProps) {
  // Navigation tabs: 'list' | 'editor' | 'review' | 'approved_view'
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'review' | 'approved_view'>('list');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Data lists
  const [boqList, setBoqList] = useState<BoqData[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Active BOQ Form State
  const [currentBoq, setCurrentBoq] = useState<BoqData>({
    boqReference: '',
    projectName: '',
    clientName: '',
    clientEmail: '',
    clientNiu: '',
    clientAddress: '',
    location: '',
    description: '',
    preparedBy: currentUser?.name || 'MADECC QS Lead Architect',
    revisionNumber: 'REV-00',
    currency: 'XAF',
    status: 'DRAFT',
    overheadPercent: 5,
    contingencyPercent: 5,
    profitPercent: 10,
    taxPercent: 0,
    subtotal: 0,
    overheadAmount: 0,
    contingencyAmount: 0,
    profitAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
    sections: []
  });

  // UI state inside editor
  const [showInternalCosts, setShowInternalCosts] = useState<boolean>(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);

  // Email Modal State
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [emailTargetBoq, setEmailTargetBoq] = useState<BoqData | null>(null);
  const [emailRecipient, setEmailRecipient] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailMessage, setEmailMessage] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // PDF Ref for generation
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [pdfOrientation, setPdfOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const logAuditEvent = async (boqId: number, action: string, details: string) => {
    try {
      await fetch(`/api/boqs/${boqId}/audit-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, details })
      });
    } catch (err) {
      console.error('Audit log error:', err);
    }
  };

  // Load BOQs, Projects, and Users from Live DB on Mount
  useEffect(() => {
    fetchBoqData();
    fetchProjectsAndClients();
  }, []);

  const fetchBoqData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/boqs');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setBoqList(data);
      }
    } catch (err) {
      console.error('Failed fetching BOQs:', err);
      if (showToast) showToast('Failed to load BOQ estimates from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectsAndClients = async () => {
    try {
      const projRes = await fetch('/api/projects');
      const projContentType = projRes.headers.get('content-type');
      if (projRes.ok && projContentType && projContentType.includes('application/json')) {
        const pData = await projRes.json();
        setProjectsList(pData);
      }
      const userRes = await fetch('/api/users');
      const userContentType = userRes.headers.get('content-type');
      if (userRes.ok && userContentType && userContentType.includes('application/json')) {
        const uData = await userRes.json();
        setClientsList(uData);
      }
    } catch (err) {
      console.error('Failed fetching support lists:', err);
    }
  };

  // Create New BOQ Action
  const handleStartCreate = () => {
    const year = new Date().getFullYear();
    const nextSeq = String(boqList.length + 1).padStart(4, '0');
    
    // Initialize with standard predefined sections
    const defaultSections: BoqSection[] = PREDEFINED_SECTIONS_TEMPLATES.map((tmpl, idx) => ({
      sectionCode: tmpl.code,
      title: tmpl.title,
      displayOrder: idx,
      subtotal: tmpl.items.reduce((acc, it) => acc + (it.quantity * it.unitRate), 0),
      items: tmpl.items.map((it, itIdx) => ({
        itemNumber: it.itemNumber,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitRate: it.unitRate,
        amount: it.quantity * it.unitRate,
        internalMaterialCost: Math.round(it.unitRate * 0.45),
        internalLabourCost: Math.round(it.unitRate * 0.30),
        internalPlantCost: Math.round(it.unitRate * 0.10),
        internalOtherCost: Math.round(it.unitRate * 0.05),
        displayOrder: itIdx
      }))
    }));

    const initial: BoqData = {
      boqReference: `MADECC-BOQ-${year}-${nextSeq}`,
      projectName: '',
      clientName: '',
      clientEmail: '',
      clientNiu: '',
      clientAddress: '',
      location: 'Douala, Littoral Region, Cameroon',
      description: 'Comprehensive construction bill of quantities and engineering rate estimate.',
      preparedBy: currentUser?.name || 'MADECC QS Engineer',
      revisionNumber: 'REV-00',
      currency: 'XAF',
      status: 'DRAFT',
      overheadPercent: 5,
      contingencyPercent: 5,
      profitPercent: 10,
      taxPercent: 0,
      subtotal: 0,
      overheadAmount: 0,
      contingencyAmount: 0,
      profitAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      sections: defaultSections
    };

    recalculateBoqState(initial);
    setViewMode('editor');
  };

  // Open existing BOQ for view/edit
  const handleOpenBoq = async (id: number, targetView?: 'editor' | 'review' | 'approved_view') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/boqs/${id}`);
      if (res.ok) {
        const fullBoq = await res.json();
        setCurrentBoq(fullBoq);
        if (targetView) {
          setViewMode(targetView);
        } else if (fullBoq.status === 'APPROVED') {
          setViewMode('approved_view');
        } else {
          setViewMode('editor');
        }
      } else {
        if (showToast) showToast('Could not load requested BOQ record', 'error');
      }
    } catch (err) {
      console.error('Error fetching single BOQ:', err);
    } finally {
      setLoading(false);
    }
  };

  // Select project preset
  const handleSelectProject = (projectId: number) => {
    const proj = projectsList.find(p => p.id === projectId);
    if (proj) {
      setCurrentBoq(prev => ({
        ...prev,
        projectId: proj.id,
        projectName: proj.title,
        location: proj.location || prev.location,
        description: proj.description || prev.description
      }));
    }
  };

  // Select client preset
  const handleSelectClient = (clientId: number) => {
    const cli = clientsList.find(c => c.id === clientId);
    if (cli) {
      setCurrentBoq(prev => ({
        ...prev,
        clientId: cli.id,
        clientName: cli.name,
        clientEmail: cli.email,
        clientNiu: cli.clientNiu || prev.clientNiu || '',
        clientAddress: cli.location || prev.clientAddress || ''
      }));
    }
  };

  // Recalculate BOQ Amounts Server/Client side synchronously for real-time responsiveness
  const recalculateBoqState = (boqObj: BoqData): BoqData => {
    let grandSubtotal = 0;

    const updatedSections = (boqObj.sections || []).map((sec, sIdx) => {
      let secSubtotal = 0;
      const updatedItems = (sec.items || []).map((item, iIdx) => {
        const qty = parseFloat(String(item.quantity)) || 0;
        const rate = parseFloat(String(item.unitRate)) || 0;
        const amt = Math.round(qty * rate * 100) / 100;
        secSubtotal += amt;
        return {
          ...item,
          amount: amt,
          displayOrder: iIdx
        };
      });

      secSubtotal = Math.round(secSubtotal * 100) / 100;
      grandSubtotal += secSubtotal;

      return {
        ...sec,
        subtotal: secSubtotal,
        displayOrder: sIdx,
        items: updatedItems
      };
    });

    grandSubtotal = Math.round(grandSubtotal * 100) / 100;
    const ovhP = parseFloat(String(boqObj.overheadPercent)) || 0;
    const cntP = parseFloat(String(boqObj.contingencyPercent)) || 0;
    const prfP = parseFloat(String(boqObj.profitPercent)) || 0;
    const taxP = parseFloat(String(boqObj.taxPercent)) || 0;

    const ovhAmt = Math.round((grandSubtotal * (ovhP / 100)) * 100) / 100;
    const cntAmt = Math.round((grandSubtotal * (cntP / 100)) * 100) / 100;
    const prfAmt = Math.round((grandSubtotal * (prfP / 100)) * 100) / 100;
    const beforeTax = grandSubtotal + ovhAmt + cntAmt + prfAmt;
    const taxAmt = Math.round((beforeTax * (taxP / 100)) * 100) / 100;
    const finalGrandTotal = Math.round((beforeTax + taxAmt) * 100) / 100;

    const computed = {
      ...boqObj,
      subtotal: grandSubtotal,
      overheadAmount: ovhAmt,
      contingencyAmount: cntAmt,
      profitAmount: prfAmt,
      taxAmount: taxAmt,
      grandTotal: finalGrandTotal,
      sections: updatedSections
    };

    setCurrentBoq(computed);
    return computed;
  };

  // Item Field Change
  const handleItemChange = (secIndex: number, itemIndex: number, field: keyof BoqItem, value: any) => {
    setCurrentBoq(prev => {
      const secs = [...(prev.sections || [])];
      const items = [...(secs[secIndex].items || [])];
      items[itemIndex] = {
        ...items[itemIndex],
        [field]: value
      };
      secs[secIndex] = {
        ...secs[secIndex],
        items
      };
      return recalculateBoqState({ ...prev, sections: secs });
    });
  };

  // Add Item to Section
  const handleAddItem = (secIndex: number) => {
    setCurrentBoq(prev => {
      const secs = [...(prev.sections || [])];
      const sec = secs[secIndex];
      const newItemNo = `${sec.sectionCode}${sec.items.length + 1}`;
      const newItem: BoqItem = {
        itemNumber: newItemNo,
        description: '',
        unit: 'm²',
        quantity: 1,
        unitRate: 0,
        amount: 0,
        internalMaterialCost: 0,
        internalLabourCost: 0,
        internalPlantCost: 0,
        internalOtherCost: 0,
        displayOrder: sec.items.length
      };
      secs[secIndex] = {
        ...sec,
        items: [...sec.items, newItem]
      };
      return recalculateBoqState({ ...prev, sections: secs });
    });
  };

  // Delete Item from Section
  const handleDeleteItem = (secIndex: number, itemIndex: number) => {
    setCurrentBoq(prev => {
      const secs = [...(prev.sections || [])];
      const items = secs[secIndex].items.filter((_, idx) => idx !== itemIndex);
      secs[secIndex] = {
        ...secs[secIndex],
        items
      };
      return recalculateBoqState({ ...prev, sections: secs });
    });
  };

  // Add New Section
  const handleAddSection = () => {
    setCurrentBoq(prev => {
      const secs = [...(prev.sections || [])];
      const nextCode = String.fromCharCode(65 + secs.length);
      const newSec: BoqSection = {
        sectionCode: nextCode,
        title: `NEW SECTION (${nextCode})`,
        displayOrder: secs.length,
        subtotal: 0,
        items: [
          {
            itemNumber: `${nextCode}1`,
            description: 'Work item description',
            unit: 'm²',
            quantity: 1,
            unitRate: 10000,
            amount: 10000,
            displayOrder: 0
          }
        ]
      };
      return recalculateBoqState({ ...prev, sections: [...secs, newSec] });
    });
  };

  // Delete Section
  const handleDeleteSection = (secIndex: number) => {
    if ((currentBoq.sections || []).length <= 1) {
      if (showToast) showToast('A BOQ must contain at least one work section', 'error');
      return;
    }
    setCurrentBoq(prev => {
      const secs = prev.sections?.filter((_, idx) => idx !== secIndex) || [];
      return recalculateBoqState({ ...prev, sections: secs });
    });
  };

  // Save BOQ (Draft / Update)
  const handleSaveBoq = async () => {
    if (!currentBoq.projectName || !currentBoq.clientName) {
      if (showToast) showToast('Please specify Project Name and Client Name before saving', 'error');
      return;
    }

    setSaving(true);
    try {
      const isExisting = Boolean(currentBoq.id);
      const url = isExisting ? `/api/boqs/${currentBoq.id}` : '/api/boqs';
      const method = isExisting ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentBoq)
      });

      if (res.ok) {
        const saved = await res.json();
        setCurrentBoq(saved);
        if (showToast) showToast(`BOQ ${saved.boqReference} saved successfully!`, 'success');
        fetchBoqData();
      } else {
        const errJson = await res.json();
        if (showToast) showToast(errJson.error || 'Failed to save BOQ', 'error');
      }
    } catch (err: any) {
      console.error('Save BOQ error:', err);
      if (showToast) showToast('Failed to save BOQ to live database', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Submit for Manager Review
  const handleSubmitReview = async () => {
    await handleSaveBoq();
    if (!currentBoq.id) return;

    try {
      const res = await fetch(`/api/boqs/${currentBoq.id}/submit-review`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setCurrentBoq(updated);
        if (showToast) showToast(`BOQ ${updated.boqReference} submitted for review!`, 'success');
        setViewMode('review');
        fetchBoqData();
      }
    } catch (err) {
      console.error('Submit review error:', err);
    }
  };

  // Approve BOQ & Lock Version
  const handleApproveBoq = async () => {
    if (!currentBoq.id) return;
    if (!window.confirm(`Are you sure you want to approve BOQ ${currentBoq.boqReference}? Once approved, this revision will be locked against modifications.`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/boqs/${currentBoq.id}/approve`, { method: 'POST' });
      if (res.ok) {
        const approved = await res.json();
        setCurrentBoq(approved);
        if (showToast) showToast(`BOQ ${approved.boqReference} APPROVED and locked!`, 'success');
        setViewMode('approved_view');
        fetchBoqData();
      } else {
        const errJson = await res.json();
        if (showToast) showToast(errJson.error || 'Approval failed', 'error');
      }
    } catch (err: any) {
      console.error('Approve error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Create New Working Revision from Approved BOQ
  const handleCreateRevision = async () => {
    if (!currentBoq.id) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/boqs/${currentBoq.id}/revision`, { method: 'POST' });
      if (res.ok) {
        const rev = await res.json();
        setCurrentBoq(rev);
        if (showToast) showToast(`New revision ${rev.revisionNumber} created! Original approved record remains intact.`, 'success');
        setViewMode('editor');
        fetchBoqData();
      } else {
        const errJson = await res.json();
        if (showToast) showToast(errJson.error || 'Failed creating revision', 'error');
      }
    } catch (err) {
      console.error('Revision error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete BOQ
  const handleDeleteBoq = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this BOQ estimate? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/boqs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (showToast) showToast('BOQ estimate deleted', 'info');
        fetchBoqData();
        if (currentBoq.id === id) {
          setViewMode('list');
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // High-Precision Vector A4 PDF Generation & Cloud Storage Upload
  const handleGenerateAndSavePdf = async (customOrientation?: 'portrait' | 'landscape') => {
    setGeneratingPdf(true);
    const targetOrientation = customOrientation || pdfOrientation;

    try {
      if (showToast) showToast(`Generating official ${targetOrientation.toUpperCase()} A4 BOQ PDF document...`, 'info');

      // Generate vector PDF
      const { pdf, filename: pdfFileName } = await generateBoqPdf(currentBoq, {
        orientation: targetOrientation
      });

      // Convert PDF to blob for cloud upload
      const pdfBlob = pdf.output('blob');
      const formData = new FormData();
      formData.append('file', pdfBlob, pdfFileName);

      // Upload to server /api/upload
      let pdfPublicUrl = '';
      try {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          pdfPublicUrl = uploadData.url;
          console.log('PDF uploaded successfully to Cloud Storage:', pdfPublicUrl);
        }
      } catch (upErr) {
        console.warn('Cloud storage upload warning (local save proceeding):', upErr);
      }

      // Save PDF URL in database if BOQ exists
      if (currentBoq.id && pdfPublicUrl) {
        await fetch(`/api/boqs/${currentBoq.id}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfUrl: pdfPublicUrl })
        });
        setCurrentBoq(prev => ({ ...prev, pdfUrl: pdfPublicUrl }));
        fetchBoqData();
      }

      // Trigger local browser download
      pdf.save(pdfFileName);

      if (currentBoq.id) {
        await logAuditEvent(currentBoq.id, 'PDF_EXPORTED', `Exported BOQ ${currentBoq.boqReference} (${currentBoq.revisionNumber}) as ${targetOrientation.toUpperCase()} A4 PDF`);
      }

      if (showToast) showToast(`BOQ PDF exported successfully (${pdfFileName})!`, 'success');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      // Fallback to html2canvas if vector build fails unexpectedly
      if (pdfContentRef.current) {
        try {
          if (showToast) showToast('Attempting DOM canvas fallback PDF export...', 'info');
          const element = pdfContentRef.current;
          const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const fbPdf = new jsPDF(targetOrientation === 'landscape' ? 'l' : 'p', 'mm', 'a4');
          const pWidth = fbPdf.internal.pageSize.getWidth();
          const pHeight = (canvas.height * pWidth) / canvas.width;
          fbPdf.addImage(imgData, 'JPEG', 0, 0, pWidth, pHeight);
          fbPdf.save(`MADECC_BOQ_${currentBoq.boqReference || 'EXPORT'}.pdf`);
          if (showToast) showToast('BOQ PDF exported via canvas fallback', 'success');
        } catch (fbErr) {
          if (showToast) showToast('Failed generating PDF document. Please try Print mode.', 'error');
        }
      } else {
        if (showToast) showToast('Error generating PDF document', 'error');
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Word Export (.docx)
  const handleExportDocx = async () => {
    setShowExportMenu(false);
    try {
      if (showToast) showToast('Generating Microsoft Word (.docx) document...', 'info');
      const { blob, filename } = await generateBoqDocx(currentBoq);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (currentBoq.id) {
        await logAuditEvent(currentBoq.id, 'WORD_EXPORTED', `Exported BOQ ${currentBoq.boqReference} (${currentBoq.revisionNumber}) as Word (.docx)`);
      }

      if (showToast) showToast('Word document (.docx) exported successfully!', 'success');
    } catch (err: any) {
      console.error('Word export error:', err);
      if (showToast) showToast('Failed generating Word document', 'error');
    }
  };

  // CSV Export (.csv)
  const handleExportCsv = async () => {
    setShowExportMenu(false);
    try {
      if (showToast) showToast('Generating CSV document...', 'info');
      const { blob, filename } = generateBoqCsv(currentBoq);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (currentBoq.id) {
        await logAuditEvent(currentBoq.id, 'CSV_EXPORTED', `Exported BOQ ${currentBoq.boqReference} (${currentBoq.revisionNumber}) as CSV (.csv)`);
      }

      if (showToast) showToast('CSV document (.csv) exported successfully!', 'success');
    } catch (err: any) {
      console.error('CSV export error:', err);
      if (showToast) showToast('Failed generating CSV document', 'error');
    }
  };

  // Open Email Modal
  const handleOpenEmailModal = (boq: BoqData) => {
    setEmailTargetBoq(boq);
    setEmailRecipient(boq.clientEmail || '');
    setEmailSubject(`MADECC Group — Bill of Quantities / Estimate — ${boq.projectName}`);
    setEmailMessage(`Dear ${boq.clientName},\n\nPlease find attached the official approved Bill of Quantities and engineering rate estimate for project ${boq.projectName} (${boq.location}).\n\nTotal Estimated Amount: ${Number(boq.grandTotal).toLocaleString()} ${boq.currency}.\n\nBest regards,\nMADECC Group Quantity Surveying Department`);
    setShowEmailModal(true);
  };

  // Send Email Action
  const handleSendEmail = async () => {
    if (!emailTargetBoq || !emailTargetBoq.id || !emailRecipient) {
      if (showToast) showToast('Please provide a valid client email address', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch(`/api/boqs/${emailTargetBoq.id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: emailRecipient,
          subject: emailSubject,
          customMessage: emailMessage,
          pdfUrl: emailTargetBoq.pdfUrl
        })
      });

      if (res.ok) {
        if (showToast) showToast(`Official BOQ sent successfully to ${emailRecipient}!`, 'success');
        setShowEmailModal(false);
        fetchBoqData();
        if (currentBoq.id === emailTargetBoq.id) {
          const updated = await res.json();
          setCurrentBoq(updated.boq);
        }
      } else {
        const errJson = await res.json();
        if (showToast) showToast(errJson.error || 'Failed to dispatch BOQ email', 'error');
      }
    } catch (err: any) {
      console.error('Send email error:', err);
      if (showToast) showToast('Email service error', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  // Filtered list
  const filteredBoqList = boqList.filter(b => {
    const matchesStatus = activeStatusFilter === 'ALL' || b.status === activeStatusFilter;
    const matchesSearch = !searchQuery || 
      b.boqReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate Internal Costs and Margin
  const computeInternalSummary = () => {
    let totalMat = 0;
    let totalLab = 0;
    let totalPlant = 0;
    let totalOther = 0;

    (currentBoq.sections || []).forEach(sec => {
      (sec.items || []).forEach(it => {
        totalMat += (parseFloat(String(it.internalMaterialCost)) || 0) * (parseFloat(String(it.quantity)) || 0);
        totalLab += (parseFloat(String(it.internalLabourCost)) || 0) * (parseFloat(String(it.quantity)) || 0);
        totalPlant += (parseFloat(String(it.internalPlantCost)) || 0) * (parseFloat(String(it.quantity)) || 0);
        totalOther += (parseFloat(String(it.internalOtherCost)) || 0) * (parseFloat(String(it.quantity)) || 0);
      });
    });

    const totalInternalCost = totalMat + totalLab + totalPlant + totalOther;
    const grand = Number(currentBoq.grandTotal) || 0;
    const estimatedProfit = grand - totalInternalCost;
    const profitMarginPercent = grand > 0 ? (estimatedProfit / grand) * 100 : 0;

    return {
      totalMat,
      totalLab,
      totalPlant,
      totalOther,
      totalInternalCost,
      estimatedProfit,
      profitMarginPercent
    };
  };

  const internalCosts = computeInternalSummary();

  return (
    <div className="space-y-6 text-slate-100 font-sans pb-16">
      
      {/* MODULE TOP NAVIGATION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
            <Calculator className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                MADECC Group QS Module
              </span>
              <span className="text-xs text-slate-400">Cameroon Standard Rate Base</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              BOQ / Construction Estimates Manager
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewMode !== 'list' && (
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All BOQs
            </button>
          )}

          {viewMode === 'list' && (
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-extrabold rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create New BOQ Estimate
            </button>
          )}

          {/* EXPORT DROPDOWN MENU FOR ALL VIEW MODES */}
          {viewMode !== 'list' && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Format</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 divide-y divide-slate-800">
                  <div className="p-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Export BOQ Documents
                  </div>
                  <div className="pt-1.5 space-y-1">
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        handleGenerateAndSavePdf();
                      }}
                      disabled={generatingPdf}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition text-left"
                    >
                      <FileText className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-bold text-white">Export as A4 PDF</div>
                        <div className="text-[10px] text-slate-400">Printable A4 document</div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportDocx}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition text-left"
                    >
                      <FileText className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="font-bold text-white">Export as Word (.docx)</div>
                        <div className="text-[10px] text-slate-400">Microsoft Word format</div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportCsv}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg cursor-pointer transition text-left"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-bold text-white">Export as CSV (.csv)</div>
                        <div className="text-[10px] text-slate-400">Excel / Google Sheets</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {viewMode === 'editor' && (
            <>
              <button
                onClick={handleSaveBoq}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleSubmitReview}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                Submit for Review
              </button>
            </>
          )}

          {viewMode === 'review' && (
            <>
              <button
                onClick={() => setViewMode('editor')}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Edit BOQ
              </button>
              <button
                onClick={handleApproveBoq}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Approve & Lock BOQ
              </button>
            </>
          )}

          {viewMode === 'approved_view' && (
            <>
              <button
                onClick={handleGenerateAndSavePdf}
                disabled={generatingPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {generatingPdf ? 'Generating PDF...' : 'Generate PDF'}
              </button>
              <button
                onClick={handleExportDocx}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Export Word
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => handleOpenEmailModal(currentBoq)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Send to Client
              </button>
              <button
                onClick={handleCreateRevision}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Create Revision
              </button>
            </>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: ALL BOQS LIST & DASHBOARD */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total BOQ Estimates</p>
                <h3 className="text-2xl font-black text-white">{boqList.length}</h3>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Drafts & Pending</p>
                <h3 className="text-2xl font-black text-amber-400">
                  {boqList.filter(b => b.status === 'DRAFT' || b.status === 'PENDING_REVIEW').length}
                </h3>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Approved Estimates</p>
                <h3 className="text-2xl font-black text-emerald-400">
                  {boqList.filter(b => b.status === 'APPROVED').length}
                </h3>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Estimated Value</p>
                <h3 className="text-xl font-black text-white">
                  {boqList.reduce((acc, b) => acc + (Number(b.grandTotal) || 0), 0).toLocaleString()} XAF
                </h3>
              </div>
            </div>
          </div>

          {/* FILTER & SEARCH BAR */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by BOQ No., Project or Client..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['ALL', 'DRAFT', 'PENDING_REVIEW', 'APPROVED'].map(st => (
                <button
                  key={st}
                  onClick={() => setActiveStatusFilter(st)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer whitespace-nowrap ${
                    activeStatusFilter === st
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* TABLE OF BOQS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                <span>Loading live BOQ records...</span>
              </div>
            ) : filteredBoqList.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No BOQ Estimates Found</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  No records match your search criteria. Create a new BOQ estimate to start generating professional rates for MADECC projects.
                </p>
                <button
                  onClick={handleStartCreate}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer mt-2"
                >
                  <Plus className="w-4 h-4" /> Create First BOQ
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                      <th className="p-4">BOQ Reference</th>
                      <th className="p-4">Project</th>
                      <th className="p-4">Client</th>
                      <th className="p-4">Date / Prep</th>
                      <th className="p-4 text-right">Grand Total (XAF)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredBoqList.map(boq => (
                      <tr key={boq.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono font-bold text-amber-400">
                          {boq.boqReference}
                          <span className="block text-[10px] text-slate-500 font-sans font-normal">{boq.revisionNumber}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-white block">{boq.projectName}</span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" /> {boq.location}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-medium text-slate-200 block">{boq.clientName}</span>
                          {boq.clientEmail && (
                            <span className="text-[10px] text-slate-500">{boq.clientEmail}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-slate-300 block">
                            {boq.datePrepared ? new Date(boq.datePrepared).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="text-[10px] text-slate-500">By {boq.preparedBy}</span>
                        </td>
                        <td className="p-4 text-right font-mono font-black text-emerald-400 text-sm">
                          {Number(boq.grandTotal).toLocaleString()} XAF
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            boq.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : boq.status === 'PENDING_REVIEW'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {boq.status === 'APPROVED' && <ShieldCheck className="w-3 h-3" />}
                            {boq.status === 'PENDING_REVIEW' && <Clock className="w-3 h-3" />}
                            {boq.status === 'DRAFT' && <Edit3 className="w-3 h-3" />}
                            {boq.status}
                          </span>

                          {boq.sentToClientAt && (
                            <span className="block text-[9px] text-emerald-500/80 mt-1">
                              Sent to client
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenBoq(boq.id!)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700 cursor-pointer"
                              title="View / Edit BOQ"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {boq.status === 'APPROVED' && (
                              <button
                                onClick={() => handleOpenEmailModal(boq)}
                                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition cursor-pointer"
                                title="Send PDF to Client Email"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteBoq(boq.id!)}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition cursor-pointer"
                              title="Delete BOQ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: BOQ EDITOR & CREATOR */}
      {viewMode === 'editor' && (
        <div className="space-y-6">
          
          {/* HEADER METADATA FORM */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4" /> 1. Project & Client Information
              </h3>
              <span className="text-xs font-mono text-slate-400">Ref: {currentBoq.boqReference} ({currentBoq.revisionNumber})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Select Existing Project</label>
                <select
                  onChange={e => handleSelectProject(Number(e.target.value))}
                  value={currentBoq.projectId || ''}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                >
                  <option value="">-- Choose Project Preset --</option>
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Project Name *</label>
                <input
                  type="text"
                  value={currentBoq.projectName}
                  onChange={e => setCurrentBoq({ ...currentBoq, projectName: e.target.value })}
                  placeholder="e.g. MADECC Eco-HQ Tower Foundation"
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Project Location *</label>
                <input
                  type="text"
                  value={currentBoq.location}
                  onChange={e => setCurrentBoq({ ...currentBoq, location: e.target.value })}
                  placeholder="e.g. Bonanjo, Douala, Cameroon"
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Select Client Preset</label>
                <select
                  onChange={e => handleSelectClient(Number(e.target.value))}
                  value={currentBoq.clientId || ''}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                >
                  <option value="">-- Choose Client Preset --</option>
                  {clientsList.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Client Name *</label>
                <input
                  type="text"
                  value={currentBoq.clientName}
                  onChange={e => setCurrentBoq({ ...currentBoq, clientName: e.target.value })}
                  placeholder="e.g. Jean-Pierre Belinga"
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Client Email Address</label>
                <input
                  type="email"
                  value={currentBoq.clientEmail || ''}
                  onChange={e => setCurrentBoq({ ...currentBoq, clientEmail: e.target.value })}
                  placeholder="client@company.com"
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Client NIU / Tax ID</label>
                <input
                  type="text"
                  value={currentBoq.clientNiu || ''}
                  onChange={e => setCurrentBoq({ ...currentBoq, clientNiu: e.target.value })}
                  placeholder="e.g. M052614923184J"
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Prepared By</label>
                <input
                  type="text"
                  value={currentBoq.preparedBy}
                  onChange={e => setCurrentBoq({ ...currentBoq, preparedBy: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Currency</label>
                <input
                  type="text"
                  value={currentBoq.currency}
                  readOnly
                  className="w-full bg-slate-950/50 border border-slate-800 text-xs text-amber-400 font-bold p-2.5 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* INTERNAL COST MANAGEMENT TOGGLE */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Internal Cost Control & Profit Estimator</h4>
                <p className="text-[11px] text-slate-400">Toggle internal material, labour, and plant costs. (Strictly hidden from client PDF).</p>
              </div>
            </div>
            <button
              onClick={() => setShowInternalCosts(!showInternalCosts)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                showInternalCosts ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              {showInternalCosts ? 'Hide Internal Costs' : 'Show Internal Costs'}
            </button>
          </div>

          {/* SECTIONS & WORK ITEMS EDITOR */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" /> 2. Measurable Work Sections & Line Items
              </h3>
              <button
                onClick={handleAddSection}
                className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            {(currentBoq.sections || []).map((sec, secIdx) => (
              <div key={secIdx} className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {/* SECTION HEADER BAR */}
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-md">
                      SEC {sec.sectionCode}
                    </span>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={e => {
                        const newTitle = e.target.value;
                        setCurrentBoq(prev => {
                          const s = [...(prev.sections || [])];
                          s[secIdx].title = newTitle;
                          return { ...prev, sections: s };
                        });
                      }}
                      className="bg-transparent border border-slate-800 text-sm font-bold text-white px-3 py-1 rounded-lg focus:border-amber-500 w-full max-w-lg"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Section Total</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {Number(sec.subtotal).toLocaleString()} XAF
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteSection(secIdx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ITEMS TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                        <th className="p-3 w-16">Item No</th>
                        <th className="p-3">Description of Work</th>
                        <th className="p-3 w-24">Unit</th>
                        <th className="p-3 w-28 text-right">Quantity</th>
                        <th className="p-3 w-36 text-right">Unit Rate (XAF)</th>
                        <th className="p-3 w-36 text-right">Amount (XAF)</th>
                        {showInternalCosts && (
                          <th className="p-3 w-40 text-right text-purple-400">Int. Cost / Unit</th>
                        )}
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sec.items.map((item, itemIdx) => (
                        <tr key={itemIdx} className="hover:bg-slate-800/30 transition">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.itemNumber}
                              onChange={e => handleItemChange(secIdx, itemIdx, 'itemNumber', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-amber-400 p-1.5 rounded-lg text-center"
                            />
                          </td>
                          <td className="p-2">
                            <textarea
                              rows={2}
                              value={item.description}
                              onChange={e => handleItemChange(secIdx, itemIdx, 'description', e.target.value)}
                              placeholder="Enter item description..."
                              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 p-2 rounded-lg focus:border-amber-500"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.unit}
                              onChange={e => handleItemChange(secIdx, itemIdx, 'unit', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2 rounded-lg"
                            >
                              {PREDEFINED_UNITS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={e => handleItemChange(secIdx, itemIdx, 'quantity', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-xs text-right font-mono font-bold text-white p-2 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.unitRate}
                              onChange={e => handleItemChange(secIdx, itemIdx, 'unitRate', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-xs text-right font-mono font-bold text-emerald-400 p-2 rounded-lg"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-black text-white text-xs">
                            {Number(item.amount).toLocaleString()}
                          </td>
                          {showInternalCosts && (
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                value={item.internalMaterialCost || 0}
                                onChange={e => handleItemChange(secIdx, itemIdx, 'internalMaterialCost', e.target.value)}
                                placeholder="Mat cost"
                                className="w-full bg-purple-950/40 border border-purple-800/50 text-xs text-right font-mono text-purple-300 p-1.5 rounded-lg"
                              />
                            </td>
                          )}
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleDeleteItem(secIdx, itemIdx)}
                              className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-start">
                  <button
                    onClick={() => handleAddItem(secIdx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Work Item
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* COMMERCIAL ADJUSTMENTS & TOTALS SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* ADJUSTMENT INPUTS */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider flex items-center gap-2">
                <Calculator className="w-4 h-4" /> 3. Overheads, Contingency & Profit %
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Overhead %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={currentBoq.overheadPercent}
                    onChange={e => {
                      const val = e.target.value;
                      setCurrentBoq(prev => recalculateBoqState({ ...prev, overheadPercent: val }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Contingency %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={currentBoq.contingencyPercent}
                    onChange={e => {
                      const val = e.target.value;
                      setCurrentBoq(prev => recalculateBoqState({ ...prev, contingencyPercent: val }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Profit %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={currentBoq.profitPercent}
                    onChange={e => {
                      const val = e.target.value;
                      setCurrentBoq(prev => recalculateBoqState({ ...prev, profitPercent: val }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Tax % (TVA / VAT)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={currentBoq.taxPercent}
                    onChange={e => {
                      const val = e.target.value;
                      setCurrentBoq(prev => recalculateBoqState({ ...prev, taxPercent: val }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* GRAND TOTAL SUMMARY CARD */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-3">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <DollarSign className="w-4 h-4" /> 4. Financial Calculation Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Sections Measured Subtotal:</span>
                  <span className="font-mono font-bold text-white">{Number(currentBoq.subtotal).toLocaleString()} XAF</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Overhead Amount ({currentBoq.overheadPercent}%):</span>
                  <span className="font-mono text-slate-300">+{Number(currentBoq.overheadAmount).toLocaleString()} XAF</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Contingency Amount ({currentBoq.contingencyPercent}%):</span>
                  <span className="font-mono text-slate-300">+{Number(currentBoq.contingencyAmount).toLocaleString()} XAF</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Profit Margin ({currentBoq.profitPercent}%):</span>
                  <span className="font-mono text-slate-300">+{Number(currentBoq.profitAmount).toLocaleString()} XAF</span>
                </div>

                {Number(currentBoq.taxAmount) > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-800/50">
                    <span className="text-slate-400">Tax Amount ({currentBoq.taxPercent}%):</span>
                    <span className="font-mono text-slate-300">+{Number(currentBoq.taxAmount).toLocaleString()} XAF</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-amber-500/30">
                  <span className="text-sm font-black text-white uppercase">Grand Total:</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {Number(currentBoq.grandTotal).toLocaleString()} XAF
                  </span>
                </div>
              </div>

              {showInternalCosts && (
                <div className="mt-4 p-3 bg-purple-950/30 border border-purple-800/50 rounded-xl space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-purple-300 font-bold">
                    <span>Total Internal Cost:</span>
                    <span className="font-mono">{internalCosts.totalInternalCost.toLocaleString()} XAF</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-black">
                    <span>Estimated Net Profit:</span>
                    <span className="font-mono">{internalCosts.estimatedProfit.toLocaleString()} XAF ({internalCosts.profitMarginPercent.toFixed(1)}%)</span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* VIEW MODE 3 & 4: REVIEW & APPROVED PDF PREVIEW */}
      {(viewMode === 'review' || viewMode === 'approved_view') && (
        <div className="space-y-6">
          
          {/* STATUS NOTIFICATION BANNER */}
          {currentBoq.status === 'APPROVED' ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-400 text-xs">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-white text-sm">Official Approved BOQ Estimate (Locked)</h4>
                  <p className="text-emerald-400/80">
                    Approved by {currentBoq.approvedBy} on {currentBoq.approvedAt ? new Date(currentBoq.approvedAt).toLocaleDateString() : 'N/A'}. 
                    Revision {currentBoq.revisionNumber} is locked against direct edits.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateAndSavePdf}
                  disabled={generatingPdf}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-black rounded-xl cursor-pointer"
                >
                  Download PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between text-blue-400 text-xs">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-white text-sm">BOQ Manager Review Mode</h4>
                  <p className="text-blue-300">Please verify all rates and quantities before final manager approval.</p>
                </div>
              </div>
            </div>
          )}

          {/* PRINTABLE A4 FORM CONTAINER */}
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-8 max-w-5xl mx-auto overflow-x-auto">
            
            <div ref={pdfContentRef} className="bg-white text-slate-900 p-8 rounded-xl space-y-6 font-sans border border-slate-200 shadow-sm" style={{ width: '100%', minWidth: '700px' }}>
              
              {/* BRANDING HEADER */}
              <div className="flex items-start justify-between border-b-2 border-amber-500 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">MADECC GROUP S.A.</h1>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Civil Engineering, Geotechnics & Structural Construction</p>
                  <p className="text-[10px] text-slate-500 mt-1">Douala & Yaoundé, Republic of Cameroon | Contact: info@madecc-group.cm</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded">
                    OFFICIAL BOQ ESTIMATE
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-800 mt-1">{currentBoq.boqReference}</p>
                  <p className="text-[10px] text-slate-500">Revision: {currentBoq.revisionNumber}</p>
                </div>
              </div>

              {/* PROJECT & CLIENT DETAILS GRID */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Project Name & Location</span>
                  <h4 className="font-extrabold text-slate-900 text-sm">{currentBoq.projectName}</h4>
                  <p className="text-slate-600">{currentBoq.location}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Client Information</span>
                  <h4 className="font-bold text-slate-900">{currentBoq.clientName}</h4>
                  {currentBoq.clientNiu && <p className="text-slate-600">NIU: {currentBoq.clientNiu}</p>}
                  {currentBoq.clientEmail && <p className="text-slate-600">Email: {currentBoq.clientEmail}</p>}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Date Prepared</span>
                  <p className="font-semibold text-slate-800">
                    {currentBoq.datePrepared ? new Date(currentBoq.datePrepared).toLocaleDateString() : new Date().toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Prepared By</span>
                  <p className="font-semibold text-slate-800">{currentBoq.preparedBy}</p>
                </div>
              </div>

              {/* MEASURED SECTIONS & ITEMS TABLE */}
              <div className="space-y-4">
                {(currentBoq.sections || []).map((sec, secIdx) => (
                  <div key={secIdx} className="space-y-1">
                    <div className="bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded flex justify-between">
                      <span>SECTION {sec.sectionCode}: {sec.title}</span>
                      <span className="font-mono">{Number(sec.subtotal).toLocaleString()} XAF</span>
                    </div>

                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 text-slate-500 uppercase font-bold text-[10px]">
                          <th className="p-2 w-12">Item</th>
                          <th className="p-2">Description</th>
                          <th className="p-2 w-16 text-center">Unit</th>
                          <th className="p-2 w-20 text-right">Qty</th>
                          <th className="p-2 w-28 text-right">Rate (XAF)</th>
                          <th className="p-2 w-28 text-right">Amount (XAF)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {sec.items.map((item, itemIdx) => (
                          <tr key={itemIdx}>
                            <td className="p-2 font-mono font-bold text-slate-700">{item.itemNumber}</td>
                            <td className="p-2 text-slate-800 font-medium">{item.description}</td>
                            <td className="p-2 text-center text-slate-600">{item.unit}</td>
                            <td className="p-2 text-right font-mono text-slate-800">{item.quantity}</td>
                            <td className="p-2 text-right font-mono text-slate-800">{Number(item.unitRate).toLocaleString()}</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">{Number(item.amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* FINANCIAL SUMMARY RECAP */}
              <div className="border-t-2 border-slate-800 pt-4 flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold text-slate-800">{Number(currentBoq.subtotal).toLocaleString()} XAF</span>
                  </div>

                  {Number(currentBoq.overheadAmount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Overhead ({currentBoq.overheadPercent}%):</span>
                      <span className="font-mono text-slate-800">+{Number(currentBoq.overheadAmount).toLocaleString()} XAF</span>
                    </div>
                  )}

                  {Number(currentBoq.contingencyAmount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Contingency ({currentBoq.contingencyPercent}%):</span>
                      <span className="font-mono text-slate-800">+{Number(currentBoq.contingencyAmount).toLocaleString()} XAF</span>
                    </div>
                  )}

                  {Number(currentBoq.profitAmount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Profit Margin ({currentBoq.profitPercent}%):</span>
                      <span className="font-mono text-slate-800">+{Number(currentBoq.profitAmount).toLocaleString()} XAF</span>
                    </div>
                  )}

                  {Number(currentBoq.taxAmount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax ({currentBoq.taxPercent}%):</span>
                      <span className="font-mono text-slate-800">+{Number(currentBoq.taxAmount).toLocaleString()} XAF</span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2 border-t border-slate-800 font-extrabold text-sm text-slate-900">
                    <span>GRAND TOTAL:</span>
                    <span className="font-mono font-black text-amber-600">{Number(currentBoq.grandTotal).toLocaleString()} XAF</span>
                  </div>
                </div>
              </div>

              {/* STAMP & SIGNATURE FOOTER */}
              <div className="pt-8 border-t border-slate-200 flex justify-between text-[10px] text-slate-500">
                <div>
                  <p className="font-bold text-slate-800">MADECC Group Quantity Surveying Dept.</p>
                  <p>Certified Professional Construction Estimate</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">Official Seal & Sign-off</p>
                  <p>Document Ref: {currentBoq.boqReference}</p>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* EMAIL CLIENT MODAL DIALOG */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4" /> Send Official BOQ to Client
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Client Email Recipient *</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={e => setEmailRecipient(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Subject Line</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Custom Message / Note</label>
                <textarea
                  rows={4}
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-amber-500"
                />
              </div>

              {emailTargetBoq?.pdfUrl && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Official PDF Document attached from Cloud Storage</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
              >
                {sendingEmail ? 'Dispatching Email...' : 'Send BOQ to Client'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
