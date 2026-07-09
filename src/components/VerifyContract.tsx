import React, { useState, useEffect } from 'react';
import SignaturePad from './SignaturePad.tsx';
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  DollarSign, 
  MapPin, 
  ArrowLeft, 
  Building,
  Camera,
  QrCode,
  Scan,
  RefreshCw,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

interface VerifyContractProps {
  token: string;
  onBackToHome: () => void;
}

export default function VerifyContract({ token, onBackToHome }: VerifyContractProps) {
  const [activeToken, setActiveToken] = useState(token);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scannerActive, setScannerActive] = useState(false);
  const [manualInputToken, setManualInputToken] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  const [showClientSignaturePad, setShowClientSignaturePad] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [typedSignName, setTypedSignName] = useState('');

  // Sync token prop changes with activeToken state
  useEffect(() => {
    setActiveToken(token);
  }, [token]);

  // Fetch contract or receipt whenever activeToken changes
  useEffect(() => {
    async function fetchContract() {
      if (!activeToken) {
        setContract(null);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const isReceipt = activeToken.startsWith('REC-');
      try {
        const url = isReceipt 
          ? `/api/receipts/verify/${activeToken}`
          : `/api/contracts/verify/${activeToken}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            isReceipt
              ? 'This verification link is invalid or the receipt has not been recorded in our secure fiscal ledger.'
              : 'This verification link is invalid or the contract has not been recorded in our secure compliance system.'
          );
        }
        const data = await response.json();
        setContract(data);
        if (!isReceipt) {
          setTypedSignName(data.typedClientSignature || '');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to authenticate this document.');
        setContract(null);
      } finally {
        setLoading(false);
      }
    }

    fetchContract();
  }, [activeToken]);

  // QR Code camera scanner subscription logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    
    if (scannerActive) {
      setScanError(null);
      // Wait for DOM layout to ensure the scanner element with id="scanner-view" is fully rendered
      setTimeout(() => {
        try {
          html5QrCode = new Html5Qrcode("scanner-view");
          const config = { 
            fps: 10, 
            qrbox: (width: number, height: number) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          };
          
          html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              let extractedToken = decodedText.trim();
              if (decodedText.includes('verify=')) {
                const parts = decodedText.split('verify=');
                if (parts[1]) {
                  extractedToken = parts[1].split('&')[0];
                }
              } else if (decodedText.includes('verifyToken=')) {
                const parts = decodedText.split('verifyToken=');
                if (parts[1]) {
                  extractedToken = parts[1].split('&')[0];
                }
              }
              
              if (extractedToken) {
                // Update URL parameters
                const url = new URL(window.location.href);
                url.searchParams.set('verify', extractedToken);
                window.history.pushState({}, '', url.toString());
                
                setActiveToken(extractedToken);
                setScannerActive(false);
                
                if (html5QrCode) {
                  html5QrCode.stop().catch(err => console.error('Failed to stop camera scanner:', err));
                }
              }
            },
            () => {
              // Ignore frames failing to parse
            }
          ).catch(err => {
            console.error("Camera access failed:", err);
            setScanError("Unable to access the device camera. Please grant camera permissions, check your settings, or enter the key manually.");
            setScannerActive(false);
          });
        } catch (err: any) {
          console.error("Scanner setup failed:", err);
          setScanError("Failed to initialize scanner. Please try again.");
          setScannerActive(false);
        }
      }, 300);
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error('Failed to stop scanner on clean up:', err));
      }
    };
  }, [scannerActive]);

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualInputToken.trim();
    if (!cleaned) return;

    // Update URL parameters
    const url = new URL(window.location.href);
    url.searchParams.set('verify', cleaned);
    window.history.pushState({}, '', url.toString());

    setActiveToken(cleaned);
  };

  const resetVerificationPortal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('verify');
    url.searchParams.delete('verifyToken');
    window.history.pushState({}, '', url.toString());
    setActiveToken('');
    setContract(null);
    setError(null);
    setScannerActive(false);
    setManualInputToken('');
  };

  const handleSaveDrawnSignature = async (base64DataUrl: string) => {
    setIsSavingSignature(true);
    try {
      const response = await fetch(`/api/contracts/verify/${contract.verificationToken}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawnClientSignature: base64DataUrl,
          typedClientSignature: typedSignName.trim() || contract.typedClientSignature
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record client signature in secure compliance system.');
      }

      const updatedContract = await response.json();
      setContract(updatedContract);
      setShowClientSignaturePad(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error saving signature');
    } finally {
      setIsSavingSignature(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Navigation and Top Bar */}
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={onBackToHome}
          className="group flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-500 hover:text-amber-500 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Portal Home
        </button>

        {activeToken && (
          <button
            onClick={resetVerificationPortal}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-amber-500 hover:text-amber-400 border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Verify New
          </button>
        )}
      </div>

      {/* Loading Overlay */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Querying secure compliance ledger...</span>
        </div>
      ) : scannerActive ? (
        /* Camera Scanner Active Viewport */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-950 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-900 pb-4">
            <div className="flex items-center gap-2.5">
              <Camera className="w-5 h-5 text-amber-500 animate-pulse" />
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Live Document Scanner</h2>
                <p className="text-[10px] text-slate-400 leading-none">Point your camera at a contract QR code</p>
              </div>
            </div>
            <button
              onClick={() => setScannerActive(false)}
              className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative max-w-md mx-auto aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-inner animate-pulse">
            {/* Holographic scanner target guide lines */}
            <div className="absolute inset-0 border-2 border-slate-800/20 z-10 pointer-events-none" />
            
            {/* Glowing Corner Accents */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-500 z-20" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-500 z-20" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-500 z-20" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-500 z-20" />

            {/* Glowing green bouncing laser scan line */}
            <div className="absolute top-0 inset-x-0 h-0.5 bg-amber-500 shadow-md shadow-amber-500/50 animate-[bounce_3s_infinite] z-20 pointer-events-none opacity-80" />

            {/* QR Scanner Node */}
            <div id="scanner-view" className="w-full h-full object-cover" />
          </div>

          <div className="text-center font-mono text-[10px] text-slate-500">
            Scanning environment in high resolution...
          </div>
        </motion.div>
      ) : !activeToken ? (
        /* Empty Verification State: Landing Dashboard */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950 border border-slate-800 rounded-2xl p-8 space-y-8 shadow-xl"
        >
          <div className="text-center space-y-2 max-w-md mx-auto">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider font-mono">MADECC Verification Desk</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Authenticate and audit signed civil works, building plans, and legal contracts registered on the live Neon compliance registry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-900/60">
            {/* Card Option A: Device Camera Scan */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-xl space-y-4 flex flex-col justify-between hover:border-slate-800 transition-colors">
              <div className="space-y-1.5">
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">
                  Mobile Scan
                </span>
                <h3 className="text-sm font-bold text-white font-mono">Device Camera</h3>
                <p className="text-xs text-slate-400">
                  Scan the verification QR code stamped on paper/digital contracts for instant validation.
                </p>
              </div>

              <button
                onClick={() => setScannerActive(true)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase font-mono tracking-wider"
              >
                <Camera className="w-4 h-4" />
                Launch Camera Scanner
              </button>
            </div>

            {/* Card Option B: Manual Input Key */}
            <form 
              onSubmit={handleManualVerify}
              className="bg-slate-900/40 border border-slate-850 p-6 rounded-xl space-y-4 flex flex-col justify-between hover:border-slate-800 transition-colors"
            >
              <div className="space-y-1.5">
                <span className="text-[10px] bg-slate-850 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">
                  Key Input
                </span>
                <h3 className="text-sm font-bold text-white font-mono">Verify by Key</h3>
                <p className="text-xs text-slate-400">
                  Enter the unique compliance verification token manually below to search the registry.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. CNT-A0X39..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white outline-none focus:border-amber-500 font-mono tracking-wider uppercase text-center"
                  value={manualInputToken}
                  onChange={(e) => setManualInputToken(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!manualInputToken.trim()}
                  className="w-full bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors uppercase font-mono tracking-wider border border-slate-700"
                >
                  <Scan className="w-4 h-4" />
                  Validate Code
                </button>
              </div>
            </form>
          </div>

          {scanError && (
            <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-400 font-mono leading-normal">{scanError}</p>
            </div>
          )}
        </motion.div>
      ) : error ? (
        /* Validation Failed View */
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950 border border-red-500/20 rounded-2xl p-8 text-center space-y-6 shadow-xl shadow-red-950/10"
        >
          <div className="mx-auto w-16 h-16 bg-red-950/30 border border-red-500/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-white uppercase tracking-tight">Verification Failed</h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {error}
            </p>
            <p className="text-[10px] font-mono text-slate-600">
              Token ID: <span className="text-red-400 font-bold">{activeToken}</span>
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={resetVerificationPortal}
              className="px-6 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all uppercase tracking-wider cursor-pointer font-mono"
            >
              Verify Different Document
            </button>
            <button
              onClick={() => setScannerActive(true)}
              className="px-6 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-600 transition-all uppercase tracking-wider cursor-pointer font-mono flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> Try Camera Scan
            </button>
          </div>
        </motion.div>
      ) : (
        /* Document Verified & Loaded successfully! */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Main Verified Badge Header */}
          <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-950/10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-950/30 border border-emerald-500/40 rounded-full flex items-center justify-center shrink-0">
                <ShieldCheck className="w-8 h-8 text-emerald-400 animate-[pulse_2s_infinite]" />
              </div>
              <div className="space-y-1 text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                    {activeToken.startsWith('REC-') ? 'Official Authenticated Receipt' : 'Official Authenticated Document'}
                  </span>
                </div>
                <h1 className="text-base font-bold text-white">MADECC Secure Verification Registry</h1>
                <p className="text-xs text-slate-400">
                  {activeToken.startsWith('REC-') 
                    ? 'This receipt is certified valid and registered under the Cameroon General Tax Code (CGI).'
                    : 'This document is certified valid and registered under Cameroon Civil Code Art. 1779.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 bg-slate-900 border border-slate-800 p-3 rounded-xl shrink-0">
              <div className="bg-white p-1 rounded-lg">
                <QRCodeSVG
                  value={`${window.location.origin}/?verify=${contract.verificationToken}`}
                  size={70}
                  level="M"
                />
              </div>
              <div className="text-center font-mono text-[9px]">
                <span className="text-slate-400 block uppercase font-bold tracking-wider mb-0.5">Verification Key</span>
                <span className="text-amber-500 font-bold select-all">{contract.verificationToken}</span>
              </div>
            </div>
          </div>

          {activeToken.startsWith('REC-') ? (
            /* ==========================================
               VERIFIED RECEIPT VIEW
               ========================================== */
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header section mimicking document style */}
              <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-mono uppercase tracking-widest font-bold">MADECC GROUP FINANCE DESK</span>
                  </div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">Corporate Payment Receipt</h2>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block font-mono uppercase">Receipt No:</span>
                  <span className="text-xs font-mono font-bold text-amber-500">{contract.receiptNo}</span>
                </div>
              </div>

              {/* Document stats grid */}
              <div className="p-6 md:p-8 space-y-8">
                {/* Core metrics bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Total Paid Amount
                    </div>
                    <p className="text-lg font-mono font-black text-white">
                      {parseFloat(contract.receiptAmount || '0').toLocaleString()} XAF
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" /> Date of Payment
                    </div>
                    <p className="text-sm font-bold text-slate-200">
                      {new Date(contract.signedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <Building className="w-3.5 h-3.5 text-amber-500" /> Payment Method
                    </div>
                    <p className="text-sm font-bold text-slate-200 truncate">
                      {contract.receiptMethod}
                    </p>
                  </div>
                </div>

                {/* Two Column details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                  {/* Column 1: Client Profile */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-900 pb-2">
                      Client Profile & Project Context
                    </h3>
                    <div className="space-y-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Payer Name</span>
                        <p className="font-bold text-slate-200">{contract.clientName}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Client Taxpayer NIU</span>
                        <p className="font-mono text-slate-300 font-bold">{contract.clientNiu || 'Not Specified'}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Associated Construction Project</span>
                        <p className="font-bold text-slate-200">{contract.receiptProject}</p>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Legal & Financial Metadata */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-900 pb-2">
                      Legal & Financial Metadata
                    </h3>
                    <div className="space-y-3 text-xs leading-relaxed">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block mb-0.5">Authorizing CFO Signatory</span>
                        <p className="font-bold text-slate-200">{contract.receiptSignatory}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block mb-0.5">VAT Standard Tax (TVA)</span>
                        <p className="text-slate-300 font-mono font-bold">{contract.receiptTaxRate || '19.25'}% standard Cameroon CGI</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block mb-0.5">Corporate Reference Memo</span>
                        <p className="text-slate-300 italic">{contract.receiptMemo || 'Mobilization fee under general construction guidelines.'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secure Cryptographic Barcode display */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block">System Document Barcode</span>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-sm">
                      Scannable standard Code-128 physical asset tag for on-site materials or fiscal ledger validation.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center shrink-0 border-2 border-slate-800">
                    <img 
                      src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(contract.receiptNo)}&scale=2&includetext=true`}
                      alt="Receipt Document Barcode"
                      className="max-h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.src = `https://barcodeapi.org/api/128/${encodeURIComponent(contract.receiptNo)}`;
                      }}
                    />
                  </div>
                </div>

                {/* Sealed Signatures panel for receipts */}
                <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-4">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold block text-center">
                    🔐 DIGITAL FISCAL LEDGER SEAL REGISTERED
                  </span>
                  <div className="max-w-md mx-auto p-4 bg-slate-950 border border-slate-900 rounded-xl text-center flex flex-col justify-between space-y-3 min-h-[160px]">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Authorizing Corporate Officer</span>
                      <p className="text-xs font-bold text-slate-200 mt-2">{contract.receiptSignatory}</p>
                      
                      {contract.drawnCfoSignature ? (
                        <div className="bg-slate-900 border border-slate-800/40 rounded-lg p-2 flex items-center justify-center h-14 w-full max-w-[200px] mx-auto mt-2 overflow-hidden">
                          <img
                            src={contract.drawnCfoSignature}
                            alt="CFO Signature"
                            className="max-h-full max-w-full object-contain invert brightness-200"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-amber-500/40 bg-amber-500/5 p-2 rounded-lg font-mono text-[9.5px] text-amber-500 font-black mt-2 max-w-[250px] mx-auto tracking-widest uppercase">
                          Authorized: / {contract.receiptTypedSign} /
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      <span className="inline-flex text-[9px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 rounded-full font-bold">
                        ✓ OFFICIALLY RECORDED & VERIFIED
                      </span>
                    </div>
                  </div>
                  <div className="text-center text-[10px] text-slate-500 font-mono pt-2">
                    Registered On: {new Date(contract.signedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ==========================================
               VERIFIED CONTRACT VIEW (ORIGINAL CONTRACT VIEW)
               ========================================== */
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header section mimicking document style */}
              <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-mono uppercase tracking-widest font-bold">MADECC GROUP PORTAL</span>
                  </div>
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">Construction Labor Agreement</h2>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block font-mono uppercase">Agreement No:</span>
                  <span className="text-xs font-mono font-bold text-amber-500">{contract.contractNo}</span>
                </div>
              </div>

              {/* Document stats grid */}
              <div className="p-6 md:p-8 space-y-8">
                {/* Core metrics bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <DollarSign className="w-3.5 h-3.5 text-amber-500" /> Contract Valuation
                    </div>
                    <p className="text-lg font-mono font-black text-white">
                      {parseFloat(contract.contractValue || '0').toLocaleString()} FCFA
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" /> Date of Execution
                    </div>
                    <p className="text-sm font-bold text-slate-200">
                      {contract.contractDate || 'July 5, 2026'}
                    </p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" /> Project Location
                    </div>
                    <p className="text-sm font-bold text-slate-200 truncate">
                      {contract.contractProjectLocation || 'Yaoundé, Cameroon'}
                    </p>
                  </div>
                </div>

                {/* Two Column details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                  {/* Column 1: Parties */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-900 pb-2">
                      Contracting Parties
                    </h3>
                    <div className="space-y-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">First Party (Contractor)</span>
                        <p className="font-bold text-slate-200">MADECC GROUP SARL</p>
                        <p className="text-slate-400 text-[11px]">
                          Representative: <span className="font-semibold text-slate-300">{contract.representativeName} ({contract.representativeTitle})</span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Second Party (Client)</span>
                        <p className="font-bold text-slate-200">{contract.clientName}</p>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          ID: <span className="font-mono text-slate-300">{contract.clientNiu || 'Not Specified'}</span><br />
                          Address: <span className="text-slate-300">{contract.clientAddress || 'Not Specified'}, {contract.clientCity}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Scope & Financials */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold border-b border-slate-900 pb-2">
                      Scope of Works & Terms
                    </h3>
                    <div className="space-y-3 text-xs leading-relaxed">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block mb-0.5">Project Blueprint Link</span>
                        <p className="font-bold text-slate-200">{contract.contractProject}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block mb-0.5">Assigned Execution Period</span>
                        <p className="text-slate-300 italic">{contract.contractDuration || 'Unspecified (funding dependent)'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block mb-0.5">Payment Milestones</span>
                        <p className="text-slate-300 text-[11px]">
                          Advance Payment: <span className="font-mono font-bold text-emerald-400">{parseFloat(contract.contractAdvancePayment || '0').toLocaleString()} FCFA</span><br />
                          Remaining Balance: <span className="font-mono font-bold text-amber-500">{(parseFloat(contract.contractValue || '0') - parseFloat(contract.contractAdvancePayment || '0')).toLocaleString()} FCFA</span> due upon Tie Beam completion.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scope lists block */}
                {contract.contractScope && (
                  <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide block">Authorized Structural Scope</span>
                    <p className="text-xs text-slate-400 whitespace-pre-line leading-relaxed font-sans">
                      {contract.contractScope}
                    </p>
                  </div>
                )}

                {/* Live Handwritten Signature Pad Trigger */}
                {showClientSignaturePad && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4"
                  >
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">✍ Draw Client Hand Signature</h3>
                      <p className="text-[11px] text-slate-400">
                        Please draw your hand signature below and confirm your printed full name to execute this contract.
                      </p>
                    </div>

                    <div className="space-y-1.5 max-w-sm">
                      <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block font-mono">Confirm Printed Signatory Name</label>
                      <input
                        type="text"
                        placeholder="e.g. John Doe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500 font-mono"
                        value={typedSignName}
                        onChange={(e) => setTypedSignName(e.target.value)}
                      />
                    </div>

                    <SignaturePad
                      onSave={handleSaveDrawnSignature}
                      onCancel={() => setShowClientSignaturePad(false)}
                      title="Handwritten Signature Pad"
                    />

                    {isSavingSignature && (
                      <p className="text-[10px] text-amber-500 font-mono animate-pulse text-center">
                        Saving signature and re-sealing document in Neon registry...
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Sealed Signatures panel */}
                <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl space-y-4">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold block text-center">
                    🔐 DIGITAL COMPLIANCE SEAL RECORDED
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl text-center flex flex-col justify-between space-y-2.5 min-h-[160px]">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Contractor Sealing Agent</span>
                        <p className="text-xs font-bold text-slate-200 mt-2">{contract.representativeName}</p>
                        <p className="text-[10px] text-slate-500 italic font-mono">{contract.representativeTitle}</p>
                      </div>
                      <div className="pt-2">
                        <span className="text-[9px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 rounded-full font-bold">
                          ✓ SECURELY SEALED
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl text-center flex flex-col justify-between space-y-2.5 min-h-[160px]">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Client Legal Signatory</span>
                        {contract.drawnClientSignature ? (
                          <div className="bg-slate-900 border border-slate-800/40 rounded-lg p-2 flex items-center justify-center h-14 w-full max-w-[200px] mx-auto overflow-hidden">
                            <img
                              src={contract.drawnClientSignature}
                              alt="Handwritten Client Signature"
                              className="max-h-full max-w-full object-contain invert brightness-200"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <p className="text-xs font-bold text-slate-200 mt-2">{contract.typedClientSignature}</p>
                        )}
                        <p className="text-[10px] text-slate-500 italic font-mono mt-1">{contract.signatoryTitle || 'Legal Representative'}</p>
                      </div>
                      
                      <div className="pt-2">
                        {contract.drawnClientSignature ? (
                          <div className="space-y-1">
                            <span className="inline-flex text-[9px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 rounded-full font-bold">
                              ✓ HAND SIGNED & SEALED
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowClientSignaturePad(true)}
                              className="block mx-auto text-[9px] text-amber-500 hover:text-amber-400 hover:underline font-mono"
                            >
                              Update Signature
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="inline-flex text-[9px] font-mono text-amber-400 border border-amber-500/20 bg-emerald-500/5 px-2.5 py-1 rounded-full font-bold">
                              ✓ TYPED ONLY
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowClientSignaturePad(true)}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1 mx-auto"
                            >
                              ✍ Draw Hand Signature
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-[10px] text-slate-500 font-mono pt-2">
                    Sealed On: {new Date(contract.signedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
