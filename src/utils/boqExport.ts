import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle
} from 'docx';

function sanitizeFilename(str: string): string {
  if (!str) return 'BOQ';
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Generate Microsoft Word (.docx) document for BOQ
 */
export async function generateBoqDocx(boq: any): Promise<{ blob: Blob; filename: string }> {
  const isDraft = boq.status !== 'APPROVED';
  const children: any[] = [];

  // Header Branding
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'MADECC GROUP S.A.',
          bold: true,
          size: 32,
          color: 'D97706' // Amber-600
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'CIVIL ENGINEERING, GEOTECHNICS & STRUCTURAL CONSTRUCTION',
          bold: true,
          size: 18,
          color: '334155'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Douala & Yaoundé, Republic of Cameroon | Contact: info@madecc-group.cm',
          size: 16,
          color: '64748B'
        })
      ]
    }),
    new Paragraph({ text: '', spacing: { after: 200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'OFFICIAL BILL OF QUANTITIES / ESTIMATE',
          bold: true,
          size: 24,
          color: '0F172A'
        })
      ]
    })
  );

  // Draft Warning Banner if not approved
  if (isDraft) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({
            text: 'DRAFT — NOT FOR CLIENT APPROVAL',
            bold: true,
            size: 20,
            color: 'DC2626' // Red
          })
        ]
      })
    );
  }

  children.push(new Paragraph({ text: '', spacing: { after: 150 } }));

  // Metadata Table
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'BOQ Reference: ', bold: true }), new TextRun(boq.boqReference || '')] }),
              new Paragraph({ children: [new TextRun({ text: 'Project Name: ', bold: true }), new TextRun(boq.projectName || '')] }),
              new Paragraph({ children: [new TextRun({ text: 'Location: ', bold: true }), new TextRun(boq.location || '')] })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'Revision: ', bold: true }), new TextRun(boq.revisionNumber || 'REV-00')] }),
              new Paragraph({ children: [new TextRun({ text: 'Client Name: ', bold: true }), new TextRun(boq.clientName || '')] }),
              new Paragraph({ children: [new TextRun({ text: 'Date Prepared: ', bold: true }), new TextRun(boq.datePrepared ? new Date(boq.datePrepared).toLocaleDateString() : new Date().toLocaleDateString())] }),
              new Paragraph({ children: [new TextRun({ text: 'Prepared By: ', bold: true }), new TextRun(boq.preparedBy || '')] })
            ]
          })
        ]
      })
    ]
  });

  children.push(metaTable);
  children.push(new Paragraph({ text: '', spacing: { after: 250 } }));

  // Sections & Work Items
  const sections = boq.sections || [];
  sections.forEach((sec: any) => {
    // Section Header
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: `SECTION ${sec.sectionCode}: ${sec.title}`,
            bold: true,
            size: 20,
            color: '0F172A'
          }),
          new TextRun({
            text: ` (Subtotal: ${Number(sec.subtotal || 0).toLocaleString()} ${boq.currency || 'XAF'})`,
            bold: true,
            size: 18,
            color: 'D97706'
          })
        ]
      })
    );

    // Items Table
    const tableHeader = new TableRow({
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Item', bold: true, size: 16 })] })] }),
        new TableCell({ width: { size: 42, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 16 })] })] }),
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Unit', bold: true, size: 16 })] })] }),
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Qty', bold: true, size: 16 })] })] }),
        new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Rate (XAF)', bold: true, size: 16 })] })] }),
        new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Amount (XAF)', bold: true, size: 16 })] })] })
      ]
    });

    const itemRows = (sec.items || []).map((item: any) => {
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.itemNumber || '', size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.description || '', size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.unit || '', size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(item.quantity ?? 0), size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: Number(item.unitRate || 0).toLocaleString(), size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: Number(item.amount || 0).toLocaleString(), bold: true, size: 16 })] })] })
        ]
      });
    });

    const itemTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [tableHeader, ...itemRows]
    });

    children.push(itemTable);
    children.push(new Paragraph({ text: '', spacing: { after: 150 } }));
  });

  // Financial Summary
  children.push(
    new Paragraph({
      spacing: { before: 250, after: 100 },
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: 'FINANCIAL SUMMARY RECAP', bold: true, size: 20, color: '0F172A' })]
    })
  );

  const summaryRows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Subtotal (Measured Work):', bold: true, size: 18 })] })] }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${Number(boq.subtotal || 0).toLocaleString()} ${boq.currency || 'XAF'}`, bold: true, size: 18 })] })] })
      ]
    })
  ];

  if (Number(boq.overheadAmount) > 0) {
    summaryRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Overhead (${boq.overheadPercent}%):`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${Number(boq.overheadAmount).toLocaleString()} ${boq.currency || 'XAF'}`, size: 16 })] })] })
        ]
      })
    );
  }

  if (Number(boq.contingencyAmount) > 0) {
    summaryRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Contingency (${boq.contingencyPercent}%):`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${Number(boq.contingencyAmount).toLocaleString()} ${boq.currency || 'XAF'}`, size: 16 })] })] })
        ]
      })
    );
  }

  if (Number(boq.profitAmount) > 0) {
    summaryRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Profit Margin (${boq.profitPercent}%):`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${Number(boq.profitAmount).toLocaleString()} ${boq.currency || 'XAF'}`, size: 16 })] })] })
        ]
      })
    );
  }

  if (Number(boq.taxAmount) > 0) {
    summaryRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Tax / TVA (${boq.taxPercent}%):`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${Number(boq.taxAmount).toLocaleString()} ${boq.currency || 'XAF'}`, size: 16 })] })] })
        ]
      })
    );
  }

  summaryRows.push(
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'GRAND TOTAL:', bold: true, size: 22, color: 'D97706' })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${Number(boq.grandTotal || 0).toLocaleString()} ${boq.currency || 'XAF'}`, bold: true, size: 22, color: 'D97706' })] })] })
      ]
    })
  );

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: summaryRows
  });

  children.push(summaryTable);
  children.push(new Paragraph({ text: '', spacing: { after: 300 } }));

  // Signatures / Footer
  children.push(
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: 'Prepared & Approved By: ',
          bold: true,
          size: 16
        }),
        new TextRun({
          text: boq.approvedBy || boq.preparedBy || 'MADECC Quantity Surveyor',
          size: 16
        })
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Document Reference: ',
          bold: true,
          size: 14,
          color: '64748B'
        }),
        new TextRun({
          text: `${boq.boqReference} (${boq.revisionNumber})`,
          size: 14,
          color: '64748B'
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: 'Disclaimer: This Bill of Quantities / Construction Rate Estimate is produced by MADECC Group S.A. based on standard civil engineering measurement rules. Figures are binding upon official approval.',
          italics: true,
          size: 14,
          color: '94A3B8'
        })
      ]
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${sanitizeFilename(boq.boqReference)}-${sanitizeFilename(boq.revisionNumber)}.docx`;

  return { blob, filename };
}

