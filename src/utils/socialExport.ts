import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer
} from 'docx';
import { saveAs } from 'file-saver';

export interface SocialPostItem {
  id: number | string;
  title: string;
  seoTopic?: string;
  targetPlatforms: string[];
  caption: string;
  hashtags?: string;
  ctaText?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document' | 'gallery';
  status: 'DRAFT' | 'APPROVED' | 'QUEUED' | 'PUBLISHING' | 'PUBLISHED' | 'PARTIALLY_PUBLISHED' | 'FAILED' | 'SCHEDULED' | 'CANCELLED';
  scheduledAt?: string;
  publishedAt?: string;
  reachEstimate?: number;
  engagementCount?: number;
  createdAt?: string;
}

export interface SocialChannelItem {
  id: number | string;
  platform: string;
  channelName: string;
  accountHandle?: string;
  status: string;
  isCustom?: boolean;
}

// ============================================================================
// 1. A4 PDF EXPORT: SOCIAL MEDIA CONTENT CALENDAR & POST DIRECTORY
// ============================================================================
export function generateSocialCalendarPdf(posts: SocialPostItem[], channels: SocialChannelItem[]): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42]; // Slate 900
  const goldColor = [217, 119, 6];   // Amber 600

  // Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.rect(0, 24, 297, 2, 'F');

  // Company Name & Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MADECC GROUP S.A. - SOCIAL MEDIA & SEO CONTENT CALENDAR', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Central Africa Region (Douala/Yaoundé)`, 14, 19);

  // Summary Metrics
  const publishedCount = posts.filter(p => p.status === 'PUBLISHED').length;
  const scheduledCount = posts.filter(p => p.status === 'SCHEDULED').length;
  const draftCount = posts.filter(p => p.status === 'DRAFT').length;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Content Operations Overview', 14, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total Posts: ${posts.length}  |  Published: ${publishedCount}  |  Scheduled: ${scheduledCount}  |  Drafts: ${draftCount}  |  Active Channels: ${channels.length}`, 14, 40);

  // Table rows setup
  const tableData = posts.map(post => [
    post.id.toString(),
    post.title || 'Untitled',
    (post.targetPlatforms || []).map(p => p.toUpperCase()).join(', '),
    post.caption.length > 80 ? post.caption.substring(0, 80) + '...' : post.caption,
    post.hashtags || '#MADECCGroup',
    post.status,
    post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('en-GB') : (post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB') : 'Immediate')
  ]);

  autoTable(doc, {
    startY: 46,
    head: [['ID', 'Post Title & Topic', 'Target Platforms', 'SEO Caption Excerpt', 'Hashtags', 'Status', 'Publish Date']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 90 },
      4: { cellWidth: 40 },
      5: { cellWidth: 22, fontStyle: 'bold' },
      6: { cellWidth: 25 }
    },
    didDrawPage: (data) => {
      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`MADECC Group S.A. Social Media & SEO Studio - Page ${data.pageNumber} of ${totalPages}`, 14, 202);
    }
  });

  doc.save(`MADECC_Social_Media_Content_Calendar_${Date.now()}.pdf`);
}

