# Panduan Setup — Belajar Tryout Gratis

Panduan lengkap untuk menginstall dan deploy platform tryout ini di akun GitHub kamu sendiri.

---

## 1. Prasyarat

- Akun GitHub (gratis)
- Akun Google (untuk Firebase)
- Browser modern (Chrome, Firefox, Edge, Safari)

---

## 2. Clone Repository

### Opsi A: Git Clone

```bash
git clone https://github.com/sagaevans/BELAJAR-TRYOUT-GRATIS-BEBAS-GURU-MURID.git
cd BELAJAR-TRYOUT-GRATIS-BEBAS-GURU-MURID
```

### Opsi B: Download ZIP

1. Klik tombol **Code** → **Download ZIP**
2. Extract file ZIP ke folder lokal
3. Buka folder tersebut

---

## 3. Setup Firebase

### 3.1 Buat Project Firebase

1. Buka [Firebase Console](https://console.firebase.google.com)
2. Klik **"Add project"**
3. Beri nama project, contoh: `tryout-gratis-sekolahku`
4. Google Analytics → aktifkan (opsional, bisa di-skip)
5. Klik **"Create project"** → tunggu selesai

### 3.2 Daftarkan Web App

1. Di halaman project, klik ikon **Web (</>)**
2. Beri nama app, contoh: `Tryout Gratis Web`
3. **JANGAN** centang Firebase Hosting (kita pakai GitHub Pages)
4. Klik **"Register app"**
5. Akan muncul kode `firebaseConfig` — **copy semua nilainya**

### 3.3 Isi Konfigurasi

1. Buka file `js/firebase-config.js` di repo kamu
2. Ganti semua nilai placeholder dengan nilai dari Firebase:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ganti ini
  authDomain: "xxx.firebaseapp.com",  // ganti ini
  projectId: "xxx",             // ganti ini
  storageBucket: "xxx.appspot.com",   // ganti ini
  messagingSenderId: "123456789",     // ganti ini
  appId: "1:123:web:abc123"           // ganti ini
};
```

---

## 4. Aktifkan Firebase Authentication

1. Di Firebase Console → **Authentication** → klik **"Get started"**
2. Tab **Sign-in method** → klik **Google** → **Enable**
3. Isi "Project support email" dengan email kamu
4. Klik **Save**
5. Scroll ke bawah → **Authorized domains**
6. Tambahkan domain GitHub Pages:
   ```
   sagaevans.github.io
   ```
   (Ganti dengan username GitHub kamu jika berbeda)

---

## 5. Setup Firestore Database

### 5.1 Buat Database

1. Di Firebase Console → **Firestore Database** → klik **"Create database"**
2. Pilih **"Start in production mode"**
3. Pilih region: **asia-southeast2** (Jakarta) untuk Indonesia
4. Klik **"Create"**

### 5.2 Terapkan Security Rules

> **PENTING:** Pushing `firestore.rules` ke GitHub TIDAK otomatis menerapkan rules ke Firebase.
> Kamu harus copy-paste rules secara manual ke Firebase Console.

1. Di Firestore → tab **Rules**
2. Hapus semua isi rules yang ada
3. Copy-paste seluruh isi file `firestore.rules` dari repo ini
4. Klik **"Publish"**

### 5.3 Buat Composite Index (Jika Diperlukan)

Firestore mungkin meminta kamu membuat index saat pertama kali query berjalan.
Jika muncul error di console browser tentang "index", klik link yang diberikan
untuk membuat index secara otomatis di Firebase Console.

---

## 6. Deploy ke GitHub Pages

### 6.1 Push ke GitHub

```bash
git add .
git commit -m "Setup Firebase config"
git push origin main
```

### 6.2 Aktifkan GitHub Pages

1. Buka repository di GitHub
2. **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** → folder: **/ (root)**
5. Klik **Save**
6. Tunggu 1-3 menit

### 6.3 Akses Website

Website kamu akan live di:
```
https://{username-kamu}.github.io/{nama-repo}/
```

---

## 7. Setup Admin Access

### 7.1 Buat GitHub Personal Access Token (PAT)

1. Buka [GitHub Token Settings](https://github.com/settings/tokens)
2. Klik **"Generate new token (classic)"**
3. Beri nama: `Tryout Admin`
4. Centang scope: **`read:user`** saja
5. Klik **"Generate token"**
6. **COPY token sekarang** — token hanya tampil sekali!

### 7.2 Login sebagai Admin

1. Buka `https://{website-kamu}/admin.html`
2. Paste token yang sudah di-copy
3. Klik **"Verifikasi Token"**
4. Jika username GitHub kamu cocok dengan owner repo → berhasil masuk

> **Catatan:** Token TIDAK disimpan di mana pun. Hanya digunakan sekali untuk verifikasi.
> Session admin tersimpan di localStorage browser. Untuk logout, klik tombol "Keluar".

---

## 8. Mulai Gunakan

### Sebagai Guru:
1. Buka website → Login dengan Google
2. Pilih role **"Saya Guru"**
3. Lengkapi profil (username + data sekolah)
4. Buat soal-soal ujian
5. Buat paket ujian → Publish
6. Bagikan link website ke murid

### Sebagai Murid:
1. Buka website → Login dengan Google
2. Pilih role **"Saya Murid"**
3. Lengkapi profil (nama + nomor + pilih sekolah)
4. Cari ujian yang tersedia
5. Kerjakan ujian → lihat hasil

### Sebagai Admin:
1. Buka `/admin.html`
2. Verifikasi dengan GitHub PAT
3. Pantau semua data platform
4. Kelola guru, murid, sekolah, soal, dan paket ujian

---

## Troubleshooting

### Error: "Firebase App not initialized"
- Pastikan `firebase-config.js` sudah diisi dengan konfigurasi yang benar
- Pastikan tidak ada typo di apiKey, authDomain, dll.

### Error: "Unauthorized domain"
- Tambahkan domain `{username}.github.io` di Firebase Auth → Authorized domains

### Error: "Missing or insufficient permissions"
- Pastikan Firestore Security Rules sudah di-publish
- Copy paste dari file `firestore.rules` di repo ini

### Login Google tidak muncul / error popup
- Pastikan Google Sign-in sudah di-enable di Firebase Auth
- Pastikan browser tidak memblokir popup

### Admin: "Akses ditolak"
- Pastikan token milik owner repo (GitHub username harus sama dengan `{username}.github.io`)
- Pastikan scope token minimal `read:user`

---

## Struktur Firestore

| Collection | Deskripsi |
|-----------|-----------|
| `users` | Data semua pengguna (guru & murid) |
| `schools` | Data sekolah yang didaftarkan guru |
| `teacher_questions` | Bank soal milik guru |
| `exam_packages` | Paket ujian yang dibuat guru |
| `exam_results` | Hasil ujian murid |

---

## Lisensi

Project ini bersifat open source dan gratis digunakan untuk keperluan pendidikan.

Dibuat untuk pendidikan Indonesia.
