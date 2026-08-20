# 🚀 Deploy UjianKita ke Hostinger

## Arsitektur

```
Browser (React SPA) → server.js (Express) → Google Sheets API
                            ↓
                    Hostinger Node.js (Express preset)
```

Satu file `server.js` di root = entry point yang handle semua: API + static files.

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
2. Tambah email service account
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

> ⚠️ Headers harus persis. Aplikasi otomatis membuat tabs jika belum ada.

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
- **Preset framework**: pilih **Express**
- **Branch**: `main`
- **Node version**: `20.x`
- Klik **Ubah**

### 3.2 Build Command
```
npm install && npx vite build
```

### 3.3 Entry File
```
server.js
```

> Hostinger akan menjalankan: `node server.js`

### 3.4 Environment Variables

| Key | Value |
|-----|-------|
| `PORT` | `3001` |
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
```
https://domain-kamu.com/api/health
```
Response: `{"status":"ok","timestamp":...}`

### Cek Login
1. Buka `https://domain-kamu.com`
2. Klik **Login**
3. Jika belum ada admin → form "Buat Akun Admin Pertama" muncul
4. Isi → Login

---

## Troubleshooting

### Build error: "vite not found"
Pastikan build command: `npm install && npx vite build`

### Login button tidak aktif
- Cek `/api/health` — jika tidak bisa diakses, server belum jalan
- Cek **Node.js logs** di Hostinger panel

### Error "Server backend belum berjalan"
Express server belum start. Cek:
1. Entry file = `server.js` (bukan `server/index.js`)
2. Port sesuai env var `PORT`
3. Log errors di Hostinger panel

### Google Sheets error
1. Service account di-share ke spreadsheet (Editor access)
2. Spreadsheet ID benar
3. Private Key lengkap

### MIME type error "text/plain" untuk JS files
Artinya server tidak jalan — static files dilayani oleh web server default (Apache/Nginx). Pastikan `node server.js` berjalan.

---

## Struktur File

```
project-root/
├── server.js            ← Entry point (Express server + semua API)
├── package.json         ← Dependencies
├── dist/                ← Frontend build output (Vite)
├── server/              ← Server source (TypeScript, untuk reference)
│   ├── index.ts
│   ├── db/sheets.ts
│   ├── routes/
│   └── middleware/
└── src/                 ← Frontend source (React)
```

> **Catatan**: `server.js` adalah versi plain JavaScript yang dijalankan Hostinger. File di `server/` adalah source TypeScript untuk development.

---

## Update Aplikasi

1. Push perubahan ke GitHub
2. Di Hostinger → **Deploy ulang**
