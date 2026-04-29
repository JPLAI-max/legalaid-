import { useState } from "react";
import { Search as SearchIcon, FileText, Filter, CalendarPlus, Plus } from "lucide-react";
import { VoiceButton } from "@/components/ui/voice-button";
import { format } from "date-fns";
import { 
  useListEvidence, 
  getListEvidenceQueryKey,
  useCreateTimelineEvent,
  useAttachEvidenceToEvent,
  getListTimelineEventsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function EvidenceSearch({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Use a simple timeout for debouncing (in a real app, use useDebounce)
  // Just querying immediately for simplicity here, relying on the hook's caching
  
  const { data: evidence, isLoading } = useListEvidence(
    caseId, 
    { search: searchQuery || undefined }, 
    { query: { enabled: !!caseId, queryKey: getListEvidenceQueryKey(caseId, { search: searchQuery || undefined }) } }
  );

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const createEvent = useCreateTimelineEvent({
    mutation: {
      onSuccess: (event) => {
        if (selectedEvidenceId) {
          attachEvidence.mutate({
            caseId,
            eventId: event.id,
            data: { evidenceId: selectedEvidenceId }
          });
        } else {
          finishEventCreation();
        }
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create event", variant: "destructive" });
      }
    }
  });

  const attachEvidence = useAttachEvidenceToEvent({
    mutation: {
      onSuccess: () => {
        finishEventCreation();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to attach evidence", variant: "destructive" });
      }
    }
  });

  const finishEventCreation = () => {
    setIsDialogOpen(false);
    setEventTitle("");
    setEventDate("");
    setSelectedEvidenceId(null);
    queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
    toast({ title: "Success", description: "Added to timeline" });
  };

  const handleAddToTimeline = (evidenceId: number) => {
    setSelectedEvidenceId(evidenceId);
    setIsDialogOpen(true);
  };

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventDate) return;
    
    createEvent.mutate({
      caseId,
      data: {
        title: eventTitle,
        eventDate,
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Evidence Library</h1>
        <p className="text-muted-foreground mt-1">
          Search your case files and add relevant documents to your timeline.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search filenames, content, people..."
            className="pl-8 pr-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-evidence"
          />
          <VoiceButton
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
            onTranscript={(text) => setSearchQuery((prev) => prev ? prev + " " + text : text)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)
        ) : evidence?.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <p className="text-muted-foreground">No evidence matches your search.</p>
          </div>
        ) : (
          evidence?.map((item) => (
            <Card key={item.id} data-testid={`card-evidence-${item.id}`}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">{item.filename}</h3>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {item.textPreview || "No text preview available."}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {item.detectedDate && (
                        <Badge variant="outline">Detected Date: {format(new Date(item.detectedDate), "PP")}</Badge>
                      )}
                      {item.tags?.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                      {item.people?.map(person => (
                        <Badge key={person} variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-100">{person}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleAddToTimeline(item.id)}
                      data-testid={`btn-add-timeline-${item.id}`}
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Add to Timeline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Timeline</DialogTitle>
            <DialogDescription>
              Create a new timeline event and attach this evidence to it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEventSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="eventTitle">Event Title</Label>
              <Input 
                id="eventTitle" 
                placeholder="e.g. Email from Landlord" 
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                required
                data-testid="input-event-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date</Label>
              <Input 
                id="eventDate" 
                type="date" 
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                data-testid="input-event-date"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createEvent.isPending || attachEvidence.isPending}>
                {(createEvent.isPending || attachEvidence.isPending) ? "Adding..." : "Add to Timeline"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
