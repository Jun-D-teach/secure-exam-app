import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileQuestion,
  GraduationCap,
  KeyRound,
  LogOut,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useAuth } from "@/hooks/use-auth";
import { api, type Exam, type Attempt } from "@/lib/api";
import { examAvailability, formatDateTime, formatDuration } from "@/lib/exam-utils";

function attemptFor(exam: Exam, attempts: Attempt[] | undefined) {
  return attempts?.find((a) => a.examId === exam._id);
}

function StatusBadge({ attempt, exam }: { attempt: Attempt | undefined; exam: Exam }) {
  if (!attempt) {
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
          <TriangleAlert className="size-3" /> Ditutup
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="rounded-full">
        Belum dikerjakan
      </Badge>
    );
  }
  if (attempt.status === "in_progress") {
    return (
      <Badge variant="outline" className="rounded-full border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        <Timer className="size-3" /> Sedang berjalan
      </Badge>
    );
  }
  if (attempt.status === "completed") {
    return (
      <Badge variant="outline" className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Selesai
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="rounded-full border-destructive/40 bg-destructive/10 text-destructive">
      <TriangleAlert className="size-3" /> Waktu habis
    </Badge>
  );
}

function ExamEntry({ exam, attempt }: { exam: Exam; attempt: Attempt | undefined }) {
  const availability = examAvailability(exam);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold tracking-tight">{exam.title}</h3>
          {exam.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {exam.description}
            </p>
          )}
        </div>
        <StatusBadge attempt={attempt} exam={exam} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-primary" />
          {formatDuration(exam.durationMinutes)}
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-primary" />
          Terpantau
        </span>
        {(exam.startsAt || exam.endsAt) && (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-primary" />
            {exam.startsAt ? `Buka ${formatDateTime(exam.startsAt)}` : "Sudah dibuka"}
            {exam.endsAt ? ` · Tutup ${formatDateTime(exam.endsAt)}` : ""}
          </span>
        )}
      </div>
      <div>
        {attempt ? (
          <Button asChild className="w-full rounded-lg sm:w-auto">
            <Link to={`/exam/${exam._id}`}>
              {attempt.status === "in_progress" ? "Lanjutkan" : "Lihat Hasil"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : availability.state === "not_yet" ? (
          <Button disabled className="w-full rounded-lg sm:w-auto">
            <CalendarClock className="size-4" />
            Dibuka {formatDateTime(availability.opensAt)}
          </Button>
        ) : availability.state === "closed" ? (
          <Button disabled className="w-full rounded-lg sm:w-auto">
            Ujian ditutup
          </Button>
        ) : (
          <Button asChild className="w-full rounded-lg sm:w-auto">
            <Link to={`/exam/${exam._id}`}>
              Mulai Ujian
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, signOut } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const firstName = user?.name?.split(" ")[0] || "Siswa";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsRes, attemptsRes] = await Promise.all([
        api.get<Exam[]>("/api/exams"),
        api.get<Attempt[]>("/api/attempts/my"),
      ]);
      setExams(examsRes);
      setAttempts(attemptsRes);
    } catch (err) {
      console.error("Failed to load student data:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  // Group published exams by subject
  const groups: { subjectName: string; exams: Exam[] }[] = [];
  for (const exam of exams) {
    const name = exam.subjectName || "Tanpa mapel";
    const group = groups.find((g) => g.subjectName === name);
    if (group) {
      group.exams.push(exam);
    } else {
      groups.push({ subjectName: name, exams: [exam] });
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Halo, {firstName} 👋
            </p>
            <h1 className="text-sm font-bold tracking-tight">Ujian Saya</h1>
          </div>
          <div className="flex items-center gap-2">
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
              size="sm"
              className="rounded-lg"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        {loading ? (
          <div className="flex justify-center py-24">
            <Timer className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : exams.length === 0 ? (
          <Empty className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileQuestion className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Belum ada ujian</EmptyTitle>
              <EmptyDescription>
                Admin belum menjadwalkan ujian apa pun. Cek kembali nanti —
                ujian yang tersedia akan muncul di halaman ini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Pilih mapel</h2>
              <p className="text-sm text-muted-foreground">
                Pilih mapel untuk mengerjakan ujian yang dijadwalkan.
              </p>
            </div>
            {groups.map((group, gi) => (
              <motion.section
                key={group.subjectName}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: gi * 0.06 }}
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-bold tracking-tight">{group.subjectName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.exams.length} ujian
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {group.exams.map((exam) => (
                    <Card key={exam._id} className="rounded-2xl border-border/70 shadow-sm">
                      <CardContent className="p-0">
                        <ExamEntry exam={exam} attempt={attemptFor(exam, attempts)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        )}
      </div>

      <ChangePasswordDialog open={showPassword} onOpenChange={setShowPassword} />
    </main>
  );
}
