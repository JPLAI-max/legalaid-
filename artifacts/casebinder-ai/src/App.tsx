import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { MainLayout } from "@/components/layout/main-layout";
import { CaseLayout } from "@/components/layout/case-layout";
import { Home } from "@/pages/home";
import { Dashboard } from "@/pages/dashboard";
import { NewCase } from "@/pages/cases/new";
import { CaseOverview } from "@/pages/cases/overview";
import { EvidenceUpload } from "@/pages/cases/evidence";
import { EvidenceSearch } from "@/pages/cases/search";
import { TimelineBuilder } from "@/pages/cases/timeline";
import { SpeakYourCase } from "@/pages/cases/speak";
import { CaseSummaryPage } from "@/pages/cases/summary";
import { SuggestedEventsPage } from "@/pages/cases/suggested-events";
import { ExportPage } from "@/pages/cases/export";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#0B1F3B",
    colorForeground: "#2B2B2B",
    colorMutedForeground: "#6b7a8d",
    colorDanger: "hsl(0 84.2% 60.2%)",
    colorBackground: "#FFFFFF",
    colorInput: "#F5F7FA",
    colorInputForeground: "#2B2B2B",
    colorNeutral: "#d8dde6",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive",
    logoBox: "mx-auto mb-4",
    logoImage: "h-12 w-auto object-contain",
    socialButtonsBlockButton: "border-input bg-background hover:bg-muted/50",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    formFieldInput: "bg-background border-input text-foreground",
    footerAction: "mt-6",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive text-destructive",
    otpCodeFieldInput: "bg-background border-input text-foreground",
    formFieldRow: "mb-4",
    main: "w-full",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-slate-900">Welcome Back</h1>
        <p className="mt-2 text-slate-600">Sign in to your CaseBinder AI account</p>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-slate-900">Create an Account</h1>
        <p className="mt-2 text-slate-600">Start organizing your legal case today</p>
      </div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <MainLayout>
          <Home />
        </MainLayout>
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component, layout: Layout, ...rest }: any) {
  return (
    <Route {...rest}>
      {(params) => (
        <>
          <Show when="signed-in">
            {Layout ? (
              <Layout params={params}>
                <Component params={params} />
              </Layout>
            ) : (
              <Component params={params} />
            )}
          </Show>
          <Show when="signed-out">
            <Redirect to="/sign-in" />
          </Show>
        </>
      )}
    </Route>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign In",
            subtitle: "Access your CaseBinder AI workspace",
          },
        },
        signUp: {
          start: {
            title: "Sign Up",
            subtitle: "Create your CaseBinder AI workspace",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          
          <ProtectedRoute path="/dashboard" component={Dashboard} layout={MainLayout} />
          <ProtectedRoute path="/cases/new" component={NewCase} layout={MainLayout} />
          
          <ProtectedRoute path="/cases/:caseId/overview" component={CaseOverview} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/evidence" component={EvidenceUpload} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/search" component={EvidenceSearch} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/timeline" component={TimelineBuilder} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/speak" component={SpeakYourCase} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/summary" component={CaseSummaryPage} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/suggested-events" component={SuggestedEventsPage} layout={CaseLayout} />
          <ProtectedRoute path="/cases/:caseId/export" component={ExportPage} layout={CaseLayout} />

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
