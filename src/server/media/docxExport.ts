import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
} from "docx";

/**
 * Create a Microsoft Word DOCX document from plain text content.
 *
 * Each newline in the content becomes a separate paragraph.
 */
export async function createDocx(
  title: string,
  content: string
): Promise<Buffer> {
  const safeTitle = title?.trim() || "MADECC Document";
  const safeContent = content ?? "";

  const paragraphs = safeContent
    .split(/\r?\n/)
    .map(
      (line) =>
        new Paragraph({
          text: line,
        })
    );

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: safeTitle,
            heading: HeadingLevel.HEADING_1,
          }),

          ...paragraphs,
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}
