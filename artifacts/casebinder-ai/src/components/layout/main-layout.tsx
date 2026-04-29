import { Header } from "@/components/layout/header";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
      <footer className="py-6 px-4 md:px-8 border-t bg-muted/30 text-center text-sm text-muted-foreground">
        <p>CaseBinder AI is an organization tool and does not provide legal advice.</p>
      </footer>
    </div>
  );
}
