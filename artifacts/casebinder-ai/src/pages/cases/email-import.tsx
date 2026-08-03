import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, parseISO, isValid } from "date-fns";
import {
  Mail,
  Loader2,
  Paperclip,
  CheckSquare,
  Square,
  Eye,
  Download,
  Clock,
  Trash2,
  Shield,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
} from "lucide-react";
import {
  useListEmailConnections,
  getListEmailConnectionsQueryKey,
  useDeleteEmailConnection,
  useSearchCaseEmails,
  useImportCaseEmails,
  useListImportedEmails,
  getListImportedEmailsQueryKey,
  useCreateTimelineEvent,
  getListTimelineEventsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatEmailDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, "MMM d, yyyy h:mm a");
  } catch {
    return dateStr;
  }
}

interface EmailResult {
  externalId: string;
  provider: string;
  date?: string | null;
  from?: string | null;
  to?: string | null;
  subject?: string | null;
  snippet?: string | null;
  hasAttachment: boolean;
  labelIds?: string[] | null;
}

interface ImportedEmail {
  id: number;
  evidenceId: number;
  provider: string;
  externalId?: string | null;
  sender?: string | null;
  recipients?: string | null;
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
  hasAttachment: boolean;
  emailDate?: string | null;
  importedAt: string;
}

