"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { sprintsApi, aiApi, boardsApi } from "@/lib/api";
import type { Sprint, Card, SprintRetrospective, SprintNote, NoteType, AIRetrospectiveSummary } from "@/types";
import {
  ArrowLeft,
  Target,
  Calendar,
  BarChart3,
  CheckCircle,
  Clock,
  Sparkles,
  Trash2,
  Plus,
  X,
  Search,
  TrendingUp,
  AlertCircle,
  Play,
  Flag,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  AlertTriangle,
  FileText,
  Send,
  Edit2,
  Smile,
  Meh,
  Frown,
  Brain,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SprintMetrics {
  total_cards: number;
  completed_cards: number;
  total_story_points: number;
  completed_story_points: number;
  completion_percentage: number;
  days_remaining: number;
}

interface SprintWithCards extends Sprint {
  cards?: Card[];
}

export default function SprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const sprintId = params.sprintId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [sprint, setSprint] = useState<SprintWithCards | null>(null);
  const [metrics, setMetrics] = useState<SprintMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generatingGoal, setGeneratingGoal] = useState(false);

  // Card picker state
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [availableCards, setAvailableCards] = useState<Card[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingCards, setLoadingCards] = useState(false);

  // Retrospective state
  const [retrospective, setRetrospective] = useState<SprintRetrospective | null>(null);
  const [showRetroForm, setShowRetroForm] = useState(false);
  const [retroFormData, setRetroFormData] = useState({
    what_went_well: "",
    what_went_wrong: "",
    team_mood: 3,
  });
  const [savingRetro, setSavingRetro] = useState(false);
  const [generatingAISummary, setGeneratingAISummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<AIRetrospectiveSummary | null>(null);
  const [showAISummary, setShowAISummary] = useState(false);

  // Sprint notes state
  const [notes, setNotes] = useState<SprintNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState<NoteType | "">("");
  const [addingNote, setAddingNote] = useState(false);
  const [showNotes, setShowNotes] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !sprintId) return;

    const fetchData = async () => {
      try {
        const [sprintData, metricsData, aiStatus, retroData, notesData] = await Promise.all([
          sprintsApi.get(sprintId),
          sprintsApi.getMetrics(sprintId),
          aiApi.getStatus().catch(() => ({ enabled: false })),
          sprintsApi.getRetrospective(sprintId).catch(() => ({ retrospective: null })),
          sprintsApi.listNotes(sprintId).catch(() => ({ notes: [] })),
        ]);
        setSprint(sprintData.sprint);
        setMetrics(metricsData.metrics);
        setAiEnabled(aiStatus.enabled);
        setRetrospective(retroData.retrospective);
        setNotes(notesData.notes || []);

        // Pre-fill retro form if exists
        if (retroData.retrospective) {
          setRetroFormData({
            what_went_well: retroData.retrospective.what_went_well || "",
            what_went_wrong: retroData.retrospective.what_went_wrong || "",
            team_mood: retroData.retrospective.team_mood || 3,
          });
        }
      } catch (error) {
        console.error("Failed to fetch sprint:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, sprintId]);

  const fetchAvailableCards = async () => {
    setLoadingCards(true);
    try {
      const boardsData = await boardsApi.list(projectId);
      const allCards: Card[] = [];
      const sprintCardIds = new Set(sprint?.cards?.map(c => c.id) || []);

      for (const board of boardsData.boards) {
        const boardDetails = await boardsApi.get(board.id);
        if (boardDetails.board.columns) {
          for (const column of boardDetails.board.columns) {
            if (column.name.toLowerCase() !== "done" && column.cards) {
              // Filter out cards already in this sprint
              const availableInColumn = column.cards.filter((c: Card) => !sprintCardIds.has(c.id));
              allCards.push(...availableInColumn);
            }
          }
        }
      }
      setAvailableCards(allCards);
    } catch (error) {
      console.error("Failed to fetch cards:", error);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleOpenCardPicker = () => {
    setShowCardPicker(true);
    fetchAvailableCards();
  };

  const handleGenerateGoal = async () => {
    if (!sprint?.cards?.length) {
      alert("Add some cards to the sprint first");
      return;
    }

    setGeneratingGoal(true);
    try {
      const cardIds = sprint.cards.map((c) => c.id);
      const data = await aiApi.generateSprintGoal(cardIds);
      setSprint({ ...sprint, goal: data.goal });
      await sprintsApi.update(sprintId, { goal: data.goal });
    } catch (error) {
      console.error("Failed to generate goal:", error);
    } finally {
      setGeneratingGoal(false);
    }
  };

  const handleAddCard = async (cardId: string) => {
    try {
      await sprintsApi.addCard(sprintId, cardId);
      // Refresh sprint data
      const [sprintData, metricsData] = await Promise.all([
        sprintsApi.get(sprintId),
        sprintsApi.getMetrics(sprintId),
      ]);
      setSprint(sprintData.sprint);
      setMetrics(metricsData.metrics);
      // Remove from available cards
      setAvailableCards(prev => prev.filter(c => c.id !== cardId));
    } catch (error: any) {
      console.error("Failed to add card:", error);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    try {
      await sprintsApi.removeCard(sprintId, cardId);
      const removedCard = sprint!.cards?.find(c => c.id === cardId);
      setSprint({
        ...sprint!,
        cards: sprint!.cards?.filter((c) => c.id !== cardId),
      });
      if (removedCard) {
        setAvailableCards(prev => [...prev, removedCard]);
      }
      const metricsData = await sprintsApi.getMetrics(sprintId);
      setMetrics(metricsData.metrics);
    } catch (error) {
      console.error("Failed to remove card:", error);
    }
  };

  const handleStartSprint = async () => {
    try {
      const data = await sprintsApi.start(sprintId);
      setSprint(data.sprint);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async () => {
    try {
      const data = await sprintsApi.complete(sprintId);
      setSprint(data.sprint);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to complete sprint");
    }
  };

  const filteredAvailableCards = availableCards.filter(card =>
    card.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Retrospective handlers
  const handleSaveRetrospective = async () => {
    setSavingRetro(true);
    try {
      if (retrospective) {
        const data = await sprintsApi.updateRetrospective(sprintId, retroFormData);
        setRetrospective(data.retrospective);
      } else {
        const data = await sprintsApi.createRetrospective(sprintId, retroFormData);
        setRetrospective(data.retrospective);
      }
      setShowRetroForm(false);
    } catch (error) {
      console.error("Failed to save retrospective:", error);
    } finally {
      setSavingRetro(false);
    }
  };

  const handleGenerateAISummary = async () => {
    setGeneratingAISummary(true);
    try {
      const data = await sprintsApi.generateRetrospectiveSummary(sprintId);
      setAiSummary(data.ai_summary);
      setShowAISummary(true);
      // Refresh retrospective to get saved AI data
      const retroData = await sprintsApi.getRetrospective(sprintId);
      setRetrospective(retroData.retrospective);
    } catch (error) {
      console.error("Failed to generate AI summary:", error);
    } finally {
      setGeneratingAISummary(false);
    }
  };

  // Sprint notes handlers
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const data = await sprintsApi.createNote(sprintId, {
        content: newNote,
        note_type: newNoteType || undefined,
      });
      setNotes([data.note, ...notes]);
      setNewNote("");
      setNewNoteType("");
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await sprintsApi.deleteNote(sprintId, noteId);
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const getNoteTypeConfig = (type: NoteType | null) => {
    switch (type) {
      case "observation": return { icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50" };
      case "risk": return { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" };
      case "decision": return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" };
      case "blocker": return { icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" };
      default: return { icon: FileText, color: "text-gray-600", bg: "bg-gray-50" };
    }
  };

  const getMoodIcon = (mood: number) => {
    if (mood >= 4) return { icon: Smile, color: "text-green-500" };
    if (mood >= 3) return { icon: Meh, color: "text-amber-500" };
    return { icon: Frown, color: "text-red-500" };
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "P0": return "bg-red-100 text-red-700 border-red-200";
      case "P1": return "bg-orange-100 text-orange-700 border-orange-200";
      case "P2": return "bg-amber-100 text-amber-700 border-amber-200";
      case "P3": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "planning": return { bg: "bg-slate-100", text: "text-slate-700", icon: Flag };
      case "active": return { bg: "bg-blue-100", text: "text-blue-700", icon: Play };
      case "completed": return { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle };
      default: return { bg: "bg-gray-100", text: "text-gray-700", icon: Flag };
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
          </div>
          <div className="text-sm font-medium text-gray-500">Loading sprint...</div>
        </div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">Sprint not found</p>
          <Link href={`/project/${projectId}/sprints`} className="mt-2 text-blue-600 hover:underline">
            Back to sprints
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(sprint.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}/sprints`}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{sprint.name}</h1>
                <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", statusConfig.bg, statusConfig.text)}>
                  <StatusIcon className="h-3 w-3" />
                  {sprint.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()}
                </span>
                {metrics && sprint.status === "active" && metrics.days_remaining > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="h-4 w-4" />
                    {metrics.days_remaining} days left
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sprint.status === "planning" && (
              <button
                onClick={handleStartSprint}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <Play className="h-4 w-4" />
                Start Sprint
              </button>
            )}
            {sprint.status === "active" && (
              <button
                onClick={handleCompleteSprint}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Complete Sprint
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Sprint Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sprint Goal */}
            <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <Target className="h-4 w-4 text-purple-600" />
                  </div>
                  Sprint Goal
                </h2>
                {aiEnabled && sprint.status === "planning" && (
                  <button
                    onClick={handleGenerateGoal}
                    disabled={generatingGoal || !sprint.cards?.length}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generatingGoal ? "Generating..." : "AI Generate"}
                  </button>
                )}
              </div>
              <p className={cn("mt-3 text-gray-600", !sprint.goal && "italic text-gray-400")}>
                {sprint.goal || "No goal set for this sprint. Add cards and use AI to generate a goal."}
              </p>
            </div>

            {/* Sprint Backlog */}
            <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  Sprint Backlog
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {sprint.cards?.length || 0} cards
                  </span>
                </h2>
                {sprint.status === "planning" && (
                  <button
                    onClick={handleOpenCardPicker}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Cards
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {sprint.cards && sprint.cards.length > 0 ? (
                  sprint.cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("flex-shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-semibold", getPriorityColor(card.priority))}>
                          {card.priority || "—"}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">{card.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {card.story_points && (
                          <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {card.story_points} pts
                          </span>
                        )}
                        {sprint.status === "planning" && (
                          <button
                            onClick={() => handleRemoveCard(card.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                    <BarChart3 className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-2 text-sm font-medium text-gray-900">No cards in this sprint</p>
                    <p className="mt-1 text-xs text-gray-500">Add cards from your backlog to start planning</p>
                    {sprint.status === "planning" && (
                      <button
                        onClick={handleOpenCardPicker}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add Cards
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sprint Notes - Show for active/completed sprints */}
            {(sprint.status === "active" || sprint.status === "completed") && (
              <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="flex items-center gap-2 font-semibold text-gray-900"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                    </div>
                    Sprint Notes
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {notes.length}
                    </span>
                    {showNotes ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>

                {showNotes && (
                  <>
                    {/* Add Note Form */}
                    <div className="mb-4 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={newNoteType}
                          onChange={(e) => setNewNoteType(e.target.value as NoteType | "")}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">Type...</option>
                          <option value="observation">Observation</option>
                          <option value="risk">Risk</option>
                          <option value="decision">Decision</option>
                          <option value="blocker">Blocker</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Add a note about this sprint..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:bg-white focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!newNote.trim() || addingNote}
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {notes.length > 0 ? (
                        notes.map((note) => {
                          const config = getNoteTypeConfig(note.note_type);
                          const NoteIcon = config.icon;
                          return (
                            <div key={note.id} className={cn("flex items-start gap-3 rounded-lg p-3", config.bg)}>
                              <NoteIcon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">{note.content}</p>
                                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                  <span>{note.user?.full_name || "Unknown"}</span>
                                  <span>•</span>
                                  <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-center text-sm text-gray-500 py-4">
                          No notes yet. Add observations, risks, or decisions during the sprint.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Retrospective - Show for completed sprints */}
            {sprint.status === "completed" && (
              <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100">
                      <Brain className="h-4 w-4 text-pink-600" />
                    </div>
                    Retrospective
                  </h2>
                  <div className="flex items-center gap-2">
                    {aiEnabled && retrospective && (
                      <button
                        onClick={handleGenerateAISummary}
                        disabled={generatingAISummary}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-pink-600 hover:bg-pink-50 disabled:opacity-50 transition-colors"
                      >
                        <Sparkles className="h-4 w-4" />
                        {generatingAISummary ? "Generating..." : "AI Insights"}
                      </button>
                    )}
                    <button
                      onClick={() => setShowRetroForm(!showRetroForm)}
                      className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      {retrospective ? "Edit" : "Create"}
                    </button>
                  </div>
                </div>

                {/* Retro Form */}
                {showRetroForm && (
                  <div className="mb-4 space-y-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <ThumbsUp className="h-4 w-4 text-green-600" />
                        What went well?
                      </label>
                      <textarea
                        value={retroFormData.what_went_well}
                        onChange={(e) => setRetroFormData({ ...retroFormData, what_went_well: e.target.value })}
                        placeholder="What worked during this sprint..."
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-100"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <ThumbsDown className="h-4 w-4 text-red-600" />
                        What could be improved?
                      </label>
                      <textarea
                        value={retroFormData.what_went_wrong}
                        onChange={(e) => setRetroFormData({ ...retroFormData, what_went_wrong: e.target.value })}
                        placeholder="What challenges or issues came up..."
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        Team Mood (1-5)
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((mood) => {
                          const moodConfig = getMoodIcon(mood);
                          const MoodIcon = moodConfig.icon;
                          return (
                            <button
                              key={mood}
                              onClick={() => setRetroFormData({ ...retroFormData, team_mood: mood })}
                              className={cn(
                                "flex items-center justify-center h-10 w-10 rounded-lg border-2 transition-colors",
                                retroFormData.team_mood === mood
                                  ? "border-pink-500 bg-pink-50"
                                  : "border-gray-200 hover:border-gray-300"
                              )}
                            >
                              <MoodIcon className={cn("h-5 w-5", moodConfig.color)} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowRetroForm(false)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveRetrospective}
                        disabled={savingRetro}
                        className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50 transition-colors"
                      >
                        {savingRetro ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Display Retrospective */}
                {retrospective && !showRetroForm && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-green-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
                          <ThumbsUp className="h-4 w-4" />
                          What went well
                        </div>
                        <p className="text-sm text-gray-700">{retrospective.what_went_well || "Not provided"}</p>
                      </div>
                      <div className="rounded-lg bg-red-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-red-700 mb-2">
                          <ThumbsDown className="h-4 w-4" />
                          Improvements
                        </div>
                        <p className="text-sm text-gray-700">{retrospective.what_went_wrong || "Not provided"}</p>
                      </div>
                    </div>
                    {retrospective.team_mood && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Team Mood:</span>
                        {(() => {
                          const moodConfig = getMoodIcon(retrospective.team_mood);
                          const MoodIcon = moodConfig.icon;
                          return (
                            <div className="flex items-center gap-1">
                              <MoodIcon className={cn("h-5 w-5", moodConfig.color)} />
                              <span className="text-sm font-medium text-gray-900">{retrospective.team_mood}/5</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Summary */}
                {showAISummary && aiSummary && (
                  <div className="mt-4 rounded-lg bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-pink-800">
                        <Sparkles className="h-4 w-4" />
                        AI Analysis
                      </h3>
                      <button
                        onClick={() => setShowAISummary(false)}
                        className="text-pink-400 hover:text-pink-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{aiSummary.summary}</p>

                    {aiSummary.key_wins && aiSummary.key_wins.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-green-700 mb-1">Key Wins</h4>
                        <ul className="list-disc list-inside text-xs text-gray-600">
                          {aiSummary.key_wins.map((win, i) => (
                            <li key={i}>{win}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiSummary.areas_for_improvement && aiSummary.areas_for_improvement.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-red-700 mb-1">Areas for Improvement</h4>
                        <ul className="list-disc list-inside text-xs text-gray-600">
                          {aiSummary.areas_for_improvement.map((area, i) => (
                            <li key={i}>{area}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-purple-700 mb-1">Recommendations</h4>
                        <div className="space-y-1">
                          {aiSummary.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded font-medium",
                                rec.priority === "high" ? "bg-red-100 text-red-700" :
                                rec.priority === "medium" ? "bg-amber-100 text-amber-700" :
                                "bg-gray-100 text-gray-700"
                              )}>
                                {rec.priority}
                              </span>
                              <span className="text-xs text-gray-600">{rec.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-pink-200 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Health Score:</span>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-24 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              aiSummary.health_score >= 7 ? "bg-green-500" :
                              aiSummary.health_score >= 4 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${aiSummary.health_score * 10}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{aiSummary.health_score}/10</span>
                      </div>
                    </div>
                  </div>
                )}

                {!retrospective && !showRetroForm && (
                  <div className="text-center py-6 text-gray-500">
                    <Brain className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                    <p className="text-sm">No retrospective yet</p>
                    <p className="text-xs mt-1">Click Create to add one</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Metrics */}
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                Progress
              </h2>
              {metrics && (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Completion</span>
                      <span className="font-semibold text-gray-900">{metrics.completion_percentage}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          metrics.completion_percentage >= 80 ? "bg-emerald-500" :
                          metrics.completion_percentage >= 50 ? "bg-blue-500" :
                          metrics.completion_percentage >= 25 ? "bg-amber-500" : "bg-gray-400"
                        )}
                        style={{ width: `${metrics.completion_percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.completed_cards}
                        <span className="text-sm font-normal text-gray-500">/{metrics.total_cards}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Cards done</div>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-4">
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.completed_story_points}
                        <span className="text-sm font-normal text-gray-500">/{metrics.total_story_points}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Points done</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Velocity Card */}
            {sprint.status !== "planning" && metrics && (
              <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                  </div>
                  Velocity
                </h3>
                <div className="mt-4">
                  <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {metrics.completed_story_points}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">story points completed</div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {sprint.status === "active" && metrics && metrics.days_remaining > 0 && (
              <div className="rounded-xl border border-gray-200/80 bg-gradient-to-br from-blue-500 to-indigo-600 p-6 shadow-sm text-white">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Time Remaining</span>
                </div>
                <div className="mt-2 text-3xl font-bold">{metrics.days_remaining} days</div>
                <div className="mt-1 text-sm text-blue-100">
                  {Math.round((metrics.total_story_points - metrics.completed_story_points) / metrics.days_remaining * 10) / 10} pts/day needed
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Card Picker Modal */}
      {showCardPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Cards to Sprint</h2>
              <button
                onClick={() => setShowCardPicker(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingCards ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
                </div>
              ) : filteredAvailableCards.length > 0 ? (
                <div className="space-y-2">
                  {filteredAvailableCards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("flex-shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-semibold", getPriorityColor(card.priority))}>
                          {card.priority || "—"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{card.title}</p>
                          {card.description && (
                            <p className="text-xs text-gray-500 truncate">{card.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {card.story_points && (
                          <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {card.story_points} pts
                          </span>
                        )}
                        <button
                          onClick={() => handleAddCard(card.id)}
                          className="rounded-lg bg-blue-600 p-1.5 text-white hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="mx-auto h-10 w-10 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    {searchQuery ? "No cards match your search" : "No available cards to add"}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowCardPicker(false)}
                className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
