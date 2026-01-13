"use client";

import { useState, useRef, useEffect } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { boardsApi } from "@/lib/api";

interface ExportDropdownProps {
  boardId: string;
  boardName: string;
}

export function ExportDropdown({ boardId, boardName }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportCsv = async () => {
    setIsExporting("csv");
    try {
      const blob = await boardsApi.exportCsv(boardId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${boardName.replace(/\s+/g, "_")}_export_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportJson = async () => {
    setIsExporting("json");
    try {
      const data = await boardsApi.exportJson(boardId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${boardName.replace(/\s+/g, "_")}_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export JSON:", error);
      alert("Failed to export JSON. Please try again.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportSummary = async () => {
    setIsExporting("summary");
    try {
      const data = await boardsApi.getExportSummary(boardId);

      // Generate a simple text report
      const lines = [
        `Board Summary Report: ${data.board_name}`,
        `Project: ${data.project_name}`,
        `Generated: ${new Date(data.exported_at).toLocaleString()}`,
        "",
        "=== Summary ===",
        `Total Cards: ${data.summary.total_cards}`,
        `Total Story Points: ${data.summary.total_story_points}`,
        `Completed Points: ${data.summary.completed_story_points}`,
        `Completion Rate: ${data.summary.completion_rate}%`,
        "",
        "=== Columns ===",
        ...data.columns.map((col: any) =>
          `${col.name}: ${col.card_count} cards, ${col.story_points} points${col.wip_limit ? ` (WIP: ${col.wip_limit})` : ""}${col.is_over_limit ? " [OVER LIMIT]" : ""}`
        ),
        "",
        "=== Priority Breakdown ===",
        ...Object.entries(data.priority_breakdown)
          .filter(([_, count]) => (count as number) > 0)
          .map(([priority, count]) => `${priority}: ${count} cards`),
        "",
        "=== Team Workload ===",
        ...(data.assignee_workload.length > 0
          ? data.assignee_workload.map((a: any) => `${a.name}: ${a.cards} cards, ${a.points} points`)
          : ["No assignees"]),
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${boardName.replace(/\s+/g, "_")}_summary_${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to export summary:", error);
      alert("Failed to export summary. Please try again.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-1">
            <button
              onClick={handleExportCsv}
              disabled={isExporting !== null}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isExporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              )}
              <div className="flex-1 text-left">
                <div className="font-medium">Export as CSV</div>
                <div className="text-xs text-gray-500">All cards in spreadsheet format</div>
              </div>
            </button>

            <button
              onClick={handleExportJson}
              disabled={isExporting !== null}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isExporting === "json" ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <FileText className="h-4 w-4 text-blue-500" />
              )}
              <div className="flex-1 text-left">
                <div className="font-medium">Export as JSON</div>
                <div className="text-xs text-gray-500">Structured data for integrations</div>
              </div>
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button
              onClick={handleExportSummary}
              disabled={isExporting !== null}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {isExporting === "summary" ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <FileText className="h-4 w-4 text-purple-500" />
              )}
              <div className="flex-1 text-left">
                <div className="font-medium">Board Summary Report</div>
                <div className="text-xs text-gray-500">Overview with stats & workload</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
