"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  BarChart3,
  Activity,
  Eye,
  Target,
  Sparkles,
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
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { useAuthStore } from "@/store/auth";
import { analyticsApi, projectsApi, sprintsApi } from "@/lib/api";
import type {
  Project,
  Sprint,
  TimeVsEstimateResponse,
  IndividualVelocityResponse,
  InvisibleWorkResponse,
} from "@/types";

type Tab = "overview" | "estimates" | "velocity" | "invisible";

export default function TimeAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [timeVsEstimate, setTimeVsEstimate] = useState<TimeVsEstimateResponse | null>(null);
  const [individualVelocity, setIndividualVelocity] = useState<IndividualVelocityResponse | null>(null);
  const [invisibleWork, setInvisibleWork] = useState<InvisibleWorkResponse | null>(null);

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

        const [timeVsEstData, velocityData, invisibleData] = await Promise.all([
          analyticsApi.getTimeVsEstimate(projectId),
          analyticsApi.getIndividualVelocity(projectId),
          analyticsApi.getInvisibleWork(projectId),
        ]);

        setTimeVsEstimate(timeVsEstData);
        setIndividualVelocity(velocityData);
        setInvisibleWork(invisibleData);
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

  const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#10b981"];

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  const renderOverviewTab = () => {
    const summary = timeVsEstimate?.summary;
    const invisibleSummary = invisibleWork?.summary;
    const totalHours = Math.round((invisibleSummary?.total_time_tracked || 0) / 60);

    return (
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Hours Tracked</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalHours}h</p>
            <p className="text-sm text-gray-400 mt-1">This period</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Cards Tracked</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary?.cards_tracked || 0}</p>
            <p className="text-sm text-gray-400 mt-1">With time logged</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Estimate Variance</span>
            </div>
            <p className={`text-3xl font-bold ${
              (summary?.total_variance_percent || 0) > 20
                ? "text-red-600"
                : (summary?.total_variance_percent || 0) < -20
                ? "text-emerald-600"
                : "text-gray-900"
            }`}>
              {summary?.total_variance_percent !== null && summary?.total_variance_percent !== undefined
                ? `${summary.total_variance_percent > 0 ? "+" : ""}${summary.total_variance_percent}%`
                : "N/A"}
            </p>
            <p className="text-sm text-gray-400 mt-1">Actual vs estimated</p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Eye className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Time Attribution</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {100 - (invisibleSummary?.orphan_percent || 0)}%
            </p>
            <p className="text-sm text-gray-400 mt-1">Attributed to cards</p>
          </div>
        </div>

        {/* Insights */}
        {invisibleWork?.insights && invisibleWork.insights.length > 0 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900">AI Insights</h3>
            </div>
            <div className="space-y-3">
              {invisibleWork.insights.map((insight, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-4 ${
                    insight.type === "critical"
                      ? "bg-red-50 border border-red-100"
                      : insight.type === "warning"
                      ? "bg-amber-50 border border-amber-100"
                      : "bg-blue-50 border border-blue-100"
                  }`}
                >
                  <p className={`text-sm ${
                    insight.type === "critical"
                      ? "text-red-700"
                      : insight.type === "warning"
                      ? "text-amber-700"
                      : "text-blue-700"
                  }`}>
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Estimate Accuracy */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Estimate Accuracy</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Over Estimate", value: summary?.over_estimate_count || 0 },
                      { name: "Under Estimate", value: summary?.under_estimate_count || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#ef4444" />
                    <Cell fill="#10b981" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600">Over ({summary?.over_estimate_count || 0})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-gray-600">Under ({summary?.under_estimate_count || 0})</span>
              </div>
            </div>
          </div>

          {/* Time Attribution */}
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Time Attribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "On Cards", value: invisibleSummary?.time_on_cards || 0 },
                      { name: "Unattributed", value: invisibleSummary?.orphan_time || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => formatMinutes(value as number)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-gray-600">On Cards</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-gray-600">Unattributed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEstimatesTab = () => {
    const comparison = timeVsEstimate?.comparison || [];

    const chartData = comparison
      .filter((c) => c.variance_minutes !== null)
      .slice(0, 10)
      .map((c) => ({
        title: c.card_title.substring(0, 20) + (c.card_title.length > 20 ? "..." : ""),
        estimated: c.estimated_minutes,
        actual: c.actual_minutes,
      }));

    return (
      <div className="space-y-6">
        {/* Bar Chart */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Time vs Estimate Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis dataKey="title" type="category" width={150} stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => formatMinutes(value as number)}
                />
                <Legend />
                <Bar dataKey="estimated" fill="#3b82f6" name="Estimated" radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Time Tracking Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Card</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Estimated</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actual</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {comparison.slice(0, 15).map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium truncate max-w-xs">{item.card_title}</div>
                      {item.column_name && (
                        <div className="text-xs text-gray-500 mt-0.5">{item.column_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === "over"
                          ? "bg-red-100 text-red-700"
                          : item.status === "under"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.status === "on_track"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {item.status === "no_estimate" ? "No estimate" :
                         item.status === "on_track" ? "On track" :
                         item.status === "over" ? "Over" : "Under"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {item.estimated_minutes > 0 ? formatMinutes(item.estimated_minutes) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {item.actual_minutes > 0 ? formatMinutes(item.actual_minutes) : "-"}
                    </td>
                    <td className={`px-6 py-4 text-right font-medium ${
                      item.variance_minutes && item.variance_minutes > 0
                        ? "text-red-600"
                        : item.variance_minutes && item.variance_minutes < 0
                        ? "text-emerald-600"
                        : "text-gray-400"
                    }`}>
                      {item.variance_minutes !== null
                        ? `${item.variance_minutes > 0 ? "+" : ""}${formatMinutes(Math.abs(item.variance_minutes))}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderVelocityTab = () => {
    const members = individualVelocity?.members || [];

    return (
      <div className="space-y-6">
        {/* Velocity Chart */}
        {members.length > 0 && members[0].sprints.length > 0 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Velocity Trends</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={members[0].sprints.map((_, idx) => {
                    const dataPoint: Record<string, any> = {
                      sprint: members[0].sprints[idx]?.sprint_name || `Sprint ${idx + 1}`,
                    };
                    members.forEach((m) => {
                      if (m.sprints[idx]) {
                        dataPoint[m.user_name] = m.sprints[idx].points;
                      }
                    });
                    return dataPoint;
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="sprint" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  {members.slice(0, 5).map((m, i) => (
                    <Area
                      key={m.user_id}
                      type="monotone"
                      dataKey={m.user_name}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.1}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Member Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member, i) => (
            <div key={member.user_id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                >
                  {member.user_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{member.user_name}</p>
                  <p className="text-sm text-gray-500">{member.average_velocity} pts/sprint avg</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{member.total_points}</p>
                  <p className="text-xs text-gray-500">Total Points</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{member.total_cards}</p>
                  <p className="text-xs text-gray-500">Cards Done</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <Users className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500">No velocity data yet</p>
            <p className="text-sm text-gray-400">Complete some sprints to see metrics</p>
          </div>
        )}
      </div>
    );
  };

  const renderInvisibleTab = () => {
    const byUser = invisibleWork?.by_user || [];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Time on Cards</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatMinutes(invisibleWork?.summary.time_on_cards || 0)}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Eye className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Unattributed</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {formatMinutes(invisibleWork?.summary.orphan_time || 0)}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Days with Blockers</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {invisibleWork?.summary.logs_with_blockers || 0}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Time Attribution by Member</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Member</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Time</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">On Cards</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Unattributed</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Blockers</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byUser.map((user, i) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        >
                          {user.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{user.user_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600 font-medium">
                      {formatMinutes(user.total_time)}
                    </td>
                    <td className="px-6 py-4 text-right text-blue-600">
                      {formatMinutes(user.card_time)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={user.orphan_percent > 30 ? "text-amber-600" : "text-gray-600"}>
                        {formatMinutes(user.orphan_time)}
                        <span className="text-gray-400 text-sm ml-1">({user.orphan_percent}%)</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">{user.blocker_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stacked Bar */}
        {byUser.length > 0 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Time Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byUser}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="user_name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => formatMinutes(value as number)}
                  />
                  <Legend />
                  <Bar dataKey="card_time" fill="#3b82f6" name="On Cards" stackId="a" />
                  <Bar dataKey="orphan_time" fill="#f59e0b" name="Unattributed" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "estimates" as const, label: "Estimates", icon: Target },
    { id: "velocity" as const, label: "Velocity", icon: TrendingUp },
    { id: "invisible" as const, label: "Invisible Work", icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}/daily-log`}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Time Analytics</h1>
              <p className="text-sm text-gray-500">{project?.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "estimates" && renderEstimatesTab()}
        {activeTab === "velocity" && renderVelocityTab()}
        {activeTab === "invisible" && renderInvisibleTab()}
      </main>
    </div>
  );
}
