"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Activity,
  Target,
  Zap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Play,
  Flag,
  Rocket,
  Timer,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { useAuthStore } from "@/store/auth";
import { analyticsApi, projectsApi, sprintsApi } from "@/lib/api";
import type { Project, Sprint } from "@/types";

interface VelocityData {
  sprint_name: string;
  planned_points: number;
  completed_points: number;
}

interface WorkloadData {
  user_name: string;
  avatar_url?: string;
  total_cards: number;
  completed_cards: number;
  total_points: number;
  completed_points: number;
  completion_rate: number;
}

interface BurndownData {
  day: number;
  date: string;
  ideal_remaining: number;
  actual_remaining: number;
}

interface ProjectSummary {
  project_name: string;
  total_sprints: number;
  completed_sprints: number;
  active_sprint: {
    id: string;
    name: string;
    days_remaining: number;
  } | null;
  average_velocity: number;
  total_cards: number;
  completed_cards: number;
  completion_rate: number;
  recent_time_spent: number;
}

export default function SprintDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [velocity, setVelocity] = useState<VelocityData[]>([]);
  const [workload, setWorkload] = useState<WorkloadData[]>([]);
  const [burndown, setBurndown] = useState<BurndownData[]>([]);
  const [sprintMetrics, setSprintMetrics] = useState<any>(null);

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
        const [projectData, sprintsData] = await Promise.all([
          projectsApi.get(projectId),
          sprintsApi.list(projectId),
        ]);

        setProject(projectData.project);
        setSprints(sprintsData.sprints || []);

        // Find active sprint
        const active = sprintsData.sprints?.find((s: Sprint) => s.status === "active");
        setActiveSprint(active || null);

        // Fetch analytics data
        const [summaryData, velocityData, workloadData] = await Promise.all([
          analyticsApi.getProjectSummary(projectId),
          analyticsApi.getVelocity(projectId, 6),
          analyticsApi.getWorkload(projectId, active?.id),
        ]);

        setSummary(summaryData);
        setVelocity(velocityData.velocity || []);
        setWorkload(workloadData.workload || []);

        // Fetch burndown if there's an active sprint
        if (active) {
          const [burndownData, metricsData] = await Promise.all([
            analyticsApi.getBurndown(active.id),
            sprintsApi.getMetrics(active.id),
          ]);
          setBurndown(burndownData.burndown || []);
          setSprintMetrics(metricsData);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, projectId]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981", "#06b6d4"];

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  const daysRemaining = summary?.active_sprint?.days_remaining || 0;
  const sprintProgress = sprintMetrics?.completion_percentage || 0;
  const completedCards = sprintMetrics?.completed_cards || 0;
  const totalCards = sprintMetrics?.total_cards || 0;
  const completedPoints = sprintMetrics?.completed_points || 0;
  const totalPoints = sprintMetrics?.total_points || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}`}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
          </div>
          <Link
            href={`/project/${projectId}/time-analytics`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <Clock className="h-4 w-4" />
            Time Analytics
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Active Sprint Hero */}
        {activeSprint && (
          <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Sprint Info */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <Play className="w-3 h-3" />
                    Active Sprint
                  </span>
                  <span className="text-sm text-gray-500">
                    {daysRemaining} days remaining
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {activeSprint.name}
                </h2>
                {activeSprint.goal && (
                  <p className="text-gray-600 mb-4">{activeSprint.goal}</p>
                )}
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Cards</p>
                    <p className="text-lg font-bold text-gray-900">
                      <span className="text-blue-600">{completedCards}</span> / {totalCards}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Points</p>
                    <p className="text-lg font-bold text-gray-900">
                      <span className="text-purple-600">{completedPoints}</span> / {totalPoints}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Velocity</p>
                    <p className="text-lg font-bold text-blue-600">
                      {summary?.average_velocity || 0} pts/sprint
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Circle */}
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${sprintProgress * 3.52} 352`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{Math.round(sprintProgress)}%</span>
                    <span className="text-xs text-gray-500">Complete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Active Sprint */}
        {!activeSprint && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center mb-8">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Active Sprint</h2>
            <p className="text-gray-500 mb-4">Start a sprint to track progress</p>
            <Link
              href={`/project/${projectId}/sprints`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Rocket className="w-4 h-4" />
              Go to Sprints
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Total Cards</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary?.total_cards || 0}</p>
            <p className="text-sm text-gray-400 mt-1">across all sprints</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Completed</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary?.completed_cards || 0}</p>
            <p className="text-sm text-emerald-600 mt-1">{summary?.completion_rate || 0}% rate</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Flag className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Sprints Done</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary?.completed_sprints || 0}</p>
            <p className="text-sm text-gray-400 mt-1">of {summary?.total_sprints || 0} total</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Timer className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Recent Time</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatMinutes(summary?.recent_time_spent || 0)}</p>
            <p className="text-sm text-gray-400 mt-1">last 7 days</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Velocity Chart */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Sprint Velocity</h3>
            <div className="h-64">
              {velocity.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={velocity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="sprint_name" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="planned_points" fill="#93c5fd" name="Planned" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed_points" fill="#3b82f6" name="Completed" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="completed_points" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} name="Trend" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <BarChart3 className="w-12 h-12 mb-3" />
                  <p>No velocity data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Burndown Chart */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Sprint Burndown</h3>
            <div className="h-64">
              {burndown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burndown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} tickFormatter={(v) => `Day ${v}`} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }} labelFormatter={(v) => `Day ${v}`} />
                    <Legend />
                    <Line type="linear" dataKey="ideal_remaining" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Ideal" />
                    <Area type="monotone" dataKey="actual_remaining" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} name="Actual" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <TrendingDown className="w-12 h-12 mb-3" />
                  <p>No burndown data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Team Workload */}
        <div className="rounded-xl border bg-white p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Team Workload
            </h3>
          </div>
          {workload.length > 0 ? (
            <div className="space-y-4">
              {workload.slice(0, 6).map((member, i) => (
                <div key={member.user_name} className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  >
                    {member.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 truncate">{member.user_name}</p>
                      <span className="text-sm text-gray-500">
                        {member.completed_cards}/{member.total_cards} cards ({member.completion_rate}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${member.completion_rate}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3" />
              <p>No workload data</p>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href={`/project/${projectId}/sprints`} className="flex items-center gap-4 p-4 rounded-xl border bg-white hover:border-blue-300 hover:shadow-md transition-all">
            <div className="p-2 rounded-lg bg-purple-50">
              <Flag className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Sprint Planning</p>
              <p className="text-sm text-gray-500">Manage sprints & goals</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          <Link href={`/project/${projectId}/backlog`} className="flex items-center gap-4 p-4 rounded-xl border bg-white hover:border-blue-300 hover:shadow-md transition-all">
            <div className="p-2 rounded-lg bg-blue-50">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Backlog</p>
              <p className="text-sm text-gray-500">Prioritize & groom tasks</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          <Link href={`/project/${projectId}/daily-log`} className="flex items-center gap-4 p-4 rounded-xl border bg-white hover:border-blue-300 hover:shadow-md transition-all">
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Daily Log</p>
              <p className="text-sm text-gray-500">Track time & blockers</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </main>
    </div>
  );
}
