import { useGetCaseStats, getGetCaseStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Clock, Lightbulb, Download } from "lucide-react";

export function CaseOverview({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { data: stats, isLoading } = useGetCaseStats(caseId, {
    query: { enabled: !!caseId, queryKey: getGetCaseStatsQueryKey(caseId) }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">
          A high-level view of your case progress and materials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evidence Uploaded</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-evidence">{stats?.evidenceCount || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Documents and files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeline Events</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-timeline">{stats?.timelineEventCount || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Chronological entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suggested Events</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-suggested">{stats?.suggestedEventCount || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">From transcripts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Export Status</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold capitalize" data-testid="stat-export">
                {stats?.lastExportStatus ? stats.lastExportStatus : "None"}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Latest packet generation</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
