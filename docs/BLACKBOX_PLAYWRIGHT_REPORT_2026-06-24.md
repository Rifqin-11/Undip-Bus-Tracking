# Laporan Pengujian Black-Box SIMOBI dengan Playwright

## Informasi Pengujian

| Parameter | Nilai |
|---|---|
| Tanggal pengujian | 24 Juni 2026 |
| Target | `https://vps.simobi.my.id` |
| Metode | Black-box testing |
| Perangkat pengujian | Playwright 1.61.1 dan Google Chrome headless |
| Bahasa awal | Indonesia |
| Resolusi viewport | 1440 x 1000 piksel |

Pengujian dilakukan dari perspektif pengguna tanpa mengubah kode aplikasi. Pengujian yang membutuhkan akun valid atau data armada aktif tidak dinyatakan berhasil apabila prasyarat tersebut tidak tersedia.

## Hasil Pengujian

| No | Fitur | Skenario Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status |
|---:|---|---|---|---|---|
| 1 | Login | Pengguna memasukkan email dan password yang valid. | Sistem berhasil masuk dan mengarahkan pengguna ke halaman utama. | Form login tampil dan penolakan kredensial tidak valid bekerja dengan pesan `Invalid login credentials`. Login positif belum diuji karena akun uji valid belum tersedia. | Belum dapat diverifikasi |
| 2 | Register | Pengguna membuat akun baru dengan data valid. | Akun berhasil dibuat dan dapat digunakan untuk login. | Form registrasi tampil. Validasi konfirmasi kata sandi bekerja dan menampilkan pesan ketika kedua kata sandi berbeda. Pembuatan akun positif belum dilakukan karena alamat email uji yang dapat diverifikasi belum tersedia. | Belum dapat diverifikasi |
| 3 | Dashboard monitoring | Pengguna membuka halaman utama SIMOBI. | Sistem menampilkan peta, halte, daftar buggy, dan informasi kendaraan. | Halaman merespons HTTP 200, peta tampil, 17 halte terdeteksi, dan panel daftar buggy tampil. Pada waktu pengujian terdapat `0 unit`, sehingga informasi kendaraan aktif tidak tersedia. Tidak ditemukan error console pada pemuatan awal. | Berhasil sebagian |
| 4 | Detail buggy | Pengguna memilih salah satu buggy. | Sistem menampilkan detail kendaraan, ETA, jumlah penumpang, kapasitas, dan status koneksi. | Tidak ada buggy aktif yang dapat dipilih karena panel menampilkan `0 unit`. | Tidak dapat diuji |
| 5 | Halaman halte | Pengguna memilih salah satu halte. | Sistem menampilkan detail halte dan lokasi halte pada peta. | Marker `Rusunawa Undip` dapat dipilih. Sistem menampilkan detail halte, status aktif, rute, jadwal hari ini, fasilitas terdekat, dan lokasi marker pada peta. | Berhasil |
| 6 | Pencarian rute | Pengguna memasukkan lokasi tujuan. | Sistem menampilkan rute dan rekomendasi halte terdekat. | Tujuan `Fakultas Hukum & Fisip` ditemukan dan dapat dipilih dengan izin geolokasi aktif. Setelah pencarian dijalankan, panel rute dan rekomendasi halte tidak tampil pada kondisi tidak ada buggy aktif. | Tidak berhasil pada kondisi uji |
| 7 | Statistik operasional | Admin membuka halaman statistik. | Sistem menampilkan ringkasan data operasional armada. | Endpoint statistik menolak sesi tanpa autentikasi dengan HTTP 401 `Authentication required`. Isi halaman admin belum diuji karena akun admin uji belum tersedia. | Belum dapat diverifikasi |
| 8 | Riwayat perjalanan | Admin atau Driver memilih tanggal perjalanan. | Sistem menampilkan riwayat perjalanan sesuai tanggal dan hak akses. | Endpoint riwayat menolak sesi tanpa autentikasi dengan HTTP 401 `Authentication required`. Pemilihan tanggal dan data riwayat belum diuji karena akun Admin/Driver belum tersedia. | Belum dapat diverifikasi |
| 9 | Notifikasi | Pengguna mengaktifkan notifikasi browser. | Sistem meminta izin notifikasi dan menyimpan data subscription. | Tombol notifikasi membuka Pusat Informasi dan menampilkan pengumuman. Permintaan izin browser dan penyimpanan push subscription belum dapat diuji tanpa sesi pengguna yang sesuai. | Belum dapat diverifikasi |
| 10 | Pengaturan aplikasi | Pengguna mengubah bahasa, tampilan peta, atau preferensi notifikasi. | Sistem menyimpan dan menerapkan pengaturan yang dipilih. | Bahasa berhasil diubah dari Indonesia ke Inggris dan URL berubah dari `/id` ke `/en`. Gaya peta berhasil diubah ke Satelit dan disimpan pada penyimpanan lokal sebagai `mapStyle: satellite`. | Berhasil |

## Ringkasan

| Kategori | Jumlah |
|---|---:|
| Berhasil | 2 |
| Berhasil sebagian | 1 |
| Tidak berhasil pada kondisi uji | 1 |
| Tidak dapat diuji atau diverifikasi | 6 |

## Catatan dan Prasyarat Pengujian Lanjutan

Pengujian lanjutan memerlukan:

1. Akun uji Pengguna yang valid untuk login, registrasi, dan push notification.
2. Akun uji Admin untuk statistik operasional.
3. Akun uji Driver untuk validasi pembatasan akses riwayat.
4. Minimal satu buggy aktif yang mengirim telemetry agar detail buggy, ETA, penumpang, kapasitas, status koneksi, dan rekomendasi rute dapat diuji.

Status `Berhasil` pada laporan akhir hanya boleh diberikan setelah keluaran aktual sesuai dengan hasil yang diharapkan pada lingkungan pengujian.
