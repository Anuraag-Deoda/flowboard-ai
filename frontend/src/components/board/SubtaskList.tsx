"use client";

import { useState } from "react";
import { CheckSquare, Square, Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { subtasksApi } from "@/lib/api";
import type { Subtask } from "@/types";

interface SubtaskListProps {
  cardId: string;
  subtasks: Subtask[];
  onSubtasksChange: (subtasks: Subtask[]) => void;
}

export function SubtaskList({ cardId, subtasks, onSubtasksChange }: SubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    setIsAdding(true);
    try {
      const data = await subtasksApi.create(cardId, newSubtaskTitle.trim());
      onSubtasksChange([...subtasks, data.subtask]);
      setNewSubtaskTitle("");
    } catch (error) {
      console.error("Failed to create subtask:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleComplete = async (subtask: Subtask) => {
    setUpdatingId(subtask.id);
    try {
      const data = await subtasksApi.update(cardId, subtask.id, {
        is_completed: !subtask.is_completed,
      });
      onSubtasksChange(
        subtasks.map((s) => (s.id === subtask.id ? data.subtask : s))
      );
    } catch (error) {
      console.error("Failed to toggle subtask:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateTitle = async (subtask: Subtask) => {
    if (!editingTitle.trim() || editingTitle === subtask.title) {
      setEditingId(null);
      return;
    }

    setUpdatingId(subtask.id);
    try {
      const data = await subtasksApi.update(cardId, subtask.id, {
        title: editingTitle.trim(),
      });
      onSubtasksChange(
        subtasks.map((s) => (s.id === subtask.id ? data.subtask : s))
      );
    } catch (error) {
      console.error("Failed to update subtask:", error);
    } finally {
      setUpdatingId(null);
      setEditingId(null);
    }
  };

  const handleDelete = async (subtaskId: string) => {
    setUpdatingId(subtaskId);
    try {
      await subtasksApi.delete(cardId, subtaskId);
      onSubtasksChange(subtasks.filter((s) => s.id !== subtaskId));
    } catch (error) {
      console.error("Failed to delete subtask:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const startEditing = (subtask: Subtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <CheckSquare className="h-4 w-4" />
          Subtasks
          {subtasks.length > 0 && (
            <span className="text-gray-500">
              ({completedCount}/{subtasks.length})
            </span>
          )}
        </h3>
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className={cn(
              "group flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50",
              updatingId === subtask.id && "opacity-50"
            )}
          >
            <button
              onClick={() => handleToggleComplete(subtask)}
              disabled={updatingId === subtask.id}
              className="flex-shrink-0 text-gray-400 hover:text-blue-500"
            >
              {subtask.is_completed ? (
                <CheckSquare className="h-4 w-4 text-green-500" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>

            {editingId === subtask.id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => handleUpdateTitle(subtask)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateTitle(subtask);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 rounded border border-blue-300 px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <span
                onClick={() => startEditing(subtask)}
                className={cn(
                  "flex-1 cursor-pointer text-sm",
                  subtask.is_completed && "text-gray-400 line-through"
                )}
              >
                {subtask.title}
              </span>
            )}

            <button
              onClick={() => handleDelete(subtask.id)}
              disabled={updatingId === subtask.id}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add subtask form */}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSubtaskTitle.trim()) {
              handleAddSubtask();
            }
          }}
          placeholder="Add a subtask..."
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isAdding}
        />
        <button
          onClick={handleAddSubtask}
          disabled={!newSubtaskTitle.trim() || isAdding}
          className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
