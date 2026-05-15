# Belajar Tryout Gratis — Bebas Guru Murid

![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Early%20Development-yellow)

Platform latihan ujian (tryout) online gratis untuk pelajar SMP, SMA, dan SMK di Indonesia. Guru membuat soal, murid mengerjakan ujian, nilai dihitung otomatis. Semua gratis, tanpa biaya.

## Tentang Project

Belajar Tryout Gratis adalah website ujian online sederhana yang di-host di GitHub Pages dan menggunakan Firebase sebagai backend. Tujuannya agar siapa saja bisa meng-clone repo ini dan langsung punya platform tryout untuk sekolahnya sendiri.

## Tujuan

- Guru dapat membuat soal, menyusun paket ujian, dan mempublish ujian untuk murid.
- Murid dapat memilih sekolah, mengerjakan ujian yang tersedia, dan melihat hasil secara otomatis.
- Nilai dihitung langsung setelah ujian selesai.
- Semua data disimpan di Firebase Cloud Firestore.
- Antarmuka (UI) sepenuhnya dalam Bahasa Indonesia.

## Fitur Utama

### Guru
- Login dengan Google
- Daftar sekolah (data terstruktur: jenjang, status, nama, kota)
- Buat, edit, hapus soal milik sendiri
- Susun soal menjadi paket ujian
- Publish/unpublish paket ujian
- Lihat hasil murid yang mengerjakan ujian

### Murid
- Login dengan Google
- Pilih sekolah dari dropdown
- Kerjakan ujian yang dipublish guru
- Nilai otomatis setelah submit
- Lihat riwayat ujian dan rekap nilai

### Admin/Owner
- Halaman admin tersedia di `admin.html`
- Konsep admin token untuk owner repo direncanakan untuk pengembangan selanjutnya
- Fitur monitoring dan moderasi data dalam tahap perencanaan

## Teknologi

- HTML
- CSS
- JavaScript (Vanilla, ES Modules)
- GitHub Pages (hosting statis)
- Firebase Authentication (Google Sign-In)
- Firebase Cloud Firestore (database)

## Struktur Folder

```
BELAJAR-TRYOUT-GRATIS-BEBAS-GURU-MURID/
├── index.html
├── tryout.html
├── dashboard-guru.html
├── dashboard-murid.html
├── ujian.html
├── hasil.html
├── admin.html
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── guru.js
│   ├── murid.js
│   ├── ujian.js
│   ├── hasil.js
│   ├── admin.js
│   └── tryout.js
├── data/
│   └── bank-soal-template/
├── firestore.rules
├── SETUP.md
├── README.md
└── .gitignore
```

## Konsep Data

### Disimpan di Firebase Firestore
- `users` — data guru dan murid (profil, role, sekolah)
- `schools` — data sekolah yang didaftarkan guru
- `teacher_questions` — soal-soal yang dibuat guru
- `exam_packages` — paket ujian yang disusun guru
- `exam_results` — hasil ujian murid

### Folder `data/bank-soal-template/`
- Berisi file JSON kosong sebagai template referensi format soal
- Tidak digunakan secara aktif oleh sistem
- Soal yang dibuat guru disimpan di Firestore, bukan di file JSON lokal

## Status Project

Project ini dalam tahap early development. Fitur-fitur inti sedang dibangun bertahap. File `firestore.rules` berisi draft security rules yang belum diterapkan ke Firebase Console.

## Deploy

1. Push semua file ke GitHub repository
2. Buka Settings → Pages
3. Source: Deploy from a branch
4. Branch: main → folder: / (root)
5. Klik Save
6. Tunggu beberapa menit, website akan live

## License

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan.
