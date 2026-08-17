export interface MediaAsset {
  id: string;

  userId: string;

  projectId?: string | null;

  jobId?: string | null;

  name: string;

  originalFilename?: string | null;

  mediaType: string;

  mimeType: string;

  extension: string;

  sizeBytes?: number | null;

  durationSeconds?: number | null;

  width?: number | null;

  height?: number | null;

  storageUrl?: string | null;

  metadata?: Record<
    string,
    unknown
  > | null;

  status: string;

  archived: boolean;

  createdAt: string;

  updatedAt: string;
}
const API = "/api/ai/media";

type MediaFormat = "mp3" | "wav";

async function parseResponse(
  response: Response
): Promise<any> {
  const contentType =
    response.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Media request failed with status ${response.status}`
      );
    }

    return data;
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      text ||
        `Media request failed with status ${response.status}`
    );
  }

  return text;
}


/**
 * Export audio from a media asset.
 *
 * POST /api/ai/media/:id/audio
 */
export async function exportMediaAudio(
  mediaId: string,
  format: MediaFormat = "mp3"
): Promise<void> {
  const response = await fetch(
    `${API}/${encodeURIComponent(mediaId)}/audio?format=${encodeURIComponent(format)}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "audio/mpeg, audio/wav, application/octet-stream",
      },
    }
  );

  if (!response.ok) {
    await parseResponse(response);
    return;
  }

  const checked = response;

  const blob =
    await checked.blob();

  const url =
    URL.createObjectURL(blob);

  const disposition =
    response.headers.get(
      "Content-Disposition"
    );

  const match =
    disposition?.match(
      /filename="([^"]+)"/
    );

  const filename =
    match?.[1] ||
    `madecc-export.${format}`;

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}


/**
 * Delete/archive a media asset.
 *
 * DELETE /api/ai/media/:id
 */
export async function deleteMedia(
  mediaId: string
): Promise<any> {
  const response =
    await fetch(
      `${API}/${encodeURIComponent(
        mediaId
      )}`,
      {
        method: "DELETE",
        credentials:
          "include",
        headers: {
          Accept: "application/json",
        },
      }
    );

  return parseResponse(
    response
  );
}


/**
 * Generic media request helper.
 *
 * Useful for future media endpoints without
 * duplicating authentication/error handling.
 */
export async function mediaRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response =
    await fetch(
      `${API}${path}`,
      {
        credentials: "include",
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      }
    );

  return parseResponse(
    response
  ) as Promise<T>;
}


export async function exportText(
  mediaId: string,
  format: "txt" | "docx" | "pdf"
): Promise<void> {
  const response = await fetch(
    `${API}/${encodeURIComponent(mediaId)}/export/text/${encodeURIComponent(format)}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!response.ok) {
    let message = "Text export failed.";

    try {
      const data = await response.json();

      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Response was not JSON.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  const disposition =
    response.headers.get("Content-Disposition");

  const match =
    disposition?.match(/filename="([^"]+)"/);

  const filename =
    match?.[1] ||
    `madecc-export.${format}`;

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

export async function exportAudio(
  mediaId: string,
  format: "mp3" | "wav"
): Promise<void> {
  const response = await fetch(
    `${API}/${encodeURIComponent(mediaId)}/export/audio/${encodeURIComponent(format)}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  if (!response.ok) {
    let message = "Audio export failed.";

    try {
      const data = await response.json();

      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Response was not JSON.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  const disposition =
    response.headers.get("Content-Disposition");

  const match =
    disposition?.match(/filename="([^"]+)"/);

  const filename =
    match?.[1] ||
    `madecc-audio-export.${format}`;

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

