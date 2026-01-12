"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/board";
import type { Column } from "@/types";

interface KanbanColumnProps {
  column: Column;
  children: React.ReactNode;
}

export function KanbanColumn({ column, children }: KanbanColumnProps) {
  const { createCard } = useBoardStore();
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return;

    try {
      await createCard(column.id, newCardTitle.trim());
      setNewCardTitle("");
      setIsAddingCard(false);
    } catch (error) {
      console.error("Failed to create card:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddCard();
    } else if (e.key === "Escape") {
      setIsAddingCard(false);
      setNewCardTitle("");
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-80 flex-shrink-0 flex-col rounded-lg bg-gray-200/50",
        isOver && "bg-blue-100/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-700">{column.name}</h3>
          <span className="rounded-full bg-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600">
            {column.card_count}
          </span>
        </div>
        {column.wip_limit && (
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              column.is_over_wip_limit
                ? "bg-red-100 text-red-700"
                : "bg-gray-200 text-gray-600"
            )}
          >
            WIP: {column.card_count}/{column.wip_limit}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex flex-col gap-2">{children}</div>

        {/* Add card form */}
        {isAddingCard ? (
          <div className="mt-2">
            <input
              type="text"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!newCardTitle.trim()) {
                  setIsAddingCard(false);
                }
              }}
              placeholder="Enter card title..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleAddCard}
                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAddingCard(false);
                  setNewCardTitle("");
                }}
                className="rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="mt-2 flex w-full items-center gap-1 rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-200"
          >
            <Plus className="h-4 w-4" />
            Add a card
          </button>
        )}
      </div>
    </div>
  );
}
