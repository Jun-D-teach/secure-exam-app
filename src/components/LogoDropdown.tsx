import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";

export function LogoDropdown() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  function getDashboardLink() {
    if (user?.role === "admin") return "/admin";
    if (user?.role === "teacher") return "/guru";
    return "/siswa";
  }

  return (
    <div className="flex items-center gap-3">
      <a href={getDashboardLink()} className="flex items-center gap-2 text-sm">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
          {user.name?.charAt(0) || "U"}
        </div>
        <span className="hidden sm:block font-medium">{user.name}</span>
      </a>
      <button
        onClick={signOut}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:block">Keluar</span>
      </button>
    </div>
  );
}
