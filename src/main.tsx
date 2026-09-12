import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const ArticleList = lazy(() => import("./pages/ArticleList.tsx"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard.tsx"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Memuat...</div>
    </div>
  );
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Portal] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Terjadi kesalahan</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">{this.state.message}</p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <RouteSyncer />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/berita" element={<ArticleList />} />
            <Route path="/berita/:slug" element={<ArticleDetail />} />

            {/* Auth */}
            <Route path="/auth" element={<AuthPage redirectAfterAuth="/admin" />} />

            {/* Admin Dashboard */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireRole role="admin">
                    <AdminDashboard />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Teacher Dashboard */}
            <Route
              path="/guru"
              element={
                <RequireAuth>
                  <RequireRole role="teacher">
                    <TeacherDashboard />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Student Dashboard */}
            <Route
              path="/siswa"
              element={
                <RequireAuth>
                  <RequireRole role="student">
                    <StudentDashboard />
                  </RequireRole>
                </RequireAuth>
              }
            />

            {/* Legacy routes redirect */}
            <Route path="/dashboard" element={<RequireAuth><RedirectToRole /></RequireAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);

// Helper to redirect to correct dashboard based on role
import { useAuth } from "@/hooks/use-auth";
function RedirectToRole() {
  const { user } = useAuth();
  if (user?.role === "admin") return <AdminDashboard />;
  if (user?.role === "teacher") return <TeacherDashboard />;
  return <StudentDashboard />;
}
