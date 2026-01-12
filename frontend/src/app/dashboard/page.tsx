"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { organizationsApi, workspacesApi, projectsApi, boardsApi } from "@/lib/api";
import type { Organization, Workspace, Project, Board } from "@/types";
import { Plus, Building2, Folder, Layout } from "lucide-react";
import { CreateModal } from "@/components/modals/CreateModal";

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
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600" />
            <span className="text-xl font-bold text-gray-900">FlowBoard AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.full_name || user?.email}
            </span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Organizations */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <Building2 className="h-4 w-4" />
                Organizations
              </h2>
              <button
                onClick={() => setCreateOrgModalOpen(true)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrg(org)}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    selectedOrg?.id === org.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {org.name}
                </button>
              ))}
              {organizations.length === 0 && (
                <p className="py-2 text-center text-sm text-gray-500">
                  No organizations yet
                </p>
              )}
            </div>
          </div>

          {/* Workspaces */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <Folder className="h-4 w-4" />
                Workspaces
              </h2>
              <button
                onClick={() => setCreateWorkspaceModalOpen(true)}
                disabled={!selectedOrg}
                className="rounded p-1 hover:bg-gray-100 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWorkspace(ws)}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    selectedWorkspace?.id === ws.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {ws.name}
                </button>
              ))}
              {workspaces.length === 0 && selectedOrg && (
                <p className="py-2 text-center text-sm text-gray-500">
                  No workspaces yet
                </p>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <Folder className="h-4 w-4" />
                Projects
              </h2>
              <button
                onClick={() => setCreateProjectModalOpen(true)}
                disabled={!selectedWorkspace}
                className="rounded p-1 hover:bg-gray-100 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProject(proj)}
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    selectedProject?.id === proj.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {proj.name}
                </button>
              ))}
              {projects.length === 0 && selectedWorkspace && (
                <p className="py-2 text-center text-sm text-gray-500">
                  No projects yet
                </p>
              )}
            </div>
          </div>

          {/* Boards */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <Layout className="h-4 w-4" />
                Boards
              </h2>
              <button
                onClick={() => setCreateBoardModalOpen(true)}
                disabled={!selectedProject}
                className="rounded p-1 hover:bg-gray-100 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-1">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  className="block w-full rounded px-3 py-2 text-left text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                >
                  {board.name}
                </Link>
              ))}
              {boards.length === 0 && selectedProject && (
                <p className="py-2 text-center text-sm text-gray-500">
                  No boards yet
                </p>
              )}
            </div>
          </div>
        </div>
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
    </div>
  );
}
