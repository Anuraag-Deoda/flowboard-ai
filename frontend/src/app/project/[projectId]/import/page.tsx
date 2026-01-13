"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  X,
  ChevronRight,
  Wand2,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
  Layers,
  Target,
  Zap,
  CheckCircle2,
  Table,
  Settings2,
} from "lucide-react";
import { importApi } from "@/lib/api";

interface ImportSession {
  import_id: string;
  filename: string;
  file_type: string;
  structure: {
    headers: string[];
    data_types: Record<string, string>;
    row_count: number;
    column_count: number;
    header_row_detected?: number;
    hierarchy_detected?: boolean;
    column_analysis?: Record<string, { type: string; confidence: number }>;
  };
  preview_rows: Record<string, any>[];
  smart_mapping?: Record<string, string | null>;
  mapping_confidence?: number;
  confidence_details?: Record<string, string>;
  insights?: {
    header_row: number;
    is_hierarchical: boolean;
    hierarchy_pattern?: string;
    adjacent_content_detected: boolean;
    adjacent_pairs?: Array<{ id_column: string; content_column: string; pattern: string }>;
  };
}

interface ProcessedImport {
  import_id: string;
  task_count: number;
  tasks: Array<{
    title: string;
    description: string;
    priority: string | null;
    story_points: number | null;
    status?: string | null;
    assignee?: string | null;
    hierarchy_level?: number;
  }>;
  ai_suggestions: {
    enhanced_tasks: Array<{
      original_title: string;
      suggested_title: string | null;
      title_issue?: string;
      suggested_priority: string | null;
      priority_reason?: string;
      suggested_points: number | null;
      points_reason?: string;
      is_likely_parent_task?: boolean;
      suggested_subtasks?: string[];
      notes?: string;
    }>;
    potential_duplicates?: Array<{
      tasks: string[];
      similarity: string;
      reason: string;
    }>;
    related_task_groups?: Array<{
      group_name: string;
      tasks: string[];
      suggestion: string;
    }>;
    project_analysis?: {
      detected_type: string;
      detected_methodology: string;
      overall_quality: string;
      missing_info: string[];
    };
    workflow_suggestions?: string[];
    import_warnings?: string[];
  } | null;
  ai_analysis?: {
    data_quality_score: number;
    completeness: {
      has_good_titles: boolean;
      has_descriptions: boolean;
      has_estimates: boolean;
      has_priorities: boolean;
    };
    recommendations: string[];
    detected_project_type: string;
    suggested_workflow: string;
  } | null;
  column_mapping: Record<string, string | null>;
  processing_insights?: {
    tasks_extracted: number;
    tasks_with_description: number;
    tasks_with_priority: number;
    tasks_with_points: number;
    tasks_with_assignee: number;
    hierarchical_tasks: number;
  };
}

