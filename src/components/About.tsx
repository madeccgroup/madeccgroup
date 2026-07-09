import { useState, useEffect } from 'react';
import { 
  Building2, 
  Award, 
  FileText, 
  Download, 
  Calendar, 
  Users, 
  ShieldCheck, 
  HeartHandshake 
} from 'lucide-react';
import { CompanyDocument } from '../types.ts';

export default function About() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch('/api/documents');
        if (res.ok) {
          setDocuments(await res.json());
        }
      } catch (err) {
        console.error('Error fetching documents:', err);
      }
    };
    fetchDocs();
  }, []);

  return (
    <div className="font-sans text-slate-200 bg-[#0A0A0B] min-h-screen">
      
      {/* Page Header */}
      <section className="bg-slate-950/80 border-b border-slate-850/60 text-white py-16 relative overflow-hidden" id="about-header">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <span className="text-xs font-bold font-mono uppercase text-amber-500 tracking-widest block mb-2">Corporate Identity</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">About MADECC Group</h1>
          <p className="text-slate-400 text-sm mt-2 max-w-xl">
            A high-standard multi-disciplinary contractor crafting net-zero infrastructures and premium master-planned developments since 2012.
          </p>
        </div>
      </section>

      {/* Main Content Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Main text block */}
          <div className="lg:col-span-7 space-y-10">
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-amber-500" /> Our Structural Vision
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                MADECC Group was established with a singular objective: to combine advanced mechanical engineering workflows with sustainable construction practices. Over the past decade, we have grown from a local residential framing contractor into a premier nationwide developer managing millions of pounds in infrastructure portfolios.
              </p>
              <p className="text-slate-400 text-sm leading-relaxed">
                By maintaining standard vertical integrations—owning our concrete mixers, scaffolding pipelines, and architectural CAD design pods—we are able to protect our client supply chains from external delays and guarantee a level of detail unmatched by traditional subcontractors.
              </p>
            </div>

            {/* Core Values grid */}
            <div className="space-y-6 pt-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Our Corporate Pillars</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl shadow-sm flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Health & Safety Primacy</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">We maintain a rigorous zero-harm target. Our sites are audited weekly under strict safety compliance protocols.</p>
                  </div>
                </div>
                
                <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl shadow-sm flex items-start gap-3">
                  <Award className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Pragmatic Green Policy</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">We actively limit the operational carbon foot of projects using photovoltaic glass facades and smart HVAC loops.</p>
                  </div>
                </div>

                <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl shadow-sm flex items-start gap-3">
                  <HeartHandshake className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Supply Chain Integrity</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">We exclusively source premium timbers, reinforced ores, and sustainable concretes from verified suppliers.</p>
                  </div>
                </div>

                <div className="p-5 bg-slate-900/50 border border-slate-800/80 rounded-xl shadow-sm flex items-start gap-3">
                  <Users className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Multi-disciplinary Experts</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">Our personnel includes chartered civil engineers, BIM design analysts, and certified project supervisors.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right sidebar: Certificates & Document downloads */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Certifications Card */}
            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 space-y-4">
              <h3 className="font-bold text-base uppercase tracking-wider text-amber-500 flex items-center gap-2">
                <Award className="w-5 h-5" /> Certifications & Compliance
              </h3>
              <ul className="space-y-3 text-xs leading-relaxed text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold font-mono">■</span>
                  <span><strong>ISO 9001:2015</strong> - International Standard for Quality Management Systems.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold font-mono">■</span>
                  <span><strong>ISO 14001:2015</strong> - Certified Environmental Management System.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold font-mono">■</span>
                  <span><strong>BREEAM Partner</strong> - Aligned with elite global sustainability guidelines.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold font-mono">■</span>
                  <span><strong>SafeContractor Approved</strong> - Verified site health, welfare, and safety.</span>
                </li>
              </ul>
            </div>

            {/* Document downloads card */}
            <div className="bg-[#0E0E10]/90 border border-slate-850 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" /> Corporate Downloads
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                View or download our approved company charters, health & safety manuals, and compliance documentation.
              </p>

              {documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 hover:border-amber-500 rounded-lg group transition-all"
                      id={`doc-download-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-slate-900 text-amber-500 rounded border border-slate-800">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-200 group-hover:text-amber-500 transition-colors">{doc.title}</span>
                          <span className="block text-[9px] text-slate-500 font-mono">Type: {doc.docType.toUpperCase()} | Vers. {doc.version}</span>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-500">
                  No public documents uploaded yet.
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
