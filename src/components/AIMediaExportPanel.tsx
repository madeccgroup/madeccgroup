import React, { useState } from "react";

import {
  MediaAsset,
  exportText,
  exportAudio,
  deleteMedia,
} from "../lib/mediaApi";

interface AIMediaExportPanelProps {
  items: MediaAsset[];
  title?: string;
  onDeleted?: (mediaId: string) => void;
}

export default function AIMediaExportPanel({
  items,
  title = "AI Media Library",
  onDeleted,
}: AIMediaExportPanelProps) {
  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function handleTextExport(
    item: MediaAsset,
    format: "txt" | "docx" | "pdf"
  ) {
    try {
      setError(null);
      setBusyId(`${item.id}-${format}`);

      await exportText(
        item.id,
        format
      );

    } catch (err) {

      console.error(
        "[MEDIA_TEXT_EXPORT]",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Text export failed."
      );

    } finally {

      setBusyId(null);
    }
  }

  async function handleAudioExport(
    item: MediaAsset,
    format: "mp3" | "wav"
  ) {
    try {
      setError(null);
      setBusyId(`${item.id}-${format}`);

      await exportAudio(
        item.id,
        format
      );

    } catch (err) {

      console.error(
        "[MEDIA_AUDIO_EXPORT]",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Audio export failed."
      );

    } finally {

      setBusyId(null);
    }
  }

  async function handleDelete(
    item: MediaAsset
  ) {
    const confirmed =
      window.confirm(
        `Delete "${item.name || item.originalFilename || "this media"}"?`
      );

    if (!confirmed) {
      return;
    }

    try {

      setError(null);
      setBusyId(`${item.id}-delete`);

      await deleteMedia(item.id);

      onDeleted?.(item.id);

    } catch (err) {

      console.error(
        "[MEDIA_DELETE]",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete media."
      );

    } finally {

      setBusyId(null);
    }
  }

  function busy(
    item: MediaAsset,
    action: string
  ) {
    return (
      busyId ===
      `${item.id}-${action}`
    );
  }

  return (
    <section className="w-full rounded-2xl border bg-white p-5 shadow-sm">

      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Export, download, and manage AI-generated media.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (

        <div className="rounded-xl border border-dashed p-8 text-center">

          <p className="text-sm text-gray-500">
            No media assets available.
          </p>

        </div>

      ) : (

        <div className="grid gap-4">

          {items.map((item) => {

            const mediaType =
              item.mediaType?.toLowerCase();

            const displayName =
              item.name ||
              item.originalFilename ||
              "Untitled media";

            return (

              <article
                key={item.id}
                className="rounded-xl border p-4"
              >

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="truncate font-medium text-gray-900">
                        {displayName}
                      </h3>

                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {item.mediaType}
                      </span>

                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {item.mimeType}
                    </div>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    {mediaType === "text" && (
                      <>

                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            handleTextExport(
                              item,
                              "txt"
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy(item, "txt")
                            ? "Exporting..."
                            : "TXT"}
                        </button>

                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            handleTextExport(
                              item,
                              "docx"
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy(item, "docx")
                            ? "Exporting..."
                            : "DOCX"}
                        </button>

                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            handleTextExport(
                              item,
                              "pdf"
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy(item, "pdf")
                            ? "Exporting..."
                            : "PDF"}
                        </button>

                      </>
                    )}

                    {mediaType === "audio" && (
                      <>

                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            handleAudioExport(
                              item,
                              "mp3"
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy(item, "mp3")
                            ? "Exporting..."
                            : "MP3"}
                        </button>

                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() =>
                            handleAudioExport(
                              item,
                              "wav"
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy(item, "wav")
                            ? "Exporting..."
                            : "WAV"}
                        </button>

                      </>
                    )}

                    {item.storageUrl && (
                      <a
                        href={item.storageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Open
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() =>
                        handleDelete(item)
                      }
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy(item, "delete")
                        ? "Deleting..."
                        : "Delete"}
                    </button>

                  </div>

                </div>

              </article>
            );
          })}

        </div>
      )}

    </section>
  );
}
