import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
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
    return <Navigate to="/role" replace />;
  }

  if (user.role === "teacher") {
    return <TeacherDashboard />;
  }

  if (user.role === "student") {
    return <StudentDashboard />;
  }

  // Fallback for other legacy roles (admin/member/user)
  return <Navigate to="/" replace />;
}
