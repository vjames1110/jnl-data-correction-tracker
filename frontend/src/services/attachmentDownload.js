import { env } from "../config/env";
import { apiClient } from "./apiClient";

// Big scans on a slow site connection take longer than the 20s used
// for ordinary API calls.
const DOWNLOAD_TIMEOUT_MS = 120_000;

/**
 * The API hands out absolute download URLs. Route them through the
 * configured API base instead, so the request always uses the right
 * host and scheme (behind a proxy the backend may build an http:// URL
 * that a https:// page cannot call).
 */
export function toApiPath(downloadUrl) {
  const path = new URL(downloadUrl, env.apiBaseUrl).pathname;
  const basePath = new URL(env.apiBaseUrl).pathname.replace(
    /\/+$/,
    "",
  );

  return basePath && path.startsWith(`${basePath}/`)
    ? path.slice(basePath.length)
    : path;
}

export function attachmentErrorMessage(error) {
  if (error?.status === 404) {
    return "This file is no longer available. Please upload it again.";
  }
  if (error?.status === 403) {
    return "You do not have permission to open this file.";
  }
  return (
    error?.message ||
    "The file could not be downloaded. Please try again."
  );
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the save before the URL goes.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Download an attachment with the signed-in user's token. A plain
 * <a href> to the download URL cannot do this: the browser sends no
 * Authorization header on navigation, so the API answers 401.
 */
export async function downloadAttachment(attachment) {
  const response = await apiClient.get(
    toApiPath(attachment.download_url),
    {
      responseType: "blob",
      timeout: DOWNLOAD_TIMEOUT_MS,
    },
  );

  saveBlob(
    response.data,
    attachment.original_name || "attachment",
  );
}