/**
 * Generate CSV document for BOQ
 */
export function generateBoqCsv(boq: any): { blob: Blob; filename: string } {
  const isDraft = boq.status !== 'APPROVED';
  const rows: string[][] = [];

  // Branding
  rows.push(['MADECC GROUP S.A. - OFFICIAL BILL OF QUANTITIES / ESTIMATE']);
  rows.push(['Civil Engineering, Geotechnics & Structural Construction']);
  rows.push(['Douala & Yaounde, Republic of Cameroon | Contact: info@madecc-group.cm']);
  rows.push([]);

  if (isDraft) {
    rows.push(['STATUS', 'DRAFT — NOT FOR CLIENT APPROVAL']);
  } else {
    rows.push(['STATUS', 'APPROVED']);
  }

  // Metadata
  rows.push(['BOQ Reference', boq.boqReference || '']);
  rows.push(['Revision', boq.revisionNumber || 'REV-00']);
  rows.push(['Project Name', boq.projectName || '']);
  rows.push(['Location', boq.location || '']);
  rows.push(['Client Name', boq.clientName || '']);
  rows.push(['Client Email', boq.clientEmail || '']);
  rows.push(['Client NIU', boq.clientNiu || '']);
  rows.push(['Date Prepared', boq.datePrepared ? new Date(boq.datePrepared).toLocaleDateString() : new Date().toLocaleDateString()]);
  rows.push(['Prepared By', boq.preparedBy || '']);
  rows.push(['Currency', boq.currency || 'XAF']);
  rows.push([]);

  // BOQ Items Header
  rows.push(['Section Code', 'Section Title', 'Item Number', 'Description', 'Unit', 'Quantity', 'Unit Rate (XAF)', 'Amount (XAF)']);

  const sections = boq.sections || [];
  sections.forEach((sec: any) => {
    (sec.items || []).forEach((item: any) => {
      rows.push([
        sec.sectionCode || '',
        sec.title || '',
        item.itemNumber || '',
        item.description || '',
        item.unit || '',
        String(item.quantity ?? 0),
        String(item.unitRate ?? 0),
        String(item.amount ?? 0)
      ]);
    });
    // Section subtotal row
    rows.push([
      sec.sectionCode || '',
      `${sec.title} SUB-TOTAL`,
      '',
      '',
      '',
      '',
      '',
      String(sec.subtotal ?? 0)
    ]);
    rows.push([]);
  });

  // Financial Summary
  rows.push(['FINANCIAL SUMMARY']);
  rows.push(['Subtotal (Measured Work)', '', '', '', '', '', '', String(boq.subtotal ?? 0)]);
  if (Number(boq.overheadAmount) > 0) {
    rows.push([`Overhead (${boq.overheadPercent}%)`, '', '', '', '', '', '', String(boq.overheadAmount ?? 0)]);
  }
  if (Number(boq.contingencyAmount) > 0) {
    rows.push([`Contingency (${boq.contingencyPercent}%)`, '', '', '', '', '', '', String(boq.contingencyAmount ?? 0)]);
  }
  if (Number(boq.profitAmount) > 0) {
    rows.push([`Profit Margin (${boq.profitPercent}%)`, '', '', '', '', '', '', String(boq.profitAmount ?? 0)]);
  }
  if (Number(boq.taxAmount) > 0) {
    rows.push([`Tax / TVA (${boq.taxPercent}%)`, '', '', '', '', '', '', String(boq.taxAmount ?? 0)]);
  }
  rows.push(['GRAND TOTAL (XAF)', '', '', '', '', '', '', String(boq.grandTotal ?? 0)]);

  // Serialize CSV with UTF-8 BOM
  const csvContent = '\uFEFF' + rows.map(r => r.map(cell => {
    const val = String(cell ?? '').replace(/"/g, '""');
    return `"${val}"`;
  }).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `${sanitizeFilename(boq.boqReference)}-${sanitizeFilename(boq.revisionNumber)}.csv`;

  return { blob, filename };
}
