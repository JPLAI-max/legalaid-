import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Briefcase, ChevronRight, AlertCircle } from "lucide-react";
import { useListCases } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Dashboard() {
  const { data: cases, isLoading, error } = useListCases();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading cases</AlertTitle>
          <AlertDescription>
            There was a problem loading your cases. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-dashboard">My Cases</h1>
        <Link href="/cases/new">
          <Button data-testid="btn-new-case">
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : cases?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-muted/30 border-dashed">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
            <Briefcase className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">No cases yet</h2>
          <p className="text-muted-foreground max-w-[500px] mb-8">
            Create your first case to start organizing evidence, building timelines, and preparing your legal packet.
          </p>
          <Link href="/cases/new">
            <Button size="lg" data-testid="btn-create-first-case">
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Case
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases?.map((c) => (
            <Card key={c.id} className="flex flex-col hover:border-primary/50 transition-colors" data-testid={`card-case-${c.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl line-clamp-1" title={c.name}>
                    {c.name}
                  </CardTitle>
                </div>
                <div className="text-sm text-muted-foreground capitalize font-medium">
                  {c.caseType.replace("_", " ")}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {c.description || "No description provided."}
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><span className="font-medium text-foreground">Parties:</span> {c.parties}</div>
                  {c.attorneyName && <div><span className="font-medium text-foreground">Attorney:</span> {c.attorneyName}</div>}
                  <div className="pt-2 text-[11px]">Last updated: {format(new Date(c.updatedAt), "PP")}</div>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t">
                <Link href={`/cases/${c.id}/overview`} className="w-full">
                  <Button variant="ghost" className="w-full justify-between" data-testid={`btn-open-case-${c.id}`}>
                    Open Workspace
                    <ChevronRight className="h-4 w-4 ml-2 text-muted-foreground" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
