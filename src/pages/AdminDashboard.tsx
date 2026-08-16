import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useAuth } from "@/hooks/use-auth";
import { examAvailability, formatDateTime, formatDuration } from "@/lib/exam-utils";

type Exam = Doc<"exams"> & { subjectName: string | null; teacherName: string | null };
type User = Doc<"users">;
type Subject = Doc<"subjects">;

// ---------------------------------------------------------------------------
// Accounts section
// ---------------------------------------------------------------------------

function AccountsSection() {
  const users = useQuery(api.users.listUsers);
  const createUser = useAction(api.users.createUser);
  const deleteUser = useMutation(api.users.deleteUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await createUser({
        name: String(formData.get("name") || ""),
        username: String(formData.get("username") || ""),
        password: String(formData.get("password") || ""),
        role: String(formData.get("role") || "student") as "student" | "teacher",
      });
      toast.success("Akun berhasil dibuat");
      event.currentTarget.reset();
    } catch (err) {
      console.error("Create user error:", err);
      setError(err instanceof Error ? err.message : "Gagal membuat akun.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Hapus akun ${user.name || user.username}?`)) return;
    try {
      await deleteUser({ userId: user._id });
      toast.success("Akun dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus akun.");
    }
  };

  const roleLabel = (role: User["role"]) =>
    role === "admin" ? "Admin" : role === "teacher" ? "Guru" : role === "student" ? "Siswa" : "—";

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base tracking-tight">
          <Users className="size-4 text-primary" /> Akun Guru & Siswa
        </CardTitle>
        <CardDescription>
          Buat akun login untuk guru dan siswa. Password awal minimal 8 karakter
          — bagikan ke pemilik akun.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-xl border border-border/70 bg-muted/30 p-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-name" className="text-xs">Nama lengkap *</Label>
              <Input id="acc-name" name="name" placeholder="mis. Budi Santoso" required disabled={isSubmitting} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-username" className="text-xs">Username *</Label>
              <Input
                id="acc-username"
                name="username"
                placeholder="mis. budi.santoso"
                pattern="[a-z0-9_.-]{3,32}"
                title="3–32 karakter: huruf kecil, angka, . _ -"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-password" className="text-xs">Password awal *</Label>
              <Input
                id="acc-password"
                name="password"
                type="text"
                minLength={8}
                placeholder="min. 8 karakter"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Peran *</Label>
              <Select name="role" defaultValue="student" disabled={isSubmitting}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Siswa</SelectItem>
                  <SelectItem value="teacher">Guru</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Button type="submit" disabled={isSubmitting} className="rounded-lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Membuat...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" /> Buat Akun
                </>
              )}
            </Button>
          </div>
        </form>

        {users === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Peran</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">@{user.username}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={user.role === "admin" ? "secondary" : "outline"}
                        className="rounded-full"
                      >
                        {roleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role !== "admin" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(user)}
                          title="Hapus akun"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <ShieldCheck className="ml-auto size-4 text-primary" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Subjects section
// ---------------------------------------------------------------------------

function SubjectsSection() {
  const subjects = useQuery(api.subjects.listSubjects);
  const createSubject = useMutation(api.subjects.createSubject);
  const deleteSubject = useMutation(api.subjects.deleteSubject);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    try {
      await createSubject({
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || "") || undefined,
      });
      toast.success("Mapel ditambahkan");
      event.currentTarget.reset();
    } catch (err) {
      console.error("Create subject error:", err);
      setError(err instanceof Error ? err.message : "Gagal menambahkan mapel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (subject: Subject) => {
    if (!confirm(`Hapus mapel ${subject.name}?`)) return;
    try {
      await deleteSubject({ subjectId: subject._id });
      toast.success("Mapel dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus mapel.");
    }
  };

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base tracking-tight">
          <BookOpen className="size-4 text-primary" /> Mapel
        </CardTitle>
        <CardDescription>
          Mapel menentukan “jalur” yang tampil di halaman siswa. Guru hanya bisa
          memilih mapel dari daftar ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-[1fr_auto]"
        >
          <div className="grid gap-2">
            <Label htmlFor="subj-name" className="text-xs">Nama mapel *</Label>
            <Input
              id="subj-name"
              name="name"
              placeholder="mis. Matematika, IPA, Bahasa Indonesia"
              required
              disabled={isSubmitting}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting} className="rounded-lg">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <BookOpen className="size-4" /> Tambah
                </>
              )}
            </Button>
          </div>
        </form>

        {subjects === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : subjects.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Belum ada mapel</EmptyTitle>
              <EmptyDescription>
                Tambahkan mapel pertama agar guru bisa membuat ujian.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject) => (
              <div
                key={subject._id}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 py-1.5 pl-3 pr-1.5"
              >
                <span className="text-sm font-medium">{subject.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(subject)}
                  title="Hapus mapel"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Schedule section
// ---------------------------------------------------------------------------

function ScheduleDialog({
  exam,
  open,
  onOpenChange,
}: {
  exam: Exam;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setExamSchedule = useMutation(api.exams.setExamSchedule);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const startsAtRaw = String(formData.get("startsAt") || "");
    const endsAtRaw = String(formData.get("endsAt") || "");
    const publish = String(formData.get("publish")) === "on";
    try {
      await setExamSchedule({
        examId: exam._id,
        isActive: publish,
        startsAt: startsAtRaw ? new Date(startsAtRaw).getTime() : undefined,
        endsAt: endsAtRaw ? new Date(endsAtRaw).getTime() : undefined,
      });
      toast.success(publish ? "Ujian dipublikasikan" : "Ujian diarsipkan (draf)");
      onOpenChange(false);
    } catch (err) {
      console.error("Schedule exam error:", err);
      setError(err instanceof Error ? err.message : "Gagal menyimpan jadwal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toLocalInput = (ts: number | undefined) =>
    ts ? new Date(ts).toISOString().slice(0, 16) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atur jadwal — {exam.title}</DialogTitle>
          <DialogDescription>
            Tentukan kapan siswa boleh mulai mengerjakan, lalu publikasikan agar
            muncul di halaman siswa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sch-starts" className="text-xs">Buka pada</Label>
              <Input
                id="sch-starts"
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalInput(exam.startsAt)}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sch-ends" className="text-xs">Tutup pada</Label>
              <Input
                id="sch-ends"
                name="endsAt"
                type="datetime-local"
                defaultValue={toLocalInput(exam.endsAt)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm font-medium">
            <input
              type="checkbox"
              name="publish"
              defaultChecked={exam.isActive}
              disabled={isSubmitting}
              className="size-4 rounded border-input accent-[var(--primary)]"
            />
            Publikasikan ke siswa (muncul di halaman siswa)
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Kosongkan “Buka pada” untuk langsung terbuka. “Tutup pada” adalah
            batas terakhir siswa boleh mulai — ujian yang berjalan tetap lanjut
            sampai waktunya habis.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <CalendarClock className="size-4" /> Simpan Jadwal
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExamStatusBadge({ exam }: { exam: Exam }) {
  if (!exam.isActive) {
    return (
      <Badge variant="secondary" className="rounded-full">
        Draf
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

function ScheduleSection() {
  const exams = useQuery(api.exams.listExams);
  const [editing, setEditing] = useState<Exam | null>(null);

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base tracking-tight">
          <CalendarClock className="size-4 text-primary" /> Jadwal Ujian
        </CardTitle>
        <CardDescription>
          Ujian buatan guru muncul sebagai Draf. Atur waktu buka/tutup lalu
          publikasikan — hanya ujian terpublikasi yang terlihat siswa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {exams === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : exams.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Belum ada ujian</EmptyTitle>
              <EmptyDescription>
                Belum ada ujian dari guru. Setelah guru membuat ujian, draf-nya
                akan tampil di sini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Ujian</th>
                  <th className="px-4 py-3">Mapel</th>
                  <th className="px-4 py-3">Guru</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam._id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(exam.durationMinutes)}
                        {exam.startsAt || exam.endsAt
                          ? ` · ${exam.startsAt ? `Buka ${formatDateTime(exam.startsAt)}` : "Buka sekarang"}${exam.endsAt ? ` · Tutup ${formatDateTime(exam.endsAt)}` : ""}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">{exam.subjectName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{exam.teacherName || "—"}</td>
                    <td className="px-4 py-3">
                      <ExamStatusBadge exam={exam} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setEditing(exam)}
                      >
                        <CalendarClock className="size-3.5" /> Atur Jadwal
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editing && (
        <ScheduleDialog
          exam={editing}
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { user, signOut } = useAuth();

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
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Panel Admin — {user?.name?.split(" ")[0] || "Admin"}
              </p>
              <h1 className="text-sm font-bold tracking-tight">Kelola Sekolah</h1>
            </div>
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
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Panel Admin UjianKita
            </h2>
            <p className="text-sm text-muted-foreground">
              Kelola akun, mapel, dan jadwal ujian. Semua alur login mengikuti
              akun yang kamu buat di sini.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0 }}
          >
            <AccountsSection />
          </motion.div>
          <Separator />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
          >
            <SubjectsSection />
          </motion.div>
          <Separator />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <ScheduleSection />
          </motion.div>
        </div>
      </div>
    </main>
  );
}
