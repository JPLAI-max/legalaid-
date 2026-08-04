import { useState, useRef, useCallback } from "react";
import { format, isValid } from "date-fns";
import {
  MessageSquare,
  Upload,
  Loader2,
  Search,
  Calendar,
  User,
  Trash2,
  CalendarPlus,
  Sparkles,
  ChevronRight,
  Paperclip,
  Info,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import {
  useListTextMessageThreads,
  getListTextMessageThreadsQueryKey,
  useGetTextMessageThread,
  useDeleteTextMessageThread,
  useCreateTimelineEvent,
  getListTimelineEventsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SmsMessage {
  id: number;
  threadId: number;
  sender: string;
  senderIsMe: boolean;
  content: string;
  sentAt: string | null;
  sequenceNumber: number;
  importedAt: string;
}

interface Thread {
  id: number;
  caseId: number;
  contactName: string;
  contactPhone?: string | null;
  sourceFilename: string;
  messageCount: number;
  firstMessageAt?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
}

interface SuggestedEvent {
  title: string;
  estimatedDate: string | null;
  description: string;
  people: string[];
  confidenceLevel: "high" | "medium" | "low";
  relevantMessageIds: number[];
}

/**
 * Timestamps are stored as UTC in the DB, but they represent naive local times
 * from the user's phone export (no timezone info was in the source file).
 * Render them as UTC so the time shown matches what was in the original file.
 */
function toDisplayDate(dateStr: string): Date {
  const d = new Date(dateStr);
  // Shift by the local offset so format() outputs the UTC wall-clock value.
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isValid(d)) return dateStr;
  return format(toDisplayDate(dateStr), "MMM d, yyyy h:mm a");
}

function fmtDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isValid(d)) return dateStr;
  return format(toDisplayDate(dateStr), "MMM d, h:mm a");
}

const EXPORT_GUIDES = [
  {
    platform: "iPhone (iOS)",
    icon: "📱",
    steps: [
      "Open the Messages app on your iPhone",
      "Find the conversation you want to export",
      'Take screenshots by pressing the Side button + Volume Up (or use "Screen Recording" for longer chats)',
      "Save screenshots to your Photos app",
      "Export them by uploading the PNG/JPG files here",
      "For a full export: Use a third-party app like iMazing (Mac/PC) to export as TXT",
    ],
  },
  {
    platform: "Android",
    icon: "🤖",
    steps: [
      "Open your Messages app",
      "Open the conversation you want to export",
      'Tap the three-dot menu → "Export chat" (Samsung) or take screenshots',
      "If export is available, save as TXT file and upload it here",
      "For screenshots: press Power + Volume Down simultaneously",
      "Alternatively, use SMS Backup & Restore app from the Play Store to export as XML or TXT",
    ],
  },
  {
    platform: "WhatsApp",
    icon: "💬",
    steps: [
      "Open WhatsApp and go to the chat",
      'Tap the contact/group name at the top → "Export Chat"',
      'Choose "Without Media" for a TXT file',
      "Share or save the TXT file, then upload it here",
      "The file will be named something like WhatsApp Chat with [Name].txt",
    ],
  },
  {
    platform: "Google Messages",
    icon: "💌",
    steps: [
      "Open Google Messages on your Android phone",
      "Find the conversation",
      "Take screenshots of the conversation",
      "Upload the PNG/JPG screenshots here",
    ],
  },
];

// ─── Upload panel ─────────────────────────────────────────────────────────────

interface UploadPanelProps {
  caseId: number;
  onSuccess: () => void;
}

