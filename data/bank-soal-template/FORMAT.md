# Format Soal Try Out Umum

Setiap file JSON berisi array of objects dengan format berikut:

```json
[
  {
    "id": "1",
    "question": "Teks pertanyaan di sini",
    "options": {
      "A": "Pilihan A",
      "B": "Pilihan B",
      "C": "Pilihan C",
      "D": "Pilihan D"
    },
    "answer": "A",
    "explanation": "Penjelasan jawaban (opsional, bisa string kosong)"
  }
]
```

## Catatan

- `id` harus unik dalam satu file
- `answer` harus salah satu dari: A, B, C, atau D
- `explanation` boleh dikosongkan dengan string kosong `""`
- Tambahkan objek soal sebanyak yang diinginkan dalam array
- Minimal 1 soal per file agar bisa dikerjakan

## Contoh Lengkap

```json
[
  {
    "id": "1",
    "question": "Berapakah hasil dari 2 + 3?",
    "options": {
      "A": "4",
      "B": "5",
      "C": "6",
      "D": "7"
    },
    "answer": "B",
    "explanation": "2 + 3 = 5"
  },
  {
    "id": "2",
    "question": "Ibukota Indonesia adalah?",
    "options": {
      "A": "Bandung",
      "B": "Surabaya",
      "C": "Jakarta",
      "D": "Yogyakarta"
    },
    "answer": "C",
    "explanation": ""
  }
]
```

## Daftar File per Jenjang

### SMP (6 file)
- matematika.json
- ipa.json
- ips.json
- bahasa-indonesia.json
- bahasa-inggris.json
- ppkn.json

### SMA (9 file)
- matematika.json
- fisika.json
- kimia.json
- biologi.json
- ekonomi.json
- sejarah.json
- bahasa-indonesia.json
- bahasa-inggris.json
- ppkn.json

### SMK — Mata Pelajaran Umum (5 file)
- matematika.json
- bahasa-indonesia.json
- bahasa-inggris.json
- ipa-terapan.json
- ppkn.json

### SMK — Muatan Kejuruan (Produktif) (14 file)

**Teknik & Rekayasa:**
- teknik-dasar-mesin.json
- teknik-kelistrikan-otomotif.json
- teknik-struktur-bangunan.json

**Teknologi Informasi (TI):**
- ti-pemrograman-dasar.json
- ti-jaringan-komputer.json
- ti-desain-grafis.json

**Bisnis & Manajemen:**
- bisnis-dasar-akuntansi.json
- bisnis-pengelolaan-kas.json
- bisnis-pemasaran-digital.json

**Seni & Ekonomi Kreatif:**
- seni-produksi-siaran.json
- seni-animasi.json
- seni-tata-busana.json

**Kesehatan & Pekerjaan Sosial:**
- kesehatan-dasar-keperawatan.json
- kesehatan-farmakologi-dasar.json
