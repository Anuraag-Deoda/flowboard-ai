"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { boardsApi, projectsApi, aiApi, sprintsApi, cardsApi } from "@/lib/api";
import type { Card, Project, Board, Column, Sprint } from "@/types";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import {
  ArrowLeft,
  Filter,
  SortAsc,
  SortDesc,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  Upload,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

interface GroomingSuggestions {
  priority_recommendations: Array<{
    card_title: string;
    current_priority: string;
    suggested_priority: string;
    reason: string;
  }>;
  split_recommendations: Array<{
    card_title: string;
    reason: string;
    suggested_split: string[];
  }>;
  combine_recommendations: Array<{
    cards: string[];
    reason: string;
  }>;
  missing_items: string[];
  health_score: number;
  health_summary: string;
}

export default function BacklogPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [boardId, setBoardId] = useState<string>("");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [groomingSuggestions, setGroomingSuggestions] =
    useState<GroomingSuggestions | null>(null);
  const [isGrooming, setIsGrooming] = useState(false);

  // Card modal state
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirmCard, setDeleteConfirmCard] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch selection state
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"priority" | "points" | "created">("priority");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !projectId) return;

    const fetchData = async () => {
      try {
        const [projectData, aiStatus, sprintsData] = await Promise.all([
          projectsApi.get(projectId),
          aiApi.getStatus().catch(() => ({ enabled: false })),
          sprintsApi.list(projectId, "planning"),
        ]);

        setProject(projectData.project);
        setAiEnabled(aiStatus.enabled);
        setSprints(sprintsData.sprints || []);

        // Get all boards for this project and collect cards
        const boardsData = await boardsApi.list(projectId);
        const allCards: Card[] = [];

        for (const board of boardsData.boards) {
          const boardDetails = await boardsApi.get(board.id);
          // Store the first board ID and org ID for the modal
          if (!boardId && board.id) {
            setBoardId(board.id);
            setOrganizationId(boardDetails.board.organization_id || "");
          }
          if (boardDetails.board.columns) {
            for (const column of boardDetails.board.columns) {
              // Exclude "Done" column from backlog
              if (column.name.toLowerCase() !== "done" && column.cards) {
                allCards.push(...column.cards);
              }
            }
          }
        }

        setCards(allCards);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, projectId]);

  const handleGroom = async () => {
    setIsGrooming(true);
    try {
      const data = await aiApi.groomBacklog(projectId);
      setGroomingSuggestions(data.grooming);
    } catch (error) {
      console.error("Failed to groom backlog:", error);
    } finally {
      setIsGrooming(false);
    }
  };

  const handleAddToSprint = async (cardId: string, sprintId: string) => {
    try {
      await sprintsApi.addCard(sprintId, cardId);
      alert("Card added to sprint!");
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to add card to sprint");
    }
  };

  const handleCardClick = async (card: Card) => {
    // Fetch full card details
    try {
      const data = await cardsApi.get(card.id);
      setSelectedCard(data.card);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Failed to fetch card:", error);
      // Fallback to basic card data
      setSelectedCard(card);
      setIsModalOpen(true);
    }
  };

  const handleCardUpdate = (updatedCard: Card) => {
    setSelectedCard(updatedCard);
    // Update the card in the local list
    setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCard(null);
  };

  const handleCardDelete = async (cardId: string) => {
    setCards(cards.filter(c => c.id !== cardId));
    setIsModalOpen(false);
    setSelectedCard(null);
  };

  const handleDirectDelete = (cardId: string, cardTitle: string) => {
    setDeleteConfirmCard({ id: cardId, title: cardTitle });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmCard) return;

    setIsDeleting(true);
    try {
      await cardsApi.delete(deleteConfirmCard.id);
      setCards(cards.filter(c => c.id !== deleteConfirmCard.id));
      setDeleteConfirmCard(null);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to delete card");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmCard(null);
  };

  // Batch selection handlers
  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const selectAllCards = () => {
    if (selectedCardIds.size === filteredCards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(filteredCards.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCardIds(new Set());
  };

  const confirmBatchDelete = async () => {
    setIsBatchDeleting(true);
    try {
      // Delete cards one by one (could be optimized with batch API)
      const cardIdsArray = Array.from(selectedCardIds);
      for (const cardId of cardIdsArray) {
        await cardsApi.delete(cardId);
      }
      setCards(cards.filter(c => !selectedCardIds.has(c.id)));
      setSelectedCardIds(new Set());
      setShowBatchDeleteConfirm(false);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to delete some cards");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchAddToSprint = async (sprintId: string) => {
    try {
      const cardIdsArray = Array.from(selectedCardIds);
      for (const cardId of cardIdsArray) {
        await sprintsApi.addCard(sprintId, cardId);
      }
      alert(`${selectedCardIds.size} cards added to sprint!`);
      setSelectedCardIds(new Set());
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to add some cards to sprint");
    }
  };

  // Filter and sort cards
  const filteredCards = cards
    .filter((card) => {
      if (priorityFilter && card.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "priority") {
        const priorities = ["P0", "P1", "P2", "P3", "P4"];
        comparison =
          priorities.indexOf(a.priority || "P4") -
          priorities.indexOf(b.priority || "P4");
      } else if (sortBy === "points") {
        comparison = (a.story_points || 0) - (b.story_points || 0);
      } else {
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "P0":
        return "bg-red-100 text-red-700 border-red-200";
      case "P1":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "P2":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "P3":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "P4":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Backlog</h1>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/project/${projectId}/import`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Import
            </Link>
            {aiEnabled && (
              <button
                onClick={handleGroom}
                disabled={isGrooming}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {isGrooming ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI Groom
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Backlog List */}
          <div className="lg:col-span-2">
            {/* Batch Actions Bar */}
            {selectedCardIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 animate-in fade-in slide-in-from-top-2">
                <button
                  onClick={clearSelection}
                  className="p-1 rounded hover:bg-blue-100"
                >
                  <X className="h-4 w-4 text-blue-600" />
                </button>
                <span className="text-sm font-medium text-blue-700">
                  {selectedCardIds.size} card{selectedCardIds.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex-1" />
                {sprints.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBatchAddToSprint(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-700"
                    defaultValue=""
                  >
                    <option value="" disabled>Add to Sprint...</option>
                    {sprints.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Selected
                </button>
              </div>
            )}

            {/* Filters */}
            <div className="mb-4 flex items-center gap-4">
              {/* Select All Checkbox */}
              <button
                onClick={selectAllCards}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                {selectedCardIds.size === filteredCards.length && filteredCards.length > 0 ? (
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                ) : selectedCardIds.size > 0 ? (
                  <div className="relative">
                    <Square className="h-5 w-5" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-2 w-2 bg-blue-600 rounded-sm" />
                    </div>
                  </div>
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">All Priorities</option>
                  <option value="P0">P0 - Critical</option>
                  <option value="P1">P1 - High</option>
                  <option value="P2">P2 - Medium</option>
                  <option value="P3">P3 - Low</option>
                  <option value="P4">P4 - Lowest</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="priority">Sort by Priority</option>
                  <option value="points">Sort by Points</option>
                  <option value="created">Sort by Created</option>
                </select>
                <button
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="rounded border border-gray-300 p-1"
                >
                  {sortOrder === "asc" ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="ml-auto text-sm text-gray-500">
                {filteredCards.length} items
              </div>
            </div>

            {/* Cards List */}
            <div className="space-y-2">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className={`flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition-all ${
                    selectedCardIds.has(card.id) ? "ring-2 ring-blue-400 border-blue-300" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Selection Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardSelection(card.id);
                      }}
                      className="flex-shrink-0"
                    >
                      {selectedCardIds.has(card.id) ? (
                        <CheckSquare className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                    <div
                      className="flex items-center gap-3 flex-1"
                      onClick={() => handleCardClick(card)}
                    >
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${getPriorityColor(
                          card.priority
                        )}`}
                      >
                        {card.priority || "N/A"}
                      </span>
                      <div>
                        <h3 className="font-medium text-gray-900">{card.title}</h3>
                        {card.description && (
                          <p className="mt-0.5 text-sm text-gray-500 line-clamp-1">
                            {card.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {card.story_points && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {card.story_points} pts
                      </span>
                    )}
                    {sprints.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddToSprint(card.id, e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Add to Sprint
                        </option>
                        {sprints.map((sprint) => (
                          <option key={sprint.id} value={sprint.id}>
                            {sprint.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={() => handleDirectDelete(card.id, card.title)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredCards.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <p className="text-gray-500">No cards in backlog</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Suggestions Panel */}
          <div className="space-y-6">
            {groomingSuggestions && (
              <>
                {/* Health Score */}
                <div className="rounded-lg border bg-white p-6 shadow-sm">
                  <h2 className="font-semibold text-gray-900">Backlog Health</h2>
                  <div className="mt-4 flex items-center gap-4">
                    <div
                      className={`text-4xl font-bold ${
                        groomingSuggestions.health_score >= 7
                          ? "text-green-600"
                          : groomingSuggestions.health_score >= 4
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {groomingSuggestions.health_score}/10
                    </div>
                    <p className="text-sm text-gray-600">
                      {groomingSuggestions.health_summary}
                    </p>
                  </div>
                </div>

                {/* Priority Recommendations */}
                {groomingSuggestions.priority_recommendations.length > 0 && (
                  <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                      <ArrowRight className="h-5 w-5 text-orange-500" />
                      Priority Changes
                    </h2>
                    <div className="mt-4 space-y-3">
                      {groomingSuggestions.priority_recommendations.map(
                        (rec, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-orange-50 p-3 text-sm"
                          >
                            <div className="font-medium text-gray-900">
                              {rec.card_title}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-orange-700">
                              <span>{rec.current_priority}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>{rec.suggested_priority}</span>
                            </div>
                            <div className="mt-1 text-gray-600">{rec.reason}</div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Split Recommendations */}
                {groomingSuggestions.split_recommendations.length > 0 && (
                  <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Consider Splitting
                    </h2>
                    <div className="mt-4 space-y-3">
                      {groomingSuggestions.split_recommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-yellow-50 p-3 text-sm"
                        >
                          <div className="font-medium text-gray-900">
                            {rec.card_title}
                          </div>
                          <div className="mt-1 text-gray-600">{rec.reason}</div>
                          <div className="mt-2 space-y-1">
                            {rec.suggested_split.map((split, j) => (
                              <div
                                key={j}
                                className="flex items-center gap-2 text-yellow-700"
                              >
                                <CheckCircle className="h-3 w-3" />
                                {split}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Items */}
                {groomingSuggestions.missing_items.length > 0 && (
                  <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <h2 className="font-semibold text-gray-900">
                      Consider Adding
                    </h2>
                    <div className="mt-4 space-y-2">
                      {groomingSuggestions.missing_items.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm text-gray-600"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!groomingSuggestions && aiEnabled && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Click "AI Groom" to get suggestions for improving your backlog
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Card Detail Modal */}
      {selectedCard && boardId && (
        <CardDetailModal
          card={selectedCard}
          boardId={boardId}
          organizationId={organizationId}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onUpdate={handleCardUpdate}
          onDelete={handleCardDelete}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cancelDelete}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header with icon */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 px-6 pt-6 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Card</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">"{deleteConfirmCard.title}"</span>?
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This will permanently remove the card and all its associated data.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Card
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowBatchDeleteConfirm(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header with icon */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 px-6 pt-6 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete {selectedCardIds.size} Cards</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{selectedCardIds.size} selected cards</span>?
              </p>
              <p className="mt-2 text-sm text-gray-500">
                This will permanently remove these cards and all their associated data.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                disabled={isBatchDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBatchDelete}
                disabled={isBatchDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBatchDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedCardIds.size} Cards
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
