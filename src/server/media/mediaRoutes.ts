import type { Express, Request, Response } from "express";
import {
  exportAudio,
  exportText,
  archiveMedia,
} from "./mediaService";

/**
 * MADECC AI Media Routes
 *
 * This application uses direct Express app registration
 * rather than an Express Router mounted separately.
 *
 * Mounted by server.ts through registerMediaRoutes(app).
 */
export function registerMediaRoutes(app: Express): void {
  /**
   * GET /api/ai/media/:id/export/text/:format
   *
   * Supported:
   *   txt
   *   docx
   *   pdf
   */
  app.get(
    "/api/ai/media/:id/export/text/:format",
    async (req: Request, res: Response) => {
      try {
        const format = String(req.params.format).toLowerCase();

        if (!["txt", "docx", "pdf"].includes(format)) {
          return res.status(400).json({
            success: false,
            error: "Unsupported text export format.",
          });
        }

        const userId =
          String(
            (req as any).mediaUserId ||
            (req as any).dbUser?.uid ||
            (req as any).dbUser?.id ||
            (req as any).user?.uid ||
            (req as any).user?.id ||
            "anonymous"
          );

        const exported = await exportText(
          req.params.id,
          userId,
          format as "txt" | "docx" | "pdf"
        );

        res.setHeader(
          "Content-Type",
          exported.mimeType
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${exported.filename}"`
        );

        res.setHeader(
          "Content-Length",
          exported.buffer.length
        );

        return res.send(exported.buffer);
      } catch (error) {
        console.error(
          "[MEDIA_TEXT_EXPORT]",
          error
        );

        return res.status(500).json({
          success: false,
          error: "Text export failed.",
        });
      }
    }
  );

  /**
   * GET /api/ai/media/:id/export/audio/:format
   *
   * Supported:
   *   mp3
   *   wav
   */
  app.get(
    "/api/ai/media/:id/export/audio/:format",
    async (req: Request, res: Response) => {
      try {
        const format = String(req.params.format).toLowerCase();

        if (!["mp3", "wav"].includes(format)) {
          return res.status(400).json({
            success: false,
            error: "Unsupported audio export format.",
          });
        }

        const userId =
          String(
            (req as any).mediaUserId ||
            (req as any).dbUser?.uid ||
            (req as any).dbUser?.id ||
            (req as any).user?.uid ||
            (req as any).user?.id ||
            "anonymous"
          );

        const exported = await exportAudio(
          req.params.id,
          userId,
          format as "mp3" | "wav"
        );

        res.setHeader(
          "Content-Type",
          exported.mimeType
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${exported.filename}"`
        );

        res.setHeader(
          "Content-Length",
          exported.buffer.length
        );

        return res.send(exported.buffer);
      } catch (error) {
        console.error(
          "[MEDIA_AUDIO_EXPORT]",
          error
        );

        return res.status(500).json({
          success: false,
          error: "Audio extraction failed.",
        });
      }
    }
  );

  /**
   * DELETE /api/ai/media/:id
   */
  app.delete(
    "/api/ai/media/:id",
    async (req: Request, res: Response) => {
      try {
        const userId =
          String(
            (req as any).mediaUserId ||
            (req as any).dbUser?.uid ||
            (req as any).dbUser?.id ||
            (req as any).user?.uid ||
            (req as any).user?.id ||
            "anonymous"
          );

        await archiveMedia(
          req.params.id,
          userId
        );

        return res.json({
          success: true,
        });
      } catch (error) {
        console.error(
          "[MEDIA_DELETE]",
          error
        );

        return res.status(500).json({
          success: false,
          error: "Unable to delete media.",
        });
      }
    }
  );

  console.log(
    "[MEDIA_ROUTES] Registered /api/ai/media endpoints"
  );
}
