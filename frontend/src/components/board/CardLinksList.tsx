"use client";

import { useState, useEffect } from "react";
import { Link2, Plus, X, Search, ArrowRight, ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardLinksApi, cardsApi } from "@/lib/api";
import type { CardLink, CardLinks, LinkType, Card } from "@/types";

interface CardLinksListProps {
  cardId: string;
  boardId: string;
}

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  relates_to: "Relates to",
  duplicates: "Duplicates",
  duplicated_by: "Duplicated by",
};

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  blocks: "text-red-600 bg-red-50",
  blocked_by: "text-orange-600 bg-orange-50",
  relates_to: "text-blue-600 bg-blue-50",
  duplicates: "text-purple-600 bg-purple-50",
  duplicated_by: "text-purple-600 bg-purple-50",
};

export function CardLinksList({ cardId, boardId }: CardLinksListProps) {
  const [links, setLinks] = useState<CardLinks>({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>("relates_to");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [cardId]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await cardLinksApi.list(cardId);
      setLinks(data.links);
    } catch (error) {
      console.error("Failed to load links:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchCards = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await cardsApi.list(undefined, boardId);
      const filtered = (data.cards || []).filter(
        (card: Card) =>
          card.id !== cardId &&
          card.title.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 5));
    } catch (error) {
      console.error("Failed to search cards:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAdding) {
        searchCards(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isAdding]);

  const handleCreateLink = async (targetCardId: string) => {
    setCreating(true);
    try {
      const data = await cardLinksApi.create(cardId, targetCardId, selectedLinkType);
      setLinks({
        ...links,
        outgoing: [...links.outgoing, data.link],
      });
      setIsAdding(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      console.error("Failed to create link:", error);
      if (error.response?.data?.error === "Link already exists") {
        alert("This link already exists");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: string, isOutgoing: boolean) => {
    setDeleting(linkId);
    try {
      await cardLinksApi.delete(cardId, linkId);
      if (isOutgoing) {
        setLinks({
          ...links,
          outgoing: links.outgoing.filter((l) => l.id !== linkId),
        });
      } else {
        setLinks({
          ...links,
          incoming: links.incoming.filter((l) => l.id !== linkId),
        });
      }
    } catch (error) {
      console.error("Failed to delete link:", error);
    } finally {
      setDeleting(null);
    }
  };

  const allLinks = [
    ...links.outgoing.map((l) => ({ ...l, isOutgoing: true })),
    ...links.incoming.map((l) => ({ ...l, isOutgoing: false })),
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Link2 className="h-4 w-4" />
          Linked Issues
          {allLinks.length > 0 && (
            <span className="text-gray-500">({allLinks.length})</span>
          )}
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 rounded text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Link issue
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        </div>
      ) : (
        <>
          {/* Add link form */}
          {isAdding && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Add Link</span>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Link type selector */}
              <div className="mb-2">
                <select
                  value={selectedLinkType}
                  onChange={(e) => setSelectedLinkType(e.target.value as LinkType)}
                  className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                >
                  <option value="blocks">Blocks</option>
                  <option value="blocked_by">Blocked by</option>
                  <option value="relates_to">Relates to</option>
                  <option value="duplicates">Duplicates</option>
                  <option value="duplicated_by">Duplicated by</option>
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards to link..."
                  className="w-full rounded border border-blue-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-blue-400 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto rounded border border-blue-200 bg-white">
                  {searchResults.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => handleCreateLink(card.id)}
                      disabled={creating}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-blue-100 disabled:opacity-50"
                    >
                      <span className="flex-1 truncate">{card.title}</span>
                      {creating && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searching && (
                <div className="mt-2 text-center text-xs text-gray-500">
                  Searching...
                </div>
              )}

              {searchQuery && !searching && searchResults.length === 0 && (
                <div className="mt-2 text-center text-xs text-gray-500">
                  No cards found
                </div>
              )}
            </div>
          )}

          {/* Links list */}
          {allLinks.length === 0 && !isAdding ? (
            <p className="text-sm text-gray-500">No linked issues</p>
          ) : (
            <div className="space-y-1">
              {allLinks.map((link) => {
                const linkedCard = link.isOutgoing ? link.target_card : link.source_card;
                const displayType = link.isOutgoing ? link.link_type : getInverseType(link.link_type);

                return (
                  <div
                    key={link.id}
                    className={cn(
                      "group flex items-center gap-2 rounded px-2 py-1.5",
                      deleting === link.id && "opacity-50"
                    )}
                  >
                    {link.isOutgoing ? (
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ArrowLeft className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium flex-shrink-0",
                        LINK_TYPE_COLORS[displayType as LinkType]
                      )}
                    >
                      {LINK_TYPE_LABELS[displayType as LinkType]}
                    </span>
                    <span className="flex-1 truncate text-sm text-gray-700">
                      {linkedCard?.title || "Unknown card"}
                    </span>
                    <button
                      onClick={() => handleDeleteLink(link.id, link.isOutgoing)}
                      disabled={deleting === link.id}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getInverseType(linkType: LinkType): LinkType {
  const inverseMap: Record<LinkType, LinkType> = {
    blocks: "blocked_by",
    blocked_by: "blocks",
    relates_to: "relates_to",
    duplicates: "duplicated_by",
    duplicated_by: "duplicates",
  };
  return inverseMap[linkType];
}
