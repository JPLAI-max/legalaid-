import { Link } from "wouter";
import { ArrowRight, Scale, FolderOpen, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 flex flex-col items-center justify-center text-center">
        <div className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground shadow">
            CaseBinder AI
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
            Turn scattered case evidence into a searchable legal timeline.
          </h1>
          <p className="mx-auto max-w-[700px] text-lg md:text-xl text-muted-foreground">
            A calm, professional workspace for organizing the chaos of a legal case. Build your timeline, manage evidence, and prepare for court with confidence.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto font-medium" data-testid="link-signup">
                Start Organizing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium" data-testid="link-login">
                Log In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-12 md:py-24 bg-muted/50 rounded-3xl mb-12">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FolderOpen className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Centralized Evidence</h3>
              <p className="text-muted-foreground">
                Upload PDFs, documents, and images. Keep everything in one secure place instead of scattered across emails and folders.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Chronological Timeline</h3>
              <p className="text-muted-foreground">
                Build a clear narrative. Link evidence to specific dates and events to show exactly what happened and when.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Court-Ready Export</h3>
              <p className="text-muted-foreground">
                Generate professional PDF packets with cover pages, summaries, and indexed exhibits ready for your attorney or the court.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
