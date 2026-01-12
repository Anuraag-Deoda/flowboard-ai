"use client";

import { useAuthStore } from "@/store/auth";
import Link from "next/link";

export default function Home() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600" />
              <span className="text-xl font-bold text-gray-900">FlowBoard AI</span>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <span className="text-sm text-gray-600">
                    Welcome, {user?.full_name || user?.email}
                  </span>
                  <Link
                    href="/dashboard"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            A Kanban board that{" "}
            <span className="text-blue-600">understands</span> your work
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            FlowBoard AI combines Jira-grade project tracking with intelligent
            document ingestion, daily time tracking, and AI-assisted workflows.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-lg hover:bg-blue-700"
            >
              Start for free
            </Link>
            <Link
              href="#features"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
            >
              Learn more
            </Link>
          </div>
        </div>

        <div id="features" className="mt-32 grid gap-8 md:grid-cols-3">
          <div className="rounded-xl bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Smart Kanban Board
            </h3>
            <p className="mt-2 text-gray-600">
              Drag-and-drop cards, WIP limits, custom columns, and real-time
              collaboration.
            </p>
          </div>

          <div className="rounded-xl bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Daily Time Tracking
            </h3>
            <p className="mt-2 text-gray-600">
              Log your work in under 2 minutes. Track progress, blockers, and
              remaining effort.
            </p>
          </div>

          <div className="rounded-xl bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              AI-Powered Insights
            </h3>
            <p className="mt-2 text-gray-600">
              Import spreadsheets, auto-generate backlogs, and get intelligent
              suggestions.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
