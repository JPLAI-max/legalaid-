import { format } from "date-fns";
import { Check, X, Calendar, Users, Lightbulb, Search, Loader2 } from "lucide-react";
import { 
  useListSuggestedEvents, 
  getListSuggestedEventsQueryKey,
  useAcceptSuggestedEvent,
  useIgnoreSuggestedEvent,
  SuggestedEventStatus,
  SuggestedEventConfidenceLevel
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SuggestedEventsPage({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: suggestedEvents, isLoading } = useListSuggestedEvents(caseId, {
    query: { enabled: !!caseId, queryKey: getListSuggestedEventsQueryKey(caseId) }
  });

  const acceptEvent = useAcceptSuggestedEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSuggestedEventsQueryKey(caseId) });
        toast({ title: "Event added to timeline" });
      },
      onError: () => toast({ title: "Failed to add event", variant: "destructive" })
    }
  });

  const ignoreEvent = useIgnoreSuggestedEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSuggestedEventsQueryKey(caseId) });
        toast({ title: "Event ignored" });
      },
      onError: () => toast({ title: "Failed to ignore event", variant: "destructive" })
    }
  });

  const handleAccept = (eventId: number) => {
    acceptEvent.mutate({ caseId, suggestedEventId: eventId });
  };

  const handleIgnore = (eventId: number) => {
    ignoreEvent.mutate({ caseId, suggestedEventId: eventId });
  };

  const pendingEvents = suggestedEvents?.filter(e => e.status === SuggestedEventStatus.pending) || [];
  const handledEvents = suggestedEvents?.filter(e => e.status !== SuggestedEventStatus.pending) || [];

  const getConfidenceBadge = (level: SuggestedEventConfidenceLevel) => {
    switch (level) {
      case "high": return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">High Confidence</Badge>;
      case "medium": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium Confidence</Badge>;
      case "low": return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">Low Confidence</Badge>;
      default: return null;
    }
  };

  const renderEventCard = (event: any, isHandled: boolean) => (
    <Card key={event.id} className={isHandled ? "opacity-75 bg-muted/50" : ""} data-testid={`suggested-event-${event.id}`}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-start justify-between">
              <h3 className="text-xl font-bold">{event.title}</h3>
              <div className="flex gap-2 shrink-0 ml-4">
                {isHandled ? (
                  <Badge variant="outline" className={event.status === "accepted" ? "text-green-600 border-green-200" : "text-muted-foreground"}>
                    {event.status === "accepted" ? "Added to Timeline" : "Ignored"}
                  </Badge>
                ) : (
                  getConfidenceBadge(event.confidenceLevel)
                )}
              </div>
            </div>

            <div className="flex items-center text-sm font-medium">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              {event.estimatedDate ? format(new Date(event.estimatedDate), "PP") : "Unknown Date"}
            </div>

            <p className="text-muted-foreground text-sm">
              {event.description}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-sm">
              {event.people && event.people.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">People:</span>
                  <div className="flex gap-1 flex-wrap">
                    {event.people.map((p: string) => (
                      <Badge key={p} variant="secondary" className="text-xs bg-blue-50 text-blue-700">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!isHandled && event.suggestedSearchTerms && event.suggestedSearchTerms.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                  <Search className="h-3.5 w-3.5" />
                  <span>Suggested evidence searches:</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {event.suggestedSearchTerms.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs bg-background">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isHandled && (
            <div className="flex md:flex-col gap-2 shrink-0 justify-start md:justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 mt-2 md:mt-0">
              <Button 
                className="w-full" 
                onClick={() => handleAccept(event.id)}
                disabled={acceptEvent.isPending || ignoreEvent.isPending}
                data-testid={`btn-accept-event-${event.id}`}
              >
                <Check className="mr-2 h-4 w-4" /> Add
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleIgnore(event.id)}
                disabled={acceptEvent.isPending || ignoreEvent.isPending}
                data-testid={`btn-ignore-event-${event.id}`}
              >
                <X className="mr-2 h-4 w-4" /> Ignore
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suggested Events</h1>
        <p className="text-muted-foreground mt-1">
          AI-extracted events from your narrative transcripts. Review and add them to your timeline.
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-2 mb-6">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="handled" data-testid="tab-handled">
            Handled ({handledEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            [1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)
          ) : pendingEvents.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-4">
                <Lightbulb className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-medium">No pending suggestions</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Generate more suggestions from the "Speak Your Case" tab, or you've already reviewed them all.
              </p>
            </div>
          ) : (
            pendingEvents.map(e => renderEventCard(e, false))
          )}
        </TabsContent>

        <TabsContent value="handled" className="space-y-4">
          {handledEvents.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-muted/5">
              <p className="text-muted-foreground">No handled events to show.</p>
            </div>
          ) : (
            handledEvents.map(e => renderEventCard(e, true))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
