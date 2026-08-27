import { useState } from "react";

import {
  parseCsv,
  readTextFile,
} from "../modules/admin/utils/csvImport";
import { useImportReconciliationMasters } from "./useReconciliation";

/**
 * Drives one management page's own "Import CSV" button (Item
 * Categories / Items / Company Defaults each have their own, next to
 * their existing "Export" button) - parses the file client-side,
 * hands each row through `normalizeRow`, then creates it via the
 * resource's existing single-row create call.
 *
 * `fileInputRef` is created by the calling page (its own `useRef`)
 * and passed in, rather than created and returned here, so a plain
 * state read like `csvImport.error` never resolves through an
 * object that also carries a ref.
 */
export function useCsvImportControl({
  resource,
  normalizeRow,
  fileInputRef,
}) {
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const importMasters =
    useImportReconciliationMasters();

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (!file) {
      return;
    }

    try {
      setError("");
      setResults([]);
      const text = await readTextFile(file);
      const parsedRows = parseCsv(text);
      const rows = parsedRows.map(normalizeRow);

      if (!rows.length) {
        setError(
          "The CSV file does not contain any data rows.",
        );
        return;
      }

      const imported =
        await importMasters.mutateAsync({
          resource,
          rows,
        });
      setResults(imported);
    } catch (importException) {
      setError(importException.message);
    }
  };

  return {
    triggerFileDialog,
    handleFileChange,
    isPending: importMasters.isPending,
    error,
    results,
  };
}
