"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, MoreHorizontal, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/board";
import type { Column, Priority } from "@/types";

interface KanbanColumnProps {
  column: Column;
  children: React.ReactNode;
  isDragging?: boolean;
}

export function KanbanColumn({ column, children, isDragging: isDraggingProp }: KanbanColumnProps) {
  const { createCard } = useBoardStore();
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardPriority, setNewCardPriority] = useState<Priority | "">("");
  const [newCardPoints, setNewCardPoints] = useState<number | "">("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sortable for column reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: "column", column },
  });

  // Droppable for cards
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDraggingProp || isSortableDragging;
  const isEmpty = !column.cards || column.cards.length === 0;

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return;

    try {
      await createCard(column.id, newCardTitle.trim(), {
        priority: newCardPriority || undefined,
        story_points: newCardPoints || undefined,
        description: newCardDescription || undefined,
      });
      resetForm();
    } catch (error) {
      console.error("Failed to create card:", error);
    }
  };

  const resetForm = () => {
    setNewCardTitle("");
    setNewCardPriority("");
    setNewCardPoints("");
    setNewCardDescription("");
    setShowAdvanced(false);
    setIsAddingCard(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddCard();
    } else if (e.key === "Escape") {
      resetForm();
    }
  };

  // Get column color based on name
  const getColumnAccentColor = () => {
    const name = column.name.toLowerCase();
    if (name.includes("backlog")) return "from-slate-500";
    if (name.includes("todo") || name.includes("to do")) return "from-blue-500";
    if (name.includes("progress") || name.includes("doing")) return "from-amber-500";
    if (name.includes("review")) return "from-purple-500";
    if (name.includes("done") || name.includes("complete")) return "from-emerald-500";
    return "from-gray-500";
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full w-72 flex-shrink-0 flex-col rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-sm transition-all duration-200 sm:w-80",
        isOver && "ring-2 ring-blue-400 ring-offset-2 bg-blue-50/50",
        isCurrentlyDragging && "opacity-50 scale-[0.98]"
      )}
    >
      {/* Header with gradient accent */}
      <div className={cn("h-1 rounded-t-xl bg-gradient-to-r", getColumnAccentColor(), "to-transparent")} />

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab rounded-lg p-1.5 hover:bg-gray-100 active:cursor-grabbing transition-colors"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
          <h3 className="font-semibold text-gray-800">{column.name}</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {column.card_count}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {column.wip_limit && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                column.is_over_wip_limit
                  ? "bg-red-100 text-red-700 animate-pulse"
                  : column.card_count >= column.wip_limit * 0.8
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {column.card_count}/{column.wip_limit}
            </span>
          )}
          <button className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <MoreHorizontal className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Cards area with drop zone */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* Empty state drop zone - critical for drag-drop to work */}
        {isEmpty && !isAddingCard && (
          <div
            className={cn(
              "flex min-h-[120px] flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200",
              isOver
                ? "border-blue-400 bg-blue-50/50"
                : "border-gray-200 bg-gray-50/50"
            )}
          >
            <div className="text-center">
              <div className="text-gray-400 mb-1">
                <Plus className="h-6 w-6 mx-auto" />
              </div>
              <p className="text-sm text-gray-500">Drop cards here</p>
              <p className="text-xs text-gray-400 mt-1">or click below to create</p>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className={cn("flex flex-col gap-2", isEmpty && "mt-2")}>
          {children}
        </div>

        {/* Add card form */}
        {isAddingCard ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <input
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm font-medium placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />

            {/* Quick options row */}
            <div className="mt-2 flex items-center gap-2">
              <select
                value={newCardPriority}
                onChange={(e) => setNewCardPriority(e.target.value as Priority | "")}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Priority</option>
                <option value="P0">P0 - Critical</option>
                <option value="P1">P1 - High</option>
                <option value="P2">P2 - Medium</option>
                <option value="P3">P3 - Low</option>
                <option value="P4">P4 - Minimal</option>
              </select>
              <input
                type="number"
                value={newCardPoints}
                onChange={(e) => setNewCardPoints(e.target.value ? parseInt(e.target.value) : "")}
                placeholder="Points"
                min="0"
                className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  showAdvanced ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-400"
                )}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            {/* Advanced options */}
            {showAdvanced && (
              <div className="mt-2">
                <textarea
                  value={newCardDescription}
                  onChange={(e) => setNewCardDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={resetForm}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCard}
                disabled={!newCardTitle.trim()}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Card
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add card
          </button>
        )}
      </div>
    </div>
  );
}
