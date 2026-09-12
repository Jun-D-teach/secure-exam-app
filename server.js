// ============================================================
//  Portal Berita MAN 2 Palembang — Express.js + SQLite Backend
// ============================================================

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
var Database = require("better-sqlite3");
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");

var app = express();
var PORT = process.env.PORT || 3001;
var JWT_SECRET = process.env.JWT_SECRET || "man2palembang-portal-secret-2024";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ============================================================
//  DATABASE SETUP
// ============================================================

var dbPath = path.join(process.cwd(), "portal.db");
var db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin','teacher','student')),
    avatar TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    nip TEXT DEFAULT '',
    nisn TEXT DEFAULT '',
    class_name TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#0d9488',
    icon TEXT DEFAULT 'newspaper',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT DEFAULT '',
    featured_image TEXT DEFAULT '',
    category_id INTEGER,
    author_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
    views INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS article_tags (
    article_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (article_id, tag_id),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
    expires_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sliders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    image TEXT DEFAULT '',
    link TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS page_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
  CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
  CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
  CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);
  CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);
  CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
  CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
`);

// ============================================================
//  SEED DATA
// ============================================================

var userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  console.log("[Portal] Seeding initial data...");

  // Default admin
  var adminHash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)").run(
    "Administrator", "admin", adminHash, "admin"
  );

  // Default teacher
  var teacherHash = bcrypt.hashSync("guru1234", 10);
  db.prepare("INSERT INTO users (name, username, password_hash, role, nip, bio) VALUES (?, ?, ?, ?, ?, ?)").run(
    "Pak Ahmad Susanto", "guru", teacherHash, "teacher", "198501012010011001",
    "Guru Matematika MAN 2 Palembang"
  );

  // Default student
  var studentHash = bcrypt.hashSync("siswa1234", 10);
  db.prepare("INSERT INTO users (name, username, password_hash, role, nisn, class_name) VALUES (?, ?, ?, ?, ?, ?)").run(
    "Siti Nurhaliza", "siswa", studentHash, "student", "0081234567", "X IPA 1"
  );

  // Categories
  var categories = [
    { name: "Berita Utama", slug: "berita-utama", description: "Berita terkini dan penting dari MAN 2 Palembang", color: "#0d9488", icon: "newspaper", sort_order: 1 },
    { name: "Pengumuman", slug: "pengumuman", description: "Pengumuman resmi dari pimpinan madrasah", color: "#dc2626", icon: "megaphone", sort_order: 2 },
    { name: "Kegiatan", slug: "kegiatan", description: "Kegiatan dan acara di MAN 2 Palembang", color: "#2563eb", icon: "calendar", sort_order: 3 },
    { name: "Akademik", slug: "akademik", description: "Informasi akademik dan kurikulum", color: "#7c3aed", icon: "graduation-cap", sort_order: 4 },
    { name: "Prestasi", slug: "prestasi", description: "Prestasi siswa dan guru MAN 2 Palembang", color: "#ca8a04", icon: "trophy", sort_order: 5 },
    { name: "Ekstrakurikuler", slug: "ekstrakurikuler", description: "Kegiatan ekstrakurikuler dan pembinaan", color: "#059669", icon: "users", sort_order: 6 },
    { name: "Infografis", slug: "infografis", description: "Infografis dan data visual MAN 2 Palembang", color: "#ea580c", icon: "bar-chart", sort_order: 7 },
    { name: "Artikel", slug: "artikel", description: "Artikel opini dan tulisan warga madrasah", color: "#0891b2", icon: "pen-line", sort_order: 8 },
  ];

  var insertCat = db.prepare("INSERT INTO categories (name, slug, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
  categories.forEach(function(c) {
    insertCat.run(c.name, c.slug, c.description, c.color, c.icon, c.sort_order);
  });

  // Sample articles
  var articles = [
    {
      title: "MAN 2 Palembang Raih Juara 1 Lomba KSM Tingkat Provinsi",
      slug: "man2-palembang-raih-juara-1-lomba-ksm",
      content: "<p>Dengan bangga kami sampaikan bahwa MAN 2 Palembang berhasil meraih Juara 1 dalam Lomba Kompetisi Sains Madrasah (KSM) tingkat Provinsi Sumatera Selatan tahun 2024.</p><p>Prestasi ini diraih oleh tiga siswa terbaik kami:</p><ul><li><strong>Muhammad Rizki Pratama</strong> — Juara 1 Matematika Terintegrasi</li><li><strong>Aisha Putri Ramadhani</strong> — Juara 1 Fisika</li><li><strong>Fajar Nugroho</strong> — Juara 2 Kimia</li></ul><p>Kepala MAN 2 Palembang, Bapak Dr. H. Muhammad Syukri, M.Pd., menyampaikan apresiasi yang tinggi atas kerja keras seluruh siswa dan pembimbing.</p><p>Selamat kepada seluruh siswa yang telah berjuang! Semoga prestasi ini menjadi motivasi bagi seluruh warga madrasah.</p>",
      excerpt: "MAN 2 Palembang berhasil meraih Juara 1 dalam Lomba KSM tingkat Provinsi Sumatera Selatan.",
      category_id: 5,
      is_featured: 1,
      is_pinned: 1,
      views: 245
    },
    {
      title: "Pengumuman Jadwal Ujian Akhir Semester Ganjil 2024/2025",
      slug: "pengumuman-jadwal-uas-ganjil-2024",
      content: "<p>Berdasarkan surat edaran Kepala Madrasah nomor 001/UAS/GANJIL/2024, dengan ini diumumkan jadwal Ujian Akhir Semester (UAS) Ganjil tahun pelajaran 2024/2025:</p><h3>Jadwal Pelaksanaan</h3><table><thead><tr><th>Tanggal</th><th>Hari</th><th>Mata Pelajaran</th></tr></thead><tbody><tr><td>16-17 Desember 2024</td><td>Senin-Selasa</td><td>Bidang Studi Umum</td></tr><tr><td>18-19 Desember 2024</td><td>Rabu-Kamis</td><td>Bidang Studi Keagamaan</td></tr><tr><td>20 Desember 2024</td><td>Jumat</td><td>Bidang Studi Pilihan</td></tr></tbody></table><h3>Ketentuan</h3><ul><li>Seluruh siswa wajib hadir 15 menit sebelum ujian dimulai</li><li>Membawa alat tulis dan kartu ujian</li><li>Dilarang membawa alat bantu elektronik</li><li>Bagi yang berhalangan hadir, wajib melapor ke Wali Kelas</li></ul><p>Semoga seluruh siswa dapat mengerjakan ujian dengan baik dan mendapatkan hasil yang maksimal.</p>",
      excerpt: "Diinformasikan jadwal Ujian Akhir Semester Ganjil tahun pelajaran 2024/2025.",
      category_id: 2,
      is_featured: 1,
      is_pinned: 0,
      views: 189
    },
    {
      title: "Peringatan Maulid Nabi Muhammad SAW 1446 H",
      slug: "peringatan-maulid-nabi-1446h",
      content: "<p>MAN 2 Palembang mengadakan peringatan Maulid Nabi Muhammad SAW 1446 H dengan tema <strong>'Meneladani Akhlak Rasulullah SAW dalam Membangun Generasi Emas'</strong>.</p><p>Kegiatan ini dihadiri oleh seluruh dewan guru, staff tata userta, dan siswa-siswi MAN 2 Palembang. Acara diisi dengan:</p><ul><li>Pembacaan Maulid Diba'</li><li>Ceramah agama oleh Ustadz Dr. KH. Ahmad Darwis, M.Ag.</li><li>Paduan suara Mars Madrasah</li><li>Penampilan seniIslami dari siswa</li></ul><p>Acara berlangsung khidmat dan penuh keberkahan. Semoga peringatan ini menjadi moment untuk lebih mendekatkan diri kepada Allah SWT.</p>",
      excerpt: "MAN 2 Palembang mengadakan peringatan Maulid Nabi Muhammad SAW 1446 H.",
      category_id: 3,
      is_featured: 0,
      is_pinned: 0,
      views: 156
    },
    {
      title: "Program Tahfidz Qur'an MAN 2 Palembang Targetkan 30 Juz",
      slug: "program-tahfidz-quran-target-30-juz",
      content: "<p>MAN 2 Palembang meluncurkan Program Tahfidz Qur'an dengan target hafalan 30 Juz bagi seluruh siswa selama masa pendidikan 3 tahun.</p><p>Program ini merupakan bagian dari visi madrasah untuk mencetak generasi Qur'ani yang unggul dalam bidang akademik dan religius.</p><h3>Struktur Program</h3><ul><li><strong>Tahun Pertama</strong>: Juz 1-10</li><li><strong>Tahun Kedua</strong>: Juz 11-20</li><li><strong>Tahun Ketiga</strong>: Juz 21-30</li></ul><p>Setiap siswa akan mendapatkan bimbingan intensif dari ustadz/ustadzah yang qualified. Monitoring hafalan dilakukan setiap minggu.</p>",
      excerpt: "MAN 2 Palembang meluncurkan Program Tahfidz Qur'an target 30 Juz.",
      category_id: 4,
      is_featured: 1,
      is_pinned: 0,
      views: 132
    },
    {
      title: "Kurikulum Merdeka: Implementasi dan Penguatan di MAN 2 Palembang",
      slug: "kurikulum-merdeka-implementasi",
      content: "<p>MAN 2 Palembang telah melakukan implementasi Kurikulum Merdeka secara bertahap sejak tahun pelajaran 2023/2024. Berikut adalah capaian dan langkah penguatan yang telah dilakukan:</p><h3>Capaian Implementasi</h3><ul><li>Proyek Penguatan Profil Pelajar Pancasila (P5) telah terlaksana</li><li>Asesmen diagnostik untuk setiap siswa baru</li><li>Pembelajaran berbasis proyek di semua jenjang</li></ul><h3>Penguatan</h3><p>Tahun ini, kami melakukan penguatan melalui:</p><ul><li>Pelatihan guru tentang Asesmen Autentik</li><li>Pengembangan modul P5 yang kontekstual</li><li>Penguatan Literasi dan Numerasi (Linur)</li></ul>",
      excerpt: "Capaian implementasi Kurikulum Merdeka di MAN 2 Palembang.",
      category_id: 4,
      is_featured: 0,
      is_pinned: 0,
      views: 98
    },
    {
      title: "MAN 2 Palembang Juara 2 Bidang Keagamaan di Muktamar Sains Madrasah",
      slug: "juara-2-muktamar-sains-madrasah",
      content: "<p>Siswa MAN 2 Palembang kembali mengharumkan nama madrasah di tingkat nasional. Dalam Muktamar Sains Madrasah ke-8 yang diselenggarakan di Jakarta, delegation kami berhasil meraih Juara 2 Bidang Keagamaan.</p><p>Prestasi ini menjadi bukti bahwa MAN 2 Palembang mampu bersaing di tingkat nasional dalam bidang sains dan keagamaan.</p>",
      excerpt: "Siswa MAN 2 Palembang meraih Juara 2 di Muktamar Sains Madrasah tingkat nasional.",
      category_id: 5,
      is_featured: 0,
      is_pinned: 0,
      views: 87
    },
    {
      title: " Jadwal Ekstrakurikuler Semester Ganjil 2024/2025",
      slug: "jadwal-ekskul-semester-ganjil",
      content: "<p>Berikut jadwal kegiatan ekstrakurikuler semester ganjil 2024/2025:</p><ul><li><strong>Robotic Club</strong> — Senin & Rabu, 15.30-17.00</li><li><strong>English Club</strong> — Selasa & Kamis, 15.30-17.00</li><li><strong>PMR (Palang Merah Remaja)</strong> — Rabu, 15.30-17.00</li><li><strong>Bucketball</strong> — Kamis, 15.30-17.00</li><li><strong>Hadroh & Rebana</strong> — Jumat, 15.30-17.00</li><li><strong>Olahraga (Bulutangkis, Futsal, Basket)</strong> — Senin-Jumat, 06.30-07.30</li></ul><p>Pendaftaran dibuka mulai tanggal 15 Juli 2024 di Ruang OSIS.</p>",
      excerpt: "Jadwal kegiatan ekstrakurikuler semester ganjil 2024/2025.",
      category_id: 6,
      is_featured: 0,
      is_pinned: 0,
      views: 112
    },
    {
      title: "Infografis: Profil MAN 2 Palembang Tahun 2024",
      slug: "infografis-profil-man2-2024",
      content: "<p>Berikut infografis profil MAN 2 Palembang tahun 2024:</p><ul><li><strong>Jumlah Siswa</strong>: 1.250 siswa</li><li><strong>Jumlah Guru</strong>: 85 guru</li><li><strong>Rasio Guru-Siswa</strong>: 1:15</li><li><strong>Rata-rata Nilai UN</strong>: 87.5</li><li><strong>Tingkat Kelulusan</strong>: 100%</li><li><strong>Jumlah Program Unggulan</strong>: 5 program</li></ul><p>MAN 2 Palembang terus berkomitmen untuk memberikan pendidikan terbaik bagi seluruh siswa.</p>",
      excerpt: "Infografis profil lengkap MAN 2 Palembang tahun 2024.",
      category_id: 7,
      is_featured: 0,
      is_pinned: 0,
      views: 76
    }
  ];

  var insertArticle = db.prepare(`INSERT INTO articles (title, slug, content, excerpt, category_id, author_id, status, views, is_featured, is_pinned, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`);

  articles.forEach(function(a) {
    insertArticle.run(a.title, a.slug, a.content, a.excerpt, a.category_id, 1, a.views, a.is_featured, a.is_pinned);
  });

  // Sample announcements
  var insertAnn = db.prepare("INSERT INTO announcements (title, content, is_active, priority, created_by) VALUES (?, ?, 1, ?, 1)");
  insertAnn.run("Libur Semester Ganjil", "MAN 2 Palembang akan melaksanakan libur semester ganjil mulai tanggal 21 Desember 2024 hingga 4 Januari 2025. Kegiatan belajar mengajar akan dimulai kembali pada tanggal 6 Januari 2025.", "high");
  insertAnn.run("Pembayaran SPP Januari 2025", "Bagi orang tua/wali siswa, pembayaran SPP untuk bulan Januari 2025 sudah dapat dilakukan mulai tanggal 2 Januari 2025 di bagian TU.", "normal");

  // Sample tags
  var tags = [
    { name: "Prestasi", slug: "prestasi" },
    { name: "KSM", slug: "ksm" },
    { name: "Ujian", slug: "ujian" },
    { name: "Maulid", slug: "maulid" },
    { name: "Tahfidz", slug: "tahfidz" },
    { name: "Kurikulum Merdeka", slug: "kurikulum-merdeka" },
    { name: "Ekstrakurikuler", slug: "ekskul" },
    { name: "Madrasah", slug: "madrasah" },
  ];
  var insertTag = db.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)");
  tags.forEach(function(t) { insertTag.run(t.name, t.slug); });

  // Sample sliders
  var insertSlider = db.prepare("INSERT INTO sliders (title, subtitle, image, link, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)");
  insertSlider.run("Selamat Datang di MAN 2 Palembang", "Madrasah Unggul, Berprestasi, dan Berkarakter", "", "/berita", 1);
  insertSlider.run("Pendaftaran Siswa Baru 2025/2026", "Sudah dibuka! Daftarkan putra-putri Anda sekarang", "", "/pengumuman", 2);

  // Page settings
  var insertSetting = db.prepare("INSERT OR REPLACE INTO page_settings (key, value) VALUES (?, ?)");
  insertSetting.run("school_name", "MAN 2 Palembang");
  insertSetting.run("school_motto", "Unggul dalam Prestasi, Berkarakter Islam");
  insertSetting.run("school_address", "Jl. Demang Lebar Daun No. 1, Palembang, Sumatera Selatan");
  insertSetting.run("school_phone", "(0711) 123456");
  insertSetting.run("school_email", "info@man2palembang.sch.id");
  insertSetting.run("school_website", "https://man2palembang.sch.id");
  insertSetting.run("footer_text", "© 2024 MAN 2 Palembang. Hak Cipta Dilindungi.");

  console.log("[Portal] Seed data inserted successfully.");
}

// ============================================================
//  HELPERS
// ============================================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch (e) { return null; }
}

function authenticate(req, res, next) {
  var authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token autentikasi diperlukan" });
  }
  var payload = verifyToken(authHeader.substring(7));
  if (!payload) {
    return res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa" });
  }
  req.user = payload;
  next();
}

function optionalAuth(req, res, next) {
  var authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    var payload = verifyToken(authHeader.substring(7));
    if (payload) req.user = payload;
  }
  next();
}

function requireRole(roles) {
  return function(req, res, next) {
    if (!req.user) return res.status(401).json({ error: "Belum masuk" });
    if (roles.indexOf(req.user.role) === -1) return res.status(403).json({ error: "Akses ditolak" });
    next();
  };
}

function logActivity(userId, action, entityType, entityId, details) {
  try {
    db.prepare("INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)").run(
      userId, action, entityType || null, entityId || null, details || ""
    );
  } catch (e) { /* silent */ }
}

// ============================================================
//  API ROUTES
// ============================================================

// --- HEALTH CHECK ---
app.get("/api/health", function(_req, res) {
  res.json({ status: "ok", timestamp: Date.now(), port: PORT, node: process.version, db: "sqlite" });
});

// ============================================================
//  AUTH ROUTES
// ============================================================

app.post("/api/auth/bootstrap-admin", async function(req, res) {
  try {
    var adminExists = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (adminExists > 0) return res.status(400).json({ error: "Akun admin sudah ada" });

    var name = req.body && req.body.name;
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });

    var hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'admin')").run(name.trim(), username, hash);
    res.json({ message: "Akun admin berhasil dibuat" });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(400).json({ error: "Username sudah dipakai" });
    res.status(500).json({ error: "Gagal membuat akun admin" });
  }
});

app.get("/api/auth/has-admin", function(_req, res) {
  var count = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
  res.json({ hasAdmin: count > 0 });
});

app.post("/api/auth/login", function(req, res) {
  try {
    var username = req.body && req.body.username;
    var password = req.body && req.body.password;
    if (!username || !password) return res.status(400).json({ error: "Username dan password diperlukan" });

    var user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) return res.status(401).json({ error: "Username atau password salah" });

    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    var token = generateToken({ userId: user.id, username: user.username, role: user.role });
    logActivity(user.id, "login", "user", user.id, "Login berhasil");
    res.json({
      token: token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, avatar: user.avatar, bio: user.bio }
    });
  } catch (e) {
    res.status(500).json({ error: "Gagal melakukan login" });
  }
});

app.get("/api/auth/me", authenticate, function(req, res) {
  var user = db.prepare("SELECT id, name, username, role, avatar, bio, nip, nisn, class_name, created_at FROM users WHERE id = ?").get(req.user.userId);
  if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
  res.json(user);
});

app.put("/api/auth/me", authenticate, function(req, res) {
  var name = req.body && req.body.name;
  var username = req.body && req.body.username;
  if (!name && !username) return res.status(400).json({ error: "Tidak ada data yang diubah" });

  var user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.userId);
  if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });

  try {
    if (name) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, req.user.userId);
    if (username && username !== user.username) {
      var exists = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, req.user.userId);
      if (exists) return res.status(400).json({ error: "Username sudah dipakai" });
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, req.user.userId);
    }
    res.json({ message: "Profil diperbarui" });
  } catch (e) {
    res.status(500).json({ error: "Gagal memperbarui profil" });
  }
});

app.post("/api/auth/change-password", authenticate, function(req, res) {
  var currentPassword = req.body && req.body.currentPassword;
  var newPassword = req.body && req.body.newPassword;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Password lama dan baru diperlukan" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password baru minimal 8 karakter" });

  var user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.userId);
  if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Password lama salah" });
  }

  var hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user.userId);
  res.json({ message: "Password berhasil diubah" });
});

// ============================================================
//  USERS (admin)
// ============================================================

app.get("/api/users", authenticate, requireRole(["admin"]), function(_req, res) {
  var users = db.prepare("SELECT id, name, username, role, avatar, nip, nisn, class_name, created_at FROM users ORDER BY created_at DESC").all();
  res.json(users);
});

app.post("/api/users", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var { name, username, password, role, nip, nisn, class_name } = req.body;
    if (!name || !username || !password) return res.status(400).json({ error: "Nama, username, dan password diperlukan" });
    if (password.length < 8) return res.status(400).json({ error: "Password minimal 8 karakter" });
    if (!role) role = "student";

    var hash = bcrypt.hashSync(password, 10);
    var result = db.prepare("INSERT INTO users (name, username, password_hash, role, nip, nisn, class_name) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      name.trim(), username, hash, role, nip || "", nisn || "", class_name || ""
    );
    logActivity(req.user.userId, "create_user", "user", result.lastInsertRowid, "Membuat user: " + username);
    res.json({ message: "Akun berhasil dibuat", id: result.lastInsertRowid });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(400).json({ error: "Username sudah dipakai" });
    res.status(500).json({ error: "Gagal membuat akun: " + e.message });
  }
});

app.put("/api/users/:id", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var { name, username, role, nip, nisn, class_name, password } = req.body;
    var user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });

    var updates = [];
    var params = [];
    if (name) { updates.push("name = ?"); params.push(name); }
    if (username && username !== user.username) {
      var exists = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, req.params.id);
      if (exists) return res.status(400).json({ error: "Username sudah dipakai" });
      updates.push("username = ?"); params.push(username);
    }
    if (role) { updates.push("role = ?"); params.push(role); }
    if (nip !== undefined) { updates.push("nip = ?"); params.push(nip); }
    if (nisn !== undefined) { updates.push("nisn = ?"); params.push(nisn); }
    if (class_name !== undefined) { updates.push("class_name = ?"); params.push(class_name); }
    if (password && password.length >= 8) {
      updates.push("password_hash = ?"); params.push(bcrypt.hashSync(password, 10));
    }

    if (updates.length === 0) return res.status(400).json({ error: "Tidak ada data yang diubah" });
    params.push(req.params.id);
    db.prepare("UPDATE users SET " + updates.join(", ") + " WHERE id = ?").run(...params);
    res.json({ message: "Pengguna berhasil diperbarui" });
  } catch (e) {
    res.status(500).json({ error: "Gagal memperbarui pengguna" });
  }
});

app.delete("/api/users/:id", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
    if (user.role === "admin") return res.status(403).json({ error: "Tidak dapat menghapus akun admin" });

    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    logActivity(req.user.userId, "delete_user", "user", req.params.id, "Menghapus user: " + user.username);
    res.json({ message: "Akun berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ error: "Gagal menghapus akun" });
  }
});

// ============================================================
//  CATEGORIES
// ============================================================

app.get("/api/categories", function(_req, res) {
  var categories = db.prepare("SELECT c.*, (SELECT COUNT(*) FROM articles WHERE category_id = c.id AND status = 'published') as article_count FROM categories c ORDER BY c.sort_order ASC, c.name ASC").all();
  res.json(categories);
});

app.post("/api/categories", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var { name, description, color, icon, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: "Nama kategori diperlukan" });
    var slug = slugify(name);
    var result = db.prepare("INSERT INTO categories (name, slug, description, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?)").run(
      name.trim(), slug, description || "", color || "#0d9488", icon || "newspaper", sort_order || 0
    );
    res.json({ message: "Kategori berhasil ditambahkan", id: result.lastInsertRowid });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) return res.status(400).json({ error: "Nama kategori sudah ada" });
    res.status(500).json({ error: "Gagal menambahkan kategori" });
  }
});

app.put("/api/categories/:id", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var { name, description, color, icon, sort_order } = req.body;
    var cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
    if (!cat) return res.status(404).json({ error: "Kategori tidak ditemukan" });

    var updates = [];
    var params = [];
    if (name) { updates.push("name = ?"); params.push(name.trim()); updates.push("slug = ?"); params.push(slugify(name)); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (color) { updates.push("color = ?"); params.push(color); }
    if (icon) { updates.push("icon = ?"); params.push(icon); }
    if (sort_order !== undefined) { updates.push("sort_order = ?"); params.push(sort_order); }

    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare("UPDATE categories SET " + updates.join(", ") + " WHERE id = ?").run(...params);
    }
    res.json({ message: "Kategori berhasil diperbarui" });
  } catch (e) {
    res.status(500).json({ error: "Gagal memperbarui kategori" });
  }
});

app.delete("/api/categories/:id", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    db.prepare("UPDATE articles SET category_id = NULL WHERE category_id = ?").run(req.params.id);
    db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
    res.json({ message: "Kategori berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ error: "Gagal menghapus kategori" });
  }
});

// ============================================================
//  ARTICLES
// ============================================================

// Public: list published articles
app.get("/api/articles", optionalAuth, function(req, res) {
  var { category, tag, search, page, limit, status } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 12;
  var offset = (page - 1) * limit;

  var where = ["a.status = 'published'"];
  var params = [];

  // Admin can see all statuses
  if (status && req.user && req.user.role === "admin") {
    where = ["a.status = ?"];
    params.push(status);
  }

  if (category) {
    where.push("c.slug = ?");
    params.push(category);
  }

  if (search) {
    where.push("(a.title LIKE ? OR a.excerpt LIKE ? OR a.content LIKE ?)");
    var searchTerm = "%" + search + "%";
    params.push(searchTerm, searchTerm, searchTerm);
  }

  var whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  var total = db.prepare("SELECT COUNT(*) as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id " + whereClause).get(...params).count;

  var articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
           u.name as author_name, u.role as author_role
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    ${whereClause}
    ORDER BY a.is_pinned DESC, a.published_at DESC, a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Get tags for each article
  var tagStmt = db.prepare(`
    SELECT t.name, t.slug FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = ?
  `);

  articles = articles.map(function(a) {
    return Object.assign({}, a, {
      tags: tagStmt.all(a.id),
      comment_count: db.prepare("SELECT COUNT(*) as count FROM comments WHERE article_id = ? AND status = 'approved'").get(a.id).count
    });
  });

  res.json({ articles: articles, total: total, page: page, pages: Math.ceil(total / limit) });
});

// Public: get single article by slug
app.get("/api/articles/:slug", optionalAuth, function(req, res) {
  var article = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug, c.color as category_color,
           u.name as author_name, u.role as author_role, u.avatar as author_avatar
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    WHERE a.slug = ?
  `).get(req.params.slug);

  if (!article) return res.status(404).json({ error: "Artikel tidak ditemukan" });

  // Increment views
  db.prepare("UPDATE articles SET views = views + 1 WHERE id = ?").run(article.id);

  // Get tags
  var tags = db.prepare("SELECT t.name, t.slug FROM tags t JOIN article_tags at ON t.id = at.tag_id WHERE at.article_id = ?").all(article.id);

  // Get approved comments
  var comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.role as user_role, u.avatar as user_avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.article_id = ? AND c.status = 'approved'
    ORDER BY c.created_at DESC
  `).all(article.id);

  // Get related articles
  var related = db.prepare(`
    SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image, a.published_at,
           c.name as category_name, c.color as category_color
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.status = 'published' AND a.id != ? AND a.category_id = ?
    ORDER BY a.published_at DESC LIMIT 3
  `).all(article.id, article.category_id);

  res.json(Object.assign({}, article, { tags: tags, comments: comments, related: related, views: article.views + 1 }));
});

// Create article
app.post("/api/articles", authenticate, requireRole(["admin", "teacher"]), function(req, res) {
  try {
    var { title, content, excerpt, category_id, status, featured_image, is_featured, is_pinned, tags } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Judul dan konten diperlukan" });

    var slug = slugify(title);
    // Ensure unique slug
    var existing = db.prepare("SELECT id FROM articles WHERE slug = ?").get(slug);
    if (existing) slug = slug + "-" + Date.now().toString(36);

    var articleStatus = status || "draft";
    var publishedAt = articleStatus === "published" ? new Date().toISOString() : null;

    var result = db.prepare(`
      INSERT INTO articles (title, slug, content, excerpt, featured_image, category_id, author_id, status, is_featured, is_pinned, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(), slug, content, excerpt || "", featured_image || "",
      category_id || null, req.user.userId, articleStatus,
      is_featured ? 1 : 0, is_pinned ? 1 : 0, publishedAt
    );

    // Handle tags
    if (tags && Array.isArray(tags)) {
      var insertTagXref = db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)");
      tags.forEach(function(tagId) {
        insertTagXref.run(result.lastInsertRowid, tagId);
      });
    }

    logActivity(req.user.userId, "create_article", "article", result.lastInsertRowid, "Membuat artikel: " + title);
    res.json({ message: "Artikel berhasil dibuat", id: result.lastInsertRowid, slug: slug });
  } catch (e) {
    res.status(500).json({ error: "Gagal membuat artikel: " + e.message });
  }
});

