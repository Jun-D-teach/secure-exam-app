import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileQuestion,
  LogOut,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
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
import { examAvailability, formatDateTime, formatDuration } from "@/lib/exam-utils";
import type { Doc } from "@/convex/_generated/dataModel";

type Exam = Doc<"exams">;
type Attempt = Doc<"examAttempts">;

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

export default function StudentDashboard() {
  const { user, signOut } = useAuth();
  const exams = useQuery(api.exams.listExams);
  const attempts = useQuery(api.exams.myAttempts);

  const firstName = user?.name?.split(" ")[0] || "Siswa";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

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
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" /> Keluar
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        {exams === undefined || attempts === undefined ? (
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
                Guru belum membagikan ujian apa pun. Cek kembali nanti — ujian
                yang tersedia akan muncul di halaman ini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {exams.map((exam, i) => {
              const attempt = attemptFor(exam, attempts);
              const availability = examAvailability(exam);
              return (
                <motion.div
                  key={exam._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
                  <Card className="h-full rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <FileQuestion className="size-5" />
                        </div>
                        <StatusBadge attempt={attempt} exam={exam} />
                      </div>
                      <h2 className="mt-4 text-lg font-bold tracking-tight">
                        {exam.title}
                      </h2>
                      {exam.subject && (
                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                          {exam.subject}
                        </p>
                      )}
                      {exam.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {exam.description}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="size-3.5 text-primary" />
                          {formatDuration(exam.durationMinutes)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="size-3.5 text-primary" />
                          Terpantau
                        </span>
                      </div>
                      {(exam.startsAt || exam.endsAt) && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <CalendarClock className="size-3.5 shrink-0 text-primary" />
                          <span>
                            {exam.startsAt
                              ? `Buka ${formatDateTime(exam.startsAt)}`
                              : "Sudah dibuka"}
                            {exam.endsAt ? ` · Tutup ${formatDateTime(exam.endsAt)}` : ""}
                          </span>
                        </div>
                      )}
                      <div className="mt-6 flex-1" />
                      {attempt ? (
                        <Button asChild className="w-full rounded-lg">
                          <Link to={`/exam/${exam._id}`}>
                            {attempt.status === "in_progress"
                              ? "Lanjutkan"
                              : "Lihat Hasil"}
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      ) : availability.state === "not_yet" ? (
                        <Button disabled className="w-full rounded-lg">
                          <CalendarClock className="size-4" />
                          Dibuka {formatDateTime(availability.opensAt)}
                        </Button>
                      ) : availability.state === "closed" ? (
                        <Button disabled className="w-full rounded-lg">
                          Ujian ditutup
                        </Button>
                      ) : (
                        <Button asChild className="w-full rounded-lg">
                          <Link to={`/exam/${exam._id}`}>
                            Mulai Ujian
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
