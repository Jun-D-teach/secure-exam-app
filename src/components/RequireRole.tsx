import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export function RequireRole({
  role,
  children,
}: {
  role: "teacher" | "student";
  children: ReactNode;
}) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (user?.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
