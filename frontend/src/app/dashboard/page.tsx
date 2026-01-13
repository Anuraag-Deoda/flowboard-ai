"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { organizationsApi, workspacesApi, projectsApi, boardsApi, templatesApi } from "@/lib/api";
import type { Organization, Workspace, Project, Board } from "@/types";
import {
  Plus,
  Building2,
  Folder,
  Layout,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  Settings,
  Search,
  ChevronRight,
  BarChart3,
  LayoutTemplate,
} from "lucide-react";
import { CreateModal } from "@/components/modals/CreateModal";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { TemplatePickerModal } from "@/components/modals/TemplatePickerModal";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, checkAuth, logout } = useAuthStore();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [createBoardModalOpen, setCreateBoardModalOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch organizations
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchOrgs = async () => {
      try {
        const data = await organizationsApi.list();
        setOrganizations(data.organizations);
        if (data.organizations.length > 0) {
          setSelectedOrg(data.organizations[0]);
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrgs();
  }, [isAuthenticated]);

  // Fetch workspaces when org changes
  useEffect(() => {
    if (!selectedOrg) return;

    const fetchWorkspaces = async () => {
      try {
        const data = await workspacesApi.list(selectedOrg.id);
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0) {
          setSelectedWorkspace(data.workspaces[0]);
        } else {
          setSelectedWorkspace(null);
          setProjects([]);
          setBoards([]);
        }
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
      }
    };

    fetchWorkspaces();
  }, [selectedOrg]);

  // Fetch projects when workspace changes
  useEffect(() => {
    if (!selectedWorkspace) return;

    const fetchProjects = async () => {
      try {
        const data = await projectsApi.list(selectedWorkspace.id);
        setProjects(data.projects);
        if (data.projects.length > 0) {
          setSelectedProject(data.projects[0]);
        } else {
          setSelectedProject(null);
          setBoards([]);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    };

    fetchProjects();
  }, [selectedWorkspace]);

  // Fetch boards when project changes
  useEffect(() => {
    if (!selectedProject) return;

    const fetchBoards = async () => {
      try {
        const data = await boardsApi.list(selectedProject.id);
        setBoards(data.boards);
      } catch (error) {
        console.error("Failed to fetch boards:", error);
      }
    };

    fetchBoards();
  }, [selectedProject]);

  const handleCreateOrg = async (name: string) => {
    const data = await organizationsApi.create(name);
    setOrganizations([...organizations, data.organization]);
    setSelectedOrg(data.organization);
  };

  const handleCreateWorkspace = async (name: string) => {
    if (!selectedOrg) return;
    const data = await workspacesApi.create(selectedOrg.id, name);
    setWorkspaces([...workspaces, data.workspace]);
    setSelectedWorkspace(data.workspace);
  };

  const handleCreateProject = async (name: string) => {
    if (!selectedWorkspace) return;
    const data = await projectsApi.create(selectedWorkspace.id, name);
    setProjects([...projects, data.project]);
    setSelectedProject(data.project);
  };

  const handleCreateBoard = async (name: string) => {
    if (!selectedProject) return;
    const data = await boardsApi.create(selectedProject.id, name);
    setBoards([...boards, data.board]);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 animate-ping opacity-20" />
          </div>
          <div className="text-sm font-medium text-gray-500">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              FlowBoard AI
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-48 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm placeholder:text-gray-400 focus:bg-white focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <NotificationDropdown />

            <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
              <Settings className="h-5 w-5" />
            </button>

            <div className="h-6 w-px bg-gray-200" />

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-semibold text-white">
                {(user?.full_name || user?.email || "?")[0].toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(" ")[0] || "there"}!
          </h1>
          <p className="mt-1 text-gray-500">Here's what's happening across your workspaces</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Organizations */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                </div>
                Organizations
              </h2>
              <button
                onClick={() => setCreateOrgModalOpen(true)}
                className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
                    selectedOrg?.id === org.id
                      ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {org.name}
                </button>
              ))}
              {organizations.length === 0 && (
                <div className="py-6 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No organizations yet</p>
                  <button
                    onClick={() => setCreateOrgModalOpen(true)}
                    className="mt-2 text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    Create your first organization
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Workspaces */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
                  <Folder className="h-3.5 w-3.5 text-blue-600" />
                </div>
                Workspaces
              </h2>
              <button
                onClick={() => setCreateWorkspaceModalOpen(true)}
                disabled={!selectedOrg}
                className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWorkspace(ws)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
                    selectedWorkspace?.id === ws.id
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {ws.name}
                </button>
              ))}
              {workspaces.length === 0 && selectedOrg && (
                <div className="py-6 text-center">
                  <Folder className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No workspaces yet</p>
                </div>
              )}
              {!selectedOrg && (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-400">Select an organization first</p>
                </div>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
                  <Folder className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                Projects
              </h2>
              <button
                onClick={() => setCreateProjectModalOpen(true)}
                disabled={!selectedWorkspace}
                className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProject(proj)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all",
                    selectedProject?.id === proj.id
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {proj.name}
                </button>
              ))}
              {projects.length === 0 && selectedWorkspace && (
                <div className="py-6 text-center">
                  <Folder className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No projects yet</p>
                </div>
              )}
              {!selectedWorkspace && (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-400">Select a workspace first</p>
                </div>
              )}
            </div>
          </div>

          {/* Boards */}
          <div className="rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
                  <Layout className="h-3.5 w-3.5 text-amber-600" />
                </div>
                Boards
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTemplatePickerOpen(true)}
                  disabled={!selectedProject}
                  className="rounded-lg p-1.5 hover:bg-purple-50 disabled:opacity-50 transition-colors"
                  title="Create from template"
                >
                  <LayoutTemplate className="h-4 w-4 text-purple-500" />
                </button>
                <button
                  onClick={() => setCreateBoardModalOpen(true)}
                  disabled={!selectedProject}
                  className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  title="Create blank board"
                >
                  <Plus className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-all"
                >
                  <span>{board.name}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
              {boards.length === 0 && selectedProject && (
                <div className="py-6 text-center">
                  <Layout className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No boards yet</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      onClick={() => setTemplatePickerOpen(true)}
                      className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center justify-center gap-1.5"
                    >
                      <LayoutTemplate className="h-4 w-4" />
                      Use a template
                    </button>
                    <button
                      onClick={() => setCreateBoardModalOpen(true)}
                      className="text-sm font-medium text-amber-600 hover:text-amber-700"
                    >
                      or create blank board
                    </button>
                  </div>
                </div>
              )}
              {!selectedProject && (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-400">Select a project first</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick access to project features */}
        {selectedProject && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link
                href={`/project/${selectedProject.id}/sprints`}
                className="group flex items-center gap-4 rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Sprints</h3>
                  <p className="text-sm text-gray-500">Manage sprint planning</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                href={`/project/${selectedProject.id}/backlog`}
                className="group flex items-center gap-4 rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Backlog</h3>
                  <p className="text-sm text-gray-500">AI-powered grooming</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                href={`/project/${selectedProject.id}/daily-log`}
                className="group flex items-center gap-4 rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Daily Log</h3>
                  <p className="text-sm text-gray-500">Track your time</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                href={`/project/${selectedProject.id}/analytics`}
                className="group flex items-center gap-4 rounded-xl border border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 hover:border-amber-300 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Analytics</h3>
                  <p className="text-sm text-gray-500">Velocity & insights</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Create Modals */}
      <CreateModal
        isOpen={createOrgModalOpen}
        onClose={() => setCreateOrgModalOpen(false)}
        onSubmit={handleCreateOrg}
        title="Create Organization"
        entityName="Organization"
      />

      <CreateModal
        isOpen={createWorkspaceModalOpen}
        onClose={() => setCreateWorkspaceModalOpen(false)}
        onSubmit={handleCreateWorkspace}
        title="Create Workspace"
        entityName="Workspace"
      />

      <CreateModal
        isOpen={createProjectModalOpen}
        onClose={() => setCreateProjectModalOpen(false)}
        onSubmit={handleCreateProject}
        title="Create Project"
        entityName="Project"
        showDescription
      />

      <CreateModal
        isOpen={createBoardModalOpen}
        onClose={() => setCreateBoardModalOpen(false)}
        onSubmit={handleCreateBoard}
        title="Create Board"
        entityName="Board"
        showDescription
      />

      {selectedProject && (
        <TemplatePickerModal
          isOpen={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          projectId={selectedProject.id}
          onSelect={async (templateId, customName) => {
            const data = await templatesApi.apply(templateId, selectedProject.id, customName);
            setBoards([...boards, data.board]);
          }}
        />
      )}
    </div>
  );
}