// Update article
app.put("/api/articles/:id", authenticate, requireRole(["admin", "teacher"]), function(req, res) {
  try {
    var article = db.prepare("SELECT * FROM articles WHERE id = ?").get(req.params.id);
    if (!article) return res.status(404).json({ error: "Artikel tidak ditemukan" });

    // Teachers can only edit their own articles
    if (req.user.role === "teacher" && article.author_id !== req.user.userId) {
      return res.status(403).json({ error: "Anda hanya bisa mengedit artikel sendiri" });
    }

    var { title, content, excerpt, category_id, status, featured_image, is_featured, is_pinned, tags } = req.body;

    var updates = ["updated_at = datetime('now')"];
    var params = [];

    if (title) { updates.push("title = ?"); params.push(title.trim()); var newSlug = slugify(title); updates.push("slug = ?"); params.push(newSlug); }
    if (content !== undefined) { updates.push("content = ?"); params.push(content); }
    if (excerpt !== undefined) { updates.push("excerpt = ?"); params.push(excerpt); }
    if (category_id !== undefined) { updates.push("category_id = ?"); params.push(category_id || null); }
    if (featured_image !== undefined) { updates.push("featured_image = ?"); params.push(featured_image); }
    if (is_featured !== undefined) { updates.push("is_featured = ?"); params.push(is_featured ? 1 : 0); }
    if (is_pinned !== undefined) { updates.push("is_pinned = ?"); params.push(is_pinned ? 1 : 0); }
    if (status) {
      updates.push("status = ?"); params.push(status);
      if (status === "published" && article.status !== "published") {
        updates.push("published_at = datetime('now')");
      }
    }

    params.push(req.params.id);
    db.prepare("UPDATE articles SET " + updates.join(", ") + " WHERE id = ?").run(...params);

    // Handle tags
    if (tags && Array.isArray(tags)) {
      db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(req.params.id);
      var insertTagXref = db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)");
      tags.forEach(function(tagId) {
        insertTagXref.run(req.params.id, tagId);
      });
    }

    logActivity(req.user.userId, "update_article", "article", req.params.id, "Mengupdate artikel");
    res.json({ message: "Artikel berhasil diperbarui" });
  } catch (e) {
    res.status(500).json({ error: "Gagal memperbarui artikel: " + e.message });
  }
});

