"use client";

import { useState, useEffect } from "react";
import { UserPlus, X, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { membersApi, assigneesApi } from "@/lib/api";
import type { User, CardAssignee, OrganizationMember } from "@/types";

interface AssigneePickerProps {
  cardId: string;
  organizationId: string;
  currentAssignees: CardAssignee[];
  onAssigneeChange: (assignees: CardAssignee[]) => void;
}

export function AssigneePicker({
  cardId,
  organizationId,
  currentAssignees,
  onAssigneeChange,
}: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && members.length === 0) {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await membersApi.list(organizationId);
      setMembers(data.members || []);
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAssigned = (userId: string) => {
    return currentAssignees.some((a) => a.user_id === userId);
  };

  const handleToggleAssignee = async (member: OrganizationMember) => {
    setUpdating(member.user_id);
    try {
      if (isAssigned(member.user_id)) {
        await assigneesApi.unassign(cardId, member.user_id);
        onAssigneeChange(currentAssignees.filter((a) => a.user_id !== member.user_id));
      } else {
        await assigneesApi.assign(cardId, member.user_id);
        onAssigneeChange([
          ...currentAssignees,
          { user_id: member.user_id, user: member.user },
        ]);
      }
    } catch (error) {
      console.error("Failed to update assignee:", error);
    } finally {
      setUpdating(null);
    }
  };

  const filteredMembers = members.filter((member) => {
    const name = member.user?.full_name || member.user?.email || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="relative">
      {/* Current Assignees */}
      <div className="flex flex-wrap gap-2 mb-2">
        {currentAssignees.map((assignee) => (
          <div
            key={assignee.user_id}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 group"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
              {(assignee.user?.full_name || assignee.user?.email || "?")[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-700">
              {assignee.user?.full_name || assignee.user?.email}
            </span>
            <button
              onClick={() => handleToggleAssignee({ user_id: assignee.user_id, user: assignee.user } as OrganizationMember)}
              className="opacity-0 group-hover:opacity-100 ml-1 text-gray-400 hover:text-red-500 transition-opacity"
              disabled={updating === assignee.user_id}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {currentAssignees.length === 0 && (
          <span className="text-sm text-gray-500">No assignees</span>
        )}
      </div>

      {/* Add Assignee Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-gray-400 hover:text-gray-700"
      >
        <UserPlus className="h-3 w-3" />
        Add assignee
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg">
            {/* Search */}
            <div className="border-b p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full rounded border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Members List */}
            <div className="max-h-48 overflow-y-auto p-1">
              {loading ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  Loading members...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  {searchQuery ? "No members found" : "No members in organization"}
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <button
                    key={member.user_id}
                    onClick={() => handleToggleAssignee(member)}
                    disabled={updating === member.user_id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors",
                      isAssigned(member.user_id)
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                      {(member.user?.full_name || member.user?.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {member.user?.full_name || member.user?.email}
                      </div>
                      {member.user?.full_name && (
                        <div className="text-xs text-gray-500 truncate">
                          {member.user.email}
                        </div>
                      )}
                    </div>
                    {isAssigned(member.user_id) && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                    {updating === member.user_id && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
