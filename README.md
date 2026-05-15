# Belajar Tryout Gratis — Bebas Guru Murid

![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Early%20Development-yellow)

## Tentang Project

Platform latihan ujian (tryout) online gratis untuk pelajar SMP, SMA, dan SMK di Indonesia. Guru bisa membuat soal dan paket ujian, murid bisa mengerjakan ujian dan melihat nilai secara otomatis. Semua berjalan di browser, di-host gratis di GitHub Pages, dengan data tersimpan di Firebase.

## Tujuan

- Guru dapat membuat soal, menyusun paket ujian, dan mempublish ujian untuk murid.
- Murid dapat memilih sekolah, mengerjakan ujian yang tersedia, dan melihat hasil secara otomatis.
- Nilai dihitung langsung setelah ujian selesai: `(jawaban benar / total soal) x 100`.
- Semua antarmuka (UI) dalam Bahasa Indonesia.

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
- Konsep: owner repo akan bisa mengakses dashboard admin menggunakan token khusus yang dikonfigurasi sendiri
- Fitur admin (monitoring data, moderasi konten) dalam tahap pengembangan

## Teknologi

- HTML
- CSS
- JavaScript (Vanilla, ES Modules)
- GitHub Pages (hosting statis)
- Firebase Authentication (Google Sign-In)
- Firebase Cloud Firestore (database)

Tidak memerlukan Node.js, PHP, backend server, atau build tools.

## Struktur Folder

```
BELAJAR-TRYOUT-GRATIS-BEBAS-GURU-MURID/
├── index.html
├── dashboard-guru.html
├── dashboard-murid.html
├── ujian.html
├── hasil.html
├── admin.html
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── firebase-config.js
│       ├── auth.js
│       ├── guru.js
│       ├── murid.js
│       ├── ujian.js
│       ├── hasil.js
│       └── admin.js
├── data/
│   └── bank-soal-template/
│       ├── FORMAT.md
│       ├── smp/
│       ├── sma/
│       └── smk/
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
- Berisi file JSON kosong (`[]`) sebagai template struktur soal
- Tidak digunakan oleh sistem secara aktif
- Hanya referensi format bagi owner yang ingin menyiapkan soal di luar Firestore
- Format soal dijelaskan di `data/bank-soal-template/FORMAT.md`

## Status Project

Project ini dalam tahap **early development**. Fitur-fitur inti sedang dibangun secara bertahap. Firestore security rules sudah ditulis sebagai draft di file `firestore.rules` tetapi belum diterapkan dan diuji di Firebase Console.

## Deploy

1. Clone atau fork repository ini
2. Buat project di [Firebase Console](https://console.firebase.google.com)
3. Isi `assets/js/firebase-config.js` dengan konfigurasi Firebase
4. Aktifkan Google Authentication dan Firestore di Firebase Console
5. Push ke GitHub, aktifkan GitHub Pages (Settings → Pages → Branch: main)

Panduan lebih lengkap tersedia di [SETUP.md](SETUP.md).

## License

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan pendidikan.
