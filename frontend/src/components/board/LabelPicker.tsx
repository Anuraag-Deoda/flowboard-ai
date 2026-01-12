"use client";

import { useState, useEffect } from "react";
import { Plus, X, Check } from "lucide-react";
import { labelsApi } from "@/lib/api";
import type { Label, CardLabel } from "@/types";

interface LabelPickerProps {
  boardId: string;
  cardId: string;
  selectedLabels: CardLabel[];
  onLabelToggle: (label: Label, isAdding: boolean) => void;
}

const PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
];

export function LabelPicker({ boardId, cardId, selectedLabels, onLabelToggle }: LabelPickerProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const data = await labelsApi.list(boardId);
        setLabels(data.labels || []);
      } catch (error) {
        console.error("Failed to fetch labels:", error);
      }
    };

    if (isOpen) {
      fetchLabels();
    }
  }, [boardId, isOpen]);

  const isLabelSelected = (labelId: string) => {
    return selectedLabels.some((cl) => cl.label_id === labelId);
  };

  const handleToggleLabel = async (label: Label) => {
    const isSelected = isLabelSelected(label.id);
    setIsLoading(true);
    try {
      if (isSelected) {
        await labelsApi.removeFromCard(cardId, label.id);
      } else {
        await labelsApi.addToCard(cardId, label.id);
      }
      onLabelToggle(label, !isSelected);
    } catch (error) {
      console.error("Failed to toggle label:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;

    setIsLoading(true);
    try {
      const data = await labelsApi.create(boardId, newLabelName.trim(), newLabelColor);
      setLabels([...labels, data.label]);
      setNewLabelName("");
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create label:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
      >
        <Plus className="h-4 w-4" />
        Add Label
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsOpen(false);
              setIsCreating(false);
            }}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Labels</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsCreating(false);
                }}
                className="rounded p-0.5 hover:bg-gray-100"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {!isCreating ? (
              <>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label)}
                      disabled={isLoading}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <div
                        className="h-4 w-4 rounded"
                        style={{ backgroundColor: label.color || "#6B7280" }}
                      />
                      <span className="flex-1 text-left text-sm text-gray-700">
                        {label.name}
                      </span>
                      {isLabelSelected(label.id) && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                  {labels.length === 0 && (
                    <p className="py-2 text-center text-sm text-gray-500">
                      No labels yet
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-1.5 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" />
                  Create Label
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />

                <div>
                  <span className="mb-1 block text-xs text-gray-500">Color</span>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewLabelColor(color)}
                        className={`h-6 w-6 rounded ${
                          newLabelColor === color
                            ? "ring-2 ring-blue-500 ring-offset-1"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="flex-1 rounded border border-gray-300 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLabel}
                    disabled={!newLabelName.trim() || isLoading}
                    className="flex-1 rounded bg-blue-600 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