type Step = "upload" | "preview" | "mapping" | "process" | "confirm";

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [processedImport, setProcessedImport] = useState<ProcessedImport | null>(null);

  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({
    title: null,
    description: null,
    priority: null,
    story_points: null,
  });
  const [useAI, setUseAI] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  }, [projectId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  }, [projectId]);

  const uploadFile = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      const response = await importApi.upload(projectId, file);
      setImportSession(response);

      // Use smart mapping from backend if available (AI-detected)
      if (response.smart_mapping) {
        setColumnMapping({
          title: response.smart_mapping.title || null,
          description: response.smart_mapping.description || null,
          priority: response.smart_mapping.priority || null,
          story_points: response.smart_mapping.story_points || null,
        });
      } else {
        // Fallback to simple header matching
        const headers = response.structure.headers;
        const headersLower = headers.reduce((acc: Record<string, string>, h: string) => {
          acc[h.toLowerCase()] = h;
          return acc;
        }, {});

        setColumnMapping({
          title: headersLower["title"] || headersLower["name"] || headersLower["task"] || headers[0],
          description: headersLower["description"] || headersLower["desc"] || headersLower["details"] || null,
          priority: headersLower["priority"] || headersLower["prio"] || null,
          story_points: headersLower["story_points"] || headersLower["points"] || headersLower["estimate"] || null,
        });
      }

      // If confidence is high enough, auto-process
      if (response.mapping_confidence && response.mapping_confidence >= 70) {
        // High confidence - can auto-process
        setStep("preview");
      } else {
        setStep("preview");
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!importSession) return;

    setError(null);
    setIsProcessing(true);

    try {
      const response = await importApi.process(importSession.import_id, {
        column_mapping: columnMapping,
        use_ai: useAI,
      });
      setProcessedImport(response);
      setStep("confirm");
    } catch (err: any) {
      setError(err.message || "Failed to process import");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!processedImport) return;

    setError(null);
    setIsConfirming(true);

    try {
      const response = await importApi.confirm(processedImport.import_id, {
        tasks: processedImport.tasks,
      });

      // Redirect to board
      router.push(`/project/${projectId}/board/${response.board_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create cards");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (importSession) {
      try {
        await importApi.cancel(importSession.import_id);
      } catch (err) {
        // Ignore cancel errors
      }
    }
    router.back();
  };

  const stepList = [
    { key: "upload", label: "Upload", icon: Upload },
    { key: "preview", label: "Map & Preview", icon: Settings2 },
    { key: "confirm", label: "Confirm", icon: CheckCircle2 },
  ];

  const currentStepIndex = stepList.findIndex((s) =>
    (s.key === "preview" && (step === "preview" || step === "mapping" || step === "process")) ||
    s.key === step
  );

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-10">
      {stepList.map((s, i) => {
        const Icon = s.icon;
        const isActive = currentStepIndex === i;
        const isCompleted = currentStepIndex > i;

        return (
          <div key={s.key} className="flex items-center">
            <div className={`relative flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${
              isActive
                ? "bg-blue-50 border border-blue-200"
                : isCompleted
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-gray-50 border border-gray-200"
            }`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isCompleted
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}>
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm font-medium ${
                isActive ? "text-blue-700" : isCompleted ? "text-emerald-700" : "text-gray-500"
              }`}>
                {s.label}
              </span>
            </div>
            {i < stepList.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${
                currentStepIndex > i ? "bg-emerald-300" : "bg-gray-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderUploadStep = () => (
    <div className={`max-w-2xl mx-auto ${mounted ? "animate-fade-in" : "opacity-0"}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 transition-all ${
          isDragging
            ? "border-blue-400 bg-blue-50 scale-[1.01]"
            : "border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50"
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <FileSpreadsheet className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900 mb-1">Uploading & Parsing</p>
              <p className="text-sm text-gray-500">Analyzing your spreadsheet...</p>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mx-auto mb-6">
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>
            <p className="text-xl font-semibold text-gray-900 mb-2 text-center">
              Drop your spreadsheet here
            </p>
            <p className="text-gray-500 text-center mb-8 max-w-sm mx-auto">
              Import tasks from Excel (.xlsx, .xls) or CSV files. We'll automatically detect columns.
            </p>
            <label
              htmlFor="file-upload"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm mx-auto w-fit cursor-pointer hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              <Upload className="w-5 h-5" />
              Browse Files
            </label>
            <p className="text-xs text-gray-400 text-center mt-4">Maximum file size: 10MB</p>
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Table className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">Smart Detection</p>
          <p className="text-xs text-gray-500 mt-1">Auto-finds headers even in messy data</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
            <Wand2 className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">AI Enhancement</p>
          <p className="text-xs text-gray-500 mt-1">Priorities, estimates & duplicates</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
            <Layers className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">Hierarchy Support</p>
          <p className="text-xs text-gray-500 mt-1">Detects parent/child task structures</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-gray-900">Smart Titles</p>
          <p className="text-xs text-gray-500 mt-1">Generates titles from numbered rows</p>
        </div>
      </div>
    </div>
  );

  const [headerRowInput, setHeaderRowInput] = useState<number>(1);
  const [isRedetecting, setIsRedetecting] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const handleRedetectHeaders = async () => {
    if (!importSession) return;
    setIsRedetecting(true);
    try {
      const response = await importApi.redetectHeaders(importSession.import_id, headerRowInput);
      setImportSession({
        ...importSession,
        structure: {
          ...importSession.structure,
          headers: response.headers,
          row_count: response.row_count,
          header_row_detected: headerRowInput,
        },
        preview_rows: response.preview_rows,
        smart_mapping: response.smart_mapping,
        mapping_confidence: response.mapping_confidence,
      });
      // Update column mapping
      if (response.smart_mapping) {
        setColumnMapping({
          title: response.smart_mapping.title || null,
          description: response.smart_mapping.description || null,
          priority: response.smart_mapping.priority || null,
          story_points: response.smart_mapping.story_points || null,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to redetect headers");
    } finally {
      setIsRedetecting(false);
    }
  };

  const handleAiAnalyze = async () => {
    if (!importSession) return;
    setIsAiAnalyzing(true);
    try {
      const response = await importApi.aiAnalyze(importSession.import_id);
      if (response.enhanced_mapping) {
        setColumnMapping({
          title: response.enhanced_mapping.title || null,
          description: response.enhanced_mapping.description || null,
          priority: response.enhanced_mapping.priority || null,
          story_points: response.enhanced_mapping.story_points || null,
        });
      }
    } catch (err: any) {
      // AI analysis is optional, don't show error
      console.warn("AI analysis failed:", err);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const renderPreviewStep = () => {
    if (!importSession) return null;

    return (
      <div className={`space-y-6 ${mounted ? "animate-fade-in" : "opacity-0"}`}>
        {/* File Info Card with AI Confidence */}
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 font-medium">{importSession.filename}</p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <Layers className="w-3.5 h-3.5" />
                  {importSession.structure.row_count} rows
                </span>
                <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <Table className="w-3.5 h-3.5" />
                  {importSession.structure.column_count} columns
                </span>
                {importSession.structure.header_row_detected && (
                  <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                    Header: Row {importSession.structure.header_row_detected}
                  </span>
                )}
                {importSession.mapping_confidence !== undefined && (
                  <span className={`flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-full ${
                    importSession.mapping_confidence >= 70
                      ? "bg-emerald-100 text-emerald-700"
                      : importSession.mapping_confidence >= 40
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    <Sparkles className="w-3 h-3" />
                    {importSession.mapping_confidence}% confident
                  </span>
                )}
                {importSession.insights?.is_hierarchical && (
                  <span className="flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    <Layers className="w-3 h-3" />
                    Hierarchical
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setImportSession(null);
                setStep("upload");
              }}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Smart Detection Insights */}
        {importSession.insights && (importSession.insights.is_hierarchical || importSession.insights.adjacent_content_detected) && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Wand2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-indigo-900">Smart Detection Insights</p>
                <ul className="mt-1 text-sm text-indigo-700 space-y-1">
                  {importSession.insights.is_hierarchical && (
                    <li>• Detected hierarchical task structure {importSession.insights.hierarchy_pattern && `(${importSession.insights.hierarchy_pattern} pattern)`}</li>
                  )}
                  {importSession.insights.adjacent_content_detected && (
                    <li>• Found ID + Description column pairs - titles will be generated from descriptions</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Header Row Override */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Header Row Detection</p>
              <p className="text-sm text-gray-500">
                Headers detected in row {importSession.structure.header_row_detected || importSession.insights?.header_row || 1}.
                Change if incorrect.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={headerRowInput}
                onChange={(e) => setHeaderRowInput(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
              />
              <button
                onClick={handleRedetectHeaders}
                disabled={isRedetecting}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {isRedetecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                Redetect
              </button>
              <button
                onClick={handleAiAnalyze}
                disabled={isAiAnalyzing}
                className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                {isAiAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI Analyze
              </button>
            </div>
          </div>
        </div>

        {/* Column Mapping - AI Auto-detected */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Settings2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Column Mapping</h3>
                <p className="text-sm text-gray-500">
                  {importSession.smart_mapping ? "AI auto-detected your columns" : "Map your spreadsheet columns to card fields"}
                </p>
              </div>
            </div>
            {importSession.smart_mapping && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-sm font-medium">
                <Wand2 className="w-4 h-4" />
                Auto-detected
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(columnMapping).map(([field, value]) => {
              const isAutoDetected = importSession.smart_mapping && importSession.smart_mapping[field] === value && value !== null;
              return (
                <div key={field} className={`rounded-xl p-4 ${isAutoDetected ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50 border border-gray-100"}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 capitalize flex items-center gap-2">
                    {field.replace("_", " ")}
                    {field === "title" && <span className="text-rose-500 text-xs">(Required)</span>}
                    {isAutoDetected && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">
                        <Sparkles className="w-3 h-3" />
                        AI
                      </span>
                    )}
                  </label>
                  <select
                    value={value || ""}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        [field]: e.target.value || null,
                      }))
                    }
                    className={`w-full bg-white border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all ${
                      isAutoDetected ? "border-indigo-300" : "border-gray-200"
                    }`}
                  >
                    <option value="">-- Select column --</option>
                    {importSession.structure.headers.map((header) => (
                      <option key={header} value={header}>
                        {header} ({importSession.structure.data_types[header]})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Enhancement Toggle */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-gray-900 font-medium">AI-Powered Enhancement</p>
                <p className="text-sm text-gray-500">
                  Automatically suggest priorities, story points, and task groupings
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-12 h-7 rounded-full transition-all ${useAI ? "bg-blue-600" : "bg-gray-300"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${useAI ? "left-6" : "left-1"}`} />
              </div>
            </div>
          </label>
        </div>

        {/* Preview Table */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Table className="w-4 h-4 text-gray-400" />
              Data Preview
            </h3>
            <span className="text-sm text-gray-500">First 10 rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {importSession.structure.headers.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importSession.preview_rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    {importSession.structure.headers.map((header) => (
                      <td key={header} className="px-4 py-3 text-sm text-gray-700">
                        {row[header] !== null && row[header] !== undefined
                          ? String(row[header]).substring(0, 100)
                          : <span className="text-gray-400">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => {
              setImportSession(null);
              setStep("upload");
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleProcess}
            disabled={!columnMapping.title || isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Process Import
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderConfirmStep = () => {
    if (!processedImport) return null;

    return (
      <div className={`space-y-6 ${mounted ? "animate-fade-in" : "opacity-0"}`}>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{processedImport.task_count}</p>
                <p className="text-sm text-gray-500">Tasks</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {processedImport.processing_insights?.tasks_with_priority || processedImport.tasks.filter((t) => t.priority).length}
                </p>
                <p className="text-sm text-gray-500">With priority</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {processedImport.processing_insights?.tasks_with_points || processedImport.tasks.filter((t) => t.story_points).length}
                </p>
                <p className="text-sm text-gray-500">With estimates</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {processedImport.processing_insights?.tasks_with_description || processedImport.tasks.filter((t) => t.description).length}
                </p>
                <p className="text-sm text-gray-500">With description</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Analysis Summary */}
        {processedImport.ai_analysis && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-blue-900">Data Quality Analysis</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-blue-700">{processedImport.ai_analysis.data_quality_score}/10</span>
                <span className="text-sm text-blue-600">quality score</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className={`p-3 rounded-lg ${processedImport.ai_analysis.completeness.has_good_titles ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <p className={`text-xs font-medium ${processedImport.ai_analysis.completeness.has_good_titles ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {processedImport.ai_analysis.completeness.has_good_titles ? '✓' : '○'} Good Titles
                </p>
              </div>
              <div className={`p-3 rounded-lg ${processedImport.ai_analysis.completeness.has_descriptions ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <p className={`text-xs font-medium ${processedImport.ai_analysis.completeness.has_descriptions ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {processedImport.ai_analysis.completeness.has_descriptions ? '✓' : '○'} Descriptions
                </p>
              </div>
              <div className={`p-3 rounded-lg ${processedImport.ai_analysis.completeness.has_estimates ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <p className={`text-xs font-medium ${processedImport.ai_analysis.completeness.has_estimates ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {processedImport.ai_analysis.completeness.has_estimates ? '✓' : '○'} Estimates
                </p>
              </div>
              <div className={`p-3 rounded-lg ${processedImport.ai_analysis.completeness.has_priorities ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                <p className={`text-xs font-medium ${processedImport.ai_analysis.completeness.has_priorities ? 'text-emerald-700' : 'text-gray-500'}`}>
                  {processedImport.ai_analysis.completeness.has_priorities ? '✓' : '○'} Priorities
                </p>
              </div>
            </div>
            {processedImport.ai_analysis.recommendations.length > 0 && (
              <div>
                <p className="text-xs text-blue-600 font-medium mb-2">Recommendations:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  {processedImport.ai_analysis.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions */}
        {processedImport.ai_suggestions && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-indigo-900">AI Task Enhancement</h3>
            </div>

            {/* Project Analysis */}
            {processedImport.ai_suggestions.project_analysis && (
              <div className="mb-4 p-3 bg-white/60 rounded-lg border border-indigo-100">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs text-gray-500">Project Type</span>
                    <p className="text-sm font-medium text-indigo-700 capitalize">
                      {processedImport.ai_suggestions.project_analysis.detected_type.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-indigo-200" />
                  <div>
                    <span className="text-xs text-gray-500">Methodology</span>
                    <p className="text-sm font-medium text-indigo-700 capitalize">
                      {processedImport.ai_suggestions.project_analysis.detected_methodology}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-indigo-200" />
                  <div>
                    <span className="text-xs text-gray-500">Data Quality</span>
                    <p className={`text-sm font-medium capitalize ${
                      processedImport.ai_suggestions.project_analysis.overall_quality === 'high' ? 'text-emerald-700' :
                      processedImport.ai_suggestions.project_analysis.overall_quality === 'medium' ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      {processedImport.ai_suggestions.project_analysis.overall_quality}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Potential Duplicates Warning */}
            {processedImport.ai_suggestions.potential_duplicates && processedImport.ai_suggestions.potential_duplicates.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Potential Duplicates Detected
                </p>
                <div className="space-y-2">
                  {processedImport.ai_suggestions.potential_duplicates.slice(0, 3).map((dup, i) => (
                    <div key={i} className="text-xs text-amber-700">
                      "{dup.tasks[0]}" ↔ "{dup.tasks[1]}" - {dup.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Task Groups */}
            {processedImport.ai_suggestions.related_task_groups && processedImport.ai_suggestions.related_task_groups.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">Related task groups detected:</p>
                <div className="flex flex-wrap gap-2">
                  {processedImport.ai_suggestions.related_task_groups.map((group, i) => (
                    <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 border border-indigo-200 rounded-full text-indigo-700 text-sm font-medium">
                      {group.group_name}
                      <span className="bg-indigo-200 px-2 py-0.5 rounded-full text-xs">{group.tasks.length}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced Tasks */}
            {processedImport.ai_suggestions.enhanced_tasks && processedImport.ai_suggestions.enhanced_tasks.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-3">Task enhancement suggestions:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {processedImport.ai_suggestions.enhanced_tasks.filter(t => t.suggested_title || t.suggested_priority || t.suggested_points).slice(0, 8).map((task, i) => (
                    <div key={i} className="bg-white/60 border border-indigo-100 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {task.suggested_title ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 line-through truncate">{task.original_title}</span>
                              <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-900 font-medium truncate">{task.suggested_title}</span>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-900 font-medium truncate">{task.original_title}</p>
                          )}
                          {task.notes && <p className="text-xs text-gray-500 mt-1">{task.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {task.suggested_priority && (
                            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-medium">{task.suggested_priority}</span>
                          )}
                          {task.suggested_points && (
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-medium">{task.suggested_points} pts</span>
                          )}
                          {task.is_likely_parent_task && (
                            <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-medium">Parent</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workflow Suggestions */}
            {processedImport.ai_suggestions.workflow_suggestions && processedImport.ai_suggestions.workflow_suggestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <p className="text-xs text-indigo-600 font-medium mb-2">Workflow Suggestions:</p>
                <ul className="text-sm text-indigo-800 space-y-1">
                  {processedImport.ai_suggestions.workflow_suggestions.slice(0, 3).map((sug, i) => (
                    <li key={i}>• {sug}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Task Preview List */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Tasks to Create
            </h3>
            <span className="text-sm text-gray-500">{processedImport.tasks.length} total</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {processedImport.tasks.slice(0, 50).map((task, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-semibold flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 truncate font-medium">{task.title}</p>
                  {task.description && (
                    <p className="text-gray-500 text-sm truncate mt-0.5">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.priority && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium">{task.priority}</span>
                  )}
                  {task.story_points && (
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium">{task.story_points} pts</span>
                  )}
                </div>
              </div>
            ))}
            {processedImport.tasks.length > 50 && (
              <div className="px-4 py-4 text-center text-gray-500 bg-gray-50">
                ...and {processedImport.tasks.length - 50} more tasks
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4">
          <button onClick={() => setStep("preview")} className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex gap-3">
            <button onClick={handleCancel} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:border-gray-300 hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating cards...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Create {processedImport.task_count} Cards
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <header className={`mb-8 ${mounted ? "animate-fade-in" : "opacity-0"}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Import Tasks
              </h1>
              <p className="text-gray-500 mt-0.5">Import tasks from Excel or CSV files</p>
            </div>
          </div>
        </header>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Error Display */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <p className="text-rose-700 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-rose-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-rose-500" />
            </button>
          </div>
        )}

        {/* Step Content */}
        {step === "upload" && renderUploadStep()}
        {(step === "preview" || step === "mapping" || step === "process") && renderPreviewStep()}
        {step === "confirm" && renderConfirmStep()}
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
