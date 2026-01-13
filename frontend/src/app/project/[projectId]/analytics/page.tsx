"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { analyticsApi, sprintsApi, projectsApi } from "@/lib/api";
import type {
  ProjectSummary,
  VelocityDataPoint,
  BurndownDataPoint,
  WorkloadMember,
  Sprint,
} from "@/types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Users,
  Clock,
  BarChart3,
  Activity,
  Zap,
  Calendar,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AnalyticsDashboard() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [velocity, setVelocity] = useState<VelocityDataPoint[]>([]);
  const [avgVelocity, setAvgVelocity] = useState(0);
  const [burndown, setBurndown] = useState<BurndownDataPoint[]>([]);
  const [workload, setWorkload] = useState<WorkloadMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

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
        const [summaryData, velocityData, workloadData, sprintsData] = await Promise.all([
          analyticsApi.getProjectSummary(projectId),
          analyticsApi.getVelocity(projectId, 10),
          analyticsApi.getWorkload(projectId),
          sprintsApi.list(projectId),
        ]);

        setSummary(summaryData);
        setVelocity(velocityData.velocity);
        setAvgVelocity(velocityData.average_velocity);
        setWorkload(workloadData.workload);
        setSprints(sprintsData.sprints);

        // Auto-select active sprint for burndown
        if (summaryData.active_sprint) {
          setSelectedSprintId(summaryData.active_sprint.id);
          const burndownData = await analyticsApi.getBurndown(summaryData.active_sprint.id);
          setBurndown(burndownData.burndown);
        } else if (sprintsData.sprints.length > 0) {
          const latestSprint = sprintsData.sprints[0];
          setSelectedSprintId(latestSprint.id);
          const burndownData = await analyticsApi.getBurndown(latestSprint.id);
          setBurndown(burndownData.burndown);
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, projectId]);

  const handleSprintChange = async (sprintId: string) => {
    setSelectedSprintId(sprintId);
    try {
      const burndownData = await analyticsApi.getBurndown(sprintId);
      setBurndown(burndownData.burndown);
    } catch (error) {
      console.error("Failed to fetch burndown:", error);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
          </div>
          <div className="text-sm font-medium text-gray-500">Loading analytics...</div>
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
            <Link
              href="/dashboard"
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-sm text-gray-500">{summary?.project_name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avg Velocity</p>
                <p className="text-2xl font-bold text-gray-900">{avgVelocity}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.completion_rate || 0}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed Sprints</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.completed_sprints || 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Recent Time</p>
                <p className="text-2xl font-bold text-gray-900">{formatTime(summary?.recent_time_spent || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Sprint Banner */}
        {summary?.active_sprint && (
          <div className="mb-8 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-100">Active Sprint</p>
                <h2 className="text-xl font-bold">{summary.active_sprint.name}</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{summary.active_sprint.days_remaining}</p>
                <p className="text-sm text-blue-100">days remaining</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Velocity Chart */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              Sprint Velocity
            </h2>
            {velocity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={velocity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="sprint_name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="planned_points" name="Planned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed_points" name="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                  <p>No completed sprints yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Burndown Chart */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                  <Activity className="h-4 w-4 text-emerald-600" />
                </div>
                Burndown Chart
              </h2>
              <select
                value={selectedSprintId}
                onChange={(e) => handleSprintChange(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
            </div>
            {burndown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={burndown} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} label={{ value: "Day", position: "bottom", fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: "Points", angle: -90, position: "insideLeft", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="ideal_remaining"
                    name="Ideal"
                    stroke="#94a3b8"
                    fill="#f1f5f9"
                    strokeDasharray="5 5"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual_remaining"
                    name="Actual"
                    stroke="#10b981"
                    fill="#d1fae5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <Activity className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                  <p>Select a sprint to view burndown</p>
                </div>
              </div>
            )}
          </div>

          {/* Team Workload */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm lg:col-span-2">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              Team Workload
            </h2>
            {workload.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workload.map((member) => (
                  <div
                    key={member.user_id}
                    className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.user_name}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold">
                          {member.user_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{member.user_name}</p>
                        <p className="text-xs text-gray-500">{member.completion_rate}% completion</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-gray-50 p-2">
                        <p className="text-lg font-bold text-gray-900">{member.total_cards}</p>
                        <p className="text-xs text-gray-500">Cards</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <p className="text-lg font-bold text-emerald-600">{member.completed_cards}</p>
                        <p className="text-xs text-gray-500">Done</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-2">
                        <p className="text-lg font-bold text-blue-600">{member.total_points}</p>
                        <p className="text-xs text-gray-500">Points</p>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                          style={{ width: `${member.completion_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-500">
                <div className="text-center">
                  <Users className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                  <p>No team members with assigned cards</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