// ============================================================================
// 2. WORD (.DOCX) EXPORT: SOCIAL MEDIA CONTENT CALENDAR
// ============================================================================
export async function generateSocialCalendarDocx(posts: SocialPostItem[], channels: SocialChannelItem[]): Promise<void> {
  const children: any[] = [];

  // Document Title Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: 'MADECC GROUP S.A. - SOCIAL MEDIA & SEO CONTENT REPORT',
          bold: true,
          size: 28,
          color: '0F172A'
        })
      ]
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Official Central Africa Corporate Broadcast & Marketing Schedule | ${new Date().toLocaleDateString('en-GB')}`,
          italics: true,
          size: 18,
          color: 'D97706'
        })
      ]
    })
  );

  children.push(new Paragraph({ text: '' }));

  // Channels Overview Paragraph
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({ text: '1. Connected Social Media Channels & Platforms', bold: true, size: 22, color: '0F172A' })
      ]
    })
  );

  const channelText = channels.map(c => `${c.channelName} (${c.platform.toUpperCase()} - ${c.accountHandle || 'Active'})`).join('\n• ');
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `• ${channelText}`, size: 18, color: '334155' })
      ]
    })
  );

  children.push(new Paragraph({ text: '' }));

  // Posts Table
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({ text: '2. Social Media Posts & SEO Media Schedule', bold: true, size: 22, color: '0F172A' })
      ]
    })
  );

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Title & SEO Topic', bold: true, color: 'FFFFFF', size: 16 })] })], shading: { fill: '0F172A' } }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Target Platforms', bold: true, color: 'FFFFFF', size: 16 })] })], shading: { fill: '0F172A' } }),
        new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Caption & Hashtags', bold: true, color: 'FFFFFF', size: 16 })] })], shading: { fill: '0F172A' } }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'CTA & Contact', bold: true, color: 'FFFFFF', size: 16 })] })], shading: { fill: '0F172A' } }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Status & Date', bold: true, color: 'FFFFFF', size: 16 })] })], shading: { fill: '0F172A' } })
      ]
    })
  ];

  posts.forEach((post, index) => {
    const bg = index % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: post.title, bold: true, size: 16, color: '0F172A' })] })], shading: { fill: bg } }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: (post.targetPlatforms || []).join(', ').toUpperCase(), size: 14, color: 'D97706', bold: true })] })], shading: { fill: bg } }),
          new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `${post.caption}\n\n${post.hashtags || ''}`, size: 14, color: '334155' })] })], shading: { fill: bg } }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: post.ctaText || 'Contact MADECC', size: 14, color: '2563EB' })] })], shading: { fill: bg } }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `${post.status}\n${post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('en-GB') : 'Immediate'}`, bold: true, size: 14, color: post.status === 'PUBLISHED' ? '059669' : 'D97706' })] })], shading: { fill: bg } })
        ]
      })
    );
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' }
      }
    })
  );

  const docxObj = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'MADECC GROUP S.A. | Social Media & SEO Studio', size: 14, color: '94A3B8' })
                ]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Confidential Internal Marketing Document - MADECC Group Cameroon', size: 14, color: '94A3B8' })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });

  const blob = await Packer.toBlob(docxObj);
  saveAs(blob, `MADECC_Social_Media_Report_${Date.now()}.docx`);
}

// ============================================================================
// 3. A4 PDF EXPORT: SINGLE POST DOSSIER
// ============================================================================
export function generateSinglePostPdf(post: SocialPostItem): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 28, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MADECC GROUP S.A. - SOCIAL MEDIA POST DOSSIER', 14, 15);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Post ID: #${post.id} | Platforms: ${(post.targetPlatforms || []).join(', ').toUpperCase()} | Status: ${post.status}`, 14, 22);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`SEO Title: ${post.title}`, 14, 38);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Published Caption / Copywriting:', 14, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const splitCaption = doc.splitTextToSize(post.caption, 180);
  doc.text(splitCaption, 14, 54);

  let currentY = 54 + splitCaption.length * 5 + 6;

  if (post.hashtags) {
    doc.setFont('helvetica', 'bold');
    doc.text('Target Hashtags:', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    const splitHash = doc.splitTextToSize(post.hashtags, 180);
    doc.text(splitHash, 14, currentY + 5);
    currentY += splitHash.length * 5 + 8;
  }

  if (post.ctaText) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Call to Action (CTA):', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(217, 119, 6);
    doc.text(post.ctaText, 14, currentY + 5);
    currentY += 12;
  }

  if (post.mediaUrl) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Attached Media Link:', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(post.mediaUrl, 14, currentY + 5);
  }

  doc.save(`MADECC_Social_Post_${post.id}_${Date.now()}.pdf`);
}
