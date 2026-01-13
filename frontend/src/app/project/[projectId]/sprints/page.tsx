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
} from "lucide-react";

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

  const handleStartSprint = async (sprintId: string) => {
    try {
      const data = await sprintsApi.start(sprintId);
      setSprints(sprints.map((s) => (s.id === sprintId ? data.sprint : s)));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    try {
      const data = await sprintsApi.complete(sprintId);
      setSprints(sprints.map((s) => (s.id === sprintId ? data.sprint : s)));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to complete sprint");
    }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    if (!confirm("Are you sure you want to delete this sprint?")) return;
    try {
      await sprintsApi.delete(sprintId);
      setSprints(sprints.filter((s) => s.id !== sprintId));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to delete sprint");
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
              <h1 className="text-xl font-bold text-gray-900">Sprints</h1>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Sprint
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {sprints.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No sprints yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first sprint to start planning.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Sprint
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sprints.map((sprint) => (
              <div
                key={sprint.id}
                className="rounded-lg border bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {sprint.name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                          sprint.status
                        )}`}
                      >
                        {sprint.status}
                      </span>
                    </div>
                    {sprint.goal && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                        <Target className="h-4 w-4" />
                        {sprint.goal}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(sprint.start_date).toLocaleDateString()} -{" "}
                        {new Date(sprint.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sprint.status === "planning" && (
                      <button
                        onClick={() => handleStartSprint(sprint.id)}
                        className="flex items-center gap-1 rounded bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-200"
                      >
                        <Play className="h-4 w-4" />
                        Start
                      </button>
                    )}
                    {sprint.status === "active" && (
                      <button
                        onClick={() => handleCompleteSprint(sprint.id)}
                        className="flex items-center gap-1 rounded bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-200"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Complete
                      </button>
                    )}
                    <Link
                      href={`/project/${projectId}/sprints/${sprint.id}`}
                      className="flex items-center gap-1 rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      <BarChart3 className="h-4 w-4" />
                      View
                    </Link>
                    <button
                      onClick={() => handleDeleteSprint(sprint.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Create Sprint</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Sprint Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sprint 1"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Sprint Goal
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do you want to achieve?"
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {aiEnabled && (
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                <Sparkles className="h-3 w-3" />
                AI can help generate goals after adding cards
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
