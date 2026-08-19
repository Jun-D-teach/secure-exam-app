import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  EyeOff,
  ExternalLink,
  FileQuestion,
  Loader2,
  Send,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type Exam, type Attempt } from "@/lib/api";
import {
  examAvailability,
  formatClock,
  formatDateTime,
  formatDuration,
  toGoogleFormEmbedUrl,
} from "@/lib/exam-utils";

// ---------------------------------------------------------------------------
// Intro (not started yet)
// ---------------------------------------------------------------------------

function ExamIntro({
  exam,
  onStart,
  startError,
  starting,
}: {
  exam: Exam;
  onStart: () => void;
  startError: string | null;
  starting: boolean;
}) {
  const availability = examAvailability(exam);
  const notYet = availability.state === "not_yet";
  const closed = availability.state === "closed";
  const rules = [
    {
      icon: Timer,
      title: "Waktu berjalan otomatis",
      desc: "Timer mulai begitu kamu menekan Mulai Ujian dan tidak bisa dihentikan.",
    },
    {
      icon: EyeOff,
      title: "Jangan pindah tab",
      desc: "Meninggalkan halaman ujian terdeteksi dan dicatat sebagai pelanggaran.",
    },
    {
      icon: Send,
      title: "Jawaban dikirim ke Google Form",
      desc: "Isi dan kumpulkan jawaban di Google Form seperti biasa.",
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.915_0.006_240/0.4)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.915_0.006_240/0.4)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,black_30%,transparent_100%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-xl"
      >
        <Card className="rounded-2xl border-border/70 shadow-xl shadow-slate-900/5">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileQuestion className="size-5" />
              </div>
              <Badge variant="secondary" className="rounded-full">
                <Clock3 className="size-3" /> {formatDuration(exam.durationMinutes)}
              </Badge>
            </div>
            <CardTitle className="mt-4 text-2xl tracking-tight">{exam.title}</CardTitle>
            {exam.subjectName && (
              <p className="text-sm font-medium text-muted-foreground">{exam.subjectName}</p>
            )}
            {exam.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {exam.description}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              <p className="flex items-start gap-2 font-semibold">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                Ujian diawasi
              </p>
              <p className="mt-1 pl-6 text-xs leading-relaxed opacity-80">
                Aktivitas kamu dicatat guru. Baca aturan di bawah sebelum memulai.
              </p>
            </div>
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <rule.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{rule.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {rule.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            {notYet || closed ? (
              <Button className="h-12 w-full rounded-lg" disabled>
                {notYet ? (
                  <>
                    <CalendarClock className="size-4" />
                    Dibuka {formatDateTime(availability.opensAt)}
                  </>
                ) : (
                  <>
                    <CalendarClock className="size-4" />
                    Ujian ditutup
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="h-12 w-full rounded-lg"
                onClick={onStart}
                disabled={starting}
              >
                {starting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Menyiapkan ujian...
                  </>
                ) : (
                  <>
                    <Timer className="size-4" /> Mulai Ujian Sekarang
                  </>
                )}
              </Button>
            )}
            {startError && <p className="text-sm text-destructive">{startError}</p>}
            <p className="text-xs text-muted-foreground">
              {notYet
                ? "Ujian dibuka otomatis sesuai jadwal guru. Kembalilah saat waktu buka tiba."
                : closed
                  ? "Batas waktu mulai ujian ini sudah lewat."
                  : `Setelah dimulai, waktu ${formatDuration(exam.durationMinutes)} langsung berjalan.`}
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-progress exam view
// ---------------------------------------------------------------------------

function ExamInProgress({
  exam,
  attempt,
}: {
  exam: Exam;
  attempt: Attempt;
}) {
  const navigate = useNavigate();

  const embedUrl = toGoogleFormEmbedUrl(exam.googleFormUrl);
  const canEmbed = embedUrl.includes("docs.google.com/forms/d/");

  const [now, setNow] = useState(() => Date.now());
  const [warnVisible, setWarnVisible] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expiredLocally, setExpiredLocally] = useState(false);

  const lastViolationRef = useRef(0);
  const expiredRef = useRef(false);

  const inProgress = attempt.status === "in_progress" && !expiredLocally;
  const remaining = attempt.endsAt - now;
  const isLow = remaining < 5 * 60 * 1000;

  const recordViolation = useCallback(
    async (type: string) => {
      if (!inProgress) return;
      const t = Date.now();
      if (t - lastViolationRef.current < 5000) return;
      lastViolationRef.current = t;
      try {
        await api.post(`/api/attempts/${attempt._id}/violation`, { type });
      } catch (err) {
        console.error("Failed to record violation:", err);
      }
      setWarnVisible(true);
      toast.warning("Pelanggaran tercatat", {
        description: "Kamu pindah tab. Jangan tinggalkan halaman ujian.",
      });
    },
    [inProgress, attempt._id],
  );

  // Countdown tick
  useEffect(() => {
    if (!inProgress) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [inProgress, attempt._id]);

  // Expiry check
  useEffect(() => {
    if (!inProgress || remaining > 0 || expiredRef.current) return;
    expiredRef.current = true;
    setExpiredLocally(true);
    api.post(`/api/attempts/${attempt._id}/expire`).catch(console.error);
  }, [inProgress, remaining, attempt._id]);

  // Anti-cheat listeners
  useEffect(() => {
    if (!inProgress) return;
    const onVisibilityChange = () => {
      if (document.hidden) recordViolation("tab_switch");
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [inProgress, recordViolation]);

  // Auto-hide the warning banner
  useEffect(() => {
    if (!warnVisible) return;
    const timeout = setTimeout(() => setWarnVisible(false), 4500);
    return () => clearTimeout(timeout);
  }, [warnVisible]);

  // Manual navigation guard
  useEffect(() => {
    if (!inProgress) return;
    window.history.pushState({ ujianKita: true }, "");
    const onPopState = () => {
      if (!inProgress) return;
      setLeaveDialogOpen(true);
      window.history.pushState({ ujianKita: true }, "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [inProgress]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/attempts/${attempt._id}/complete`);
      setConfirmSubmit(false);
      window.location.reload();
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Gagal mengumpulkan ujian. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!inProgress) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/attempts/${attempt._id}/complete`);
      setLeaveDialogOpen(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Submit error:", err);
      setLeaveDialogOpen(false);
      setIsSubmitting(false);
      toast.error("Gagal mengumpulkan ujian. Coba lagi.");
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40">
      {/* Top bar */}
      <header
        className={`z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6 ${
          isLow ? "border-destructive/30" : "border-border/70"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileQuestion className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">{exam.title}</p>
            <p className="text-xs text-muted-foreground">
              {exam.subjectName || "Ujian"} · {formatDuration(exam.durationMinutes)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-full border-primary/25 bg-primary/5 text-primary ${
              attempt.violationCount > 0
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : ""
            }`}
            title="Pelanggaran (pindah tab / keluar halaman)"
          >
            <AlertTriangle className="size-3" />
            {attempt.violationCount} pelanggaran
          </Badge>
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
              isLow
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-border bg-background text-foreground"
            }`}
            aria-live="polite"
          >
            <Timer className="size-4" />
            {formatClock(remaining)}
          </div>
          <Button
            size="sm"
            className="rounded-lg"
            onClick={() => setConfirmSubmit(true)}
            disabled={!inProgress}
          >
            <Send className="size-4" /> Kumpulkan
          </Button>
        </div>
      </header>

      {/* Warning banner */}
      {warnVisible && inProgress && (
        <div className="z-10 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-semibold text-white">
          <AlertTriangle className="size-4 shrink-0" />
          Jangan pindah tab atau tinggalkan halaman ujian — aktivitas dicatat!
        </div>
      )}

      {/* Google Form */}
      <div className="relative min-h-0 flex-1">
        {canEmbed ? (
          <iframe
            key={attempt.startedAt}
            src={embedUrl}
            title={exam.title}
            className="h-full w-full border-0"
            allow="fullscreen"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <Card className="max-w-md rounded-2xl text-center shadow-sm">
              <CardHeader>
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ExternalLink className="size-6" />
                </div>
                <CardTitle className="text-lg tracking-tight">
                  Buka soal di tab baru
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Link Google Form ini (link pendek) tidak bisa ditampilkan di
                  dalam aplikasi. Buka lewat tombol di bawah — jangan pindah tab
                  lain selain halaman ini.
                </p>
              </CardContent>
              <CardFooter className="justify-center">
                <Button asChild className="rounded-lg">
                  <a href={exam.googleFormUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Buka Google Form
                  </a>
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>

      {/* Confirm submit dialog */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kumpulkan ujian sekarang?</DialogTitle>
            <DialogDescription>
              Pastikan semua jawaban sudah terisi di Google Form. Setelah
              dikumpulkan, kamu tidak bisa kembali mengerjakan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmit(false)} disabled={isSubmitting}>
              Kembali mengerjakan
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="rounded-lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Mengumpulkan...
                </>
              ) : (
                <>
                  <Send className="size-4" /> Ya, kumpulkan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave-attempt dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ujian masih berlangsung!</DialogTitle>
            <DialogDescription>
              Waktu ujian belum selesai. Meninggalkan halaman akan dicatat sebagai
              pelanggaran.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeaveDialogOpen(false)}
              disabled={isSubmitting}
            >
              Tetap mengerjakan
            </Button>
            <Button
              onClick={handleLeave}
              disabled={isSubmitting}
              variant="destructive"
              className="rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Mengumpulkan...
                </>
              ) : (
                "Kumpulkan & keluar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result view
// ---------------------------------------------------------------------------

function ExamResult({
  exam,
  attempt,
}: {
  exam: Exam;
  attempt: Attempt;
}) {
  const navigate = useNavigate();
  const finished = attempt.status === "completed";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.915_0.006_240/0.4)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.915_0.006_240/0.4)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,black_30%,transparent_100%)]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg"
      >
        <Card className="rounded-2xl border-border/70 shadow-xl shadow-slate-900/5">
          <CardHeader className="items-center text-center">
            <div
              className={`flex size-14 items-center justify-center rounded-2xl ${
                finished
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {finished ? (
                <CheckCircle2 className="size-7" />
              ) : (
                <Clock3 className="size-7" />
              )}
            </div>
            <CardTitle className="mt-2 text-2xl tracking-tight">
              {finished ? "Ujian berhasil dikumpulkan" : "Waktu ujian habis"}
            </CardTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {finished
                ? "Jawabanmu sudah terkirim lewat Google Form. Semoga hasilnya memuaskan!"
                : "Jawaban yang sudah terisi tetap tersimpan di Google Form. Kamu tidak bisa melanjutkan ujian ini."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
              <p className="text-sm font-bold">{exam.title}</p>
              <p className="text-xs text-muted-foreground">
                {exam.subjectName || "Ujian"} · {formatDuration(exam.durationMinutes)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                <p className="text-sm font-bold">Mulai</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(attempt.startedAt)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                <p className="text-sm font-bold">Selesai</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {attempt.completedAt ? formatDateTime(attempt.completedAt) : "—"}
                </p>
              </div>
            </div>
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                attempt.violationCount > 0
                  ? "border-destructive/25 bg-destructive/5 text-destructive"
                  : "border-emerald-600/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                {attempt.violationCount > 0 ? "Pelanggaran terdeteksi" : "Tidak ada pelanggaran"}
              </span>
              <span className="font-bold tabular-nums">{attempt.violationCount}</span>
            </div>
          </CardContent>
          <CardFooter className="justify-center pb-6">
            <Button className="w-full rounded-lg" onClick={() => navigate("/dashboard")}>
              Kembali ke Beranda
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExamPage() {
  const params = useParams();
  const navigate = useNavigate();
  const examId = params.examId ?? "";

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    loadExamData();
  }, [examId]);

  async function loadExamData() {
    try {
      const [examRes, attemptRes] = await Promise.all([
        api.get<Exam>(`/api/exams/${examId}`),
        api.get<Attempt | null>(`/api/attempts/my/${examId}`),
      ]);
      setExam(examRes);
      setAttempt(attemptRes);
    } catch (err) {
      console.error("Failed to load exam:", err);
      setExam(null);
    } finally {
      setLoading(false);
    }
  }

  if (!examId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <FileQuestion className="size-10 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-bold">Ujian tidak ditemukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Link yang kamu buka tidak valid.
          </p>
        </div>
        <Button variant="outline" className="rounded-lg" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="size-4" /> Kembali ke Beranda
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exam === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <FileQuestion className="size-10 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-bold">Ujian tidak ditemukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ujian ini mungkin sudah dihapus.
          </p>
        </div>
        <Button variant="outline" className="rounded-lg" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="size-4" /> Kembali ke Beranda
        </Button>
      </div>
    );
  }

  if (attempt === null) {
    const handleStart = async () => {
      setStarting(true);
      setStartError(null);
      try {
        await api.post("/api/attempts/start", { examId: exam._id });
        // Reload attempt data
        const newAttempt = await api.get<Attempt>(`/api/attempts/my/${examId}`);
        setAttempt(newAttempt);
      } catch (err) {
        console.error("Start attempt error:", err);
        setStartError(err instanceof Error ? err.message : "Gagal memulai ujian.");
        setStarting(false);
      }
    };

    return (
      <ExamIntro
        exam={exam}
        onStart={handleStart}
        startError={startError}
        starting={starting}
      />
    );
  }

  if (attempt.status === "in_progress") {
    return <ExamInProgress exam={exam} attempt={attempt} />;
  }

  return <ExamResult exam={exam} attempt={attempt} />;
}
