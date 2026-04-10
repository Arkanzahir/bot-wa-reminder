require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');
const mongoose = require('mongoose');

// Setup web server agar hosting gratisan tidak sleep
const app = express();
const port = process.env.PORT || 3000;
const axios = require('axios');
const moment = require('moment-timezone');

// ======= SETUP DATABASE MONGOOSE =======
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Terhubung ke MongoDB Atlas!'))
    .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

const taskSchema = new mongoose.Schema({
    title: String,
    course: String,
    deadline: Date,
    participants: [String],
    isNotified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// ======= KONFIGURASI PENTING =======
// Masukkan Nomor WA Pribadi atau ID Group di sini.
// Contoh Nomor: '6281234567890@c.us' (harus ada @c.us, gunakan 62 untuk Indonesia)
// Tujuan Pengiriman: Bisa banyak grup / japri sekaligus
const TARGET_NUMBERS = [
    { id: '120363400351305898@g.us', name: 'Grup Kontrakan BME', city: 'Surabaya' },
    { id: '101902545113296@lid', name: 'Japri Arkan', city: 'Surabaya' },
    { id: '205080426999829@lid', name: 'Anna', city: 'Yogyakarta' },
    { id: '66014150688999@lid', name: 'Rara Hama', city: 'Surabaya' }
];

const MENTIONS_DB = {
    'Arkan': '6289612030168@c.us',
    'Rafli': '6287834492419@c.us',
    'Hilman': '6285693889022@c.us',
    'Lutfan': '6282126392515@c.us',
    'Anna': '205080426999829@lid',
    'Rara': '66014150688999@lid',
    'Rafi': '6285795085024@c.us',
    'Kahfi': '6287796147089@c.us'
};

const KULIAH_DB = [
    // === JADWAL ARKAN & RARA ===
    { hari: 1, jam: '07:00', matkul: 'Integrasi Sistem (C)', ruang: 'TW2 703', peserta: ['Arkan', 'Rara'] },
    { hari: 1, jam: '13:30', matkul: 'Big Data dan Data Lakehouse (C)', ruang: 'TW2 704', peserta: ['Arkan', 'Rara'] },
    { hari: 2, jam: '07:00', matkul: 'Manajemen Insiden Keamanan Siber (C)', ruang: 'TW2 704', peserta: ['Arkan', 'Rara'] },
    { hari: 2, jam: '13:30', matkul: 'Kalkulus 2 (109)', ruang: 'TW1-804', peserta: ['Arkan', 'Rara'] },
    { hari: 3, jam: '07:00', matkul: 'Security Operations Center (C)', ruang: 'TW2 702', peserta: ['Arkan', 'Rara'] },
    { hari: 3, jam: '10:00', matkul: 'Teknologi Komputasi Awan (C)', ruang: 'TW2 702', peserta: ['Arkan', 'Rara'] },
    { hari: 3, jam: '13:30', matkul: 'Kecerdasan Artifisial dan Machine Learning (C)', ruang: 'TW2 702', peserta: ['Arkan', 'Rara'] },
    { hari: 4, jam: '07:00', matkul: 'Kecerdasan Artifisial dan Machine Learning (C)', ruang: 'TW2 904', peserta: ['Arkan', 'Rara'] },
    { hari: 4, jam: '13:30', matkul: 'Kalkulus 2 (109)', ruang: 'TW1-804', peserta: ['Arkan', 'Rara'] },
    { hari: 5, jam: '07:00', matkul: 'Teknologi Komputasi Awan (C)', ruang: 'TW2 704', peserta: ['Arkan', 'Rara'] },

    // === JADWAL RAFLI ===
    { hari: 1, jam: '10:00', matkul: 'Pengolahan Sinyal Digital (U)', ruang: 'TW2-501', peserta: ['Rafli'] },
    { hari: 2, jam: '10:00', matkul: 'Jaringan Komunikasi Data (T)', ruang: 'TW2-502', peserta: ['Rafli'] },
    { hari: 3, jam: '10:00', matkul: 'Rangkaian Elektronika (T)', ruang: 'C-111', peserta: ['Rafli'] },
    { hari: 3, jam: '13:30', matkul: 'Sistem Tertanam dalam Telekomunikasi (U)', ruang: 'TW2-503', peserta: ['Rafli'] },
    { hari: 5, jam: '07:00', matkul: 'Proses Stokastik (U)', ruang: 'TW2-503', peserta: ['Rafli'] },
    { hari: 5, jam: '08:00', matkul: 'Kalkulus 2 (124)', ruang: 'TW1-802', peserta: ['Rafli'] },
    { hari: 5, jam: '13:30', matkul: 'Jaringan Komunikasi Nirkabel (U)', ruang: 'TW2-505', peserta: ['Rafli'] },
    { hari: 6, jam: '07:00', matkul: 'Laboratorium Teknik Telekomunikasi 2 (T)', ruang: 'C-101', peserta: ['Rafli'] },

    // === JADWAL HILMAN ===
    { hari: 2, jam: '15:30', matkul: 'Manajemen Basis Data (B)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 3, jam: '07:00', matkul: 'Otomata (C)', ruang: 'TIF 111', peserta: ['Hilman'] },
    { hari: 3, jam: '10:00', matkul: 'Probabilitas dan Statistik (A)', ruang: 'TIF 102', peserta: ['Hilman'] },
    { hari: 3, jam: '13:30', matkul: 'Perancangan Perangkat Lunak (B)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 3, jam: '15:30', matkul: 'Pembelajaran Mesin (B)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 4, jam: '10:00', matkul: 'Perancangan dan Analisis Algoritma (F)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 5, jam: '13:30', matkul: 'Etika Profesi (A)', ruang: 'IF-219', peserta: ['Hilman'] },

    // === JADWAL LUTFAN ===
    { hari: 1, jam: '10:00', matkul: 'Pengolahan Sinyal Digital (U)', ruang: 'TW2-501', peserta: ['Lutfan'] },
    { hari: 2, jam: '07:00', matkul: 'Sistem Komunikasi (U)', ruang: 'TW2-504', peserta: ['Lutfan'] },
    { hari: 3, jam: '07:00', matkul: 'Sistem Komunikasi (U)', ruang: 'TW2-501', peserta: ['Lutfan'] },
    { hari: 3, jam: '13:30', matkul: 'Sistem Tertanam dalam Telekomunikasi (U)', ruang: 'TW2-503', peserta: ['Lutfan'] },
    { hari: 4, jam: '10:00', matkul: 'Rekayasa Internet (T)', ruang: 'TW2-503', peserta: ['Lutfan'] },
    { hari: 4, jam: '13:30', matkul: 'Elektronika Telekomunikasi (U)', ruang: 'TW2-501', peserta: ['Lutfan'] },
    { hari: 5, jam: '07:00', matkul: 'Proses Stokastik (U)', ruang: 'TW2-503', peserta: ['Lutfan'] },
    { hari: 5, jam: '13:30', matkul: 'Jaringan Komunikasi Nirkabel (U)', ruang: 'TW2-505', peserta: ['Lutfan'] },

    // === JADWAL ANNA ===
    { hari: 1, jam: '12:30', matkul: 'Kelas Bahasa', ruang: '404', peserta: ['Anna'] },
    { hari: 2, jam: '07:00', matkul: 'Tafsir dan Hadist Ekonomi', ruang: '402', peserta: ['Anna'] },
    { hari: 2, jam: '10:00', matkul: 'Manajemen', ruang: '406', peserta: ['Anna'] },
    { hari: 2, jam: '15:15', matkul: 'Bahasa Arab', ruang: '402', peserta: ['Anna'] },
    { hari: 3, jam: '07:00', matkul: 'Statistik', ruang: '302', peserta: ['Anna'] },
    { hari: 3, jam: '11:00', matkul: 'Ulum Hadist', ruang: '303', peserta: ['Anna'] },
    { hari: 4, jam: '07:00', matkul: 'Ekonomi Makro', ruang: '501', peserta: ['Anna'] },
    { hari: 4, jam: '09:45', matkul: 'Ekonomi Mikro II', ruang: '302', peserta: ['Anna'] },
    { hari: 4, jam: '14:45', matkul: 'Kewarganegaraan', ruang: '501', peserta: ['Anna'] },

    // === JADWAL RAFI (ARSITEKTUR) ===
    { hari: 1, jam: '07:00', matkul: 'Perancangan Arsitektur 2 (C)', ruang: 'SF-101/102', peserta: ['Rafi'] },
    { hari: 2, jam: '07:00', matkul: 'Arsitektur Setelah Pandemi (A)', ruang: 'SF-101', peserta: ['Rafi'] },
    { hari: 2, jam: '09:00', matkul: 'Matematika (114)', ruang: 'Theater-B', peserta: ['Rafi'] },
    { hari: 2, jam: '13:30', matkul: 'Perancangan Tanggap Bencana (A)', ruang: 'SF-101', peserta: ['Rafi'] },
    { hari: 3, jam: '07:00', matkul: 'Asas Perancangan Arsitektur Kontekstual (A)', ruang: 'SF-101', peserta: ['Rafi'] },
    { hari: 3, jam: '13:30', matkul: 'Dasar Perancangan Kota (A)', ruang: 'SG-101', peserta: ['Rafi'] },
    { hari: 4, jam: '07:00', matkul: 'Sejarah Arsitektur (A)', ruang: 'SG-101', peserta: ['Rafi'] },
    { hari: 4, jam: '09:00', matkul: 'Matematika (114)', ruang: 'Theater-B', peserta: ['Rafi'] },
    { hari: 5, jam: '07:00', matkul: 'Perancangan Arsitektur 2 (C)', ruang: 'SF-101/102', peserta: ['Rafi'] },

    // === JADWAL KAHFI (SISTEM INFORMASI BISNIS) ===
    { hari: 2, jam: '07:00', matkul: 'Perencanaan Produksi dan Pengendalian Persediaan (D)', ruang: 'IE-105', peserta: ['Kahfi'] },
    { hari: 2, jam: '10:00', matkul: 'Penelitian Operasional 2 (D)', ruang: 'IE-106', peserta: ['Kahfi'] },
    { hari: 3, jam: '13:30', matkul: 'Perancangan dan Pengembangan Produk (D)', ruang: 'IE-106', peserta: ['Kahfi'] },
    { hari: 4, jam: '07:00', matkul: 'Pengendalian dan Penjaminan Kualitas (D)', ruang: 'IE-105', peserta: ['Kahfi'] },
    { hari: 4, jam: '10:00', matkul: 'Perancangan Sistem Informasi Bisnis (D)', ruang: 'IE-105', peserta: ['Kahfi'] },
    { hari: 4, jam: '15:30', matkul: 'Pemeliharaan dan Teknik Keandalan (D)', ruang: 'IE-601', peserta: ['Kahfi'] },
    { hari: 5, jam: '08:00', matkul: 'Kalkulus 1 (134)', ruang: 'TW1-605', peserta: ['Kahfi'] }
];

const COUNTRY = 'Indonesia';
const TIMEZONE = 'Asia/Jakarta';

// Inisialisasi WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(), // Auth otomatis tersimpan di folder .wwebjs_auth
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Menyimpan Job Cron berjalan agar bisa direset setiap berganti hari
let activeCronJobs = [];
let midnightCronJob = null; // Track cron midnight agar tidak menumpuk
let isInitializing = false; // Lock agar tidak ada double-call bersamaan

client.on('qr', (qr) => {
    console.log('==============================================');
    console.log('TOLONG SCAN BARKODE DI BAWAH MENGGUNAKAN WA-MU:');
    qrcode.generate(qr, { small: true });
    console.log('==============================================');
    console.log('🚨 JIKA BARKODE DI ATAS GEPENG / GAGAL DI-SCAN 🚨');
    console.log('COPY DAN BUKA LINK DI BAWAH INI KE BROWSER-MU UNTUK MELIHAT QR-NYA:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`);
    console.log('==============================================');
});

client.on('ready', () => {
    console.log('✅ Klien WhatsApp sudah SIAP dan TERHUBUNG!');
    
    // Inisialisasi jadwal langsung saat bot hidup
    initializeDailySchedule();
    
    // Hentikan cron midnight lama jika ada (mencegah duplikasi saat reconnect)
    if (midnightCronJob) {
        midnightCronJob.stop();
        midnightCronJob = null;
    }
    
    // Refresh jadwal otomatis setiap reset hari (00:01 AM) 
    midnightCronJob = cron.schedule('1 0 * * *', () => {
        console.log('Menyiapkan jadwal sholat baru untuk hari ini...');
        initializeDailySchedule();
    }, {
        timezone: TIMEZONE
    });

    // --- CRON: PENGINGAT TUGAS HARIAN (07:00 AM) ---
    cron.schedule('0 7 * * *', async () => {
        console.log('Running Task Reminder Cron (07:00 AM)...');
        try {
            const threeDaysLater = moment().add(3, 'days').endOf('day').toDate();
            const tasks = await Task.find({
                deadline: { $gte: moment().startOf('day').toDate(), $lte: threeDaysLater }
            }).sort({ deadline: 1 });

            if (tasks.length > 0) {
                let report = '📢 *PENGINGAT TUGAS KULIAH* 📢\n\nAda tugas yang mendekati deadline nih:\n\n';
                tasks.forEach((t, i) => {
                    const daysLeft = moment(t.deadline).diff(moment().startOf('day'), 'days');
                    const status = daysLeft === 0 ? '⚠️ *HARI INI!*' : daysLeft === 1 ? '🔴 *BESOK!*' : '🟡 H-${daysLeft}';
                    report += `${i + 1}. *${t.title}*\n   📚 ${t.course}\n   🗓️ ${moment(t.deadline).format('DD MMM')}\n   ⏰ Status: ${status}\n\n`;
                });

                // Kirim ke Grup Kontrakan (Utama)
                const groupChatId = '120363400351305898@g.us';
                await client.sendMessage(groupChatId, report + '_Semangat nugasnya rek!_');

                // Japri ke masing-masing peserta
                for (const t of tasks) {
                    for (const pName of t.participants) {
                        const jid = MENTIONS_DB[pName];
                        if (jid) {
                            await client.sendMessage(jid, `⚠️ *PENGINGAT TUGAS: ${t.title}*\n\nJangan lupa, deadline tugas *${t.course}* adalah tanggal *${moment(t.deadline).format('DD MMMM YYYY')}*.\nSemangat! 💪`);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error in Task Reminder Cron:', err);
        }
    }, { timezone: TIMEZONE });

    // --- CRON: AUTO-CLEANUP TUGAS KADALUARSA (01:00 AM) ---
    cron.schedule('0 1 * * *', async () => {
        console.log('Running Task Cleanup Cron (01:00 AM)...');
        try {
            const yesterday = moment().subtract(1, 'days').endOf('day').toDate();
            const result = await Task.deleteMany({ deadline: { $lte: yesterday } });
            console.log(`🧹 Auto-Cleanup: Berhasil menghapus ${result.deletedCount} tugas kadaluarsa.`);
        } catch (err) {
            console.error('Error in Task Cleanup Cron:', err);
        }
    }, { timezone: TIMEZONE });
});

async function initializeDailySchedule() {
    // GUARD: Cegah eksekusi ganda bersamaan (race condition saat reconnect)
    if (isInitializing) {
        console.log('⚠️ initializeDailySchedule sudah berjalan, melewati panggilan duplikat...');
        return;
    }
    isInitializing = true;

    // 1. Matikan & Reset Job lama (jika ada)
    activeCronJobs.forEach(job => job.stop());
    activeCronJobs = [];

    // 2. Ambil data jadwal Sholat harian
    try {
        // Ambil kota unik dari daftar user
        const uniqueCities = [...new Set(TARGET_NUMBERS.map(t => t.city))];

        for (const city of uniqueCities) {
            const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${COUNTRY}&method=11`);
            const timings = response.data.data.timings;
            console.log(`\n📅 Berhasil mendapatkan jadwal sholat wilayah ${city} untuk hari ini:`);
            console.log(timings);

            // 3. Saring user yang hanya perlu jadwal kota ini
            const cityTargets = TARGET_NUMBERS.filter(t => t.city === city);

            // --- JADWAL TAHAJUD (Fixed Jam 03:00) ---
            scheduleMessage('0 3 * * *', 
                `🌙 *WAKTU TAHAJUD* 🌙\n\nSaatnya bangun untuk sholat Tahajud dan bermunajat kepada Allah SWT.`, cityTargets
            );

            // --- JADWAL SAHUR (45 menit sebelum Imsak - Otomatis menyesuaikan) ---
            const imsakTime = moment(timings.Imsak, 'HH:mm');
            const sahurTime = imsakTime.clone().subtract(45, 'minutes');
            scheduleMessage(`${sahurTime.minute()} ${sahurTime.hour()} * * *`,
                `🍚 *WAKTU SAHUR* 🍚\n\nSegera bangun dan makan sahur.\n⏳ Imsak pukul: ${timings.Imsak} WIB\n⏳ Subuh pukul: ${timings.Fajr} WIB`, cityTargets
            );

            // --- JADWAL IMSAK ---
            const imsakMoment = moment(timings.Imsak, 'HH:mm');
            scheduleMessage(`${imsakMoment.minute()} ${imsakMoment.hour()} * * *`,
                `⚠️ *WAKTU IMSAK* ⚠️\n\nWilayah: ${city}\nWaktu: ${timings.Imsak} WIB\n\n_Segera selesaikan makan & minum Anda. Sebentar lagi azan Subuh._`, cityTargets
            );

            // --- JADWAL SUBUH ---
            const subuhMoment = moment(timings.Fajr, 'HH:mm');
            scheduleMessage(`${subuhMoment.minute()} ${subuhMoment.hour()} * * *`,
                `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${city}\nWaktu: Subuh (${timings.Fajr} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`, cityTargets
            );
            
            // --- JADWAL DZUHUR ---
            const dzuhurMoment = moment(timings.Dhuhr, 'HH:mm');
            scheduleMessage(`${dzuhurMoment.minute()} ${dzuhurMoment.hour()} * * *`,
                `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${city}\nWaktu: Dzuhur (${timings.Dhuhr} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`, cityTargets
            );

            // --- JADWAL ASHAR ---
            const asharMoment = moment(timings.Asr, 'HH:mm');
            scheduleMessage(`${asharMoment.minute()} ${asharMoment.hour()} * * *`,
                `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${city}\nWaktu: Ashar (${timings.Asr} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`, cityTargets
            );

            // --- JADWAL MAGHRIB ---
            const maghribMoment = moment(timings.Maghrib, 'HH:mm');
            scheduleMessage(`${maghribMoment.minute()} ${maghribMoment.hour()} * * *`,
                `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${city}\nWaktu: Maghrib (${timings.Maghrib} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`, cityTargets
            );

            // --- JADWAL ISYA ---
            const isyaMoment = moment(timings.Isha, 'HH:mm');
            scheduleMessage(`${isyaMoment.minute()} ${isyaMoment.hour()} * * *`,
                `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${city}\nWaktu: Isya (${timings.Isha} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`, cityTargets
            );
        }

        // --- JADWAL KULIAH (Mendukung Multi-Destinasi: Grup & Japri) ---
        const PESERTA_ROUTING = {
            'Arkan': ['120363400351305898@g.us', '101902545113296@lid'], // Grup & Japri
            'Rafli': ['120363400351305898@g.us'],
            'Hilman': ['120363400351305898@g.us'],
            'Lutfan': ['120363400351305898@g.us'],
            'Anna': ['205080426999829@lid'],
            'Rara': ['66014150688999@lid'],
            'Rafi': ['120363400351305898@g.us'],
            'Kahfi': ['120363400351305898@g.us']
        };

        const groupedKuliah = {};
        KULIAH_DB.forEach(kuliah => {
            kuliah.peserta.forEach(p => {
                const dests = PESERTA_ROUTING[p] || [];
                dests.forEach(dest => {
                    const key = `${dest}_${kuliah.hari}_${kuliah.jam}`;
                    if (!groupedKuliah[key]) {
                        groupedKuliah[key] = {
                            dest: dest,
                            hari: kuliah.hari,
                            jam: kuliah.jam,
                            matkuls: {}
                        };
                    }
                    
                    const mkKey = `${kuliah.matkul}_${kuliah.ruang}`;
                    if (!groupedKuliah[key].matkuls[mkKey]) {
                        groupedKuliah[key].matkuls[mkKey] = {
                            matkul: kuliah.matkul,
                            ruang: kuliah.ruang,
                            peserta: []
                        };
                    }
                    if (!groupedKuliah[key].matkuls[mkKey].peserta.includes(p)) {
                        groupedKuliah[key].matkuls[mkKey].peserta.push(p);
                    }
                });
            });
        });

        // Buat cronjob per destinasi per waktu
        Object.values(groupedKuliah).forEach(group => {
            const timeObj = moment(group.jam, 'HH:mm').subtract(45, 'minutes');
            const cronMnt = timeObj.minute();
            const cronHr = timeObj.hour();
            const cronDay = group.hari;
            const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][cronDay] || '';
            const emojiList = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

            let daftarPeserta = '';
            let allMentions = [];
            
            Object.values(group.matkuls).forEach((mk, idx) => {
                const emoji = emojiList[idx] || `${idx + 1}.`;
                
                let names = '';
                // Jika dikirim ke grup, gunakan format mention @nomor agar jadi biru
                if (group.dest.includes('@g.us')) {
                    names = mk.peserta.map(p => {
                        const jid = MENTIONS_DB[p];
                        if (jid) {
                            // Ambil bagian nomor saja (sebelum @)
                            const phoneNumber = jid.split('@')[0];
                            return '@' + phoneNumber;
                        }
                        return p; // fallback ke nama hiasa jika tidak ada di DB
                    }).join(', ');

                    mk.peserta.forEach(p => {
                        if (MENTIONS_DB[p]) allMentions.push(MENTIONS_DB[p]);
                    });
                } else {
                    // Jika ke japri, cukup sebut nama biasa karena sedang membaca chat dirinya
                    names = mk.peserta.join(', ');
                }
                
                daftarPeserta += `${emoji} ${names}\n└ ${mk.matkul} — ${mk.ruang}\n\n`;
            });

            const msgTeks = `🎓 *PENGINGAT JADWAL KULIAH* 🎓\n📅 ${namaHari}, ${group.jam} WIB\n\n${daftarPeserta.trim()}\n\n_"Jangan biarkan rasa malas ngelahin mimpi yang kamu kejar"_`;

            scheduleUniversityMessage(`${cronMnt} ${cronHr} * * ${cronDay}`, msgTeks, group.dest, allMentions);
        });

        console.log(`[!] Sebanyak ${activeCronJobs.length} jadwal pengingat aktif hari ini.\n`);

    } catch (error) {
        console.error('❌ Gagal mengambil data jadwal sholat:', error.message);
    } finally {
        isInitializing = false; // Buka kunci agar jadwal bisa di-refresh lagi nanti
    }
}

// Helper: Menyisipkan Task ke list eksekusi
function scheduleMessage(cronTime, messageText, targetsArray) {
    const job = cron.schedule(cronTime, async () => {
        const now = moment().tz(TIMEZONE).format('HH:mm:ss');
        console.log(`[${now}] Menjalankan aksi: Mengirim pengingat pesan...`);
        
        for (const target of targetsArray) {
            try {
                await client.sendMessage(target.id, messageText);
                console.log(` - Pesan sukses terkirim ke: ${target.name} (${target.id})`);
            } catch (err) {
                console.error(` - Gagal mengirim ke ${target.name}:`, err.message);
            }
        }
    }, {
        timezone: TIMEZONE
    });
    
    activeCronJobs.push(job);
}

// Helper: Menyisipkan Task Khusus Jadwal Kuliah (Bisa Spesifik Target & Mention)
function scheduleUniversityMessage(cronTime, messageText, targetId, mentionsArray) {
    const job = cron.schedule(cronTime, async () => {
        const now = moment().tz(TIMEZONE).format('HH:mm:ss');
        console.log(`[${now}] Menjalankan aksi: Mengirim pengingat KULIAH ke ${targetId}...`);
        
        try {
            await client.sendMessage(targetId, messageText, { mentions: mentionsArray });
            console.log(` - Pesan kuliah sukses terkirim ke: ${targetId}`);
        } catch (err) {
            console.error(` - Gagal mengirim kuliah:`, err.message);
        }
    }, {
        timezone: TIMEZONE
    });
    
    activeCronJobs.push(job);
}

// Sistem Pendeteksi ID Grup
// Jika kamu ingin tau ID sebuah grup (buat diisikan ke TARGET_NUMBERS), undang bot ke grup lalu katakan !ping.
client.on('message_create', async msg => {
    // 1. Fitur cek ID untuk mendaftarkan grup (Bebas untuk umum)
    if (msg.body === '!ping') {
        const chat = await msg.getChat();
        msg.reply(`Pong!\n\nID Chat ini adalah:\n*${chat.id._serialized}*`);
        console.log('User menanyakan ID:', chat.id._serialized);
    }
    
    // ======== AREA KHUSUS PEMILIK BOT ========
    // Fitur di bawah ini hanya akan aktif jika yang mengetik pesannya dari HP kamu sendiri (fromMe = true)
    if (msg.fromMe) {
        
        // 2. Fitur Tambah Target (Format: !tambah ID Kota Nama Lengkap Target)
        if (msg.body.startsWith('!tambah ')) {
            const parts = msg.body.split(' ');
            const newId = parts[1]?.trim();
            const newCity = parts[2]?.trim() || 'Surabaya';
            const newName = parts.slice(3).join(' ').trim() || 'Tanpa Nama (Manual)';
            
            if (newId && !TARGET_NUMBERS.find(t => t.id === newId)) {
                TARGET_NUMBERS.push({ id: newId, name: newName, city: newCity });
                msg.reply(`✅ SUKSES DITAMBAHKAN:\n*${newName}*\n(ID: ${newId})\n🏙️ Kota: ${newCity}\n\nTarget akan dikirimi alarm sholat mulai saat ini! 😎`);
                // Auto-refresh jadwal agar langsung aktif
                initializeDailySchedule();
            } else {
                msg.reply(`⚠️ GAGAL:\nFormat salah atau ID sudah terdaftar.\n\n_Format: !tambah <ID> <Kota> <Nama>_\n_Contoh: !tambah 12345@g.us Surabaya Grup Keluarga_`);
            }
        }
        
        // 3. Fitur Hapus Target
        if (msg.body.startsWith('!hapus ')) {
            const idToRemove = msg.body.split(' ')[1]?.trim();
            const index = TARGET_NUMBERS.findIndex(t => t.id === idToRemove);
            if (index > -1) {
                const removedName = TARGET_NUMBERS[index].name;
                TARGET_NUMBERS.splice(index, 1);
                msg.reply(`🗑️ BERHASIL DIHAPUS:\n*${removedName}* tidak akan dikirimkan Notifikasi Sholat lagi!`);
            } else {
                msg.reply(`⚠️ GAGAL:\nID tersebut tidak ditemukan.`);
            }
        }

        // 4. Cek Semua Daftar
        if (msg.body === '!cek') {
            const list = TARGET_NUMBERS.map((t, n) => `${n+1}. *${t.name}*\n   └ ID: ${t.id}\n   └ 🏙️ Kota: ${t.city}`).join('\n\n');
            msg.reply(`📂 *DAFTAR TARGET AKTIF:*\n\n${list}\n\n_(Total: ${TARGET_NUMBERS.length} Tujuan)_`);
        }

        // 5. Fitur Bantuan / Panduan
        if (msg.body === '!help' || msg.body === '!bantuan') {
            msg.reply(`🤖 *PANDUAN ADMIN BOT SHOLAT* 🤖\n\n` +
            `Berikut panduan penulisan perintahnya:\n\n` +
            `1️⃣ *!ping*\n└ Fungsi: Mengetahui ID dari sebuah chat/grup.\n└ Cara: Ketik !ping di grup yang dituju\n\n` +
            `2️⃣ *!tambah <ID> <Kota> <Nama>*\n└ Fungsi: Mendaftarkan grup/orang ke alarm sholat.\n└ Cara: \`!tambah 12345@g.us Surabaya Grup Keluarga\`\n\n` +
            `3️⃣ *!hapus <ID>*\n└ Fungsi: Menghapus grup/orang dari alarm.\n└ Cara: \`!hapus 12345@g.us\`\n\n` +
            `4️⃣ *!cek*\n└ Fungsi: Melihat daftar target beserta kota masing-masing.\n\n` +
            `⚠️ _Catatan: Saat mencopy ID, pastikan tanda bintang (*) atau spasi berlebih tidak ikut tercopy!_`);
        }
    }

    // ======== AREA FITUR TUGAS (Bisa oleh semua anggota terdaftar) ========
    const sender = msg.from;
    const isOwner = msg.fromMe;
    const isRegistered = Object.values(MENTIONS_DB).some(jid => jid === sender || jid.replace('@c.us', '@s.whatsapp.net') === sender);

    if (isOwner || isRegistered) {
        if (msg.body.startsWith('!tugas ')) {
            const command = msg.body.split(' ')[1];
            
            // --- 1. TAMBAH TUGAS (!tugas tambah Nama | Matkul | YYYY-MM-DD | Peserta) ---
            if (command === 'tambah') {
                const content = msg.body.replace('!tugas tambah ', '').split('|');
                if (content.length < 3) {
                    return msg.reply('⚠️ Format Salah!\n\n_Format: !tugas tambah [Nama] | [Matkul] | [YYYY-MM-DD] | [Peserta (Opsional)]_');
                }

                const title = content[0].trim();
                const course = content[1].trim();
                const deadlineStr = content[2].trim();
                const participants = content[3] ? content[3].split(',').map(p => p.trim()) : [];

                const deadline = moment.tz(deadlineStr, 'YYYY-MM-DD', TIMEZONE);
                if (!deadline.isValid()) {
                    return msg.reply('⚠️ Tanggal tidak valid!\nGunakan format YYYY-MM-DD (Contoh: 2024-04-20)');
                }

                try {
                    const newTask = new Task({
                        title,
                        course,
                        deadline: deadline.toDate(),
                        participants
                    });
                    await newTask.save();
                    msg.reply(`✅ *TUGAS BERHASIL DICATAT!*\n\n📝: ${title}\n📚: ${course}\n🗓️: ${deadline.format('DD MMMM YYYY')}\n👥: ${participants.join(', ') || 'Semua'}\n\n_Tenang, nanti diingetin H-3 dan tiap pagi!_`);
                } catch (err) {
                    msg.reply('❌ Gagal menyimpan ke database.');
                }
            }

            // --- 2. CEK TUGAS (!tugas cek) ---
            if (command === 'cek' || command === 'list') {
                try {
                    const tasks = await Task.find({ deadline: { $gte: moment().startOf('day').toDate() } }).sort({ deadline: 1 });
                    if (tasks.length === 0) {
                        return msg.reply('📭 *Tidak ada tugas aktif.* Santai dulu aja! 😎');
                    }

                    let listMsg = '📅 *DAFTAR TUGAS AKTIF* 📅\n\n';
                    tasks.forEach((t, i) => {
                        listMsg += `${i + 1}. *${t.title}*\n   📚 ${t.course}\n   🗓️ Deadline: ${moment(t.deadline).format('DD MMM YYYY')}\n   👥 ${t.participants.join(', ') || 'Semua'}\n   🆔 \`${t._id}\`\n\n`;
                    });
                    msg.reply(listMsg + '_Ketik !tugas hapus [ID] untuk menghapus._');
                } catch (err) {
                    msg.reply('❌ Gagal mengambil data.');
                }
            }

            // --- 3. HAPUS TUGAS (!tugas hapus ID) ---
            if (command === 'hapus') {
                const taskId = msg.body.split(' ')[2]?.trim();
                if (!taskId) return msg.reply('⚠️ Masukkan ID-nya! (ID bisa dilihat di !tugas cek)');

                try {
                    const deleted = await Task.findByIdAndDelete(taskId);
                    if (deleted) {
                        msg.reply(`🗑️ Tugas *${deleted.title}* berhasil dihapus!`);
                    } else {
                        msg.reply('⚠️ ID tidak ditemukan.');
                    }
                } catch (err) {
                    msg.reply('❌ ID tidak valid / error database.');
                }
            }
        }
    }
});

client.initialize();

// ======= SERVER BYPASS RENDER.COM =======
// Menjalankan halaman web kosong supaya UptimeRobot bisa nge-ping bot kita terus-terusan.
app.get('/', (req, res) => {
    res.send('✅ Bot WA Reminder sedang aktif dan nyala 24 jam!');
});
app.listen(port, () => {
    console.log(`\n🌐 Web Server untuk Pinger telah menyala di port: ${port}`);
});
