import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  EyeOff,
  FileText,
  GraduationCap,
  LogIn,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.08,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={logo} alt="UjianKita" width={34} height={34} className="rounded-lg" />
      <span className="text-[17px] font-bold tracking-tight text-foreground">
        UjianKita
      </span>
    </Link>
  );
}

function ExamMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      {/* soft glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-tr from-primary/15 via-accent to-transparent blur-2xl"
      />
      <motion.div
        initial={{ opacity: 0, y: 32, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-slate-900/5"
      >
        {/* window header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/50 px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-2 rounded-full bg-destructive/70" />
            <span className="flex size-2 rounded-full bg-amber-400" />
            <span className="flex size-2 rounded-full bg-emerald-500" />
            <span className="ml-2 hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex">
              <FileText className="size-3.5" /> Ujian Tengah Semester — Google Form
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-3" /> Terpantau
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-primary-foreground">
              <Timer className="size-3" /> 14:32
            </span>
          </div>
        </div>
        {/* form body */}
        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <div className="mb-2 h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-3.5 rounded-full border-2 border-primary/50" />
                <span className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-3.5 rounded-full border-2 border-primary/50" />
                <span className="h-2.5 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-3.5 rounded-full border-2 border-primary/50" />
                <span className="h-2.5 w-2/5 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs font-medium text-primary">
            <span className="flex items-center gap-2">
              <EyeOff className="size-4" /> Jangan pindah tab — semua aktivitas dicatat
            </span>
            <CheckCircle2 className="size-4" />
          </div>
        </div>
      </motion.div>
      {/* floating chips */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="absolute -left-4 top-16 hidden rounded-xl border border-border/70 bg-card px-3.5 py-2.5 shadow-lg sm:block"
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Clock3 className="size-4 text-primary" /> Waktu terkunci otomatis
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.75, duration: 0.5 }}
        className="absolute -right-4 bottom-14 hidden rounded-xl border border-border/70 bg-card px-3.5 py-2.5 shadow-lg sm:block"
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Users className="size-4 text-primary" /> 0 pelanggaran
        </div>
      </motion.div>
    </div>
  );
}

const steps = [
  {
    icon: LogIn,
    title: "Masuk dengan email",
    desc: "Guru dan siswa login dengan alamat email masing-masing melalui kode OTP.",
  },
  {
    icon: FileText,
    title: "Guru menyiapkan ujian",
    desc: "Tempel link Google Form, atur durasi, lalu ujian langsung aktif untuk siswa.",
  },
  {
    icon: ShieldCheck,
    title: "Siswa mengerjakan dengan aman",
    desc: "Timer berjalan otomatis dan pindah tab terdeteksi serta dicatat guru.",
  },
];

const features = [
  {
    icon: Timer,
    title: "Timer otomatis & terkunci",
    desc: "Waktu dihitung di server sejak ujian dimulai. Segarkan halaman pun waktu tidak bertambah.",
  },
  {
    icon: EyeOff,
    title: "Deteksi pindah tab",
    desc: "Keluar dari halaman ujian terekam sebagai pelanggaran dan dilaporkan ke guru.",
  },
  {
    icon: FileText,
    title: "Tetap pakai Google Form",
    desc: "Soal tetap dikelola di Google Form — cukup tempel link, selesai. Tanpa mengubah cara mengajar.",
  },
  {
    icon: GraduationCap,
    title: "Login per siswa",
    desc: "Setiap siswa teridentifikasi lewat akunnya, jadi tidak ada yang mengerjakan atas nama orang lain.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Brand />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#cara-kerja" className="transition-colors hover:text-foreground">Cara kerja</a>
            <a href="#fitur" className="transition-colors hover:text-foreground">Fitur</a>
            <a href="#peran" className="transition-colors hover:text-foreground">Peran</a>
          </nav>
          <Button asChild size="sm" className="rounded-lg">
            <Link to="/auth">
              <LogIn className="size-4" /> Masuk
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.915_0.006_240/0.5)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.915_0.006_240/0.5)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
          <div>
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
                <ShieldCheck className="size-3.5" />
                Ujian Google Form yang bebas kecurangan
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="mt-6 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]"
            >
              Ujian tetap jujur.{" "}
              <span className="bg-gradient-to-r from-primary to-teal-500 bg-clip-text text-transparent">
                Waktu tetap terkunci.
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              UjianKita membungkus Google Form dengan sistem login siswa, timer
              otomatis, dan pengawasan anti-mencontek — tanpa mengubah cara guru
              membuat soal.
            </motion.p>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button asChild size="lg" className="rounded-lg px-6">
                <Link to="/auth">
                  Mulai Sekarang <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-lg px-6">
                <Link to="/auth">Masuk sebagai Siswa</Link>
              </Button>
            </motion.div>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={4}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Gratis untuk guru
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Tanpa install aplikasi
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Siap dipakai sekolah
              </span>
            </motion.div>
          </div>
          <ExamMockup />
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="border-t border-border/60 bg-muted/40 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Cara kerja
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Tiga langkah, tanpa ribet
            </h2>
            <p className="mt-4 text-muted-foreground">
              Dari membuka ujian sampai hasil terkumpul — semua berjalan otomatis
              dan bisa dipantau guru.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-2xl border border-border/70 bg-card p-6 shadow-sm"
              >
                <span className="absolute right-5 top-5 text-4xl font-extrabold text-border/80">
                  {i + 1}
                </span>
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-bold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Fitur
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Dibuat khusus untuk ujian yang adil
            </h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-bold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="peran" className="border-t border-border/60 bg-muted/40 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Untuk siapa
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Satu platform untuk guru dan siswa
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-8 shadow-sm"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="size-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight">Untuk Guru</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Buat ujian dalam hitungan menit dengan link Google Form yang
                sudah ada, atur durasi, lalu pantau siapa yang sudah mengerjakan
                dan siapa yang kedapatan pindah tab.
              </p>
              <Button asChild variant="outline" className="mt-6 self-start rounded-lg">
                <Link to="/auth">
                  Masuk sebagai Guru <ArrowRight className="size-4" />
                </Link>
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="flex flex-col rounded-2xl border border-border/70 bg-card p-8 shadow-sm"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400">
                <Users className="size-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight">Untuk Siswa</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Login dengan email, pilih ujian yang tersedia, dan kerjakan
                langsung di dalam aplikasi. Waktu dihitung mundur otomatis dan
                semua jawaban dikirim lewat Google Form seperti biasa.
              </p>
              <Button asChild variant="outline" className="mt-6 self-start rounded-lg">
                <Link to="/auth">
                  Masuk sebagai Siswa <ArrowRight className="size-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground shadow-xl sm:px-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-teal-300/20 blur-2xl"
            />
            <h2 className="relative text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Siap mengadakan ujian yang lebih jujur?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/80">
              Login hanya butuh alamat email. Buat ujian pertama Anda dalam
              semenit dan bagikan ke siswa.
            </p>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="relative mt-8 rounded-lg bg-white text-primary shadow-md hover:bg-white/90"
            >
              <Link to="/auth">
                Masuk Sekarang <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="UjianKita" width={24} height={24} className="rounded-md" />
            <span className="font-semibold text-foreground">UjianKita</span>
          </div>
          <p>Ujian online anti-mencontek berbasis Google Form.</p>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="transition-colors hover:text-foreground">
              Masuk
            </Link>
            <a href="#cara-kerja" className="transition-colors hover:text-foreground">
              Cara kerja
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
