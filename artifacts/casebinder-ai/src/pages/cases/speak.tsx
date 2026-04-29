import { useState, useEffect } from "react";
import { Mic, Save, FileText, Lightbulb, Loader2 } from "lucide-react";
import { VoiceButton } from "@/components/ui/voice-button";
import { 
  useListTranscripts, 
  getListTranscriptsQueryKey,
  useCreateTranscript,
  useUpdateTranscript,
  useGenerateCaseSummary,
  useSuggestTimelineEvents,
  CreateTranscriptBodySource
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SpeakYourCase({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: transcripts, isLoading } = useListTranscripts(caseId, {
    query: { enabled: !!caseId, queryKey: getListTranscriptsQueryKey(caseId) }
  });

  const transcript = transcripts && transcripts.length > 0 ? transcripts[0] : null;
  const [content, setContent] = useState("");
  const [generatedSummaryText, setGeneratedSummaryText] = useState("");

  useEffect(() => {
    if (transcript && !content) {
      setContent(transcript.content);
    }
  }, [transcript]);

  const createTranscript = useCreateTranscript({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTranscriptsQueryKey(caseId) });
        toast({ title: "Transcript saved successfully." });
      },
      onError: () => toast({ title: "Error saving transcript", variant: "destructive" })
    }
  });

  const updateTranscript = useUpdateTranscript({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTranscriptsQueryKey(caseId) });
        toast({ title: "Transcript updated successfully." });
      },
      onError: () => toast({ title: "Error updating transcript", variant: "destructive" })
    }
  });

  const generateSummary = useGenerateCaseSummary({
    mutation: {
      onSuccess: (data) => {
        setGeneratedSummaryText(data.summary);
        toast({ title: "Summary generated successfully." });
      },
      onError: () => toast({ title: "Error generating summary", variant: "destructive" })
    }
  });

  const suggestEvents = useSuggestTimelineEvents({
    mutation: {
      onSuccess: () => {
        toast({ title: "Events suggested successfully. Check the Suggested Events tab." });
      },
      onError: () => toast({ title: "Error suggesting events", variant: "destructive" })
    }
  });

  const handleSave = () => {
    if (!content.trim()) return;
    if (transcript) {
      updateTranscript.mutate({
        caseId,
        transcriptId: transcript.id,
        data: { content }
      });
    } else {
      createTranscript.mutate({
        caseId,
        data: { content, source: CreateTranscriptBodySource.typed }
      });
    }
  };

  const handleGenerateSummary = () => {
    if (!transcript) {
      toast({ title: "Please save the transcript first", variant: "destructive" });
      return;
    }
    generateSummary.mutate({
      caseId,
      data: { transcriptId: transcript.id }
    });
  };

  const handleSuggestEvents = () => {
    if (!transcript) {
      toast({ title: "Please save the transcript first", variant: "destructive" });
      return;
    }
    suggestEvents.mutate({
      caseId,
      data: { transcriptId: transcript.id }
    });
  };

  const isSaving = createTranscript.isPending || updateTranscript.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Speak Your Case</h1>
        <p className="text-muted-foreground mt-1">
          Type or dictate the narrative of your case. AI will help extract events and summaries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mic className="mr-2 h-5 w-5 text-primary" />
              Case Narrative
            </CardTitle>
            <CardDescription>
              Write down everything that happened in your own words. Don't worry about formatting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="relative">
                <Textarea
                  placeholder="Start typing your story here..."
                  className="min-h-[400px] resize-y text-base p-4 pr-10"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  data-testid="textarea-narrative"
                />
                <VoiceButton
                  className="absolute top-2 right-2"
                  onTranscript={(text) => setContent((prev) => prev ? prev + " " + text : text)}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t p-4 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {transcript ? "Last saved: " + new Date(transcript.updatedAt).toLocaleString() : "Unsaved"}
            </p>
            <Button onClick={handleSave} disabled={isSaving || !content.trim()} data-testid="btn-save-transcript">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Transcript
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Actions</CardTitle>
              <CardDescription>Analyze your narrative</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3 px-4" 
                onClick={handleGenerateSummary}
                disabled={generateSummary.isPending || !transcript}
                data-testid="btn-generate-summary"
              >
                <div className="flex items-start">
                  <FileText className="mr-3 h-5 w-5 text-primary mt-0.5" />
                  <div className="text-left">
                    <div className="font-medium">Generate Case Summary</div>
                    <div className="text-xs text-muted-foreground mt-1">Draft a professional summary position</div>
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto py-3 px-4"
                onClick={handleSuggestEvents}
                disabled={suggestEvents.isPending || !transcript}
                data-testid="btn-suggest-events"
              >
                <div className="flex items-start">
                  <Lightbulb className="mr-3 h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-left">
                    <div className="font-medium">Suggest Timeline Events</div>
                    <div className="text-xs text-muted-foreground mt-1">Extract dates and facts automatically</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          {generatedSummaryText && (
            <Alert className="bg-primary/5 border-primary/20">
              <FileText className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary font-medium">Draft Summary Generated</AlertTitle>
              <AlertDescription className="mt-2 text-sm">
                <div className="max-h-60 overflow-y-auto pr-2 whitespace-pre-wrap">
                  {generatedSummaryText}
                </div>
                <p className="mt-4 text-xs font-medium text-muted-foreground">
                  Head to the Summary tab to save or edit this draft.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
