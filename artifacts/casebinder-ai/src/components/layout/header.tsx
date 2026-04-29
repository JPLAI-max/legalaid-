import { Link } from "wouter";
import { UserButton, useAuth, Show } from "@clerk/react";

export function Header() {
  const { isSignedIn } = useAuth();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between mx-auto px-4 md:px-6">
        <Link href={isSignedIn ? "/dashboard" : "/"} className="flex items-center space-x-2">
          <img src={`${basePath}/logo.png`} alt="Legal Aid" className="h-8 w-8 object-contain rounded-md" />
          <span className="font-bold text-foreground">Legal Aid</span>
        </Link>
        <div className="flex items-center space-x-4">
          <Show when="signed-out">
            <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Log In
            </Link>
            <Link href="/sign-up" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
              Create Account
            </Link>
          </Show>
          <Show when="signed-in">
            <UserButton afterSignOutUrl={basePath || "/"} />
          </Show>
        </div>
      </div>
    </header>
  );
}