// Delete article
app.delete("/api/articles/:id", authenticate, requireRole(["admin", "teacher"]), function(req, res) {
  try {
    var article = db.prepare("SELECT * FROM articles WHERE id = ?").get(req.params.id);
    if (!article) return res.status(404).json({ error: "Artikel tidak ditemukan" });

    if (req.user.role === "teacher" && article.author_id !== req.user.userId) {
      return res.status(403).json({ error: "Anda hanya bisa menghapus artikel sendiri" });
    }

    db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(req.params.id);
    db.prepare("DELETE FROM comments WHERE article_id = ?").run(req.params.id);
    db.prepare("DELETE FROM articles WHERE id = ?").run(req.params.id);
    logActivity(req.user.userId, "delete_article", "article", req.params.id, "Menghapus artikel: " + article.title);
    res.json({ message: "Artikel berhasil dihapus" });
  } catch (e) {
    res.status(500).json({ error: "Gagal menghapus artikel" });
  }
});

// Admin: all articles with any status
app.get("/api/admin/articles", authenticate, requireRole(["admin", "teacher"]), function(req, res) {
  var { status, category, search, page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  var offset = (page - 1) * limit;

  var where = [];
  var params = [];

  if (req.user.role === "teacher") {
    where.push("a.author_id = ?");
    params.push(req.user.userId);
  }

  if (status) { where.push("a.status = ?"); params.push(status); }
  if (category) { where.push("c.slug = ?"); params.push(category); }
  if (search) {
    where.push("(a.title LIKE ? OR a.excerpt LIKE ?)");
    params.push("%" + search + "%", "%" + search + "%");
  }

  var whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
  var total = db.prepare("SELECT COUNT(*) as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id " + whereClause).get(...params).count;

  var articles = db.prepare(`
    SELECT a.*, c.name as category_name, c.slug as category_slug,
           u.name as author_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN users u ON a.author_id = u.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ articles: articles, total: total, page: page, pages: Math.ceil(total / limit) });
});

// ============================================================
//  COMMENTS
// ============================================================

app.post("/api/articles/:id/comments", authenticate, function(req, res) {
  try {
    var { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: "Komentar tidak boleh kosong" });

    var article = db.prepare("SELECT id FROM articles WHERE id = ? AND status = 'published'").get(req.params.id);
    if (!article) return res.status(404).json({ error: "Artikel tidak ditemukan" });

    var result = db.prepare("INSERT INTO comments (article_id, user_id, content, status) VALUES (?, ?, ?, 'approved')").run(
      req.params.id, req.user.userId, content.trim()
    );
    logActivity(req.user.userId, "create_comment", "comment", result.lastInsertRowid, "Komentar pada artikel #" + req.params.id);
    res.json({ message: "Komentar berhasil ditambahkan", id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: "Gagal menambahkan komentar" });
  }
});

app.get("/api/admin/comments", authenticate, requireRole(["admin"]), function(req, res) {
  var { status } = req.query;
  var where = status ? "WHERE c.status = ?" : "";
  var params = status ? [status] : [];

  var comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.role as user_role, a.title as article_title, a.slug as article_slug
    FROM comments c
    JOIN users u ON c.user_id = u.id
    JOIN articles a ON c.article_id = a.id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT 100
  `).all(...params);

  res.json(comments);
});

app.put("/api/comments/:id/status", authenticate, requireRole(["admin"]), function(req, res) {
  var { status } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Status tidak valid" });
  }
  db.prepare("UPDATE comments SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ message: "Status komentar diperbarui" });
});

app.delete("/api/comments/:id", authenticate, requireRole(["admin"]), function(req, res) {
  db.prepare("DELETE FROM comments WHERE id = ?").run(req.params.id);
  res.json({ message: "Komentar berhasil dihapus" });
});

// ============================================================
//  ANNOUNCEMENTS
// ============================================================

app.get("/api/announcements", function(_req, res) {
  var announcements = db.prepare(`
    SELECT a.*, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.is_active = 1
    ORDER BY a.priority DESC, a.created_at DESC
  `).all();
  res.json(announcements);
});

app.get("/api/admin/announcements", authenticate, requireRole(["admin"]), function(_req, res) {
  var announcements = db.prepare(`
    SELECT a.*, u.name as author_name
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    ORDER BY a.created_at DESC
  `).all();
  res.json(announcements);
});

app.post("/api/announcements", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var { title, content, priority, is_active, expires_at } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Judul dan konten diperlukan" });

    var result = db.prepare("INSERT INTO announcements (title, content, priority, is_active, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?)").run(
      title.trim(), content, priority || "normal", is_active !== undefined ? (is_active ? 1 : 0) : 1, expires_at || null, req.user.userId
    );
    logActivity(req.user.userId, "create_announcement", "announcement", result.lastInsertRowid, "Membuat pengumuman: " + title);
    res.json({ message: "Pengumuman berhasil dibuat", id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: "Gagal membuat pengumuman" });
  }
});

