import PDFDocument from "pdfkit";

/**
 * Create an A4 PDF document from plain text content.
 *
 * Returns the generated PDF as a Buffer so it can be:
 * - downloaded by the client
 * - uploaded to Cloudinary
 * - stored as an AI media asset
 * - attached to an email
 * - used by other server-side export workflows
 */
export function createPdf(
  title: string,
  content: string
): Promise<Buffer> {
  return new Promise(
    (resolve, reject) => {
      const chunks: Buffer[] = [];

      const safeTitle =
        title?.trim() || "MADECC Document";

      const safeContent =
        content ?? "";

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: safeTitle,
          Author: "MADECC Group",
          Creator: "MADECC AI Studio",
        },
      });

      doc.on(
        "data",
        (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk));
        }
      );

      doc.on(
        "end",
        () => {
          resolve(
            Buffer.concat(chunks)
          );
        }
      );

      doc.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      doc
        .fontSize(20)
        .text(safeTitle);

      doc.moveDown();

      doc
        .fontSize(10)
        .text(safeContent, {
          align: "left",
          lineGap: 5,
        });

      doc.end();
    }
  );
}
