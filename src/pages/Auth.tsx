import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";

export default function AuthPage({ redirectAfterAuth = "/dashboard" }: { redirectAfterAuth?: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || redirectAfterAuth;
  const { signIn, isAuthenticated, user } = useAuth();

  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") navigate("/admin", { replace: true });
      else if (user.role === "teacher") navigate("/guru", { replace: true });
      else navigate("/siswa", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const res = await api.hasAdmin();
      if (!res.hasAdmin) setMode("bootstrap");
    } catch (e) {
      // Server might not be running
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(username, password);
    } catch (err: any) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || !username || !password) {
      setError("Semua field wajib diisi");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    setLoading(true);
    try {
      await api.bootstrapAdmin(name, username, password);
      await signIn(username, password);
    } catch (err: any) {
      setError(err.message || "Gagal membuat akun admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <Link to="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Kembali ke Beranda
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              M2
            </div>
            <div>
              <div className="text-sm font-bold">MAN 2 Palembang</div>
              <div className="text-[10px] text-muted-foreground">Portal Berita & Informasi</div>
            </div>
          </div>

          {mode === "bootstrap" ? (
            <>
              <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Setup Admin</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Buat akun administrator pertama untuk mengelola portal.
              </p>

              <form onSubmit={handleBootstrap} className="mt-8 space-y-4">
                <div>
                  <label className="text-sm font-medium">Nama Lengkap</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Administrator"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Minimal 8 karakter"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full rounded-lg" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <><UserPlus className="size-4" /> Buat Akun Admin</>}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
                  Sudah punya akun? Masuk
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Masuk</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Gunakan akun yang diberikan administrator.
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Masukkan username"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Masukkan password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full rounded-lg" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <><ShieldCheck className="size-4" /> Masuk</>}
                </Button>
              </form>

              <div className="mt-6 rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-xs font-bold text-muted-foreground mb-2">Demo Akun:</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><strong>Admin:</strong> admin / admin123</p>
                  <p><strong>Guru:</strong> guru / guru1234</p>
                  <p><strong>Siswa:</strong> siswa / siswa1234</p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="max-w-md px-8 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl mb-6">
              M2
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Portal Berita MAN 2 Palembang
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Portal informasi resmi madrasah. Kelola berita, pengumuman,
              dan seluruh informasi dari satu tempat.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <div className="rounded-lg bg-card border border-border/70 px-4 py-3 text-left">
                <span className="font-bold text-primary">Admin</span> — Kelola seluruh konten, pengguna, dan pengaturan portal
              </div>
              <div className="rounded-lg bg-card border border-border/70 px-4 py-3 text-left">
                <span className="font-bold text-blue-600 dark:text-blue-400">Guru</span> — Buat dan kelola artikel sendiri
              </div>
              <div className="rounded-lg bg-card border border-border/70 px-4 py-3 text-left">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Siswa</span> — Baca berita, beri komentar
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
