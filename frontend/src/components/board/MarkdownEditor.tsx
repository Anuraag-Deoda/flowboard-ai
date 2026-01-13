"use client";

import { useState } from "react";
import { Eye, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Simple markdown to HTML converter for preview
function renderMarkdown(text: string): string {
  if (!text) return "";

  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-3 mb-1'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-3 mb-2'>$1</h1>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Strikethrough
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre class='bg-gray-100 rounded p-2 my-2 overflow-x-auto text-sm'><code>$2</code></pre>")
    // Inline code
    .replace(/`(.+?)`/g, "<code class='bg-gray-100 px-1 rounded text-sm'>$1</code>")
    // Unordered lists
    .replace(/^[\*\-] (.+)$/gm, "<li class='ml-4'>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote class='border-l-4 border-gray-300 pl-3 italic text-gray-600'>$1</blockquote>")
    // Horizontal rule
    .replace(/^---$/gm, "<hr class='my-3 border-gray-300' />")
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' class='text-blue-600 hover:underline' target='_blank' rel='noopener'>$1</a>")
    // Line breaks
    .replace(/\n\n/g, "</p><p class='my-2'>")
    .replace(/\n/g, "<br />");

  // Wrap in paragraph
  html = "<p class='my-2'>" + html + "</p>";

  // Clean up empty paragraphs
  html = html.replace(/<p class='my-2'><\/p>/g, "");

  return html;
}

export function MarkdownEditor({ value, onChange, placeholder, className }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div className={cn("rounded-lg border border-gray-300", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              !isPreview
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Edit3 className="h-3 w-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
              isPreview
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
        </div>
        <span className="text-xs text-gray-500">Markdown supported</span>
      </div>

      {/* Content */}
      {isPreview ? (
        <div
          className="prose prose-sm max-w-none p-3 min-h-[150px] text-sm text-gray-700"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || "<span class='text-gray-400'>Nothing to preview</span>" }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="w-full resize-none border-0 px-3 py-2 text-sm focus:outline-none focus:ring-0"
          placeholder={placeholder || "Write your description here... (Markdown supported)"}
        />
      )}
    </div>
  );
}
