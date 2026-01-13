"use client";

import { useState, useEffect } from "react";
import {
  X,
  Layout,
  Zap,
  Code,
  Bug,
  Megaphone,
  Palette,
  User,
  Headphones,
  Check,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { templatesApi } from "@/lib/api";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  column_count: number;
  columns_preview: string[];
}

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string, customName?: string) => Promise<void>;
  projectId: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  layout: <Layout className="w-6 h-6" />,
  zap: <Zap className="w-6 h-6" />,
  code: <Code className="w-6 h-6" />,
  bug: <Bug className="w-6 h-6" />,
  megaphone: <Megaphone className="w-6 h-6" />,
  palette: <Palette className="w-6 h-6" />,
  user: <User className="w-6 h-6" />,
  headphones: <Headphones className="w-6 h-6" />,
};

const COLOR_MAP: Record<string, string> = {
  layout: "bg-blue-100 text-blue-600",
  zap: "bg-amber-100 text-amber-600",
  code: "bg-emerald-100 text-emerald-600",
  bug: "bg-red-100 text-red-600",
  megaphone: "bg-purple-100 text-purple-600",
  palette: "bg-pink-100 text-pink-600",
  user: "bg-indigo-100 text-indigo-600",
  headphones: "bg-cyan-100 text-cyan-600",
};

export function TemplatePickerModal({
  isOpen,
  onClose,
  onSelect,
  projectId,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customName, setCustomName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<"select" | "customize">("select");

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setStep("select");
      setSelectedTemplate(null);
      setCustomName("");
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await templatesApi.list();
      setTemplates(data.templates);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setCustomName(template.name);
    setStep("customize");
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    try {
      await onSelect(selectedTemplate.id, customName || undefined);
      onClose();
    } catch (error) {
      console.error("Failed to create board:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    setStep("select");
    setSelectedTemplate(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            {step === "customize" && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {step === "select" ? "Choose a Template" : "Customize Your Board"}
              </h2>
              <p className="text-sm text-gray-500">
                {step === "select"
                  ? "Start with a pre-configured workflow"
                  : `Creating from "${selectedTemplate?.name}"`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "select" ? (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="group relative flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all"
                    >
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${COLOR_MAP[template.icon] || "bg-gray-100 text-gray-600"}`}>
                        {ICON_MAP[template.icon] || <Layout className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.columns_preview.slice(0, 4).map((col, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                            >
                              {col}
                            </span>
                          ))}
                          {template.columns_preview.length > 4 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              +{template.columns_preview.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Customize step */
            <div className="space-y-6">
              {/* Template preview */}
              <div className={`p-4 rounded-xl ${COLOR_MAP[selectedTemplate?.icon || "layout"]?.replace("text-", "bg-").split(" ")[0]}/10`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${COLOR_MAP[selectedTemplate?.icon || "layout"]}`}>
                    {ICON_MAP[selectedTemplate?.icon || "layout"]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedTemplate?.name}</h3>
                    <p className="text-sm text-gray-500">{selectedTemplate?.description}</p>
                  </div>
                </div>

                {/* Columns preview */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedTemplate?.columns_preview.map((col, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-32 bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
                    >
                      <div className="text-sm font-medium text-gray-700">{col}</div>
                      <div className="text-xs text-gray-400 mt-1">0 cards</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom name input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Board Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter board name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "customize" && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !customName.trim()}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Board
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
