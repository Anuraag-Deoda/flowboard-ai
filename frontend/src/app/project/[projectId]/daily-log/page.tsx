"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { dailyLogsApi, projectsApi, aiApi } from "@/lib/api";
import type { DailyLog, Project, TaskWorked } from "@/types";
import {
  ArrowLeft,
  Clock,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  FileText,
  Sparkles,
  BarChart3,
} from "lucide-react";

interface TaskSuggestion {
  card_id: string | null;
  title: string;
  description?: string;
  reason: string;
  column?: string;
  priority?: string;
  story_points?: number;
}

export default function DailyLogPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Form state
  const [tasksWorked, setTasksWorked] = useState<
    Array<{ card_id: string; title: string; time_spent: number; notes: string }>
  >([]);
  const [remainingWork, setRemainingWork] = useState("");
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<{
    total_time_minutes: number;
    total_time_hours: number;
    days_logged: number;
    average_per_day: number;
  } | null>(null);

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
        const [projectData, todayData, summaryData, aiStatus] = await Promise.all([
          projectsApi.get(projectId),
          dailyLogsApi.getToday(projectId),
          dailyLogsApi.getSummary(projectId, 7),
          aiApi.getStatus().catch(() => ({ enabled: false })),
        ]);

        setProject(projectData.project);
        setSummary(summaryData.summary);
        setAiEnabled(aiStatus.enabled);

        if (todayData.daily_log) {
          setTodayLog(todayData.daily_log);
          // Populate form with existing data
          setTasksWorked(
            todayData.daily_log.tasks_worked?.map((t: TaskWorked) => ({
              card_id: t.card_id,
              title: "", // We'd need to fetch card titles
              time_spent: t.time_spent,
              notes: t.notes || "",
            })) || []
          );
          setRemainingWork(todayData.daily_log.remaining_work || "");
          setBlockers(todayData.daily_log.blockers || "");
          setNotes(todayData.daily_log.notes || "");
        }

        if (todayData.suggestions) {
          setSuggestions(todayData.suggestions);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, projectId]);

  const handleAddTask = (suggestion?: TaskSuggestion) => {
    setTasksWorked([
      ...tasksWorked,
      {
        card_id: suggestion?.card_id || "",
        title: suggestion?.title || "",
        time_spent: 0,
        notes: "",
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    setTasksWorked(tasksWorked.filter((_, i) => i !== index));
  };

  const handleUpdateTask = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const updated = [...tasksWorked];
    updated[index] = { ...updated[index], [field]: value };
    setTasksWorked(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = await dailyLogsApi.createOrUpdate({
        project_id: projectId,
        tasks_worked: tasksWorked
          .filter((t) => t.card_id && t.time_spent > 0)
          .map((t) => ({
            card_id: t.card_id,
            time_spent: t.time_spent,
            notes: t.notes || undefined,
          })),
        remaining_work: remainingWork || undefined,
        blockers: blockers || undefined,
        notes: notes || undefined,
      });
      setTodayLog(data.daily_log);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to save daily log");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (tasksWorked.length === 0) {
      alert("Add some tasks first");
      return;
    }

    try {
      const data = await aiApi.generateDailySummary(
        tasksWorked.map((t) => ({
          title: t.title,
          time_spent: t.time_spent,
          notes: t.notes,
        })),
        blockers
      );
      setNotes(data.summary);
    } catch (error) {
      console.error("Failed to generate summary:", error);
    }
  };

  const totalTime = tasksWorked.reduce((sum, t) => sum + (t.time_spent || 0), 0);

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
              <h1 className="text-xl font-bold text-gray-900">Daily Log</h1>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Daily Log Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tasks Worked */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <Clock className="h-5 w-5" />
                  Tasks Worked On
                </h2>
                <div className="text-sm text-gray-500">
                  Total: {Math.floor(totalTime / 60)}h {totalTime % 60}m
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {tasksWorked.map((task, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) =>
                            handleUpdateTask(index, "title", e.target.value)
                          }
                          placeholder="What did you work on?"
                          className="w-full rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={task.time_spent || ""}
                            onChange={(e) =>
                              handleUpdateTask(
                                index,
                                "time_spent",
                                parseInt(e.target.value) || 0
                              )
                            }
                            placeholder="Minutes"
                            className="w-24 rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">minutes</span>
                        </div>
                        <input
                          type="text"
                          value={task.notes}
                          onChange={(e) =>
                            handleUpdateTask(index, "notes", e.target.value)
                          }
                          placeholder="Notes (optional)"
                          className="w-full rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveTask(index)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => handleAddTask()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600"
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </button>
              </div>
            </div>

            {/* Remaining Work */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <FileText className="h-5 w-5" />
                Remaining Work
              </h2>
              <textarea
                value={remainingWork}
                onChange={(e) => setRemainingWork(e.target.value)}
                placeholder="What still needs to be done?"
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Blockers */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Blockers
              </h2>
              <textarea
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Any blockers or impediments?"
                rows={2}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Notes / Summary */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Notes / Summary</h2>
                {aiEnabled && (
                  <button
                    onClick={handleGenerateSummary}
                    className="flex items-center gap-1 rounded px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Summary
                  </button>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or standup summary"
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : todayLog ? "Update Log" : "Save Log"}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900">Suggestions</h2>
                <div className="mt-4 space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddTask(suggestion)}
                      className="w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {suggestion.title}
                      </div>
                      {suggestion.column && (
                        <div className="mt-1 text-xs text-gray-500">
                          {suggestion.column}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-blue-600">
                        {suggestion.reason === "assigned"
                          ? "Assigned to you"
                          : suggestion.reason === "yesterday_remaining"
                          ? "From yesterday"
                          : "Suggested"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Summary */}
            {summary && (
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <BarChart3 className="h-5 w-5" />
                  This Week
                </h2>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Time</span>
                    <span className="font-medium text-gray-900">
                      {summary.total_time_hours}h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Days Logged</span>
                    <span className="font-medium text-gray-900">
                      {summary.days_logged}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Avg per Day</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(summary.average_per_day)}m
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