app.put("/api/announcements/:id", authenticate, requireRole(["admin"]), function(req, res) {
  try {
    var { title, content, priority, is_active, expires_at } = req.body;
    var updates = [];
    var params = [];

    if (title) { updates.push("title = ?"); params.push(title.trim()); }
    if (content) { updates.push("content = ?"); params.push(content); }
    if (priority) { updates.push("priority = ?"); params.push(priority); }
    if (is_active !== undefined) { updates.push("is_active = ?"); params.push(is_active ? 1 : 0); }
    if (expires_at !== undefined) { updates.push("expires_at = ?"); params.push(expires_at || null); }

    if (updates.length === 0) return res.status(400).json({ error: "Tidak ada data yang diubah" });
    params.push(req.params.id);
    db.prepare("UPDATE announcements SET " + updates.join(", ") + " WHERE id = ?").run(...params);
    res.json({ message: "Pengumuman berhasil diperbarui" });
  } catch (e) {
    res.status(500).json({ error: "Gagal memperbarui pengumuman" });
  }
});

app.delete("/api/announcements/:id", authenticate, requireRole(["admin"]), function(req, res) {
  db.prepare("DELETE FROM announcements WHERE id = ?").run(req.params.id);
  res.json({ message: "Pengumuman berhasil dihapus" });
});

