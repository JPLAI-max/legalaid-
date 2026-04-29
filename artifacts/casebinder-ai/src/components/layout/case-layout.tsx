import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderOpen, 
  Search, 
  Clock, 
  Mic, 
  FileText, 
  Lightbulb, 
  Download,
  Mail,
  ChevronLeft
} from "lucide-react";
import { useGetCase } from "@workspace/api-client-react";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CaseLayoutProps {
  children: React.ReactNode;
  params: { caseId: string };
}

export function CaseLayout({ children, params }: CaseLayoutProps) {
  const [location] = useLocation();
  const caseId = parseInt(params.caseId);
  const { data: caseData, isLoading } = useGetCase(caseId, {
    query: { enabled: !!caseId }
  });

  const navItems = [
    { name: "Overview", href: `/cases/${caseId}/overview`, icon: LayoutDashboard },
    { name: "Evidence", href: `/cases/${caseId}/evidence`, icon: FolderOpen },
    { name: "Search", href: `/cases/${caseId}/search`, icon: Search },
    { name: "Timeline", href: `/cases/${caseId}/timeline`, icon: Clock },
    { name: "Speak Your Case", href: `/cases/${caseId}/speak`, icon: Mic },
    { name: "Summary", href: `/cases/${caseId}/summary`, icon: FileText },
    { name: "Suggested Events", href: `/cases/${caseId}/suggested-events`, icon: Lightbulb },
    { name: "Export", href: `/cases/${caseId}/export`, icon: Download },
    { name: "Email Import", href: `/cases/${caseId}/email-import`, icon: Mail },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-64 border-r bg-muted/20 flex-shrink-0">
          <div className="p-4 border-b">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" data-testid="btn-back-dashboard">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="mt-4 px-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              ) : (
                <>
                  <h2 className="font-semibold truncate" title={caseData?.name}>
                    {caseData?.name}
                  </h2>
                  <p className="text-xs text-muted-foreground capitalize">
                    {caseData?.caseType.replace("_", " ")}
                  </p>
                </>
              )}
            </div>
          </div>
          
          <nav className="p-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href}>
                  <span
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      <footer className="py-4 px-4 md:px-8 border-t bg-muted/30 text-center text-xs text-muted-foreground mt-auto">
        <p>Legal Aid is an organization tool and does not provide legal advice.</p>
      </footer>
    </div>
  );
}
