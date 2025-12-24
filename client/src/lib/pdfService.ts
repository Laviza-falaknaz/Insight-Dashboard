import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  includeTimestamp?: boolean;
  orientation?: 'portrait' | 'landscape';
}

export async function captureElementAsImage(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) return null;
  
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error capturing element:', error);
    return null;
  }
}

export async function captureMultipleElements(elementIds: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  for (const id of elementIds) {
    const image = await captureElementAsImage(id);
    if (image) {
      results.set(id, image);
    }
  }
  
  return results;
}

export async function generateDashboardPDF(
  options: PDFExportOptions,
  contentElementIds: string[]
): Promise<void> {
  const pdf = new jsPDF({
    orientation: options.orientation || 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Add header
  pdf.setFontSize(24);
  pdf.setTextColor(33, 33, 33);
  pdf.text(options.title, margin, yPosition);
  yPosition += 10;

  if (options.subtitle) {
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(options.subtitle, margin, yPosition);
    yPosition += 8;
  }

  if (options.includeTimestamp !== false) {
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 12;
  }

  // Add separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Capture and add each element
  for (const elementId of contentElementIds) {
    const element = document.getElementById(elementId);
    if (!element) continue;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check if we need a new page
      if (yPosition + imgHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    } catch (error) {
      console.error(`Error capturing element ${elementId}:`, error);
    }
  }

  // Add footer to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin - 20,
      pageHeight - 10
    );
    pdf.text(
      'Executive Dashboard Report',
      margin,
      pageHeight - 10
    );
  }

  // Save the PDF
  const filename = `${options.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
}

export async function generateFullDashboardReport(
  pages: { name: string; elementIds: string[] }[],
  title: string = 'Executive Dashboard Report'
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // Title page
  pdf.setFontSize(32);
  pdf.setTextColor(33, 33, 33);
  pdf.text(title, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

  pdf.setFontSize(12);
  pdf.text('Contents:', pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });
  
  pages.forEach((page, index) => {
    pdf.text(`${index + 1}. ${page.name}`, pageWidth / 2, pageHeight / 2 + 40 + (index * 8), { align: 'center' });
  });

  // Process each page
  for (const page of pages) {
    pdf.addPage();
    let yPosition = margin;

    // Page header
    pdf.setFontSize(20);
    pdf.setTextColor(33, 33, 33);
    pdf.text(page.name, margin, yPosition);
    yPosition += 15;

    // Separator
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Capture elements
    for (const elementId of page.elementIds) {
      const element = document.getElementById(elementId);
      if (!element) continue;

      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (yPosition + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (error) {
        console.error(`Error capturing element ${elementId}:`, error);
      }
    }
  }

  // Add page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
  }

  const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
}
