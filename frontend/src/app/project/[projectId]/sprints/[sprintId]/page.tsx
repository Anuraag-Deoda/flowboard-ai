"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { sprintsApi, aiApi } from "@/lib/api";
import type { Sprint, Card } from "@/types";
import {
  ArrowLeft,
  Target,
  Calendar,
  BarChart3,
  CheckCircle,
  Clock,
  Sparkles,
  Trash2,
} from "lucide-react";

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
        const [sprintData, metricsData, aiStatus] = await Promise.all([
          sprintsApi.get(sprintId),
          sprintsApi.getMetrics(sprintId),
          aiApi.getStatus().catch(() => ({ enabled: false })),
        ]);
        setSprint(sprintData.sprint);
        setMetrics(metricsData.metrics);
        setAiEnabled(aiStatus.enabled);
      } catch (error) {
        console.error("Failed to fetch sprint:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, sprintId]);

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

  const handleRemoveCard = async (cardId: string) => {
    try {
      await sprintsApi.removeCard(sprintId, cardId);
      setSprint({
        ...sprint!,
        cards: sprint!.cards?.filter((c) => c.id !== cardId),
      });
      // Refresh metrics
      const metricsData = await sprintsApi.getMetrics(sprintId);
      setMetrics(metricsData.metrics);
    } catch (error) {
      console.error("Failed to remove card:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planning":
        return "bg-gray-100 text-gray-700";
      case "active":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Sprint not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}/sprints`}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{sprint.name}</h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                    sprint.status
                  )}`}
                >
                  {sprint.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(sprint.start_date).toLocaleDateString()} -{" "}
                  {new Date(sprint.end_date).toLocaleDateString()}
                </span>
                {metrics && sprint.status === "active" && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {metrics.days_remaining} days remaining
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sprint Goal */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <Target className="h-5 w-5" />
                  Sprint Goal
                </h2>
                {aiEnabled && (
                  <button
                    onClick={handleGenerateGoal}
                    disabled={generatingGoal}
                    className="flex items-center gap-1 rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generatingGoal ? "Generating..." : "AI Generate"}
                  </button>
                )}
              </div>
              <p className="mt-2 text-gray-600">
                {sprint.goal || "No goal set for this sprint"}
              </p>
            </div>

            {/* Sprint Cards */}
            <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900">Sprint Backlog</h2>
              <div className="mt-4 space-y-2">
                {sprint.cards && sprint.cards.length > 0 ? (
                  sprint.cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            card.priority === "P0"
                              ? "bg-red-100 text-red-700"
                              : card.priority === "P1"
                              ? "bg-orange-100 text-orange-700"
                              : card.priority === "P2"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {card.priority || "N/A"}
                        </span>
                        <span className="text-sm text-gray-900">{card.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {card.story_points && (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {card.story_points} pts
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-gray-500 py-4">
                    No cards in this sprint yet. Add cards from the board.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-6">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <BarChart3 className="h-5 w-5" />
                Metrics
              </h2>
              {metrics && (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium text-gray-900">
                        {metrics.completion_percentage}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${metrics.completion_percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.completed_cards}
                      </div>
                      <div className="text-xs text-gray-500">
                        of {metrics.total_cards} cards
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.completed_story_points}
                      </div>
                      <div className="text-xs text-gray-500">
                        of {metrics.total_story_points} points
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {sprint.status === "active" && metrics && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900">Velocity</h3>
                <div className="mt-2">
                  <div className="text-3xl font-bold text-blue-600">
                    {metrics.completed_story_points}
                  </div>
                  <div className="text-sm text-gray-500">points completed</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
