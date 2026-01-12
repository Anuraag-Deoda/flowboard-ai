"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
} from "@dnd-kit/sortable";
import { useBoardStore } from "@/store/board";
import { KanbanColumn } from "@/components/board/KanbanColumn";
import { KanbanCard } from "@/components/board/KanbanCard";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import type { Card } from "@/types";

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;

  const { board, columns, isLoading, error, fetchBoard, moveCard, optimisticMoveCard, updateCard } =
    useBoardStore();

  const [activeCard, setActiveCard] = useState<Card | null>(null);
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
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const cardId = active.id as string;

    // Find the card
    for (const column of columns) {
      const card = column.cards?.find((c) => c.id === cardId);
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

    if (!over) return;

    const cardId = active.id as string;
    const overId = over.id as string;

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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-100">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{board?.name}</h1>
      </header>

      {/* Board */}
      <div className="flex h-[calc(100vh-73px)] gap-4 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
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

          <DragOverlay>
            {activeCard ? (
              <KanbanCard card={activeCard} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onUpdate={handleCardUpdate}
        />
      )}
    </div>
  );
}
