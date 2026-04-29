import { useState } from "react";
import { format } from "date-fns";
import { Plus, Edit2, Trash2, Calendar, FileText, Users, Tag, Loader2 } from "lucide-react";
import { VoiceButton } from "@/components/ui/voice-button";
import { 
  useListTimelineEvents, 
  getListTimelineEventsQueryKey,
  useCreateTimelineEvent,
  useUpdateTimelineEvent,
  useDeleteTimelineEvent
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function TimelineBuilder({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: events, isLoading } = useListTimelineEvents(caseId, {
    query: { enabled: !!caseId, queryKey: getListTimelineEventsQueryKey(caseId) }
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
    attorneyNote: ""
  });

  const createEvent = useCreateTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Event created" });
      },
      onError: () => toast({ title: "Failed to create event", variant: "destructive" })
    }
  });

  const updateEvent = useUpdateTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        setIsDialogOpen(false);
        resetForm();
        toast({ title: "Event updated" });
      },
      onError: () => toast({ title: "Failed to update event", variant: "destructive" })
    }
  });

  const deleteEvent = useDeleteTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        toast({ title: "Event deleted" });
      },
      onError: () => toast({ title: "Failed to delete event", variant: "destructive" })
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      eventDate: "",
      eventTime: "",
      description: "",
      people: "",
      tags: "",
      attorneyNote: ""
    });
  };

  const handleEdit = (event: any) => {
    setEditingId(event.id);
    setFormData({
      title: event.title,
      eventDate: event.eventDate,
      eventTime: event.eventTime || "",
      description: event.description || "",
      people: event.people?.join(", ") || "",
      tags: event.tags?.join(", ") || "",
      attorneyNote: event.attorneyNote || ""
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
      people: formData.people ? formData.people.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      tags: formData.tags ? formData.tags.split(",").map(s => s.trim()).filter(Boolean) : undefined,
      attorneyNote: formData.attorneyNote || undefined
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
        <Button 
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
          data-testid="btn-add-event"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Event
        </Button>
      </div>

      <div className="relative pl-8 md:pl-12 border-l-2 border-primary/20 space-y-8 py-4">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="relative">
              <div className="absolute -left-[41px] md:-left-[57px] top-1 h-5 w-5 rounded-full border-2 border-primary bg-background" />
              <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-12 w-full" /></CardContent>
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
                  {format(new Date(event.eventDate), "PP")}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(event)} data-testid={`btn-edit-event-${event.id}`}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(event.id)} data-testid={`btn-delete-event-${event.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {event.description && (
                    <p className="text-muted-foreground mb-4 whitespace-pre-wrap">
                      {event.description}
                    </p>
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
                          {event.people.map(p => (
                            <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Tags:</span>
                        <div className="flex gap-1 flex-wrap">
                          {event.tags.map(t => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

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
                  id="eventDate" 
                  type="date" 
                  value={formData.eventDate}
                  onChange={(e) => setFormData({...formData, eventDate: e.target.value})}
                  required
                  data-testid="input-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventTime">Time (Optional)</Label>
                <Input 
                  id="eventTime" 
                  type="time" 
                  value={formData.eventTime}
                  onChange={(e) => setFormData({...formData, eventTime: e.target.value})}
                  data-testid="input-event-time"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <div className="relative">
                <Input 
                  id="title" 
                  placeholder="Brief, descriptive title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="pr-9"
                  data-testid="input-event-title"
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
                  id="description" 
                  placeholder="What happened? Stick to the facts."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="min-h-[100px] pr-10"
                  data-testid="input-event-desc"
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
                  id="attorneyNote" 
                  placeholder="Why is this important? Any context your attorney needs?"
                  value={formData.attorneyNote}
                  onChange={(e) => setFormData({...formData, attorneyNote: e.target.value})}
                  className="min-h-[80px] pr-10"
                  data-testid="input-event-note"
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
                    id="people" 
                    placeholder="John Doe, Jane Smith"
                    value={formData.people}
                    onChange={(e) => setFormData({...formData, people: e.target.value})}
                    className="pr-9"
                    data-testid="input-event-people"
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
                    id="tags" 
                    placeholder="financial, email, important"
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    className="pr-9"
                    data-testid="input-event-tags"
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
                {(createEvent.isPending || updateEvent.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
