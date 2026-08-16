import { motion } from "framer-motion";
import { GraduationCap, Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";

const options = [
  {
    role: "teacher" as const,
    icon: GraduationCap,
    title: "Saya Guru",
    desc: "Buat ujian dari link Google Form, atur durasi, dan pantau pengerjaan siswa.",
    accent: "bg-primary text-primary-foreground",
  },
  {
    role: "student" as const,
    icon: Users,
    title: "Saya Siswa",
    desc: "Masuk untuk melihat ujian yang tersedia dan mengerjakannya dengan timer.",
    accent: "bg-teal-600/10 text-teal-600 dark:text-teal-400",
  },
];

export default function RoleSelect() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const setRole = useMutation(api.exams.setRole);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user && user.role) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, user, navigate]);

  const choose = async (role: "teacher" | "student") => {
    setChoosing(role);
    setError(null);
    try {
      await setRole({ role });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Set role error:", err);
      setError(
        err instanceof Error ? err.message : "Gagal memilih peran. Coba lagi.",
      );
      setChoosing(null);
    }
  };

  if (isLoading || (user && user.role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

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
        className="relative w-full max-w-2xl"
      >
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">
            Satu langkah lagi
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Pilih peran kamu
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Peran menentukan tampilan aplikasi. Guru mengelola ujian, siswa
            mengerjakan ujian.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {options.map((option, i) => (
            <motion.div
              key={option.role}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            >
              <Card className="h-full rounded-2xl border-border/70 shadow-lg shadow-slate-900/5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl">
                <CardContent className="flex h-full flex-col p-6">
                  <div
                    className={`flex size-12 items-center justify-center rounded-xl ${option.accent}`}
                  >
                    <option.icon className="size-6" />
                  </div>
                  <h2 className="mt-5 text-lg font-bold tracking-tight">
                    {option.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {option.desc}
                  </p>
                  <Button
                    onClick={() => choose(option.role)}
                    disabled={choosing !== null}
                    className="mt-6 w-full rounded-lg"
                    variant={option.role === "teacher" ? "default" : "outline"}
                  >
                    {choosing === option.role ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      `Lanjut sebagai ${option.role === "teacher" ? "Guru" : "Siswa"}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-destructive">{error}</p>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pilihan ini bisa diubah nanti oleh pengelola sekolah.{" "}
          <Link to="/" className="underline underline-offset-4 hover:text-foreground">
            Kembali ke beranda
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
