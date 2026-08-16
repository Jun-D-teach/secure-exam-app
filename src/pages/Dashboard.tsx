import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import AdminDashboard from "@/pages/AdminDashboard";
import StudentDashboard from "@/pages/StudentDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";

export default function Dashboard() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user?.role) {
    // Every account is created by the admin with a role, so this only
    // happens for legacy accounts. Send them to the landing page.
    return <Navigate to="/" replace />;
  }

  if (user.role === "admin") {
    return <AdminDashboard />;
  }

  if (user.role === "teacher") {
    return <TeacherDashboard />;
  }

  if (user.role === "student") {
    return <StudentDashboard />;
  }

  // Fallback for other legacy roles (member/user)
  return <Navigate to="/" replace />;
}
