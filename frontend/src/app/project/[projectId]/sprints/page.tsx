"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { sprintsApi, projectsApi, aiApi } from "@/lib/api";
import type { Sprint, Project } from "@/types";
import {
  Plus,
  Play,
  CheckCircle,
  Calendar,
  Target,
  BarChart3,
  ArrowLeft,
  Sparkles,
  Trash2,
  Flag,
  Clock,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SprintsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

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
        const [projectData, sprintsData, aiStatus] = await Promise.all([
          projectsApi.get(projectId),
          sprintsApi.list(projectId),
          aiApi.getStatus().catch(() => ({ enabled: false })),
        ]);
        setProject(projectData.project);
        setSprints(sprintsData.sprints);
        setAiEnabled(aiStatus.enabled);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, projectId]);

  const handleStartSprint = async (sprintId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = await sprintsApi.start(sprintId);
      setSprints(sprints.map((s) => (s.id === sprintId ? data.sprint : s)));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async (sprintId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = await sprintsApi.complete(sprintId);
      setSprints(sprints.map((s) => (s.id === sprintId ? data.sprint : s)));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to complete sprint");
    }
  };

  const handleDeleteSprint = async (sprintId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this sprint?")) return;
    try {
      await sprintsApi.delete(sprintId);
      setSprints(sprints.filter((s) => s.id !== sprintId));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to delete sprint");
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "planning":
        return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: Flag, iconColor: "text-slate-500" };
      case "active":
        return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", icon: Play, iconColor: "text-blue-500" };
      case "completed":
        return { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle, iconColor: "text-emerald-500" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200", icon: Flag, iconColor: "text-gray-500" };
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Group sprints by status
  const activeSprints = sprints.filter(s => s.status === "active");
  const planningSprints = sprints.filter(s => s.status === "planning");
  const completedSprints = sprints.filter(s => s.status === "completed");

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
          </div>
          <div className="text-sm font-medium text-gray-500">Loading sprints...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sprints</h1>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Sprint
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {sprints.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white/50 p-12 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No sprints yet</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
              Create your first sprint to start planning and tracking your team's work.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Sprint
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Sprints */}
            {activeSprints.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100">
                    <Play className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  Active Sprints
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{activeSprints.length}</span>
                </h2>
                <div className="space-y-3">
                  {activeSprints.map((sprint) => (
                    <SprintCard
                      key={sprint.id}
                      sprint={sprint}
                      projectId={projectId}
                      onStart={handleStartSprint}
                      onComplete={handleCompleteSprint}
                      onDelete={handleDeleteSprint}
                      getStatusConfig={getStatusConfig}
                      getDaysRemaining={getDaysRemaining}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Planning Sprints */}
            {planningSprints.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100">
                    <Flag className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  Planning
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{planningSprints.length}</span>
                </h2>
                <div className="space-y-3">
                  {planningSprints.map((sprint) => (
                    <SprintCard
                      key={sprint.id}
                      sprint={sprint}
                      projectId={projectId}
                      onStart={handleStartSprint}
                      onComplete={handleCompleteSprint}
                      onDelete={handleDeleteSprint}
                      getStatusConfig={getStatusConfig}
                      getDaysRemaining={getDaysRemaining}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Sprints */}
            {completedSprints.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  Completed
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{completedSprints.length}</span>
                </h2>
                <div className="space-y-3">
                  {completedSprints.map((sprint) => (
                    <SprintCard
                      key={sprint.id}
                      sprint={sprint}
                      projectId={projectId}
                      onStart={handleStartSprint}
                      onComplete={handleCompleteSprint}
                      onDelete={handleDeleteSprint}
                      getStatusConfig={getStatusConfig}
                      getDaysRemaining={getDaysRemaining}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Sprint Modal */}
      {showCreateModal && (
        <CreateSprintModal
          projectId={projectId}
          aiEnabled={aiEnabled}
          onClose={() => setShowCreateModal(false)}
          onCreated={(sprint) => {
            setSprints([sprint, ...sprints]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function SprintCard({
  sprint,
  projectId,
  onStart,
  onComplete,
  onDelete,
  getStatusConfig,
  getDaysRemaining,
}: {
  sprint: Sprint;
  projectId: string;
  onStart: (id: string, e: React.MouseEvent) => void;
  onComplete: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  getStatusConfig: (status: string) => { bg: string; text: string; border: string; icon: any; iconColor: string };
  getDaysRemaining: (endDate: string) => number;
}) {
  const config = getStatusConfig(sprint.status);
  const StatusIcon = config.icon;
  const daysRemaining = getDaysRemaining(sprint.end_date);

  return (
    <Link
      href={`/project/${projectId}/sprints/${sprint.id}`}
      className="block rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:border-gray-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{sprint.name}</h3>
            <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", config.bg, config.text)}>
              <StatusIcon className="h-3 w-3" />
              {sprint.status}
            </span>
          </div>
          {sprint.goal && (
            <p className="mt-2 flex items-start gap-2 text-sm text-gray-600">
              <Target className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400" />
              <span className="line-clamp-2">{sprint.goal}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()}
            </span>
            {sprint.status === "active" && daysRemaining > 0 && (
              <span className={cn("flex items-center gap-1.5", daysRemaining <= 3 ? "text-amber-600" : "text-blue-600")}>
                <Clock className="h-4 w-4" />
                {daysRemaining} days left
              </span>
            )}
            {sprint.status === "active" && daysRemaining <= 0 && (
              <span className="flex items-center gap-1.5 text-red-600">
                <Clock className="h-4 w-4" />
                Overdue
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {sprint.status === "planning" && (
            <button
              onClick={(e) => onStart(sprint.id, e)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-200 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          )}
          {sprint.status === "active" && (
            <button
              onClick={(e) => onComplete(sprint.id, e)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Complete
            </button>
          )}
          <button
            onClick={(e) => onDelete(sprint.id, e)}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

function CreateSprintModal({
  projectId,
  aiEnabled,
  onClose,
  onCreated,
}: {
  projectId: string;
  aiEnabled: boolean;
  onClose: () => void;
  onCreated: (sprint: Sprint) => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default dates (today + 2 weeks)
  useEffect(() => {
    const today = new Date();
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(twoWeeksLater.toISOString().split("T")[0]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      const data = await sprintsApi.create({
        project_id: projectId,
        name,
        goal: goal || undefined,
        start_date: startDate,
        end_date: endDate,
      });
      onCreated(data.sprint);
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to create sprint");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Create Sprint</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sprint Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sprint 1"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sprint Goal (Optional)</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do you want to achieve in this sprint?"
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-none"
            />
            {aiEnabled && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                AI can help generate goals after adding cards to the sprint
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
