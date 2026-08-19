# 🚀 Deploy UjianKita ke Hostinger

## Arsitektur

```
Browser (React SPA) → Express.js Server → Google Sheets API
                            ↓
                    Hostinger Node.js Hosting
```

Express server serve **semuanya**: API routes + frontend static files dari satu port.

---

## Langkah 1: Persiapan Google Sheets

### 1.1 Buat Google Cloud Project
1. Buka https://console.cloud.google.com
2. Buat project baru atau pilih yang sudah ada
3. Aktifkan **Google Sheets API** di Library

### 1.2 Buat Service Account
1. Buka **IAM & Admin** → **Service Accounts**
2. Klik **Create Service Account**
3. Beri nama (misal: `exam-secure-app`)
4. Klik **Create and Continue**
5. Role: **Editor** → **Done**
6. Klik service account → tab **Keys** → **Add Key** → **Create new key**
7. Pilih **JSON** → Download

### 1.3 Buat Google Spreadsheet
1. Buka https://sheets.google.com
2. Buat spreadsheet baru: "UjianKita Database"
3. Copy **Spreadsheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

### 1.4 Share ke Service Account
1. Buka spreadsheet → **Share**
2. Tambah email service account (format: `xxx@project.iam.gserviceaccount.com`)
3. Akses: **Editor** → **Share**

### 1.5 Buat Sheet Tabs
Buat 4 sheet tabs:

**users** (header baris 1):
```
id | name | username | password_hash | role | created_at
```

**subjects**:
```
id | name | description | created_by | created_at
```

**exams**:
```
id | title | subject_id | description | google_form_url | duration_minutes | is_active | starts_at | ends_at | created_by | created_at
```

**attempts**:
```
id | exam_id | student_id | status | started_at | ends_at | completed_at | violation_count | violations
```

> ⚠️ Headers harus persis seperti di atas. Aplikasi otomatis membuat tabs jika belum ada.

---

## Langkah 2: Push ke GitHub

```bash
git add -A
git commit -m "Deploy to Hostinger"
git push origin main
```

---

## Langkah 3: Setup di Hostinger Panel

### 3.1 Pilih Framework
Di Hostinger panel → **Pengaturan dan deploy ulang**:
- **Preset framework**: pilih **Express**
- Klik **Ubah**

### 3.2 Build Command
Set build command ke:
```
npm install && npx tsc -b && npx vite build
```

> Build script akan:
> 1. Install semua dependencies (termasuk devDependencies untuk TypeScript)
> 2. Compile TypeScript (type checking)
> 3. Build frontend ke folder `dist/`

### 3.3 Start Command
Set start command / entry point ke:
```
npx tsx server/index.ts
```

> Server Express akan:
> 1. Listen di port yang ditentukan (biasanya 3000 atau 3001)
> 2. Serve API routes di `/api/*`
> 3. Serve frontend SPA dari `dist/`

### 3.4 Environment Variables
Set di Hostinger panel (atau file `.env`):

| Variable | Value |
|----------|-------|
| `PORT` | `3001` (atau port yang ditentukan Hostinger) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(generate baru — lihat di bawah)* |
| `GOOGLE_SHEET_ID` | `1jHpzXrNdjkdIW4QjLaCl6S8d1-obvz8lztvhiqJ7pYQ` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `exam-secure-app@polar-automata-468801-u9.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | *(paste dari .env kamu)* |
| `ADMIN_RESET_KEY` | *(buat secret key untuk reset admin)* |

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3.5 Deploy
Klik **Deploy ulang** / **Redeploy**

---

## Langkah 4: Verifikasi

### Cek Server
Buka browser, akses:
```
https://domain-kamu.com/api/health
```

Response yang benar:
```json
{"status":"ok","timestamp":1234567890}
```

### Cek Login
1. Buka `https://domain-kamu.com`
2. Klik **Login**
3. Jika belum ada admin → form "Buat Akun Admin Pertama" muncul
4. Isi nama, username, password → Login

### Cek Google Sheets
Buka spreadsheet kamu → tab `Users` → seharusnya ada baris admin yang baru dibuat.

---

## Troubleshooting

### Build error: "tsc not found" atau "vite not found"
Hostinger mungkin menjalankan `npm install --production`. Build command sudah include `npm install` untuk install semua dependencies. Jika masih error, pastikan:
- Build command: `npm install && npx tsc -b && npx vite build`

### Login button tidak aktif / tidak bisa klik
- Cek apakah server backend berjalan: akses `/api/health`
- Jika tidak bisa diakses, server belum jalan → cek log di Hostinger panel

### Error "Server backend belum berjalan"
Artinya Express server belum start. Cek:
1. Start command benar: `npx tsx server/index.ts`
2. Port sudah benar
3. Log errors di Hostinger panel

### Google Sheets error
1. Service account sudah di-share ke spreadsheet (Editor access)
2. Spreadsheet ID benar
3. Private Key lengkap (dengan `\n` yang benar)
4. 4 tabs sudah ada (users, subjects, exams, attempts)

### CORS errors
Server sudah include CORS middleware. Jika masih error, pastikan前端 akses backend dari URL yang sama (satu domain).

---

## Struktur Deploy

```
hostinger-root/
├── .env                    # Environment variables
├── package.json            # Dependencies + scripts
├── dist/                   # Frontend build output (Vite)
│   ├── index.html
│   └── assets/
├── server/                 # Backend source
│   ├── index.ts            # Express server entry
│   ├── db/sheets.ts        # Google Sheets API
│   ├── routes/
│   │   ├── auth.ts         # Login, register, change password
│   │   ├── users.ts        # CRUD users + import
│   │   ├── subjects.ts     # CRUD subjects
│   │   ├── exams.ts        # CRUD exams + scheduling
│   │   └── attempts.ts     # Start/complete/expire attempts
│   └── middleware/auth.ts   # JWT auth middleware
└── src/                    # Frontend source (React + Vite)
```

---

## Update Aplikasi

1. Push perubahan ke GitHub
2. Di Hostinger → **Deploy ulang**
3. Server otomatis rebuild dan restart

---

## Catatan Penting

1. **Jangan commit `.env` ke Git** — sudah di `.gitignore`
2. **Backup Google Spreadsheet** — download ke Excel secara berkala
3. **Google Sheets API limit** — 300 requests/menit (cukup untuk 900 siswa/hari)
4. **JWT_SECRET harus unik** — jangan pakai placeholder
5. **HTTPS** — pastikan Hostinger SSL aktif (biasanya otomatis)
