import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Hash, Loader2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import debounce from "lodash/debounce";

interface SearchResult {
  id: number;
  channelId: number;
  channelName: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface MessageSearchProps {
  appSpaceId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageClick?: (channelId: number, messageId: number) => void;
}

export function MessageSearch({
  appSpaceId,
  open,
  onOpenChange,
  onMessageClick,
}: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, 300),
    []
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    debouncedSetQuery(value);
  };

  // Search messages
  const { data: results, isLoading } = useQuery<{ messages: SearchResult[] }>({
    queryKey: ["message-search", appSpaceId, debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return { messages: [] };
      }
      const res = await fetch(
        `/api/appspaces/${appSpaceId}/messages/search?q=${encodeURIComponent(debouncedQuery)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: open && debouncedQuery.length >= 2,
  });

  const messages = results?.messages || [];

  const handleResultClick = (result: SearchResult) => {
    onMessageClick?.(result.channelId, result.id);
    onOpenChange(false);
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-violet-500/30 text-white px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0510] border-white/10 sm:max-w-xl p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-white">Search Messages</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search messages..."
              className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setDebouncedQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <ScrollArea className="h-[400px]">
            {isLoading && debouncedQuery.length >= 2 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                {debouncedQuery.length >= 2 ? (
                  <>
                    <MessageCircle className="h-10 w-10 text-white/20 mb-3" />
                    <p className="text-sm text-white/50">No messages found</p>
                    <p className="text-xs text-white/30 mt-1">
                      Try a different search term
                    </p>
                  </>
                ) : (
                  <>
                    <Search className="h-10 w-10 text-white/20 mb-3" />
                    <p className="text-sm text-white/50">Enter a search term</p>
                    <p className="text-xs text-white/30 mt-1">
                      Search across all your accessible channels
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="w-full p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {result.user.avatarUrl ? (
                          <AvatarImage
                            src={result.user.avatarUrl}
                            alt={result.user.displayName || result.user.username || ""}
                          />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-white/70 text-xs">
                          {(result.user.displayName || result.user.username || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-white/90">
                            {result.user.displayName || result.user.username || "User"}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-white/40">
                            <Hash className="h-3 w-3" />
                            {result.channelName}
                          </span>
                          <span className="text-xs text-white/30">
                            {formatDistanceToNow(new Date(result.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-white/70 line-clamp-2">
                          {highlightMatch(result.content, debouncedQuery)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
