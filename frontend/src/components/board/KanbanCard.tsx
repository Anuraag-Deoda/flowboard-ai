"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, MessageSquare, CheckSquare, Paperclip, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Card, Priority } from "@/types";

interface KanbanCardProps {
  card: Card;
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityConfig: Record<Priority, { bg: string; text: string; border: string; label: string }> = {
  P0: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "Critical" },
  P1: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", label: "High" },
  P2: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Medium" },
  P3: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Low" },
  P4: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", label: "Minimal" },
};

const avatarColors = [
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-blue-500 to-cyan-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-orange-500 to-amber-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
];

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

  // Check if due date is overdue or due soon
  const getDueDateStatus = () => {
    if (!card.due_date) return null;
    const due = new Date(card.due_date);
    const now = new Date();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "overdue";
    if (diffDays <= 2) return "soon";
    return "normal";
  };

  const dueDateStatus = getDueDateStatus();

  // Calculate subtask progress
  const subtaskProgress = card.subtasks?.length
    ? {
        completed: card.subtasks.filter((s) => s.is_completed).length,
        total: card.subtasks.length,
      }
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group cursor-grab rounded-xl border bg-white p-3.5 shadow-sm transition-all duration-200",
        "hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5",
        isCurrentlyDragging && "cursor-grabbing opacity-60 shadow-xl rotate-2 scale-105"
      )}
    >
      {/* Labels row */}
      {card.labels && card.labels.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {card.labels.slice(0, 4).map((labelAssoc) => (
            <span
              key={labelAssoc.label_id}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: labelAssoc.label?.color || "#6B7280" }}
            >
              {labelAssoc.label?.name}
            </span>
          ))}
          {card.labels.length > 4 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              +{card.labels.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-700">
        {card.title}
      </h4>

      {/* Description preview */}
      {card.description && (
        <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{card.description}</p>
      )}

      {/* Meta badges row */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {/* Priority badge */}
        {card.priority && (
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
              priorityConfig[card.priority].bg,
              priorityConfig[card.priority].text,
              priorityConfig[card.priority].border
            )}
          >
            {card.priority}
          </span>
        )}

        {/* Story points */}
        {card.story_points && (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
            <Clock className="h-2.5 w-2.5" />
            {card.story_points}
          </span>
        )}

        {/* Subtask progress */}
        {subtaskProgress && (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 border border-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            <CheckSquare className="h-2.5 w-2.5" />
            {subtaskProgress.completed}/{subtaskProgress.total}
          </span>
        )}
      </div>

      {/* Bottom row with due date, icons, and assignees */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Due date */}
          {card.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                dueDateStatus === "overdue" && "bg-red-100 text-red-700",
                dueDateStatus === "soon" && "bg-amber-100 text-amber-700",
                dueDateStatus === "normal" && "bg-gray-100 text-gray-600"
              )}
            >
              <Calendar className="h-2.5 w-2.5" />
              {new Date(card.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}

          {/* Icons for comments and attachments */}
          <div className="flex items-center gap-1.5 text-gray-400">
            {card.comments && card.comments.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <MessageSquare className="h-3 w-3" />
                {card.comments.length}
              </span>
            )}
            {card.attachments && card.attachments.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <Paperclip className="h-3 w-3" />
                {card.attachments.length}
              </span>
            )}
          </div>
        </div>

        {/* Assignees */}
        {card.assignees && card.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {card.assignees.slice(0, 3).map((assignee, idx) => (
              <div
                key={assignee.user_id}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white",
                  avatarColors[idx % avatarColors.length]
                )}
                title={assignee.user?.full_name || assignee.user?.email}
              >
                {(assignee.user?.full_name || assignee.user?.email || "?")[0].toUpperCase()}
              </div>
            ))}
            {card.assignees.length > 3 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600 ring-2 ring-white">
                +{card.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
