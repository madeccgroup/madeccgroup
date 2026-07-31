import { jsPDF } from 'jspdf';

export interface ExportPdfOptions {
  orientation?: 'portrait' | 'landscape';
  companyName?: string;
  showTerms?: boolean;
}

/**
 * High-precision A4 BOQ PDF Generator supporting Portrait & Landscape orientation,
 * equal page margins, automatic text wrapping, headers, footers with page numbers,
 * Terms & Conditions, and official signature / stamp block.
 */
export async function generateBoqPdf(boq: any, options: ExportPdfOptions = {}): Promise<{ pdf: jsPDF; filename: string }> {
  const orientation = options.orientation || 'portrait';
  const isLandscape = orientation === 'landscape';

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15; // 15mm equal margins
  const contentWidth = pageWidth - (margin * 2);

  const boqRef = boq.boqReference || 'BOQ-001';
  const revNum = boq.revisionNumber || 'REV-01';
  const projClean = (boq.projectName || boqRef).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `MADECC_Bill_of_Quantities_${projClean}_${dateStr}.pdf`;

  let currentY = margin;

  // Header banner drawer
  function drawHeader(pageNum: number, totalPagesPlaceholder: boolean) {
    // Company Header
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(margin, currentY, contentWidth, 22, 'F');

    // Amber accent bar
    doc.setFillColor(217, 119, 6); // Amber-600
    doc.rect(margin, currentY + 22, contentWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MADECC GROUP S.A.R.L.', margin + 6, currentY + 9);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(251, 191, 36); // Amber-400
    doc.text('CIVIL ENGINEERING, GEOTECHNICAL INVESTIGATIONS & STRUCTURAL WORKS', margin + 6, currentY + 14);

    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    doc.text('Douala & Yaoundé, Republic of Cameroon | Email: info@madecc-group.cm | Tel: +237 670 000 000', margin + 6, currentY + 18);

    // Document Reference Badge on Right
    doc.setFillColor(217, 119, 6);
    doc.rect(pageWidth - margin - 55, currentY + 4, 48, 14, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('OFFICIAL BOQ ESTIMATE', pageWidth - margin - 31, currentY + 9, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`REF: ${boqRef} (${revNum})`, pageWidth - margin - 31, currentY + 14, { align: 'center' });

    currentY += 28;
  }

  // Footer drawer
  function drawFooter(pageNum: number) {
    const footerY = pageHeight - 12;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('MADECC Group SARL — Certified Construction & Civil Engineering Estimation', margin, footerY + 2);
    doc.text(`Page ${pageNum}`, pageWidth - margin, footerY + 2, { align: 'right' });
  }

  // Start Page 1 Header
  drawHeader(1, false);

  // PROJECT & CLIENT SUMMARY CARD
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  // Col 1: Project Name & Location
  doc.text('PROJECT:', margin + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text((boq.projectName || 'General Construction Works').slice(0, 42), margin + 22, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('LOCATION:', margin + 4, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text((boq.location || 'Douala / Yaounde, Cameroon').slice(0, 42), margin + 22, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('DATE:', margin + 4, currentY + 18);
  doc.setFont('helvetica', 'normal');
  const dt = boq.datePrepared ? new Date(boq.datePrepared).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  doc.text(dt, margin + 22, currentY + 18);

  // Col 2: Client Details
  const midX = margin + (contentWidth / 2);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT:', midX, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text((boq.clientName || 'Valued Client').slice(0, 38), midX + 18, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('TAX ID (NIU):', midX, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(boq.clientNiu || 'N/A', midX + 24, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('ENGINEER:', midX, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text((boq.preparedBy || 'MADECC Quantity Surveyor').slice(0, 38), midX + 22, currentY + 18);

  currentY += 34;

  // TABLE COLUMNS CONFIGURATION
  const colW = isLandscape
    ? { item: 15, desc: 135, unit: 20, qty: 22, rate: 35, amount: 40 }
    : { item: 14, desc: 76, unit: 16, qty: 18, rate: 26, amount: 30 };

  let pageNum = 1;

  function checkPageBreak(requiredHeight: number) {
    if (currentY + requiredHeight > pageHeight - 20) {
      drawFooter(pageNum);
      doc.addPage();
      pageNum++;
      currentY = margin;
      drawHeader(pageNum, false);
    }
  }

  // DRAW WORK SECTIONS AND ITEMS
  const sections = boq.sections || [];

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const sec = sections[sIdx];
    checkPageBreak(12);

    // Section Header Bar
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`SECTION ${sec.sectionCode}: ${sec.title}`.toUpperCase(), margin + 3, currentY + 5);

    const secSubtotalFormatted = `${Number(sec.subtotal || 0).toLocaleString()} ${boq.currency || 'XAF'}`;
    doc.text(secSubtotalFormatted, pageWidth - margin - 3, currentY + 5, { align: 'right' });

    currentY += 8;

    // Table Header Row
    checkPageBreak(8);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    let x = margin;
    doc.text('ITEM', x + 2, currentY + 4); x += colW.item;
    doc.text('DESCRIPTION OF WORKS', x + 2, currentY + 4); x += colW.desc;
    doc.text('UNIT', x + (colW.unit / 2), currentY + 4, { align: 'center' }); x += colW.unit;
    doc.text('QTY', x + colW.qty - 2, currentY + 4, { align: 'right' }); x += colW.qty;
    doc.text('UNIT RATE', x + colW.rate - 2, currentY + 4, { align: 'right' }); x += colW.rate;
    doc.text('AMOUNT (XAF)', x + colW.amount - 2, currentY + 4, { align: 'right' });

    currentY += 7;

    // Table Items
    const items = sec.items || [];
    for (let iIdx = 0; iIdx < items.length; iIdx++) {
      const item = items[iIdx];
      const descLines = doc.splitTextToSize(item.description || '', colW.desc - 4);
      const rowHeight = Math.max(6, descLines.length * 3.8 + 2);

      checkPageBreak(rowHeight);

      // Zebra striping
      if (iIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY - 1, contentWidth, rowHeight, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      let rx = margin;
      doc.text(String(item.itemNumber || ''), rx + 2, currentY + 3.5); rx += colW.item;

      doc.setFont('helvetica', 'normal');
      doc.text(descLines, rx + 2, currentY + 3.5); rx += colW.desc;

      doc.text(String(item.unit || 'm³'), rx + (colW.unit / 2), currentY + 3.5, { align: 'center' }); rx += colW.unit;
      doc.text(String(item.quantity || '0'), rx + colW.qty - 2, currentY + 3.5, { align: 'right' }); rx += colW.qty;
      doc.text(Number(item.unitRate || 0).toLocaleString(), rx + colW.rate - 2, currentY + 3.5, { align: 'right' }); rx += colW.rate;

      doc.setFont('helvetica', 'bold');
      doc.text(Number(item.amount || 0).toLocaleString(), rx + colW.amount - 2, currentY + 3.5, { align: 'right' });

      // Horizontal subtle line
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, currentY + rowHeight - 1, pageWidth - margin, currentY + rowHeight - 1);

      currentY += rowHeight;
    }

    currentY += 3;
  }

  // FINANCIAL RECAP RECTANGLE
  checkPageBreak(45);

  const summaryBoxWidth = isLandscape ? 120 : 95;
  const summaryX = pageWidth - margin - summaryBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryX, currentY, summaryBoxWidth, 38, 2, 2, 'FD');

  let sy = currentY + 5;
  doc.setFontSize(8);

  const drawSummaryLine = (label: string, val: string, isBold = false, isAmber = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(isAmber ? 217 : 30, isAmber ? 119 : 41, isAmber ? 6 : 59);
    doc.text(label, summaryX + 4, sy);
    doc.text(val, summaryX + summaryBoxWidth - 4, sy, { align: 'right' });
    sy += 5;
  };

  drawSummaryLine('SECTIONS MEASURED SUBTOTAL:', `${Number(boq.subtotal || 0).toLocaleString()} ${boq.currency || 'XAF'}`, true);
  if (Number(boq.overheadAmount || 0) > 0) {
    drawSummaryLine(`Overhead & Site Logistics (${boq.overheadPercent}%):`, `+${Number(boq.overheadAmount).toLocaleString()} ${boq.currency || 'XAF'}`);
  }
  if (Number(boq.contingencyAmount || 0) > 0) {
    drawSummaryLine(`Unforeseen Contingencies (${boq.contingencyPercent}%):`, `+${Number(boq.contingencyAmount).toLocaleString()} ${boq.currency || 'XAF'}`);
  }
  if (Number(boq.profitAmount || 0) > 0) {
    drawSummaryLine(`Contractor Profit Margin (${boq.profitPercent}%):`, `+${Number(boq.profitAmount).toLocaleString()} ${boq.currency || 'XAF'}`);
  }
  if (Number(boq.taxAmount || 0) > 0) {
    drawSummaryLine(`TVA Value Added Tax (${boq.taxPercent}%):`, `+${Number(boq.taxAmount).toLocaleString()} ${boq.currency || 'XAF'}`);
  }

  doc.setDrawColor(217, 119, 6);
  doc.line(summaryX + 4, sy - 2, summaryX + summaryBoxWidth - 4, sy - 2);

  drawSummaryLine('GRAND TOTAL ESTIMATE:', `${Number(boq.grandTotal || 0).toLocaleString()} ${boq.currency || 'XAF'}`, true, true);

  currentY += 44;

  // TERMS & CONDITIONS & SIGNATURE STAMP
  checkPageBreak(35);

  // Left: Terms & Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('COMMERCIAL TERMS & TECHNICAL COMPLIANCE:', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const termsText = [
    '1. Rates are based on official CCT/NFP specifications valid in Republic of Cameroon for 60 calendar days.',
    '2. Quantities are derived from architectural plans; final billing shall reflect verified joint site measurements.',
    '3. Materials comply with AFNOR/C25/30 concrete and Fe500 high-yield ribbed reinforcement standards.',
    '4. Payment schedule: 30% mobilization deposit upon contract sign-off; monthly progress certificates.'
  ];
  let ty = currentY + 4;
  termsText.forEach(line => {
    doc.text(line, margin, ty);
    ty += 3.5;
  });

  // Right: Signature and Seal Stamp Box
  const stampX = pageWidth - margin - 60;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(stampX, currentY - 2, 60, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL SIGNATURE & SEAL', stampX + 30, currentY + 3, { align: 'center' });

  // Seal circle outline
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.3);
  doc.circle(stampX + 30, currentY + 12, 7);

  doc.setFontSize(5);
  doc.setTextColor(180, 83, 9);
  doc.text('MADECC GROUP S.A.', stampX + 30, currentY + 11, { align: 'center' });
  doc.text('CERTIFIED SEAL', stampX + 30, currentY + 13.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(`Chief Quantity Surveyor — ${boq.preparedBy || 'MADECC Group'}`, stampX + 30, currentY + 21, { align: 'center' });

  // Stamp final page footers with total count
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = pageHeight - 12;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('MADECC Group SARL — Certified Construction & Civil Engineering Estimation', margin, footerY + 2);
    doc.text(`Page ${p} of ${totalPages} | Generated: ${dateStr}`, pageWidth - margin, footerY + 2, { align: 'right' });
  }

  return { pdf: doc, filename };
}
