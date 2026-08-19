import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileQuestion,
  GraduationCap,
  KeyRound,
  Loader2,
  LogOut,
  Timer,
  Users,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { examAvailability, formatDateTime, formatDuration } from "@/lib/exam-utils";

type ExamData = {
  id: string;
  title: string;
  subject_id: string;
  description: string;
  google_form_url: string;
  durationMinutes: number;
  isActive: boolean;
  startsAt?: number;
  endsAt?: number;
  created_by: string;
  created_at: string;
  subjectName: string | null;
  teacherName: string | null;
};

type SubjectData = {
  id: string;
  name: string;
  description: string;
};

// ---------------------------------------------------------------------------
// Create exam dialog (draft — admin schedules & publishes)
// ---------------------------------------------------------------------------

function CreateExamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      api.listSubjects().then(setSubjects).catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const subjectId = String(formData.get("subjectId") || "");
    try {
      await api.createExam({
        title: String(formData.get("title") || ""),
        subjectId,
        durationMinutes: Number(formData.get("durationMinutes") || 60),
        description: String(formData.get("description") || "") || undefined,
        googleFormUrl: String(formData.get("googleFormUrl") || ""),
      });
      toast.success("Ujian dibuat sebagai draf", {
        description: "Admin akan mengatur jadwal & mempublikasikan ujian ini.",
      });
      onOpenChange(false);
      onCreated();
    } catch (err) {
      console.error("Create exam error:", err);
      setError(err instanceof Error ? err.message : "Gagal membuat ujian.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Ujian Baru</DialogTitle>
          <DialogDescription>
            Tempel link Google Form yang sudah berisi soal. Ujian dibuat sebagai
            draf — admin akan mengatur jadwal dan mempublikasikannya.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="exam-title">Nama ujian *</Label>
            <Input
              id="exam-title"
              name="title"
              placeholder="Contoh: Ujian Tengah Semester Matematika"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Mapel *</Label>
              <Select
                name="subjectId"
                required
                disabled={isSubmitting}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder={subjects.length ? "Pilih mapel" : "Belum ada mapel"} />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjects.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada mapel. Minta admin menambahkan mapel terlebih dahulu.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exam-duration">Durasi (menit) *</Label>
              <Input
                id="exam-duration"
                name="durationMinutes"
                type="number"
                min={1}
                max={600}
                defaultValue={60}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exam-description">Deskripsi</Label>
            <Input
              id="exam-description"
              name="description"
              placeholder="Petunjuk singkat untuk siswa (opsional)"
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exam-url">Link Google Form *</Label>
            <Input
              id="exam-url"
              name="googleFormUrl"
              type="url"
              placeholder="https://docs.google.com/forms/d/e/.../viewform"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Gunakan link dari tombol <span className="font-medium">"Kirim"</span>{" "}
              di Google Form. Link pendek (forms.gle) belum bisa ditampilkan di
              dalam aplikasi.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !subjects.length}
              className="rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <FilePlus2 className="size-4" /> Buat Draf
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Participants dialog
// ---------------------------------------------------------------------------

function ParticipantsDialog({
  exam,
  open,
  onOpenChange,
}: {
  exam: ExamData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [attempts, setAttempts] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    if (open) {
      api.attemptsForExam(exam.id).then(setAttempts).catch(console.error);
    }
  }, [open, exam.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Peserta — {exam.title}</DialogTitle>
          <DialogDescription>
            Status pengerjaan dan catatan pelanggaran setiap siswa.
          </DialogDescription>
        </DialogHeader>

        {attempts === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : attempts.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Belum ada peserta</EmptyTitle>
              <EmptyDescription>
                Belum ada siswa yang memulai ujian ini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Siswa</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Pelanggaran</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{attempt.student?.name || "Tanpa nama"}</p>
                      <p className="text-xs text-muted-foreground">
                        @{attempt.student?.username}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {attempt.status === "in_progress" && (
                        <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <Timer className="size-3" /> Berjalan
                        </Badge>
                      )}
                      {attempt.status === "completed" && (
                        <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="size-3" /> Selesai
                        </Badge>
                      )}
                      {attempt.status === "expired" && (
                        <Badge variant="outline" className="rounded-full border-destructive/40 bg-destructive/10 text-destructive">
                          <AlertTriangle className="size-3" /> Waktu habis
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          attempt.violationCount > 0
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {attempt.violationCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Pelanggaran dihitung dari aktivitas pindah tab atau meninggalkan
          halaman ujian saat waktu masih berjalan.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Exam card
// ---------------------------------------------------------------------------

function ExamStatusBadge({ exam }: { exam: ExamData }) {
  if (!exam.isActive) {
    return (
      <Badge variant="secondary" className="rounded-full">
        <FilePlus2 className="size-3" /> Draf
      </Badge>
    );
  }
  const availability = examAvailability(exam);
  if (availability.state === "not_yet") {
    return (
      <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 text-primary">
        <CalendarClock className="size-3" /> Belum dibuka
      </Badge>
    );
  }
  if (availability.state === "closed") {
    return (
      <Badge variant="outline" className="rounded-full border-destructive/40 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-3" /> Ditutup
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="size-3" /> Terbuka
    </Badge>
  );
}

function ExamCard({ exam, index }: { exam: ExamData; index: number }) {
  const [summary, setSummary] = useState<{
    started: number;
    inProgress: number;
    completed: number;
    totalViolations: number;
  } | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    api.attemptsSummary(exam.id).then(setSummary).catch(console.error);
  }, [exam.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Card className="h-full rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileQuestion className="size-5" />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <ExamStatusBadge exam={exam} />
              <Badge variant="secondary" className="rounded-full">
                {formatDuration(exam.durationMinutes)}
              </Badge>
            </div>
          </div>
          <CardTitle className="mt-3 leading-tight">{exam.title}</CardTitle>
          <p className="text-sm font-medium text-muted-foreground">
            {exam.subjectName || "Tanpa mapel"}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Dibuat {formatDateTime(parseInt(exam.created_at) || Date.now())}
            </p>
          </div>

          {exam.isActive && (exam.startsAt || exam.endsAt) ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              <CalendarClock className="size-3.5 shrink-0 text-primary" />
              <span>
                {exam.startsAt
                  ? `Buka ${formatDateTime(exam.startsAt)}`
                  : "Buka sekarang"}
                {exam.endsAt ? ` · Tutup ${formatDateTime(exam.endsAt)}` : ""}
              </span>
            </div>
          ) : !exam.isActive ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
              Menunggu admin untuk dijadwalkan & dipublikasikan.
            </div>
          ) : null}

          <Separator />

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 px-2 py-2.5">
              <p className="text-lg font-bold tabular-nums">{summary?.started ?? "–"}</p>
              <p className="text-[11px] font-medium text-muted-foreground">Mulai</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-2 py-2.5">
              <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-300">
                {summary?.inProgress ?? "–"}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">Berjalan</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-2 py-2.5">
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                {summary?.completed ?? "–"}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">Selesai</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              {summary?.totalViolations ?? 0} pelanggaran tercatat
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => setShowParticipants(true)}
            >
              <Users className="size-4" /> Lihat Peserta
            </Button>
            <Button variant="ghost" size="icon" className="rounded-lg" asChild>
              <a
                href={exam.google_form_url}
                target="_blank"
                rel="noreferrer"
                title="Buka Google Form"
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <ParticipantsDialog
        exam={exam}
        open={showParticipants}
        onOpenChange={setShowParticipants}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Teacher dashboard
// ---------------------------------------------------------------------------

export default function TeacherDashboard() {
  const { user, signOut } = useAuth();
  const [exams, setExams] = useState<ExamData[] | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loadExams = useCallback(async () => {
    try {
      const data = await api.listExams();
      setExams(data);
    } catch (err) {
      console.error("Load exams error:", err);
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="size-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Ruang Guru — {user?.name?.split(" ")[0] || "Guru"}
              </p>
              <h1 className="text-sm font-bold tracking-tight">Manajemen Ujian</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-lg"
              onClick={() => setShowCreate(true)}
            >
              <FilePlus2 className="size-4" /> Buat Ujian
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setShowPassword(true)}
            >
              <KeyRound className="size-4" />
              <span className="hidden sm:inline">Ubah Password</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-lg"
              onClick={handleSignOut}
              title="Keluar"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        {exams === undefined ? (
          <div className="flex justify-center py-24">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : exams.length === 0 ? (
          <Empty className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileQuestion className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Belum ada ujian</EmptyTitle>
              <EmptyDescription>
                Buat ujian pertama kamu dengan menempelkan link Google Form dan
                memilih mapel. Setelah itu admin akan mengatur jadwalnya.
              </EmptyDescription>
              <Button className="mt-2 rounded-lg" onClick={() => setShowCreate(true)}>
                <FilePlus2 className="size-4" /> Buat Ujian
              </Button>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  {exams.length} ujian
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ujian yang kamu buat tampil di sini. Yang berstatus{" "}
                  <span className="font-medium">Draf</span> belum terlihat siswa
                  sampai admin mengatur jadwalnya.
                </p>
              </div>
              <Button variant="outline" className="rounded-lg" onClick={() => setShowCreate(true)}>
                <FilePlus2 className="size-4" /> Buat
              </Button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {exams.map((exam, i) => (
                <ExamCard key={exam.id} exam={exam} index={i} />
              ))}
            </div>
          </>
        )}
      </div>

      <CreateExamDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadExams} />
      <ChangePasswordDialog open={showPassword} onOpenChange={setShowPassword} />
    </main>
  );
}