function UploadPanel({ caseId, onSuccess }: UploadPanelProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [myName, setMyName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (myName.trim()) fd.append("myName", myName.trim());

      const resp = await fetch(`${basePath}/api/cases/${caseId}/text-messages/upload`, {
        method: "POST",
        body: fd,
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const serverMsg = (data as { error?: string }).error || "Unexpected error";
        if (resp.status >= 500) {
          throw new Error(`Server error — ${serverMsg}`);
        }
        // 422: genuine parse / format failure — surface as-is
        throw new Error(serverMsg);
      }

      const result = await resp.json();
      toast({
        title: `Imported ${result.messages?.length ?? 0} messages from ${result.thread?.contactName ?? "conversation"}`,
      });
      setFile(null);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4 text-primary" />
          Upload Text Message Export
        </CardTitle>
        <CardDescription>
          Upload a TXT export, PDF, or screenshot (JPG/PNG) of a text conversation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".txt,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="space-y-1">
              <Paperclip className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-muted-foreground/70">
                TXT, PDF, JPG, PNG up to 25 MB
              </p>
            </div>
          )}
        </div>

        {/* My name field */}
        <div className="space-y-1.5">
          <Label htmlFor="myName" className="text-xs">
            Your name / phone number in the export (optional)
          </Label>
          <Input
            id="myName"
            placeholder='e.g. "Me", "+1 555-0100", "John"'
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Helps identify which messages are yours so they display correctly.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGuide(true)}
            className="text-muted-foreground"
          >
            <Info className="mr-1.5 h-3.5 w-3.5" />
            How to export messages
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing with AI…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Messages
              </>
            )}
          </Button>
        </div>

        {uploading && (
          <p className="text-xs text-muted-foreground text-center">
            AI is reading and structuring the conversation — this takes 10–30 seconds.
          </p>
        )}
      </CardContent>

      {/* Export guide dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to Export Your Text Messages</DialogTitle>
            <DialogDescription>
              Follow the steps below for your device to create an export file you can upload here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {EXPORT_GUIDES.map((guide) => (
              <Card key={guide.platform} className="bg-muted/20">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-lg">{guide.icon}</span>
                    {guide.platform}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ol className="list-decimal list-inside space-y-1">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="text-sm text-muted-foreground">{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}

            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-300 text-sm">Best format: Screenshots</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs">
                If you can't export a file, take screenshots of your conversation. 
                AI can read message screenshots just like a human would.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowGuide(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  onAddToTimeline,
  isSelected,
  onSelect,
}: {
  message: SmsMessage;
  onAddToTimeline: (msg: SmsMessage) => void;
  isSelected: boolean;
  onSelect: (id: number) => void;
}) {
  const isMe = message.senderIsMe;
  return (
    <div
      className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
      onClick={() => onSelect(message.id)}
    >
      {/* Avatar */}
      <div
        className={`h-6 w-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
          isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {isMe ? "Me" : message.sender.charAt(0).toUpperCase()}
      </div>

      {/* Bubble */}
      <div className={`max-w-[72%] group relative ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {!isMe && (
          <span className="text-xs text-muted-foreground px-1">{message.sender}</span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed cursor-pointer transition-all ${
            isMe
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm"
          } ${isSelected ? "ring-2 ring-offset-1 ring-amber-400" : ""}`}
        >
          {message.content}
        </div>
        <div
          className={`flex items-center gap-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}
        >
          {message.sentAt && (
            <span className="text-[10px] text-muted-foreground px-1">
              {fmtDateShort(message.sentAt)}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onAddToTimeline(message); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary hover:underline px-1"
          >
            + Timeline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Thread viewer ────────────────────────────────────────────────────────────

function ThreadViewer({
  caseId,
  threadId,
  onBack,
}: {
  caseId: number;
  threadId: number;
  onBack: () => void;
}) {
  const { data, isLoading } = useGetTextMessageThread(caseId, threadId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [suggestions, setSuggestions] = useState<SuggestedEvent[] | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const thread = data?.thread as Thread | undefined;
  const allMessages = (data?.messages ?? []) as SmsMessage[];

  const createEvent = useCreateTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        toast({ title: "Added to timeline" });
      },
    },
  });

  const deleteThread = useDeleteTextMessageThread({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTextMessageThreadsQueryKey(caseId) });
        toast({ title: "Conversation deleted" });
        onBack();
      },
    },
  });

  const filtered = allMessages.filter((m) => {
    if (search && !m.content.toLowerCase().includes(search.toLowerCase()) && !m.sender.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDateFrom && m.sentAt && new Date(m.sentAt) < new Date(filterDateFrom)) return false;
    if (filterDateTo && m.sentAt && new Date(m.sentAt) > new Date(filterDateTo + "T23:59:59")) return false;
    return true;
  });

  function handleAddToTimeline(msg: SmsMessage) {
    createEvent.mutate({
      caseId,
      data: {
        title: `Text from ${msg.senderIsMe ? "Me" : msg.sender}`,
        eventDate: msg.sentAt ? new Date(msg.sentAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        description: msg.content,
        people: [msg.sender],
        tags: ["text message", "sms"],
      },
    });
  }

  function handleAddSelectedToTimeline() {
    const msgs = allMessages.filter((m) => selectedIds.has(m.id));
    if (msgs.length === 0) return;
    const first = msgs[0];
    const text = msgs.map((m) => `${m.senderIsMe ? "Me" : m.sender}: ${m.content}`).join("\n");
    createEvent.mutate({
      caseId,
      data: {
        title: `Text exchange with ${thread?.contactName ?? "contact"} (${msgs.length} messages)`,
        eventDate: first.sentAt ? new Date(first.sentAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        description: text.slice(0, 1000),
        people: [thread?.contactName ?? "Unknown"],
        tags: ["text message", "sms"],
      },
    });
    setSelectedIds(new Set());
  }

  async function handleSuggest() {
    setIsSuggesting(true);
    setSuggestions(null);
    setSuggestError(null);
    try {
      const resp = await fetch(`${basePath}/api/cases/${caseId}/text-messages/threads/${threadId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await resp.json();
      if (!resp.ok) {
        const serverMsg = (body as { error?: string }).error ?? `Server error (${resp.status})`;
        setSuggestError(serverMsg);
        setShowSuggestions(true);
        return;
      }
      setSuggestions(Array.isArray(body) ? body : []);
      setShowSuggestions(true);
    } catch {
      toast({ title: "Could not generate suggestions — check your connection and try again", variant: "destructive" });
    } finally {
      setIsSuggesting(false);
    }
  }

  function handleAddSuggestion(event: SuggestedEvent) {
    createEvent.mutate({
      caseId,
      data: {
        title: event.title,
        eventDate: event.estimatedDate ?? new Date().toISOString().split("T")[0],
        description: event.description,
        people: event.people,
        tags: ["text message", "sms", "ai-suggested"],
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold">{thread.contactName}</h2>
          <p className="text-xs text-muted-foreground">
            {thread.messageCount} messages · {thread.sourceFilename}
            {thread.firstMessageAt && ` · ${fmtDate(thread.firstMessageAt)} → ${fmtDate(thread.lastMessageAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={isSuggesting}
          >
            {isSuggesting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
            )}
            AI Suggestions
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteThread.mutate({ caseId, threadId })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search messages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="h-8 text-sm w-36"
          title="From date"
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="h-8 text-sm w-36"
          title="To date"
        />
        {(search || filterDateFrom || filterDateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setFilterDateFrom(""); setFilterDateTo(""); }}
            className="h-8 text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Selection bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <span className="text-sm text-amber-800 dark:text-amber-300">
            {selectedIds.size} message{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleAddSelectedToTimeline}
            >
              <CalendarPlus className="mr-1 h-3 w-3" /> Create Timeline Event
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Chat bubble list */}
      <Card>
        <ScrollArea className="h-[500px]">
          <div className="p-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No messages match your search.
              </div>
            ) : (
              filtered.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onAddToTimeline={handleAddToTimeline}
                  isSelected={selectedIds.has(msg.id)}
                  onSelect={(id) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {filtered.length !== allMessages.length && (
        <p className="text-xs text-center text-muted-foreground">
          Showing {filtered.length} of {allMessages.length} messages
        </p>
      )}

      {/* AI Suggestions dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              AI-Suggested Timeline Events
            </DialogTitle>
            <DialogDescription>
              Based on this conversation with {thread.contactName}. Review and add events that are relevant to your case.
            </DialogDescription>
          </DialogHeader>
          {suggestError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{suggestError}</AlertDescription>
            </Alert>
          ) : !suggestions || suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No significant legal events were detected in this conversation.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((event, i) => (
                <Card key={i} className="border bg-muted/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.title}</p>
                        {event.estimatedDate && (
                          <p className="text-xs text-muted-foreground">
                            <Calendar className="inline h-3 w-3 mr-1" />
                            {event.estimatedDate}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={event.confidenceLevel === "high" ? "default" : "secondary"}
                        className="text-xs capitalize shrink-0"
                      >
                        {event.confidenceLevel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    {event.people.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {event.people.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">
                            <User className="h-2.5 w-2.5 mr-1" />{p}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleAddSuggestion(event)}
                      className="w-full mt-1"
                    >
                      <CalendarPlus className="mr-2 h-3.5 w-3.5" />
                      Add to Timeline
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuggestions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TextMessagesPage({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [contactFilter, setContactFilter] = useState("");

  const { data: threads = [], isLoading } = useListTextMessageThreads(caseId, {
    query: { enabled: !!caseId, queryKey: getListTextMessageThreadsQueryKey(caseId) },
  });

  const filteredThreads = (threads as Thread[]).filter((t) =>
    !contactFilter || t.contactName.toLowerCase().includes(contactFilter.toLowerCase())
  );

  function handleUploadSuccess() {
    queryClient.invalidateQueries({ queryKey: getListTextMessageThreadsQueryKey(caseId) });
  }

  if (selectedThreadId) {
    return (
      <ThreadViewer
        caseId={caseId}
        threadId={selectedThreadId}
        onBack={() => setSelectedThreadId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Text Messages</h1>
        <p className="text-muted-foreground mt-1">
          Import text message conversations as case evidence. Messages are parsed by AI into a structured, searchable format.
        </p>
      </div>

      {/* Upload */}
      <UploadPanel caseId={caseId} onSuccess={handleUploadSuccess} />

      {/* Conversation list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Imported Conversations
            {threads.length > 0 && <Badge variant="secondary">{threads.length}</Badge>}
          </h2>
          {(threads as Thread[]).length > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by contact…"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
                className="pl-8 h-8 text-sm w-48"
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filteredThreads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No conversations imported yet</p>
              <p className="text-sm mt-1">Upload a text message export or screenshot above to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {filteredThreads.map((thread) => (
              <Card
                key={thread.id}
                className="cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setSelectedThreadId(thread.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {thread.contactName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{thread.contactName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{thread.messageCount} messages</span>
                        {thread.firstMessageAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtDate(thread.firstMessageAt)}
                          </span>
                        )}
                        <span className="truncate">{thread.sourceFilename}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
