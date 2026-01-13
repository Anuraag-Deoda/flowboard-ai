"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Search,
  Filter,
  Users,
  Calendar,
  MoreHorizontal,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
import { useBoardStore } from "@/store/board";
import { KanbanColumn } from "@/components/board/KanbanColumn";
import { KanbanCard } from "@/components/board/KanbanCard";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { cn } from "@/lib/utils";
import type { Card, Column } from "@/types";

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;

  const { board, columns, isLoading, error, fetchBoard, moveCard, optimisticMoveCard, reorderColumns, deleteCard } =
    useBoardStore();

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchBoard(boardId);
  }, [boardId, fetchBoard]);

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setIsModalOpen(true);
  };

  const handleCardUpdate = (updatedCard: Card) => {
    setSelectedCard(updatedCard);
    // Refresh board to show updated card
    fetchBoard(boardId);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCard(null);
    // Refresh board to reflect any changes made in the modal (labels, assignees, etc.)
    fetchBoard(boardId);
  };

  const handleCardDelete = async (cardId: string) => {
    await deleteCard(cardId);
    setIsModalOpen(false);
    setSelectedCard(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    // Check if dragging a column
    if (activeId.startsWith("column-")) {
      const columnId = activeId.replace("column-", "");
      const column = columns.find((c) => c.id === columnId);
      if (column) {
        setActiveColumn(column);
        return;
      }
    }

    // Find the card
    for (const column of columns) {
      const card = column.cards?.find((c) => c.id === activeId);
      if (card) {
        setActiveCard(card);
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Skip if dragging a column (columns don't need dragOver handling)
    if (activeId.startsWith("column-")) {
      return;
    }

    // Find source and target columns
    let sourceColumnId: string | null = null;
    let targetColumnId: string | null = null;

    for (const column of columns) {
      if (column.cards?.some((c) => c.id === activeId)) {
        sourceColumnId = column.id;
      }
      if (column.id === overId || column.cards?.some((c) => c.id === overId)) {
        targetColumnId = column.id;
      }
    }

    if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId) {
      return;
    }

    // Calculate position
    const targetColumn = columns.find((c) => c.id === targetColumnId);
    const overCard = targetColumn?.cards?.find((c) => c.id === overId);
    const position = overCard ? overCard.position : (targetColumn?.cards?.length || 0);

    // Optimistic update
    optimisticMoveCard(activeId, sourceColumnId, targetColumnId, position);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Handle column reordering
    if (activeId.startsWith("column-") && overId.startsWith("column-")) {
      const activeColumnId = activeId.replace("column-", "");
      const overColumnId = overId.replace("column-", "");

      if (activeColumnId !== overColumnId) {
        const oldIndex = columns.findIndex((c) => c.id === activeColumnId);
        const newIndex = columns.findIndex((c) => c.id === overColumnId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(columns, oldIndex, newIndex);
          try {
            await reorderColumns(newOrder.map((c) => c.id));
          } catch (error) {
            console.error("Failed to reorder columns:", error);
          }
        }
      }
      return;
    }

    // Handle card movement
    const cardId = activeId;

    // Find target column
    let targetColumnId: string | null = null;
    let position = 0;

    for (const column of columns) {
      if (column.id === overId) {
        targetColumnId = column.id;
        position = column.cards?.length || 0;
        break;
      }
      const overCard = column.cards?.find((c) => c.id === overId);
      if (overCard) {
        targetColumnId = column.id;
        position = overCard.position;
        break;
      }
    }

    if (!targetColumnId) return;

    try {
      await moveCard(cardId, targetColumnId, position);
    } catch (error) {
      console.error("Failed to move card:", error);
    }
  };

  // Calculate board stats
  const totalCards = columns.reduce((sum, col) => sum + (col.cards?.length || 0), 0);
  const completedCards = columns
    .filter((col) => col.name.toLowerCase().includes("done"))
    .reduce((sum, col) => sum + (col.cards?.length || 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
          </div>
          <div className="text-sm font-medium text-gray-500">Loading your board...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <div className="mb-4 text-4xl">😕</div>
          <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate sm:text-xl">{board?.name}</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500 sm:gap-3">
                <span>{totalCards} cards</span>
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                <span className="text-emerald-600">{completedCards} done</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search - hidden on mobile */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search cards..."
                className="w-48 lg:w-64 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* Search icon for mobile */}
            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors md:hidden">
              <Search className="h-5 w-5" />
            </button>

            {/* Filter button */}
            <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors sm:px-3">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>

            {/* View toggle - hidden on small mobile */}
            <div className="hidden sm:flex items-center rounded-lg border border-gray-200 bg-white p-1">
              <button className="rounded-md bg-gray-100 p-1.5 text-gray-700">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button className="rounded-md p-1.5 text-gray-400 hover:text-gray-600">
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* More options */}
            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex h-[calc(100vh-65px)] gap-3 overflow-x-auto p-4 pb-6 sm:gap-5 sm:p-6 sm:pb-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => `column-${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => (
              <KanbanColumn key={column.id} column={column}>
                <SortableContext
                  items={column.cards?.map((c) => c.id) || []}
                  strategy={verticalListSortingStrategy}
                >
                  {column.cards?.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      onClick={() => handleCardClick(card)}
                    />
                  ))}
                </SortableContext>
              </KanbanColumn>
            ))}
          </SortableContext>

          <DragOverlay dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}>
            {activeCard ? (
              <div className="rotate-3 scale-105">
                <KanbanCard card={activeCard} isDragging />
              </div>
            ) : activeColumn ? (
              <div className="opacity-90">
                <KanbanColumn column={activeColumn} isDragging>
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <LayoutGrid className="h-8 w-8 mb-2" />
                    <span className="text-sm font-medium">{activeColumn.card_count} cards</span>
                  </div>
                </KanbanColumn>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Add column button */}
        <div className="flex-shrink-0">
          <button className="flex h-full min-h-[200px] w-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white/40 text-gray-400 hover:border-gray-400 hover:bg-white/60 hover:text-gray-500 transition-all sm:w-72">
            <span className="text-sm font-medium">+ Add Column</span>
          </button>
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          boardId={boardId}
          organizationId={board?.organization_id}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onUpdate={handleCardUpdate}
          onDelete={handleCardDelete}
        />
      )}
    </div>
  );
}
