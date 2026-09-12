import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export function RequireRole({ children, role }: { children: React.ReactNode; role: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Memuat...</div>
      </div>
    );
  }

  if (!user || user.role !== role) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
