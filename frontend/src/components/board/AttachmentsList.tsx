"use client";

import { useState, useRef } from "react";
import { Paperclip, Upload, Trash2, Download, FileText, Image, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { attachmentsApi } from "@/lib/api";
import type { Attachment } from "@/types";

interface AttachmentsListProps {
  cardId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  document: <FileText className="h-4 w-4 text-blue-500" />,
  default: <File className="h-4 w-4" />,
};

function getFileIcon(mimeType: string | null): React.ReactNode {
  if (!mimeType) return FILE_ICONS.default;
  if (mimeType.startsWith("image/")) return FILE_ICONS.image;
  if (mimeType === "application/pdf") return FILE_ICONS.pdf;
  if (mimeType.includes("word") || mimeType.includes("document")) return FILE_ICONS.document;
  return FILE_ICONS.default;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsList({ cardId, attachments, onAttachmentsChange }: AttachmentsListProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const data = await attachmentsApi.upload(cardId, file);
        onAttachmentsChange([data.attachment, ...attachments]);
      }
    } catch (err: any) {
      console.error("Failed to upload file:", err);
      setError(err.response?.data?.error || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setDeleting(attachmentId);
    try {
      await attachmentsApi.delete(cardId, attachmentId);
      onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId));
    } catch (err) {
      console.error("Failed to delete attachment:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const url = attachmentsApi.getDownloadUrl(cardId, attachment.id);
    const token = localStorage.getItem("access_token");

    // Create a temporary link with authorization
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = attachment.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
      })
      .catch((err) => console.error("Download failed:", err));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Paperclip className="h-4 w-4" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-gray-500">({attachments.length})</span>
          )}
        </h3>
      </div>

      {/* Upload area */}
      <div className="mb-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          accept=".txt,.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.csv,.zip,.md"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-700",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Click to upload files
            </>
          )}
        </button>
        <p className="mt-1 text-xs text-gray-500 text-center">
          Max 10MB per file. Supported: images, PDFs, documents, spreadsheets, zip
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Attachments list */}
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500">No attachments</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50",
                deleting === attachment.id && "opacity-50"
              )}
            >
              {/* Icon */}
              <div className="flex-shrink-0 text-gray-400">
                {getFileIcon(attachment.mime_type)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {attachment.filename}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(attachment.file_size)}
                  {attachment.uploaded_by_user && (
                    <> &middot; {attachment.uploaded_by_user.full_name || attachment.uploaded_by_user.email}</>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deleting === attachment.id}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
