"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  User,
  MessageSquare,
  Clock,
  AlertCircle,
  PlayCircle,
  CheckCircle2,
  UserPlus,
  ArrowRight,
  X,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import type { Notification, NotificationType } from "@/types";
import { formatDistanceToNow } from "date-fns";

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  card_assigned: <User className="w-4 h-4 text-blue-500" />,
  card_mentioned: <User className="w-4 h-4 text-purple-500" />,
  card_commented: <MessageSquare className="w-4 h-4 text-green-500" />,
  card_due_soon: <Clock className="w-4 h-4 text-orange-500" />,
  card_overdue: <AlertCircle className="w-4 h-4 text-red-500" />,
  card_moved: <ArrowRight className="w-4 h-4 text-gray-500" />,
  sprint_started: <PlayCircle className="w-4 h-4 text-green-500" />,
  sprint_completed: <CheckCircle2 className="w-4 h-4 text-blue-500" />,
  sprint_ending_soon: <Clock className="w-4 h-4 text-yellow-500" />,
  added_to_project: <UserPlus className="w-4 h-4 text-indigo-500" />,
  added_to_organization: <UserPlus className="w-4 h-4 text-indigo-500" />,
  card_blocked: <AlertCircle className="w-4 h-4 text-red-500" />,
  subtask_completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
};

export function NotificationDropdown() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await notificationsApi.list({
        unread_only: showUnreadOnly,
        limit: 20,
      });
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  // Poll for new notifications
  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(async () => {
      try {
        const data = await notificationsApi.getUnreadCount();
        setUnreadCount(data.unread_count);
      } catch (error) {
        // Silently fail polling
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Refetch when filter changes
  useEffect(() => {
    fetchNotifications();
  }, [showUnreadOnly]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        await notificationsApi.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    // Navigate if action URL exists
    if (notification.action_url) {
      router.push(notification.action_url);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    try {
      await notificationsApi.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    showUnreadOnly
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {showUnreadOnly ? "Unread" : "All"}
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No notifications</p>
                <p className="text-gray-400 text-xs mt-1">
                  {showUnreadOnly ? "No unread notifications" : "You're all caught up!"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 cursor-pointer transition-colors group ${
                      notification.is_read
                        ? "bg-white hover:bg-gray-50"
                        : "bg-blue-50/50 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        notification.is_read ? "bg-gray-100" : "bg-white shadow-sm"
                      }`}>
                        {NOTIFICATION_ICONS[notification.type]}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notification.is_read ? "text-gray-700" : "text-gray-900 font-medium"}`}>
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          {notification.actor && (
                            <span className="text-xs text-gray-400">
                              by {notification.actor.full_name || notification.actor.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-center text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