// ============================================================
//  SLIDERS
// ============================================================

app.get("/api/sliders", function(_req, res) {
  var sliders = db.prepare("SELECT * FROM sliders WHERE is_active = 1 ORDER BY sort_order ASC").all();
  res.json(sliders);
});

// ============================================================
//  TAGS
// ============================================================

app.get("/api/tags", function(_req, res) {
  var tags = db.prepare("SELECT t.*, (SELECT COUNT(*) FROM article_tags WHERE tag_id = t.id) as article_count FROM tags t ORDER BY t.name ASC").all();
  res.json(tags);
});

// ============================================================
//  DASHBOARD STATS
// ============================================================

app.get("/api/admin/stats", authenticate, requireRole(["admin"]), function(_req, res) {
  var totalArticles = db.prepare("SELECT COUNT(*) as count FROM articles").get().count;
  var publishedArticles = db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'published'").get().count;
  var draftArticles = db.prepare("SELECT COUNT(*) as count FROM articles WHERE status = 'draft'").get().count;
  var totalViews = db.prepare("SELECT COALESCE(SUM(views), 0) as total FROM articles").get().total;
  var totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  var totalTeachers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'").get().count;
  var totalStudents = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count;
  var totalCategories = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
  var pendingComments = db.prepare("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'").get().count;
  var totalComments = db.prepare("SELECT COUNT(*) as count FROM comments").get().count;
  var totalAnnouncements = db.prepare("SELECT COUNT(*) as count FROM announcements").get().count;

  var recentArticles = db.prepare(`
    SELECT a.id, a.title, a.slug, a.status, a.views, a.created_at, u.name as author_name
    FROM articles a LEFT JOIN users u ON a.author_id = u.id
    ORDER BY a.created_at DESC LIMIT 5
  `).all();

  var topArticles = db.prepare(`
    SELECT a.id, a.title, a.slug, a.views, u.name as author_name
    FROM articles a LEFT JOIN users u ON a.author_id = u.id
    WHERE a.status = 'published'
    ORDER BY a.views DESC LIMIT 5
  `).all();

  var categoryStats = db.prepare(`
    SELECT c.name, c.color, COUNT(a.id) as count
    FROM categories c
    LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
    GROUP BY c.id ORDER BY count DESC
  `).all();

  res.json({
    totalArticles: totalArticles,
    publishedArticles: publishedArticles,
    draftArticles: draftArticles,
    totalViews: totalViews,
    totalUsers: totalUsers,
    totalTeachers: totalTeachers,
    totalStudents: totalStudents,
    totalCategories: totalCategories,
    pendingComments: pendingComments,
    totalComments: totalComments,
    totalAnnouncements: totalAnnouncements,
    recentArticles: recentArticles,
    topArticles: topArticles,
    categoryStats: categoryStats
  });
});

