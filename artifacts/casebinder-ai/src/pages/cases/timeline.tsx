import { useState, useRef } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  Plus, Edit2, Trash2, Calendar, FileText, Users, Tag, Loader2,
  Mail, MessageSquare, ImageIcon, File, Download, X,
} from "lucide-react";
import { parseLocalDate } from "@/lib/dates";
import { VoiceButton } from "@/components/ui/voice-button";
import {
  useListTimelineEvents,
  getListTimelineEventsQueryKey,
  useCreateTimelineEvent,
  useUpdateTimelineEvent,
  useDeleteTimelineEvent,
  useListEventEvidence,
  getListEventEvidenceQueryKey,
  type Evidence,
  type TimelineEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function getFileUrl(objectPath: string): string {
  // objectPath  = "/objects/uploads/<uuid>"
  // serves via  = /api/storage/objects/uploads/<uuid>
  return `${basePath}/api${objectPath.replace("/objects", "/storage/objects")}`;
}

type EvidenceKind = "email" | "image" | "text-message" | "document";

function detectKind(ev: Evidence): EvidenceKind {
  const ft = ev.fileType.toLowerCase();
  const fn = ev.filename.toLowerCase();
  if (ft.includes("email") || ft.includes("message/rfc822") || fn.endsWith(".eml")) return "email";
  if (ft.startsWith("image/")) return "image";
  if (fn.includes("sms") || fn.includes("text-message") || fn.includes("imessage") || ft.includes("text-message"))
    return "text-message";
  return "document";
}

function KindIcon({ kind, className }: { kind: EvidenceKind; className?: string }) {
  const cls = className ?? "h-3.5 w-3.5";
  if (kind === "email") return <Mail className={cls} />;
  if (kind === "image") return <ImageIcon className={cls} />;
  if (kind === "text-message") return <MessageSquare className={cls} />;
  return <File className={cls} />;
}

function chipLabel(ev: Evidence): string {
  if (ev.filename.length > 28) return ev.filename.slice(0, 26) + "…";
  return ev.filename;
}

// ---------------------------------------------------------------------------
// Evidence popover quick-preview
// ---------------------------------------------------------------------------

function EvidencePopoverContent({ ev }: { ev: Evidence }) {
  const kind = detectKind(ev);
  const fileUrl = getFileUrl(ev.objectPath);

  return (
    <div className="w-64 space-y-2 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <KindIcon kind={kind} className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{ev.filename}</span>
      </div>
      <Separator />

      {kind === "image" ? (
        <div className="overflow-hidden rounded-md border bg-muted">
          <img
            src={fileUrl}
            alt={ev.filename}
            className="max-h-36 w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : kind === "email" ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          {ev.detectedDate && (
            <p><span className="font-medium text-foreground">Date:</span> {format(parseLocalDate(ev.detectedDate), "PP")}</p>
          )}
          {ev.people.length > 0 && (
            <p><span className="font-medium text-foreground">People:</span> {ev.people.join(", ")}</p>
          )}
          {ev.textPreview && (
            <p className="line-clamp-4 mt-1 border-t pt-1">{ev.textPreview}</p>
          )}
        </div>
      ) : (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Type:</span> {ev.fileType}</p>
          {ev.detectedDate && (
            <p><span className="font-medium text-foreground">Date:</span> {format(parseLocalDate(ev.detectedDate), "PP")}</p>
          )}
          {ev.fileSize != null && (
            <p><span className="font-medium text-foreground">Size:</span> {(ev.fileSize / 1024).toFixed(1)} KB</p>
          )}
          {ev.textPreview && (
            <p className="line-clamp-3 mt-1 border-t pt-1">{ev.textPreview}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evidence full-viewer dialog
// ---------------------------------------------------------------------------

function EvidenceViewerDialog({
  ev,
  open,
  onClose,
}: {
  ev: Evidence | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!ev) return null;
  const kind = detectKind(ev);
  const fileUrl = getFileUrl(ev.objectPath);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <KindIcon kind={kind} className="h-5 w-5 text-muted-foreground" />
            <DialogTitle className="truncate">{ev.filename}</DialogTitle>
          </div>
          <DialogDescription>
            {ev.fileType}
            {ev.detectedDate ? ` · ${format(parseLocalDate(ev.detectedDate), "PP")}` : ""}
            {ev.fileSize != null ? ` · ${(ev.fileSize / 1024).toFixed(1)} KB` : ""}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 rounded-md border bg-muted/30 p-4">
          {kind === "image" ? (
            <img
              src={fileUrl}
              alt={ev.filename}
              className="mx-auto max-w-full rounded-md object-contain"
            />
          ) : kind === "email" ? (
            <div className="space-y-3 text-sm">
              {ev.people.length > 0 && (
                <div className="rounded-md bg-background p-3 text-xs space-y-1 border">
                  <p><span className="font-semibold">People:</span> {ev.people.join(", ")}</p>
                  {ev.tags.length > 0 && <p><span className="font-semibold">Tags:</span> {ev.tags.join(", ")}</p>}
                  {ev.detectedDate && <p><span className="font-semibold">Date:</span> {format(parseLocalDate(ev.detectedDate), "PPpp")}</p>}
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {ev.textPreview ?? "No preview available. Download to view the full content."}
              </pre>
            </div>
          ) : kind === "text-message" ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {ev.textPreview ?? "No preview available. Download to view the full content."}
            </pre>
          ) : (
            <div className="space-y-2 text-sm">
              {ev.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ev.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {ev.textPreview ?? "No text preview available. Download to view the file."}
              </pre>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button asChild>
            <a href={fileUrl} download={ev.filename}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Evidence chip with hover-popover (desktop) / tap-to-dialog (mobile)
// ---------------------------------------------------------------------------

function EvidenceChip({
  ev,
  onOpenViewer,
}: {
  ev: Evidence;
  onOpenViewer: (ev: Evidence) => void;
}) {
  const isMobile = useIsMobile();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kind = detectKind(ev);

  const handleClick = () => {
    setPopoverOpen(false);
    onOpenViewer(ev);
  };

  const handleMouseEnter = () => {
    if (isMobile) return;
    hoverTimer.current = setTimeout(() => setPopoverOpen(true), 250);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPopoverOpen(false);
  };

  return (
    <Popover open={!isMobile && popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors max-w-[180px]"
          title={ev.filename}
        >
          <KindIcon kind={kind} className="h-3 w-3 shrink-0" />
          <span className="truncate">{chipLabel(ev)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="p-3"
        onMouseEnter={() => setPopoverOpen(true)}
        onMouseLeave={handleMouseLeave}
      >
        <EvidencePopoverContent ev={ev} />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Evidence row for a single event — fetches its own evidence
// ---------------------------------------------------------------------------

function EventEvidenceRow({ caseId, eventId }: { caseId: number; eventId: number }) {
  const [viewerEv, setViewerEv] = useState<Evidence | null>(null);

  const { data: evidence } = useListEventEvidence(caseId, eventId, {
    query: { queryKey: getListEventEvidenceQueryKey(caseId, eventId) },
  });

  if (!evidence || evidence.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 pt-3 mt-1 border-t">
        <span className="text-xs text-muted-foreground self-center mr-0.5">Evidence:</span>
        {evidence.map((ev) => (
          <EvidenceChip key={ev.id} ev={ev} onOpenViewer={setViewerEv} />
        ))}
      </div>
      <EvidenceViewerDialog
        ev={viewerEv}
        open={!!viewerEv}
        onClose={() => setViewerEv(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/** Extract the source SMS thread ID from internal event tags, e.g. "sms-thread:42" → 42 */
function getSmsThreadId(tags: string[]): number | null {
  const tag = tags.find((t) => t.startsWith("sms-thread:"));
  if (!tag) return null;
  const n = parseInt(tag.split(":")[1]);
  return isNaN(n) ? null : n;
}

/** Strip internal metadata tags from the user-visible tag list */
function visibleTags(tags: string[]): string[] {
  return tags.filter((t) => !t.startsWith("sms-thread:") && !t.startsWith("sms-msgs:"));
}

export function TimelineBuilder({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: events, isLoading } = useListTimelineEvents(caseId, {
    query: { enabled: !!caseId, queryKey: getListTimelineEventsQueryKey(caseId) },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    eventDate: "",
    eventTime: "",
    description: "",
    people: "",
    tags: "",
    attorneyNote: "",
  });

  const createEvent = useCreateTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Event created" });
      },
      onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
    },
  });

  const updateEvent = useUpdateTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Event updated" });
      },
      onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
    },
  });

  const deleteEvent = useDeleteTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        toast({ title: "Event deleted" });
      },
      onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({ title: "", eventDate: "", eventTime: "", description: "", people: "", tags: "", attorneyNote: "" });
  };

  const handleEdit = (event: TimelineEvent) => {
    setEditingId(event.id);
    setFormData({
      title: event.title,
      eventDate: event.eventDate,
      eventTime: event.eventTime ?? "",
      description: event.description ?? "",
      people: event.people?.join(", ") ?? "",
      tags: event.tags?.join(", ") ?? "",
      attorneyNote: event.attorneyNote ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this event?")) {
      deleteEvent.mutate({ caseId, eventId: id });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.eventDate) return;

    const payload = {
      title: formData.title,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime || undefined,
      description: formData.description || undefined,
      people: formData.people ? formData.people.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      tags: formData.tags ? formData.tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      attorneyNote: formData.attorneyNote || undefined,
    };

    if (editingId) {
      updateEvent.mutate({ caseId, eventId: editingId, data: payload });
    } else {
      createEvent.mutate({ caseId, data: payload });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timeline Builder</h1>
          <p className="text-muted-foreground mt-1">
            Build a chronological narrative of the events in your case.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} data-testid="btn-add-event">
          <Plus className="mr-2 h-4 w-4" /> Add Event
        </Button>
      </div>

      <div className="relative pl-8 md:pl-12 border-l-2 border-primary/20 space-y-8 py-4">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[41px] md:-left-[57px] top-1 h-5 w-5 rounded-full border-2 border-primary bg-background" />
              <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <div className="p-6 pt-0"><Skeleton className="h-12 w-full" /></div>
              </Card>
            </div>
          ))
        ) : events?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10 -ml-8 md:-ml-12">
            <h3 className="text-lg font-medium">No events yet</h3>
            <p className="text-muted-foreground mt-2 mb-4">Start building your timeline by adding your first event.</p>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add First Event
            </Button>
          </div>
        ) : (
          events?.map((event) => (
            <div key={event.id} className="relative group" data-testid={`event-item-${event.id}`}>
              <div className="absolute -left-[41px] md:-left-[57px] top-4 h-5 w-5 rounded-full border-2 border-primary bg-background shadow-sm group-hover:bg-primary transition-colors" />

              <div className="flex flex-col md:flex-row gap-2 mb-2 text-sm">
                <span className="font-bold text-foreground flex items-center">
                  <Calendar className="mr-1 h-3.5 w-3.5" />
                  {format(parseLocalDate(event.eventDate), "PP")}
                </span>
                {event.eventTime && (
                  <span className="text-muted-foreground ml-2">{event.eventTime}</span>
                )}
              </div>

              <Card className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 md:p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold">{event.title}</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEdit(event)}
                        data-testid={`btn-edit-event-${event.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(event.id)}
                        data-testid={`btn-delete-event-${event.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{event.description}</p>
                  )}

                  {event.attorneyNote && (
                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm">
                      <p className="font-semibold text-blue-900 dark:text-blue-300 flex items-center mb-1">
                        <FileText className="mr-2 h-4 w-4" /> Attorney Note
                      </p>
                      <p className="text-blue-800 dark:text-blue-200">{event.attorneyNote}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t text-sm">
                    {event.people && event.people.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">People:</span>
                        <div className="flex gap-1 flex-wrap">
                          {event.people.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleTags(event.tags ?? []).length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Tags:</span>
                        <div className="flex gap-1 flex-wrap">
                          {visibleTags(event.tags ?? []).map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Evidence chips — fetched per-event */}
                  <EventEvidenceRow caseId={caseId} eventId={event.id} />

                  {/* Source conversation chip for AI-suggested events from text threads */}
                  {getSmsThreadId(event.tags ?? []) !== null && (
                    <div className="flex items-center gap-1.5 pt-2">
                      <span className="text-xs text-muted-foreground">Source:</span>
                      <button
                        onClick={() =>
                          setLocation(`/cases/${caseId}/text-messages?thread=${getSmsThreadId(event.tags ?? [])}`)
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        title="Open source conversation"
                      >
                        <MessageSquare className="h-3 w-3 shrink-0" />
                        Text conversation
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* ── Add / Edit event dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event" : "Add Timeline Event"}</DialogTitle>
            <DialogDescription>
              Details added here will appear in your chronological timeline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventDate">Date *</Label>
                <Input
                  id="eventDate" type="date" value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  required data-testid="input-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventTime">Time (Optional)</Label>
                <Input
                  id="eventTime" type="time" value={formData.eventTime}
                  onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                  data-testid="input-event-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <div className="relative">
                <Input
                  id="title" placeholder="Brief, descriptive title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required className="pr-9" data-testid="input-event-title"
                />
                <VoiceButton
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  onTranscript={(text) => setFormData((f) => ({ ...f, title: f.title ? f.title + " " + text : text }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <div className="relative">
                <Textarea
                  id="description" placeholder="What happened? Stick to the facts."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-[100px] pr-10" data-testid="input-event-desc"
                />
                <VoiceButton
                  className="absolute top-2 right-2"
                  onTranscript={(text) => setFormData((f) => ({ ...f, description: f.description ? f.description + " " + text : text }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attorneyNote">Note for Attorney (Optional)</Label>
              <div className="relative">
                <Textarea
                  id="attorneyNote" placeholder="Why is this important? Any context your attorney needs?"
                  value={formData.attorneyNote}
                  onChange={(e) => setFormData({ ...formData, attorneyNote: e.target.value })}
                  className="min-h-[80px] pr-10" data-testid="input-event-note"
                />
                <VoiceButton
                  className="absolute top-2 right-2"
                  onTranscript={(text) => setFormData((f) => ({ ...f, attorneyNote: f.attorneyNote ? f.attorneyNote + " " + text : text }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="people">People (comma separated)</Label>
                <div className="relative">
                  <Input
                    id="people" placeholder="John Doe, Jane Smith"
                    value={formData.people}
                    onChange={(e) => setFormData({ ...formData, people: e.target.value })}
                    className="pr-9" data-testid="input-event-people"
                  />
                  <VoiceButton
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    onTranscript={(text) => setFormData((f) => ({ ...f, people: f.people ? f.people + ", " + text : text }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <div className="relative">
                  <Input
                    id="tags" placeholder="financial, email, important"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="pr-9" data-testid="input-event-tags"
                  />
                  <VoiceButton
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    onTranscript={(text) => setFormData((f) => ({ ...f, tags: f.tags ? f.tags + ", " + text : text }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createEvent.isPending || updateEvent.isPending}>
                {(createEvent.isPending || updateEvent.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingId ? "Save Changes" : "Add Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
