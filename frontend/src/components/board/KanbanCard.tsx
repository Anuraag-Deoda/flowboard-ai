"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Card, Priority } from "@/types";

interface KanbanCardProps {
  card: Card;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityColors: Record<Priority, string> = {
  P0: "bg-red-500",
  P1: "bg-orange-500",
  P2: "bg-yellow-500",
  P3: "bg-blue-500",
  P4: "bg-gray-400",
};

const priorityLabels: Record<Priority, string> = {
  P0: "Critical",
  P1: "High",
  P2: "Medium",
  P3: "Low",
  P4: "Minimal",
};

export function KanbanCard({ card, isDragging, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        isCurrentlyDragging && "cursor-grabbing opacity-50 shadow-lg"
      )}
    >
      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((labelAssoc) => (
            <span
              key={labelAssoc.label_id}
              className="rounded px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: labelAssoc.label?.color || "#6B7280" }}
            >
              {labelAssoc.label?.name}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900">{card.title}</h4>

      {/* Meta info */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Priority */}
          {card.priority && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium text-white",
                priorityColors[card.priority]
              )}
              title={priorityLabels[card.priority]}
            >
              {card.priority}
            </span>
          )}

          {/* Story points */}
          {card.story_points && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
              {card.story_points} SP
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Due date */}
          {card.due_date && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              {new Date(card.due_date).toLocaleDateString()}
            </span>
          )}

          {/* Comments count - placeholder */}
          {card.comments && card.comments.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MessageSquare className="h-3 w-3" />
              {card.comments.length}
            </span>
          )}
        </div>
      </div>

      {/* Assignees */}
      {card.assignees && card.assignees.length > 0 && (
        <div className="mt-2 flex -space-x-2">
          {card.assignees.slice(0, 3).map((assignee) => (
            <div
              key={assignee.user_id}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-xs font-medium text-white"
              title={assignee.user?.full_name || assignee.user?.email}
            >
              {(assignee.user?.full_name || assignee.user?.email || "?")[0].toUpperCase()}
            </div>
          ))}
          {card.assignees.length > 3 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-xs font-medium text-gray-600">
              +{card.assignees.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