app.get("/api/teacher/stats", authenticate, requireRole(["teacher"]), function(req, res) {
  var totalArticles = db.prepare("SELECT COUNT(*) as count FROM articles WHERE author_id = ?").get(req.user.userId).count;
  var publishedArticles = db.prepare("SELECT COUNT(*) as count FROM articles WHERE author_id = ? AND status = 'published'").get(req.user.userId).count;
  var totalViews = db.prepare("SELECT COALESCE(SUM(views), 0) as total FROM articles WHERE author_id = ?").get(req.user.userId).total;
  var totalComments = db.prepare(`
    SELECT COUNT(*) as count FROM comments c
    JOIN articles a ON c.article_id = a.id
    WHERE a.author_id = ? AND c.status = 'approved'
  `).get(req.user.userId).count;

  var articles = db.prepare(`
    SELECT a.*, c.name as category_name
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.author_id = ?
    ORDER BY a.created_at DESC LIMIT 10
  `).all(req.user.userId);

  res.json({
    totalArticles: totalArticles,
    publishedArticles: publishedArticles,
    totalViews: totalViews,
    totalComments: totalComments,
    articles: articles
  });
});

app.get("/api/student/stats", authenticate, requireRole(["student"]), function(req, res) {
  var totalComments = db.prepare("SELECT COUNT(*) as count FROM comments WHERE user_id = ?").get(req.user.userId).count;
  var recentComments = db.prepare(`
    SELECT c.*, a.title as article_title, a.slug as article_slug
    FROM comments c
    JOIN articles a ON c.article_id = a.id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC LIMIT 10
  `).all(req.user.userId);

  res.json({ totalComments: totalComments, recentComments: recentComments });
});

// ============================================================
//  ACTIVITY LOGS
// ============================================================

app.get("/api/admin/logs", authenticate, requireRole(["admin"]), function(req, res) {
  var logs = db.prepare(`
    SELECT l.*, u.name as user_name, u.username
    FROM activity_logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC LIMIT 100
  `).all();
  res.json(logs);
});

// ============================================================
//  Static files + SPA fallback
// ============================================================

var distPath = path.join(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  console.log("[Portal] Serving static files from", distPath);
  app.use(express.static(distPath));
  app.get("*", function(req, res) {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  console.warn("[Portal] dist/ folder not found — frontend not built yet");
  app.get("*", function(req, res) {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.status(200).send("Portal Berita MAN 2 Palembang — Backend is running.");
  });
}

// Error handler
app.use(function(err, _req, res, _next) {
  console.error("[Portal] Express error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ============================================================
//  Start server
// ============================================================

app.listen(PORT, "0.0.0.0", function() {
  console.log("[Portal] ✅ Server running on port " + PORT);
  console.log("[Portal] API available at http://localhost:" + PORT + "/api");
  console.log("[Portal] Database: SQLite (" + dbPath + ")");
});
