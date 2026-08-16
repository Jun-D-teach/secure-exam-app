import { motion } from "framer-motion";
import { KeyRound, Loader2, Lock, ShieldCheck, UserRound } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First-run setup: no admin account exists yet → offer bootstrap.
  const hasAdmin = useQuery(api.users.hasAdmin);
  const bootstrapAdmin = useAction(api.users.bootstrapAdmin);
  const [showSetup, setShowSetup] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", new FormData(event.currentTarget));
      // Navigation happens via the auth-state effect above once confirmed.
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Username atau password salah. Silakan coba lagi.",
      );
      setIsLoading(false);
    }
  };

  const handleSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSetupLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await bootstrapAdmin({
        name: String(formData.get("setup-name") || ""),
        username: String(formData.get("setup-username") || ""),
        password: String(formData.get("setup-password") || ""),
      });
      setShowSetup(false);
      toast.success("Akun admin pertama dibuat", {
        description: "Silakan login dengan akun tersebut.",
      });
    } catch (err) {
      console.error("Bootstrap admin error:", err);
      setError(err instanceof Error ? err.message : "Gagal membuat akun admin.");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.915_0.006_240/0.4)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.915_0.006_240/0.4)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,black_30%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <Link
        to="/"
        className="relative mb-8 flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <img src={logo} alt="UjianKita" width={34} height={34} className="rounded-lg" />
        <span className="text-[17px] font-bold tracking-tight">UjianKita</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <Card className="rounded-2xl border-border/70 shadow-xl shadow-slate-900/5">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="size-5" />
            </div>
            <CardTitle className="mt-2 text-xl tracking-tight">
              Masuk UjianKita
            </CardTitle>
            <CardDescription>
              Masukkan username dan password dari akun yang dibuat admin sekolah.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="grid gap-4 pb-2">
              <div className="grid gap-2">
                <Label htmlFor="login-username">Username</Label>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-username"
                    name="username"
                    placeholder="mis. budi.siswa"
                    autoComplete="username"
                    className="h-11 rounded-lg pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-11 rounded-lg pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <input type="hidden" name="flow" value="signIn" />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
            <CardFooter className="flex-col gap-3 pb-7">
              <Button
                type="submit"
                className="h-11 w-full rounded-lg"
                disabled={isLoading || hasAdmin === undefined}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Memeriksa...
                  </>
                ) : (
                  <>
                    Masuk
                    <Lock className="size-4" />
                  </>
                )}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tidak punya akun? Hubungi admin sekolah — semua akun (guru &
                siswa) dibuat oleh admin.
              </p>
            </CardFooter>
          </form>
        </Card>

        {hasAdmin === false && !showSetup && (
          <div className="relative mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck className="size-4" />
              Pengaturan awal
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Belum ada akun admin. Buat akun admin pertama untuk mulai
              mengelola siswa, guru, dan jadwal ujian.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-lg"
              onClick={() => setShowSetup(true)}
            >
              Buat akun admin
            </Button>
          </div>
        )}

        {showSetup && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mt-4 rounded-2xl border-primary/25 shadow-lg">
              <CardHeader>
                <CardTitle className="text-base tracking-tight">
                  Buat akun admin pertama
                </CardTitle>
                <CardDescription>
                  Akun ini berperan sebagai pengelola sistem. Simpan username &
                  password-nya baik-baik.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSetup}>
                <CardContent className="grid gap-3 pb-2">
                  <div className="grid gap-2">
                    <Label htmlFor="setup-name" className="text-xs">
                      Nama
                    </Label>
                    <Input
                      id="setup-name"
                      name="setup-name"
                      placeholder="mis. Admin Sekolah"
                      disabled={setupLoading}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="setup-username" className="text-xs">
                      Username
                    </Label>
                    <Input
                      id="setup-username"
                      name="setup-username"
                      placeholder="mis. admin"
                      autoComplete="username"
                      disabled={setupLoading}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="setup-password" className="text-xs">
                      Password (min. 8 karakter)
                    </Label>
                    <Input
                      id="setup-password"
                      name="setup-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      disabled={setupLoading}
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowSetup(false);
                      setError(null);
                    }}
                    disabled={setupLoading}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={setupLoading} className="rounded-lg">
                    {setupLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Membuat...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-4" /> Buat akun admin
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dengan masuk, kamu menyetujui aturan ujian yang berlaku di sekolahmu.{" "}
          <Link to="/" className="underline underline-offset-4 hover:text-foreground">
            Kembali ke beranda
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
