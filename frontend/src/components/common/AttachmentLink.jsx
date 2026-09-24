import { useState } from "react";

import {
  attachmentErrorMessage,
  downloadAttachment,
} from "../../services/attachmentDownload";

/**
 * A link-styled button that downloads an attachment through the
 * authenticated API (see attachmentDownload.js for why a plain link
 * does not work).
 */
export function AttachmentLink({
  attachment,
  children,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      await downloadAttachment(attachment);
    } catch (downloadError) {
      setError(attachmentErrorMessage(downloadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="attachment-link-wrap">
      <button
        type="button"
        className="attachment-link"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
      >
        {children ?? attachment.original_name}
      </button>
      {error ? (
        <small
          className="attachment-link__error"
          role="alert"
        >
          {error}
        </small>
      ) : null}
    </div>
  );
}
