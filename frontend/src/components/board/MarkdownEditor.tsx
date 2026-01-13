"use client";

import { useState, useRef } from "react";
import { Eye, Edit3, Bold, Italic, List, ListOrdered, Code, Link, Heading2 } from "lucide-react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const formatButtons = [
    { icon: Bold, action: () => insertText("**", "**"), title: "Bold" },
    { icon: Italic, action: () => insertText("_", "_"), title: "Italic" },
    { icon: Heading2, action: () => insertText("## "), title: "Heading" },
    { icon: Code, action: () => insertText("`", "`"), title: "Code" },
    { icon: List, action: () => insertText("- "), title: "Bullet list" },
    { icon: ListOrdered, action: () => insertText("1. "), title: "Numbered list" },
    { icon: Link, action: () => insertText("[", "](url)"), title: "Link" },
  ];

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Write/Preview toggle */}
          <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                !isPreview
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Write
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                isPreview
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>

          {/* Formatting buttons */}
          {!isPreview && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-0.5">
                {formatButtons.map(({ icon: Icon, action, title }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={action}
                    title={title}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 min-h-[150px] text-sm text-gray-700"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(value) || "<span class='text-gray-400 italic'>Nothing to preview</span>"
          }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          placeholder={placeholder || "Write your description here... Use **bold**, _italic_, or # headings"}
        />
      )}
    </div>
  );
}
