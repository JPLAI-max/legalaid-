import { useState } from "react";
import { format } from "date-fns";
import { FileText, Download, FileArchive, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { 
  useListExports, 
  getListExportsQueryKey,
  useCreateExport,
  CreateExportBodyExportType
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ExportPage({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: exports, isLoading } = useListExports(caseId, {
    query: { enabled: !!caseId, queryKey: getListExportsQueryKey(caseId) }
  });

  const createExport = useCreateExport({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExportsQueryKey(caseId) });
        toast({ title: "Export started", description: "Your packet is being generated." });
      },
      onError: () => toast({ title: "Export failed to start", variant: "destructive" })
    }
  });

  const handleGeneratePdf = () => {
    createExport.mutate({
      caseId,
      data: { exportType: CreateExportBodyExportType.pdf }
    });
  };

  const handleGenerateZip = () => {
    createExport.mutate({
      caseId,
      data: { exportType: CreateExportBodyExportType.zip }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "pending": return <Clock className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
      case "processing": return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Processing</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "pending": return <Badge variant="outline">Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Case Packet</h1>
        <p className="text-muted-foreground mt-1">
          Generate professional, court-ready packets containing your timeline and evidence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Packet Contents</CardTitle>
            <CardDescription>
              Your exported packet will automatically be structured in the following order:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">1</div>
                <div>
                  <h4 className="font-semibold text-foreground">Cover Page</h4>
                  <p className="text-sm text-muted-foreground">Case name, type, parties involved, and generation date.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">2</div>
                <div>
                  <h4 className="font-semibold text-foreground">Case Summary</h4>
                  <p className="text-sm text-muted-foreground">The position summary you drafted in the Summary tab.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">3</div>
                <div>
                  <h4 className="font-semibold text-foreground">Chronological Timeline</h4>
                  <p className="text-sm text-muted-foreground">All events sorted by date, including descriptions and linked exhibit references.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">4</div>
                <div>
                  <h4 className="font-semibold text-foreground">Exhibit Index</h4>
                  <p className="text-sm text-muted-foreground">A numbered table of contents for all attached evidence.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">5</div>
                <div>
                  <h4 className="font-semibold text-foreground">Supporting Evidence</h4>
                  <p className="text-sm text-muted-foreground">Full copies of all uploaded documents and images.</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t bg-muted/20">
            <Button 
              className="w-full sm:w-auto" 
              onClick={handleGeneratePdf}
              disabled={createExport.isPending}
              data-testid="btn-generate-pdf"
            >
              {createExport.isPending && createExport.variables?.data.exportType === 'pdf' 
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                : <FileText className="mr-2 h-4 w-4" />}
              Generate PDF Packet
            </Button>
            <Button 
              variant="outline" 
              className="w-full sm:w-auto bg-background"
              onClick={handleGenerateZip}
              disabled={createExport.isPending}
              data-testid="btn-generate-zip"
            >
              {createExport.isPending && createExport.variables?.data.exportType === 'zip' 
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                : <FileArchive className="mr-2 h-4 w-4" />}
              Download ZIP Archive
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Details</CardTitle>
            <CardDescription>Format options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-foreground mb-1">PDF Packet</h4>
              <p className="text-muted-foreground">Best for printing, emailing to your attorney, or bringing to court. Merges all documents into a single file with page numbers.</p>
            </div>
            <div className="pt-4 border-t">
              <h4 className="font-medium text-foreground mb-1">ZIP Archive</h4>
              <p className="text-muted-foreground">Best for digital delivery. Keeps original files separate but organized in numbered folders matching the exhibit index.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>Previously generated packets for this case.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : exports?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              No exports generated yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports?.map((exp) => (
                    <TableRow key={exp.id} data-testid={`row-export-${exp.id}`}>
                      <TableCell className="font-medium">
                        {format(new Date(exp.createdAt), "PP p")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-muted-foreground">
                          {exp.exportType === "pdf" ? <FileText className="mr-2 h-4 w-4" /> : <FileArchive className="mr-2 h-4 w-4" />}
                          <span className="uppercase">{exp.exportType}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(exp.status)}
                          {getStatusBadge(exp.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {exp.status === "completed" && exp.objectPath && (
                          <Button variant="ghost" size="sm" asChild data-testid={`btn-download-${exp.id}`}>
                            <a href={`/api/storage${exp.objectPath}`} download target="_blank" rel="noreferrer">
                              <Download className="mr-2 h-4 w-4" /> Download
                            </a>
                          </Button>
                        )}
                        {exp.status === "failed" && (
                          <span className="text-sm text-muted-foreground">Failed</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
