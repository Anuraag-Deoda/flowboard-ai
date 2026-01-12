"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Tag, Users, MessageSquare, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardsApi } from "@/lib/api";
import { LabelPicker } from "./LabelPicker";
import type { Card, Priority, Comment, Label, CardLabel } from "@/types";

interface CardDetailModalProps {
  card: Card;
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (card: Card) => void;
  onDelete?: (cardId: string) => void;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: "P0", label: "Critical", color: "bg-red-500" },
  { value: "P1", label: "High", color: "bg-orange-500" },
  { value: "P2", label: "Medium", color: "bg-yellow-500" },
  { value: "P3", label: "Low", color: "bg-blue-500" },
  { value: "P4", label: "Minimal", color: "bg-gray-400" },
];

export function CardDetailModal({ card, boardId, isOpen, onClose, onUpdate, onDelete }: CardDetailModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [priority, setPriority] = useState<Priority | null>(card.priority);
  const [storyPoints, setStoryPoints] = useState<number | "">(card.story_points || "");
  const [dueDate, setDueDate] = useState(card.due_date || "");
  const [newComment, setNewComment] = useState("");
  const [comments, setComments] = useState<Comment[]>(card.comments || []);
  const [cardLabels, setCardLabels] = useState<CardLabel[]>(card.labels || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || "");
    setPriority(card.priority);
    setStoryPoints(card.story_points || "");
    setDueDate(card.due_date || "");
    setComments(card.comments || []);
    setCardLabels(card.labels || []);
    setShowDeleteConfirm(false);
  }, [card]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = await cardsApi.update(card.id, {
        title,
        description,
        priority: priority || undefined,
        story_points: storyPoints ? Number(storyPoints) : undefined,
        due_date: dueDate || undefined,
      });
      onUpdate(data.card);
    } catch (error) {
      console.error("Failed to update card:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsAddingComment(true);
    try {
      const data = await cardsApi.addComment(card.id, newComment);
      setComments([...comments, data.comment]);
      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await cardsApi.delete(card.id);
      onDelete(card.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete card:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLabelToggle = (label: Label, isAdding: boolean) => {
    if (isAdding) {
      setCardLabels([...cardLabels, { label_id: label.id, label }]);
    } else {
      setCardLabels(cardLabels.filter((cl) => cl.label_id !== label.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-xl font-semibold text-gray-900 focus:outline-none"
            placeholder="Card title"
          />
          <div className="ml-4 flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                title="Delete card"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Main content */}
            <div className="md:col-span-2 space-y-6">
              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Add a description... (Markdown supported)"
                />
              </div>

              {/* Comments */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({comments.length})
                </h3>

                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-gray-50 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                          {(comment.user?.full_name || comment.user?.email || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {comment.user?.full_name || comment.user?.email}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{comment.content}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Write a comment..."
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isAddingComment}
                    className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isAddingComment ? "Adding..." : "Add Comment"}
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Priority */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Tag className="h-4 w-4" />
                  Priority
                </label>
                <select
                  value={priority || ""}
                  onChange={(e) => setPriority(e.target.value as Priority || null)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">No priority</option>
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value} - {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Story Points */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Clock className="h-4 w-4" />
                  Story Points
                </label>
                <input
                  type="number"
                  value={storyPoints}
                  onChange={(e) => setStoryPoints(e.target.value ? parseInt(e.target.value) : "")}
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Assignees */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Users className="h-4 w-4" />
                  Assignees
                </label>
                <div className="flex flex-wrap gap-2">
                  {card.assignees?.map((assignee) => (
                    <div
                      key={assignee.user_id}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                        {(assignee.user?.full_name || assignee.user?.email || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-700">
                        {assignee.user?.full_name || assignee.user?.email}
                      </span>
                    </div>
                  ))}
                  {(!card.assignees || card.assignees.length === 0) && (
                    <span className="text-sm text-gray-500">No assignees</span>
                  )}
                </div>
              </div>

              {/* Labels */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Tag className="h-4 w-4" />
                  Labels
                </label>
                <div className="flex flex-wrap gap-1">
                  {cardLabels.map((labelAssoc) => (
                    <span
                      key={labelAssoc.label_id}
                      className="rounded px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: labelAssoc.label?.color || "#6B7280" }}
                    >
                      {labelAssoc.label?.name}
                    </span>
                  ))}
                </div>
                <div className="mt-2">
                  <LabelPicker
                    boardId={boardId}
                    cardId={card.id}
                    selectedLabels={cardLabels}
                    onLabelToggle={handleLabelToggle}
                  />
                </div>
              </div>

              {/* Meta info */}
              <div className="border-t pt-4 text-xs text-gray-500">
                <p>Created: {new Date(card.created_at).toLocaleString()}</p>
                <p>Updated: {new Date(card.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-black/50">
            <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900">Delete Card</h3>
              <p className="mt-2 text-sm text-gray-600">
                Are you sure you want to delete "{card.title}"? This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
