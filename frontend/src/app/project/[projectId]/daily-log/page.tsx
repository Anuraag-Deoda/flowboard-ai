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
  Calendar,
  AlertCircle,
  FileText,
  Sparkles,
  BarChart3,
  CheckCircle2,
  Zap,
  Target,
  ChevronRight,
  TrendingUp,
  Timer,
  Save,
  Lightbulb,
  X,
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

// Animated number component
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const steps = 40;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        setDisplayed(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(displayed)}</span>;
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
  const [mounted, setMounted] = useState(false);

  // Form state
  const [tasksWorked, setTasksWorked] = useState<
    Array<{ card_id: string; title: string; time_spent: number; notes: string }>
  >([]);
  const [remainingWork, setRemainingWork] = useState("");
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<{
    total_time_minutes: number;
    total_time_hours: number;
    days_logged: number;
    average_per_day: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
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
          setTasksWorked(
            todayData.daily_log.tasks_worked?.map((t: TaskWorked) => ({
              card_id: t.card_id,
              title: "",
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
    setSaveSuccess(false);
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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
  const hours = Math.floor(totalTime / 60);
  const minutes = totalTime % 60;

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <Clock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <header className={`mb-8 ${mounted ? "animate-fade-in" : "opacity-0"}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/project/${projectId}/dashboard`}
                className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <p className="text-sm text-gray-500 mb-0.5">{project?.name}</p>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Daily Log
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700 font-medium">{formatDate()}</span>
              </div>
              <Link
                href={`/project/${projectId}/time-analytics`}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium">Analytics</span>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className={`lg:col-span-2 space-y-6 ${mounted ? "animate-fade-in" : "opacity-0"}`} style={{ animationDelay: "100ms" }}>
            {/* Time Summary Hero */}
            <div className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Today's Progress</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-blue-600">
                      <AnimatedNumber value={hours} />
                    </span>
                    <span className="text-lg text-gray-500 font-medium">h</span>
                    <span className="text-4xl font-bold text-blue-600 ml-2">
                      <AnimatedNumber value={minutes} />
                    </span>
                    <span className="text-lg text-gray-500 font-medium">m</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {todayLog && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-medium">Saved</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-gray-700">{tasksWorked.length} tasks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks Worked */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-base font-semibold text-gray-900">Tasks Worked On</span>
              </div>

              <div className="space-y-3">
                {tasksWorked.map((task, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-all hover:border-blue-200 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => handleUpdateTask(index, "title", e.target.value)}
                          placeholder="What did you work on?"
                          className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                        />
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={task.time_spent || ""}
                              onChange={(e) =>
                                handleUpdateTask(index, "time_spent", parseInt(e.target.value) || 0)
                              }
                              placeholder="0"
                              className="w-20 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                              min="0"
                            />
                            <span className="text-sm text-gray-500">min</span>
                          </div>
                          <input
                            type="text"
                            value={task.notes}
                            onChange={(e) => handleUpdateTask(index, "notes", e.target.value)}
                            placeholder="Notes (optional)"
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTask(index)}
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => handleAddTask()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>

            {/* Remaining Work */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Target className="w-4 h-4 text-indigo-600" />
                </div>
                <span className="text-base font-semibold text-gray-900">Remaining Work</span>
              </div>
              <textarea
                value={remainingWork}
                onChange={(e) => setRemainingWork(e.target.value)}
                placeholder="What still needs to be done?"
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>

            {/* Blockers */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-rose-50">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-base font-semibold text-gray-900">Blockers</span>
                {blockers && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-md text-rose-600 text-xs font-medium">
                    Has blockers
                  </span>
                )}
              </div>
              <textarea
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Any blockers or impediments?"
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>

            {/* Notes / Summary */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <FileText className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-base font-semibold text-gray-900">Notes / Summary</span>
                </div>
                {aiEnabled && (
                  <button
                    onClick={handleGenerateSummary}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </button>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or standup summary"
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all ${
                  saveSuccess
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {todayLog ? "Update Log" : "Save Log"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className={`space-y-6 ${mounted ? "animate-fade-in" : "opacity-0"}`} style={{ animationDelay: "200ms" }}>
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-indigo-50">
                    <Lightbulb className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-base font-semibold text-gray-900">Suggestions</span>
                </div>
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleAddTask(suggestion)}
                      className="w-full text-left bg-gray-50 border border-gray-200 rounded-xl p-3.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:translate-x-1 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {suggestion.title}
                          </p>
                          {suggestion.column && (
                            <p className="text-xs text-gray-500 mt-1">{suggestion.column}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                            suggestion.reason === "assigned"
                              ? "bg-blue-50 text-blue-600 border border-blue-200"
                              : suggestion.reason === "yesterday_remaining"
                              ? "bg-amber-50 text-amber-600 border border-amber-200"
                              : "bg-indigo-50 text-indigo-600 border border-indigo-200"
                          }`}
                        >
                          {suggestion.reason === "assigned"
                            ? "Assigned"
                            : suggestion.reason === "yesterday_remaining"
                            ? "Yesterday"
                            : "Suggested"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Summary */}
            {summary && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-base font-semibold text-gray-900">This Week</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                    <p className="text-xs text-gray-500 mb-1">Total Time</p>
                    <p className="text-xl font-bold text-gray-900">
                      {summary.total_time_hours}
                      <span className="text-sm text-gray-500 font-normal">h</span>
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                    <p className="text-xs text-gray-500 mb-1">Days Logged</p>
                    <p className="text-xl font-bold text-gray-900">{summary.days_logged}</p>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3.5 col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Average per Day</p>
                    <p className="text-xl font-bold text-blue-600">
                      {Math.round(summary.average_per_day)}
                      <span className="text-sm text-gray-500 font-normal">m</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Zap className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-base font-semibold text-gray-900">Quick Links</span>
              </div>
              <div className="space-y-2">
                <Link
                  href={`/project/${projectId}/dashboard`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100 transition-all"
                >
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="flex-1 text-sm font-medium">Dashboard</span>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
                <Link
                  href={`/project/${projectId}`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100 transition-all"
                >
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span className="flex-1 text-sm font-medium">Board</span>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
                <Link
                  href={`/project/${projectId}/sprints`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-100 transition-all"
                >
                  <Timer className="w-4 h-4 text-amber-600" />
                  <span className="flex-1 text-sm font-medium">Sprints</span>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