export function EmailImportPage({ params }: { params: { caseId: string } }) {
  const caseId = parseInt(params.caseId);
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse query params for OAuth feedback
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const emailConnected = searchParams.get("email_connected");
  const emailError = searchParams.get("email_error");
  const errorProvider = searchParams.get("provider");

  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [setupProvider, setSetupProvider] = useState<"gmail" | "outlook" | null>(null);
  const [viewEmail, setViewEmail] = useState<ImportedEmail | null>(null);
  const [viewSearchResult, setViewSearchResult] = useState<EmailResult | null>(null);

  // Search filters
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);
  const [filterFolder, setFilterFolder] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const [searchResults, setSearchResults] = useState<EmailResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const { data: connections = [], isLoading: connectionsLoading } = useListEmailConnections({
    query: { queryKey: getListEmailConnectionsQueryKey() },
  });

  const { data: importedEmails = [], isLoading: importedLoading } = useListImportedEmails(caseId, {
    query: { enabled: !!caseId, queryKey: getListImportedEmailsQueryKey(caseId) },
  });

  const deleteConnection = useDeleteEmailConnection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmailConnectionsQueryKey() });
        toast({ title: "Email account disconnected" });
      },
    },
  });

  const searchEmails = useSearchCaseEmails({
    mutation: {
      onSuccess: (results) => {
        setSearchResults(results as EmailResult[]);
        setSelected(new Set());
        setHasSearched(true);
        setFiltersExpanded(false);
      },
      onError: () => {
        toast({ title: "Search failed", description: "Could not reach the email provider.", variant: "destructive" });
      },
    },
  });

  const importEmails = useImportCaseEmails({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListImportedEmailsQueryKey(caseId) });
        toast({ title: `${(data as unknown[]).length} email(s) imported to your case` });
        setSelected(new Set());
        setSearchResults((prev) => prev.filter((r) => !selected.has(r.externalId)));
      },
      onError: () => {
        toast({ title: "Import failed", variant: "destructive" });
      },
    },
  });

  const createEvent = useCreateTimelineEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTimelineEventsQueryKey(caseId) });
        toast({ title: "Added to timeline" });
      },
      onError: () => {
        toast({ title: "Failed to add to timeline", variant: "destructive" });
      },
    },
  });

  // Auto-select first connection
  useEffect(() => {
    if (connections.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections]);

  // Handle OAuth return
  useEffect(() => {
    if (emailConnected) {
      toast({ title: `${emailConnected === "gmail" ? "Gmail" : "Outlook"} connected successfully` });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (emailError === "setup_required") {
      setSetupProvider((errorProvider as "gmail" | "outlook") ?? "gmail");
      setShowSetupGuide(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function handleConnect(provider: "gmail" | "outlook") {
    const returnPath = `${basePath}/cases/${caseId}/email-import`;
    window.location.href = `/api/email/oauth/connect/${provider}?returnPath=${encodeURIComponent(returnPath)}`;
  }

  function handleSearch() {
    if (!selectedConnectionId) return;
    searchEmails.mutate({
      caseId,
      data: {
        connectionId: selectedConnectionId,
        from: filterFrom || undefined,
        to: filterTo || undefined,
        subject: filterSubject || undefined,
        keyword: filterKeyword || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        hasAttachment: filterHasAttachment || undefined,
        folder: filterFolder || undefined,
        maxResults: 20,
      },
    });
  }

  function handleImportSelected() {
    if (!selectedConnectionId || selected.size === 0) return;
    importEmails.mutate({
      caseId,
      data: {
        connectionId: selectedConnectionId,
        emailIds: Array.from(selected),
        tags: ["email"],
      },
    });
  }

  function handleImportOne(emailId: string) {
    if (!selectedConnectionId) return;
    importEmails.mutate({
      caseId,
      data: { connectionId: selectedConnectionId, emailIds: [emailId], tags: ["email"] },
    });
  }

  function handleAddToTimeline(email: EmailResult) {
    const date = email.date ? new Date(email.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    createEvent.mutate({
      caseId,
      data: {
        title: email.subject ?? "Email",
        eventDate: date,
        description: `From: ${email.from ?? "Unknown"}\nTo: ${email.to ?? "Unknown"}\n\n${email.snippet ?? ""}`.trim(),
        people: [
          ...(email.from ? [email.from.replace(/<[^>]+>/g, "").trim()] : []),
          ...(email.to ? email.to.split(",").map((s) => s.replace(/<[^>]+>/g, "").trim()).filter(Boolean) : []),
        ].slice(0, 5),
        tags: ["email"],
      },
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === searchResults.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(searchResults.map((r) => r.externalId)));
    }
  }

  const gmailConnection = connections.find((c) => c.provider === "gmail");
  const outlookConnection = connections.find((c) => c.provider === "outlook");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Import</h1>
        <p className="text-muted-foreground mt-1">
          Connect your email and import relevant messages as case evidence.
        </p>
      </div>

      {/* Privacy Notice */}
      <Alert className="border-teal-200 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-800">
        <Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        <AlertTitle className="text-teal-800 dark:text-teal-300">Privacy First</AlertTitle>
        <AlertDescription className="text-teal-700 dark:text-teal-400 text-sm">
          Exhibit A only imports emails you choose to add to a case. Your inbox is never scanned automatically.
        </AlertDescription>
      </Alert>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Connect a Gmail or Outlook account to search and import emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectionsLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <>
              {/* Gmail row */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white border shadow-sm flex items-center justify-center text-sm font-bold text-red-500">G</div>
                  <div>
                    <p className="text-sm font-medium">Gmail</p>
                    {gmailConnection ? (
                      <p className="text-xs text-muted-foreground">{gmailConnection.email}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                  </div>
                </div>
                {gmailConnection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteConnection.mutate({ connectionId: gmailConnection.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => handleConnect("gmail")}>
                    Connect Gmail
                  </Button>
                )}
              </div>

              {/* Outlook row */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white border shadow-sm flex items-center justify-center text-sm font-bold text-blue-600">O</div>
                  <div>
                    <p className="text-sm font-medium">Outlook</p>
                    {outlookConnection ? (
                      <p className="text-xs text-muted-foreground">{outlookConnection.email}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    )}
                  </div>
                </div>
                {outlookConnection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteConnection.mutate({ connectionId: outlookConnection.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleConnect("outlook")}>
                    Connect Outlook
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Setup Required Guide Dialog */}
      <Dialog open={showSetupGuide} onOpenChange={setShowSetupGuide}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Setup Required for {setupProvider === "gmail" ? "Gmail" : "Outlook"}</DialogTitle>
            <DialogDescription>
              OAuth credentials need to be configured before connecting your email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            {setupProvider === "gmail" ? (
              <>
                <p className="font-medium">To enable Gmail integration:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Go to <strong>console.cloud.google.com</strong> and create a project</li>
                  <li>Enable the <strong>Gmail API</strong></li>
                  <li>Create <strong>OAuth 2.0 credentials</strong> (Web application)</li>
                  <li>Add your app domain to Authorized Redirect URIs:
                    <code className="block mt-1 bg-muted p-2 rounded text-xs break-all">
                      https://YOUR_APP_DOMAIN/api/email/oauth/callback/gmail
                    </code>
                  </li>
                  <li>Set these environment secrets in your project:
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li><code>GOOGLE_CLIENT_ID</code></li>
                      <li><code>GOOGLE_CLIENT_SECRET</code></li>
                    </ul>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="font-medium">To enable Outlook integration:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Go to <strong>portal.azure.com</strong> → App Registrations</li>
                  <li>Register a new application</li>
                  <li>Add a Web Redirect URI:
                    <code className="block mt-1 bg-muted p-2 rounded text-xs break-all">
                      https://YOUR_APP_DOMAIN/api/email/oauth/callback/outlook
                    </code>
                  </li>
                  <li>Add API permission: <strong>Microsoft Graph → Mail.Read</strong></li>
                  <li>Create a client secret under Certificates & Secrets</li>
                  <li>Set these environment secrets:
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li><code>MICROSOFT_CLIENT_ID</code></li>
                      <li><code>MICROSOFT_CLIENT_SECRET</code></li>
                    </ul>
                  </li>
                </ol>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSetupGuide(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Section */}
      {connections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Search Filters</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="text-muted-foreground"
              >
                {filtersExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {filtersExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
          </CardHeader>
          {filtersExpanded && (
            <CardContent className="space-y-4">
              {/* Account selector if multiple */}
              {connections.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Search Account</Label>
                  <div className="flex gap-2">
                    {connections.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedConnectionId(c.id)}
                        className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                          selectedConnectionId === c.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                      >
                        {c.provider === "gmail" ? "Gmail" : "Outlook"}: {c.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterFrom">From (sender email)</Label>
                  <Input id="filterFrom" placeholder="sender@example.com" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterTo">To (recipient email)</Label>
                  <Input id="filterTo" placeholder="recipient@example.com" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterSubject">Subject contains</Label>
                  <Input id="filterSubject" placeholder="e.g. lease agreement" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterKeyword">Keyword search</Label>
                  <Input id="filterKeyword" placeholder="e.g. termination clause" value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterDateFrom">Date from</Label>
                  <Input id="filterDateFrom" type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterDateTo">Date to</Label>
                  <Input id="filterDateTo" type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="filterFolder">Folder / Label</Label>
                  <Input id="filterFolder" placeholder="e.g. inbox, sent, work" value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Checkbox
                    id="filterAttach"
                    checked={filterHasAttachment}
                    onCheckedChange={(v) => setFilterHasAttachment(!!v)}
                  />
                  <Label htmlFor="filterAttach" className="text-sm cursor-pointer">
                    Has attachment
                  </Label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSearch} disabled={searchEmails.isPending || !selectedConnectionId}>
                  {searchEmails.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Search Emails
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Search Results */}
      {hasSearched && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Search Results
                {searchResults.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{searchResults.length}</Badge>
                )}
              </CardTitle>
              {searchResults.length > 0 && selected.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleImportSelected}
                  disabled={importEmails.isPending}
                >
                  {importEmails.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-3.5 w-3.5" />
                  )}
                  Import Selected ({selected.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {searchResults.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground px-4">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No emails matched your search. Try adjusting the filters.</p>
              </div>
            ) : (
              <>
                {/* Select all row */}
                <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20 text-sm text-muted-foreground">
                  <button onClick={toggleAll} className="flex items-center gap-2 hover:text-foreground transition-colors">
                    {selected.size === searchResults.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {selected.size === searchResults.length ? "Deselect all" : "Select all"}
                  </button>
                </div>

                <div className="divide-y">
                  {searchResults.map((email) => (
                    <div
                      key={email.externalId}
                      className={`p-4 hover:bg-muted/10 transition-colors ${selected.has(email.externalId) ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <Checkbox
                            checked={selected.has(email.externalId)}
                            onCheckedChange={() => toggleSelect(email.externalId)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {email.subject || "(No subject)"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                <span className="truncate max-w-[200px]">From: {email.from || "Unknown"}</span>
                                {email.to && (
                                  <span className="truncate max-w-[200px]">To: {email.to}</span>
                                )}
                                {email.date && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {formatEmailDate(email.date)}
                                  </span>
                                )}
                              </div>
                              {email.snippet && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {email.snippet}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {email.hasAttachment && (
                                <span title="Has attachment">
                                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">
                                {email.provider}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => setViewSearchResult(email)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => handleImportOne(email.externalId)}
                              disabled={importEmails.isPending}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" /> Import to Case
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2 text-muted-foreground"
                              onClick={() => handleAddToTimeline(email)}
                            >
                              <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Add to Timeline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom import bar */}
                {selected.size > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-primary/5">
                    <span className="text-sm text-muted-foreground">{selected.size} email(s) selected</span>
                    <Button
                      onClick={handleImportSelected}
                      disabled={importEmails.isPending}
                    >
                      {importEmails.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Import {selected.size} Email{selected.size > 1 ? "s" : ""}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Imported Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            Imported Emails
            {importedEmails.length > 0 && (
              <Badge variant="secondary">{importedEmails.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Emails you've imported appear here and in the Evidence Library.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {importedLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : importedEmails.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground px-4">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No emails imported yet. Search and import emails above.</p>
            </div>
          ) : (
            <div className="divide-y">
              {(importedEmails as unknown as ImportedEmail[]).map((email) => (
                <div key={email.id} className="p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {email.subject || "(No subject)"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {email.sender && <span className="truncate max-w-[200px]">From: {email.sender}</span>}
                        {email.recipients && <span className="truncate max-w-[200px]">To: {email.recipients}</span>}
                        {email.emailDate && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />
                            {formatEmailDate(email.emailDate)}
                          </span>
                        )}
                      </div>
                      {email.snippet && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{email.snippet}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {email.hasAttachment && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Badge variant="outline" className="text-xs capitalize">{email.provider}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setViewEmail(email)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Email Dialog (imported) */}
      <Dialog open={!!viewEmail} onOpenChange={(o) => !o && setViewEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="leading-tight">{viewEmail?.subject || "(No subject)"}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm">
                {viewEmail?.sender && <div><span className="font-medium">From:</span> {viewEmail.sender}</div>}
                {viewEmail?.recipients && <div><span className="font-medium">To:</span> {viewEmail.recipients}</div>}
                {viewEmail?.emailDate && <div><span className="font-medium">Date:</span> {formatEmailDate(viewEmail.emailDate)}</div>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 max-h-96 overflow-y-auto">
            {viewEmail?.bodyText || viewEmail?.snippet || "(No content)"}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Search Result Dialog */}
      <Dialog open={!!viewSearchResult} onOpenChange={(o) => !o && setViewSearchResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewSearchResult?.subject || "(No subject)"}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm">
                {viewSearchResult?.from && <div><span className="font-medium">From:</span> {viewSearchResult.from}</div>}
                {viewSearchResult?.to && <div><span className="font-medium">To:</span> {viewSearchResult.to}</div>}
                {viewSearchResult?.date && <div><span className="font-medium">Date:</span> {formatEmailDate(viewSearchResult.date)}</div>}
              </div>
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {viewSearchResult?.snippet || "(Preview not available — import the email to view full content)"}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (viewSearchResult) handleAddToTimeline(viewSearchResult);
                setViewSearchResult(null);
              }}
            >
              <CalendarPlus className="mr-2 h-4 w-4" /> Add to Timeline
            </Button>
            <Button
              onClick={() => {
                if (viewSearchResult) handleImportOne(viewSearchResult.externalId);
                setViewSearchResult(null);
              }}
              disabled={importEmails.isPending}
            >
              <Download className="mr-2 h-4 w-4" /> Import to Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
