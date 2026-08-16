import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

// Helper for formatting date strings
const formatDate = (dateStr?: string | Date) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateStr);
  }
};

// =========================================================================
// 1. PDF EXPORT FUNCTIONS (jsPDF + autoTable)
// =========================================================================

/**
 * Export Sustainability & Social Impact Report to PDF
 */
export function exportSustainabilityPDF(data: {
  content: any;
  initiatives: any[];
  socialProjects: any[];
  metrics: any[];
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const timestamp = new Date().toLocaleString();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  doc.setFillColor(217, 119, 6); // amber-600 accent bar
  doc.rect(0, 32, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MADECC GROUP — SUSTAINABILITY & SOCIAL IMPACT', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('Corporate Responsibility, Environmental Management & Community Progress Report', 14, 22);
  doc.text(`Generated: ${timestamp}`, 14, 28);

  let currentY = 40;

  // Overview Section
  if (data.content?.introduction) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('1. Executive Sustainability Vision & Commitment', 14, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    const splitIntro = doc.splitTextToSize(data.content.introduction, 182);
    doc.text(splitIntro, 14, currentY);
    currentY += splitIntro.length * 5 + 6;
  }

  // Key Impact Metrics Table
  if (data.metrics && data.metrics.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Verified Performance Metrics', 14, currentY);
    currentY += 4;

    const metricRows = data.metrics.map(m => [
      m.label || 'N/A',
      m.value || 'N/A',
      m.category || 'General',
      m.status || 'PUBLISHED'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Metric Indicator', 'Achieved Value / Target', 'Focus Category', 'Status']],
      body: metricRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Initiatives Table
  if (data.initiatives && data.initiatives.length > 0) {
    if (currentY > 230) { doc.addPage(); currentY = 20; }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('3. Sustainable Construction Initiatives', 14, currentY);
    currentY += 4;

    const initRows = data.initiatives.map(i => [
      i.title,
      i.category,
      i.impactSummary || i.description.substring(0, 100) + '...',
      i.status
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Initiative Title', 'Category', 'Impact Summary', 'Status']],
      body: initRows,
      theme: 'striped',
      headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Social Impact Projects
  if (data.socialProjects && data.socialProjects.length > 0) {
    if (currentY > 220) { doc.addPage(); currentY = 20; }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('4. Community & Social Impact Projects', 14, currentY);
    currentY += 4;

    const projRows = data.socialProjects.map(p => [
      p.title,
      p.category,
      p.location,
      p.impactMetricsText || p.description.substring(0, 80) + '...',
      p.status
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Project Title', 'Pillar', 'Location', 'Outcomes', 'Status']],
      body: projRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`MADECC GROUP — Official Sustainability Record | Page ${i} of ${pageCount}`, 14, 287);
    doc.text('Confidential & Proprietary', 160, 287);
  }

  doc.save(`MADECC_Sustainability_Social_Impact_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export FAQ Knowledge Base / Single FAQ to PDF
 */
export function exportFaqsPDF(faqs: any[], categoryFilter = 'All Categories') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const timestamp = new Date().toLocaleString();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 30, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MADECC GROUP — FAQ & HELP CENTRE DOSSIER', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Official Knowledge Base Export | Filter: ${categoryFilter} | Date: ${timestamp}`, 14, 22);

  let currentY = 38;

  faqs.forEach((faq, index) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 8, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Q${index + 1}: ${faq.question}`, 16, currentY + 5.5);

    currentY += 11;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    const splitAnswer = doc.splitTextToSize(faq.answer, 180);
    doc.text(splitAnswer, 16, currentY);

    currentY += splitAnswer.length * 4.5 + 4;

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Category: ${faq.categoryName || 'General'} | Status: ${faq.status} | Author: ${faq.author || 'MADECC Team'}`, 16, currentY);

    currentY += 8;
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`MADECC GROUP Help Centre | Page ${i} of ${pageCount}`, 14, 287);
  }

  doc.save(`MADECC_FAQ_Knowledge_Base_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Export Supplier Application Dossier to PDF
 */
export function exportSupplierDossierPDF(app: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const timestamp = new Date().toLocaleString();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 32, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MADECC GROUP — SUPPLIER PREQUALIFICATION DOSSIER', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Application No: ${app.applicationNumber} | Status: ${app.status} | Generated: ${timestamp}`, 14, 22);

  let currentY = 40;

  const summaryData = [
    ['Company Name', app.companyName, 'Reg. Number', app.registrationNumber || 'N/A'],
    ['Company Type', app.companyType || 'SARL', 'Years in Business', `${app.yearsInBusiness || 1} Year(s)`],
    ['Category', app.supplierCategory, 'Primary City', `${app.city}, ${app.region}`],
    ['Contact Person', `${app.contactPerson} (${app.position})`, 'Email Address', app.email],
    ['Phone Number', app.phone, 'WhatsApp', app.whatsapp || 'N/A'],
    ['Assigned Reviewer', app.assignedReviewer || 'Unassigned', 'Submission Date', formatDate(app.createdAt)]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Field', 'Detail', 'Field', 'Detail']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Products & Supply Capabilities:', 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const splitProducts = doc.splitTextToSize(app.products || 'None specified', 182);
  doc.text(splitProducts, 14, currentY);
  currentY += splitProducts.length * 5 + 8;

  if (app.reviewerNotes) {
    doc.setFillColor(254, 243, 199);
    doc.rect(14, currentY, 182, 18, 'F');
    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CONFIDENTIAL INTERNAL REVIEWER NOTES:', 18, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(app.reviewerNotes, 174), 18, currentY + 12);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`CONFIDENTIAL — MADECC GROUP Procurement System | Page ${i} of ${pageCount}`, 14, 287);
  }

  doc.save(`MADECC_Supplier_Dossier_${app.applicationNumber}.pdf`);
}

/**
 * Export Tender Opportunity Notice to PDF
 */
export function exportTenderNoticePDF(tender: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const timestamp = new Date().toLocaleString();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 32, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MADECC GROUP — OFFICIAL TENDER OPPORTUNITY NOTICE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Ref: ${tender.tenderNumber} | Status: ${tender.status} | Printed: ${timestamp}`, 14, 22);

  let currentY = 40;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(tender.title, 14, currentY);
  currentY += 7;

  const metaTable = [
    ['Tender Reference', tender.tenderNumber, 'Category', tender.categoryName],
    ['Client / Project', tender.clientProject, 'Location', tender.location],
    ['Opening Date', formatDate(tender.openingDate), 'Closing Date', formatDate(tender.closingDate)],
    ['Submission Method', tender.submissionMethod || 'Online & Hard Copy', 'Status', tender.status]
  ];

  autoTable(doc, {
    startY: currentY,
    body: metaTable,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3 },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Project Description & Context', 14, currentY);
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const splitDesc = doc.splitTextToSize(tender.description || '', 182);
  doc.text(splitDesc, 14, currentY);
  currentY += splitDesc.length * 4.5 + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Scope of Work', 14, currentY);
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const splitScope = doc.splitTextToSize(tender.scopeOfWork || '', 182);
  doc.text(splitScope, 14, currentY);
  currentY += splitScope.length * 4.5 + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. Eligibility & Experience Requirements', 14, currentY);
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const splitElig = doc.splitTextToSize(tender.eligibility || '', 182);
  doc.text(splitElig, 14, currentY);
  currentY += splitElig.length * 4.5 + 6;

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`MADECC GROUP Procurement Department | Tender ${tender.tenderNumber} | Page ${i} of ${pageCount}`, 14, 287);
  }

  doc.save(`MADECC_Tender_Notice_${tender.tenderNumber}.docx.pdf`);
}


// =========================================================================
// 2. WORD (.DOCX) EXPORT FUNCTIONS (using docx & file-saver)
// =========================================================================

/**
 * Export Sustainability Report to Microsoft Word (.docx)
 */
export async function exportSustainabilityDOCX(data: any) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'MADECC GROUP — SUSTAINABILITY & SOCIAL IMPACT REPORT',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Generated on: ${new Date().toLocaleString()}`, italics: true, size: 20 })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '1. Executive Vision & Commitments',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: data.content?.introduction || 'MADECC Group is dedicated to sustainable construction and community impact across Cameroon.'
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '2. Environmental & Safety Policies',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({
            text: data.content?.environmentalPolicy || 'Environmental stewardship is embedded in every project site.'
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '3. Key Impact Metrics Summary',
            heading: HeadingLevel.HEADING_2
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Metric', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })] })
                ]
              }),
              ...(data.metrics || []).map((m: any) => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(m.label || '')] }),
                  new TableCell({ children: [new Paragraph(m.value || '')] }),
                  new TableCell({ children: [new Paragraph(m.category || '')] })
                ]
              }))
            ]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `MADECC_Sustainability_Report_${new Date().toISOString().split('T')[0]}.docx`);
}

/**
 * Export Tender Opportunity Notice to Word (.docx)
 */
export async function exportTenderNoticeDOCX(tender: any) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: `TENDER NOTICE — ${tender.tenderNumber}`,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: tender.title, bold: true, size: 24 })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: `Client Project: ${tender.clientProject} | Location: ${tender.location}`, italics: true })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Closing Date: ${formatDate(tender.closingDate)} | Status: ${tender.status}`, bold: true })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '1. Project Overview & Description',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: tender.description || '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '2. Detailed Scope of Work',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: tender.scopeOfWork || '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '3. Eligibility Criteria & Required Documents',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: tender.eligibility || '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '4. Clarifications & Submission Instructions',
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: tender.contactInstructions || '' })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `MADECC_Tender_${tender.tenderNumber}.docx`);
}
