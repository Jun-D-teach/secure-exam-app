# 🚀 Deploy UjianKita ke Hostinger

## Arsitektur Setelah Migrasi

```
┌─────────────────────────────────────────────┐
│                Hostinger VPS                 │
│                                              │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │  Express.js   │───▶│  Google Sheets   │   │
│  │  (Port 3001)  │    │  (Database)      │   │
│  └──────┬───────┘    └──────────────────┘   │
│         │                                    │
│  ┌──────▼───────┐                            │
│  │  Vite Build   │                            │
│  │  (dist/)      │                            │
│  └──────────────┘                            │
└─────────────────────────────────────────────┘
```

## Langkah 1: Persiapan Google Sheets

### 1.1 Buat Google Cloud Project
1. Buka https://console.cloud.google.com
2. Buat project baru atau pilih yang sudah ada
3. Aktifkan **Google Sheets API** di Library

### 1.2 Buat Service Account
1. Buka **IAM & Admin** → **Service Accounts**
2. Klik **Create Service Account**
3. Beri nama (misal: `ujiankita-db`)
4. Klik **Create and Continue**
5. Beri role **Editor** (atau minimal **Owner** untuk akses Sheets)
6. Klik **Done**
7. Klik service account yang baru dibuat
8. Buka tab **Keys** → **Add Key** → **Create new key**
9. Pilih **JSON** → Download

### 1.3 Buat Google Spreadsheet
1. Buka https://sheets.google.com
2. Buat spreadsheet baru, beri nama "UjianKita Database"
3. Copy **Spreadsheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

### 1.4 Share Spreadsheet ke Service Account
1. Buka spreadsheet yang baru dibuat
2. Klik **Share**
3. Tambahkan email service account dari langkah 1.2 (format: `ujiankita-db@project.iam.gserviceaccount.com`)
4. Beri akses **Editor**
5. Klik **Share**

### 1.5 Siapkan Sheet Tabs
Buat 4 sheet tabs di spreadsheet:
- `users` - Data pengguna
- `subjects` - Mata pelajaran
- `exams` - Ujian
- `attempts` - Percobaan ujian

**Baris pertama (header) masing-masing sheet:**

**users:**
```
id | name | username | password_hash | role | created_at
```

**subjects:**
```
id | name | description | created_by | created_at
```

**exams:**
```
id | title | subject_id | description | google_form_url | duration_minutes | is_active | starts_at | ends_at | created_by | created_at
```

**attempts:**
```
id | exam_id | student_id | status | started_at | ends_at | completed_at | violation_count | violations
```

---

## Langkah 2: Setup Hostinger VPS

### 2.1 Akses VPS
```bash
ssh root@IP_ANDA
```

### 2.2 Install Dependencies
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Git
apt install -y git

# Install Bun (untuk build frontend)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 2.3 Clone Repository
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/ujiankita.git
cd ujiankita
```

---

## Langkah 3: Konfigurasi Environment

### 3.1 Buat File .env di Root Project
```bash
nano .env
```

Isi dengan:
```env
# Server
PORT=3001
NODE_ENV=production

# JWT Secret (generate sendiri!)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# Google Sheets
GOOGLE_SHEET_ID=your-spreadsheet-id-here
GOOGLE_SERVICE_ACCOUNT_EMAIL=ujiankita-db@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"

# Frontend
VITE_API_URL=
```

### 3.2 Buat File .env untuk Server
```bash
nano server/.env
```

Isi yang sama seperti di atas.

### 3.3 Generate JWT Secret yang Kuat
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Gunakan outputnya sebagai nilai `JWT_SECRET`.

---

## Langkah 4: Build & Deploy

### 4.1 Install Dependencies
```bash
# Install frontend dependencies
bun install

# Install backend dependencies
cd server
npm install
cd ..
```

### 4.2 Build Frontend
```bash
bun run build
```

### 4.3 Build Backend (opsional, bisa pakai tsx langsung)
```bash
cd server
npx tsc -p tsconfig.json
cd ..
```

### 4.4 Start Server dengan PM2
```bash
# Jalankan backend
pm2 start server/index.ts --name ujiankita-api --interpreter tsx

# Atau jika sudah di-build:
# pm2 start server/dist/index.js --name ujiankita-api

# Simpan konfigurasi PM2
pm2 save
pm2 startup
```

### 4.5 Cek Status
```bash
pm2 status
pm2 logs ujiankita-api
```

---

## Langkah 5: Konfigurasi Nginx (Reverse Proxy)

### 5.1 Buat Config Nginx
```bash
nano /etc/nginx/sites-available/ujiankita
```

Isi:
```nginx
server {
    listen 80;
    server_name domainanda.com www.domainanda.com;

    # Frontend (static files)
    location / {
        root /var/www/ujiankita/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.2 Aktifkan Config
```bash
ln -s /etc/nginx/sites-available/ujiankita /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## Langkah 6: SSL Certificate (HTTPS)

### Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d domainanda.com -d www.domainanda.com
```

---

## Langkah 7: Setup Admin Pertama

1. Buka browser, akses `https://domainanda.com`
2. Klik **Login**
3. Jika belum ada admin, akan muncul form bootstrap admin
4. Isi: Nama, Username, Password
5. Login sebagai admin
6. Buat akun guru dan siswa melalui dashboard admin

---

## Troubleshooting

### Server tidak mau jalan
```bash
pm2 logs ujiankita-api
# Cek error di log
```

### Google Sheets error
1. Pastikan Service Account email sudah di-share ke spreadsheet
2. Pastikan Spreadsheet ID benar
3. Pastikan Private Key lengkap (dengan `\n` yang benar)

### Port sudah terpakai
```bash
lsof -i :3001
# Kill process yang menggunakan port tersebut
kill -9 PID
```

### Nginx 502 Bad Gateway
```bash
# Pastikan server berjalan
pm2 status

# Cek port
netstat -tlnp | grep 3001
```

---

## Struktur File di VPS

```
/var/www/ujiankita/
├── .env                    # Environment variables
├── package.json
├── dist/                   # Frontend build output
├── server/
│   ├── .env                # Backend env (copy dari root)
│   ├── index.ts            # Express server entry
│   ├── db/
│   │   └── sheets.ts       # Google Sheets integration
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── subjects.ts
│   │   ├── exams.ts
│   │   └── attempts.ts
│   └── middleware/
│       └── auth.ts
└── src/                    # Frontend source
```

---

## Update Aplikasi

Saat ada update baru:
```bash
cd /var/www/ujiankita
git pull origin main

# Rebuild frontend
bun install
bun run build

# Restart server
pm2 restart ujiankita-api
```

---

## Catatan Penting

1. **Jangan commit file .env ke Git** - tambahkan ke .gitignore
2. **Backup Google Spreadsheet secara berkala** - export ke Excel
3. **Gunakan HTTPS** - wajib untuk keamanan data siswa
4. **Monitor usage** - cek Google Sheets API quota di Google Cloud Console
5. **Google Sheets API Limit**: 300 requests per menit per project
