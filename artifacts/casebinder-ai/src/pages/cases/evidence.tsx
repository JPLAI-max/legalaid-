import { useState } from "react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/dates";
import { FileText, File, Image as ImageIcon, Loader2 } from "lucide-react";
import { 
  useListEvidence, 
  getListEvidenceQueryKey,
  useCreateEvidence
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ObjectUploader } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function EvidenceUpload({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: evidence, isLoading } = useListEvidence(caseId, undefined, {
    query: { enabled: !!caseId, queryKey: getListEvidenceQueryKey(caseId) }
  });

  const createEvidence = useCreateEvidence({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEvidenceQueryKey(caseId) });
        toast({
          title: "Evidence uploaded",
          description: "File successfully added to the case.",
        });
      },
      onError: () => {
        toast({
          title: "Upload failed",
          description: "There was an error saving the evidence record.",
          variant: "destructive",
        });
      }
    }
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (fileType.includes("image")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
    if (fileType.includes("word") || fileType.includes("document")) return <FileText className="h-4 w-4 text-blue-700" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Processed</Badge>;
      case "processing":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Processing</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Evidence Upload</h1>
        <p className="text-muted-foreground mt-1">
          Upload documents, PDFs, and images related to your case.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop files here. We accept PDF, DOCX, TXT, JPG, and PNG files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-6 bg-muted/20" data-testid="upload-area">
            <ObjectUploader
              onGetUploadParameters={async (file) => {
                const res = await fetch("/api/storage/uploads/request-url", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: file.name,
                    size: file.size,
                    contentType: file.type,
                  }),
                });
                const { uploadURL } = await res.json();
                return {
                  method: "PUT",
                  url: uploadURL,
                  headers: { "Content-Type": file.type },
                };
              }}
              onComplete={(result) => {
                if (result.successful && result.successful.length > 0) {
                  result.successful.forEach((file) => {
                    if (file.response?.body?.objectPath) {
                      createEvidence.mutate({
                        caseId,
                        data: {
                          filename: file.name,
                          fileType: file.type || "application/octet-stream",
                          objectPath: (file.response?.body as { objectPath: string })?.objectPath ?? "",
                          fileSize: file.size,
                        }
                      });
                    }
                  });
                }
              }}
            >
              Select files or drop here
            </ObjectUploader>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Evidence</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : evidence?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No evidence uploaded yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Detected Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence?.map((item) => (
                  <TableRow key={item.id} data-testid={`row-evidence-${item.id}`}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getFileIcon(item.fileType)}
                        <span className="font-medium truncate max-w-[200px] md:max-w-[300px]" title={item.filename}>
                          {item.filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.uploadedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.detectedDate ? format(parseLocalDate(item.detectedDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.processingStatus)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
