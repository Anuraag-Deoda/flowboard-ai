import { create } from "zustand";
import { boardsApi, cardsApi, columnsApi } from "@/lib/api";
import type { Board, Column, Card } from "@/types";

interface BoardState {
  board: Board | null;
  columns: Column[];
  isLoading: boolean;
  error: string | null;

  fetchBoard: (boardId: string) => Promise<void>;
  moveCard: (cardId: string, targetColumnId: string, targetPosition: number) => Promise<void>;
  createCard: (columnId: string, title: string, options?: { priority?: string; story_points?: number; description?: string }) => Promise<Card>;
  updateCard: (cardId: string, data: Partial<{ title: string; description: string; priority: string | null; story_points: number; due_date: string }>) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  createColumn: (name: string) => Promise<void>;
  updateColumn: (columnId: string, data: Partial<Column>) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  reorderColumns: (columnIds: string[]) => Promise<void>;

  // Optimistic updates
  optimisticMoveCard: (cardId: string, sourceColumnId: string, targetColumnId: string, targetPosition: number) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  columns: [],
  isLoading: false,
  error: null,

  fetchBoard: async (boardId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await boardsApi.get(boardId);
      set({
        board: data.board,
        columns: data.board.columns || [],
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || "Failed to fetch board",
        isLoading: false,
      });
    }
  },

  optimisticMoveCard: (cardId, sourceColumnId, targetColumnId, targetPosition) => {
    set((state) => {
      const newColumns = state.columns.map((col) => {
        // Remove card from source column
        if (col.id === sourceColumnId) {
          return {
            ...col,
            cards: col.cards?.filter((c) => c.id !== cardId) || [],
          };
        }
        // Add card to target column
        if (col.id === targetColumnId) {
          const sourceColumn = state.columns.find((c) => c.id === sourceColumnId);
          const card = sourceColumn?.cards?.find((c) => c.id === cardId);
          if (!card) return col;

          const newCards = [...(col.cards || [])];
          const updatedCard = { ...card, column_id: targetColumnId, position: targetPosition };
          newCards.splice(targetPosition, 0, updatedCard);

          // Update positions
          return {
            ...col,
            cards: newCards.map((c, i) => ({ ...c, position: i })),
          };
        }
        return col;
      });

      return { columns: newColumns };
    });
  },

  moveCard: async (cardId, targetColumnId, targetPosition) => {
    try {
      await cardsApi.move(cardId, targetColumnId, targetPosition);
      // Refresh board to get updated state
      const { board } = get();
      if (board) {
        await get().fetchBoard(board.id);
      }
    } catch (error: any) {
      // Revert on error - refetch board
      const { board } = get();
      if (board) {
        await get().fetchBoard(board.id);
      }
      throw error;
    }
  },

  createCard: async (columnId, title, options) => {
    // Only include optional fields if they have values
    const payload: { column_id: string; title: string; priority?: string; story_points?: number; description?: string } = {
      column_id: columnId,
      title,
    };
    if (options?.priority) payload.priority = options.priority;
    if (options?.story_points) payload.story_points = options.story_points;
    if (options?.description) payload.description = options.description;

    const data = await cardsApi.create(payload);
    const { board } = get();
    if (board) {
      await get().fetchBoard(board.id);
    }
    return data.card;
  },

  updateCard: async (cardId, data) => {
    await cardsApi.update(cardId, data);
    const { board } = get();
    if (board) {
      await get().fetchBoard(board.id);
    }
  },

  deleteCard: async (cardId) => {
    await cardsApi.delete(cardId);
    const { board } = get();
    if (board) {
      await get().fetchBoard(board.id);
    }
  },

  createColumn: async (name) => {
    const { board } = get();
    if (!board) return;

    await columnsApi.create(board.id, name);
    await get().fetchBoard(board.id);
  },

  updateColumn: async (columnId, data) => {
    await columnsApi.update(columnId, data);
    const { board } = get();
    if (board) {
      await get().fetchBoard(board.id);
    }
  },

  deleteColumn: async (columnId) => {
    await columnsApi.delete(columnId);
    const { board } = get();
    if (board) {
      await get().fetchBoard(board.id);
    }
  },

  reorderColumns: async (columnIds) => {
    await columnsApi.reorder(columnIds);
    const { board } = get();
    if (board) {
      await get().fetchBoard(board.id);
    }
  },
}));
