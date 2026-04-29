import { useState, useEffect } from "react";
import { Save, FileText, Loader2, Clock } from "lucide-react";
import { 
  useGetCaseSummary, 
  getGetCaseSummaryQueryKey,
  useSaveCaseSummary
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CaseSummaryPage({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: summary, isLoading } = useGetCaseSummary(caseId, {
    query: { enabled: !!caseId, queryKey: getGetCaseSummaryQueryKey(caseId) }
  });

  const [content, setContent] = useState("");

  useEffect(() => {
    if (summary && !content) {
      setContent(summary.content);
    }
  }, [summary]);

  const saveSummary = useSaveCaseSummary({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCaseSummaryQueryKey(caseId) });
        toast({ title: "Summary saved successfully" });
      },
      onError: () => {
        toast({ title: "Error saving summary", variant: "destructive" });
      }
    }
  });

  const handleSave = () => {
    saveSummary.mutate({
      caseId,
      data: { content }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Case Summary</h1>
        <p className="text-muted-foreground mt-1">
          Write a concise summary of your position for the court or your attorney.
        </p>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary" />
            Summary of Position
          </CardTitle>
          <CardDescription>
            This summary will be included at the beginning of your generated export packet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Textarea
              placeholder="State your main arguments, key facts, and what you are asking the court to decide..."
              className="min-h-[400px] resize-y text-base p-4"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              data-testid="textarea-summary"
            />
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4 bg-muted/20">
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {summary ? "Last updated: " + new Date(summary.updatedAt).toLocaleString() : "Not saved yet"}
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saveSummary.isPending || !content.trim()} 
            data-testid="btn-save-summary"
          >
            {saveSummary.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Summary
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
