"use client";

import { useState, useEffect } from "react";
import { History, MessageSquare, ArrowRight, User, Tag, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { activityApi } from "@/lib/api";
import type { ActivityLog } from "@/types";

interface ActivityTimelineProps {
  cardId: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  "card.created": <Tag className="h-3.5 w-3.5" />,
  "card.updated": <Tag className="h-3.5 w-3.5" />,
  "card.moved": <ArrowRight className="h-3.5 w-3.5" />,
  "card.assigned": <User className="h-3.5 w-3.5" />,
  "card.unassigned": <User className="h-3.5 w-3.5" />,
  "card.commented": <MessageSquare className="h-3.5 w-3.5" />,
  "card.blocked": <AlertCircle className="h-3.5 w-3.5" />,
  "card.unblocked": <AlertCircle className="h-3.5 w-3.5" />,
};

const actionColors: Record<string, string> = {
  "card.created": "bg-green-100 text-green-600",
  "card.updated": "bg-blue-100 text-blue-600",
  "card.moved": "bg-purple-100 text-purple-600",
  "card.assigned": "bg-cyan-100 text-cyan-600",
  "card.unassigned": "bg-orange-100 text-orange-600",
  "card.commented": "bg-gray-100 text-gray-600",
  "card.blocked": "bg-red-100 text-red-600",
  "card.unblocked": "bg-green-100 text-green-600",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ActivityTimeline({ cardId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadActivity();
  }, [cardId]);

  const loadActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await activityApi.getCardActivity(cardId);
      setActivities(data.activities || []);
    } catch (err) {
      console.error("Failed to load activity:", err);
      setError("Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  const displayedActivities = isExpanded ? activities : activities.slice(0, 5);

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <History className="h-4 w-4" />
        Activity
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-sm text-gray-500 py-2">No activity yet</div>
      ) : (
        <div className="space-y-1">
          {displayedActivities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 py-1.5"
            >
              {/* Icon */}
              <div
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                  actionColors[activity.action] || "bg-gray-100 text-gray-600"
                )}
              >
                {actionIcons[activity.action] || <History className="h-3.5 w-3.5" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">
                    {activity.user?.full_name || activity.user?.email || "Someone"}
                  </span>
                  {" "}
                  <span className="text-gray-600">
                    {formatAction(activity)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatTimeAgo(activity.created_at)}
                </div>
              </div>
            </div>
          ))}

          {activities.length > 5 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700"
            >
              {isExpanded ? "Show less" : `Show ${activities.length - 5} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatAction(activity: ActivityLog): string {
  const details = activity.details || {};

  switch (activity.action) {
    case "card.created":
      return "created this card";
    case "card.updated":
      if (details.changes) {
        const fields = Object.keys(details.changes);
        return `updated ${fields.join(", ")}`;
      }
      return "updated this card";
    case "card.moved":
      return `moved this card${details.to_column_name ? ` to ${details.to_column_name}` : ""}`;
    case "card.assigned":
      return `assigned ${details.assignee_name || "someone"} to this card`;
    case "card.unassigned":
      return `unassigned ${details.assignee_name || "someone"} from this card`;
    case "card.commented":
      return "commented on this card";
    case "card.blocked":
      return "marked this card as blocked";
    case "card.unblocked":
      return "removed blocked status";
    default:
      return activity.action.replace("card.", "");
  }
}
