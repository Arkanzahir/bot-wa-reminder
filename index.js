const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');

// Setup web server agar hosting gratisan tidak sleep
const app = express();
const port = process.env.PORT || 3000;
const axios = require('axios');
const moment = require('moment-timezone');

// ======= KONFIGURASI PENTING =======
// Masukkan Nomor WA Pribadi atau ID Group di sini.
// Contoh Nomor: '6281234567890@c.us' (harus ada @c.us, gunakan 62 untuk Indonesia)
// Contoh Group: '120363025123456789@g.us' (cara tau grup ID: undang bot ke grup, ketik !ping, lihat console)
const TARGET_NUMBERS = [
    '101902545113296@lid' 
];

const CITY = 'Surabaya';
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
    
    // Refresh jadwal otomatis setiap reset hari (00:01 AM) 
    cron.schedule('1 0 * * *', () => {
        console.log('Menyiapkan jadwal sholat baru untuk hari ini...');
        initializeDailySchedule();
    }, {
        timezone: TIMEZONE
    });
});

async function initializeDailySchedule() {
    // 1. Matikan & Reset Job lama (jika ada)
    activeCronJobs.forEach(job => job.stop());
    activeCronJobs = [];

    // 2. Ambil data jadwal Sholat harian
    try {
        const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${CITY}&country=${COUNTRY}&method=11`);
        const timings = response.data.data.timings;
        console.log(`\n📅 Berhasil mendapatkan jadwal sholat wilayah ${CITY} untuk hari ini:`);
        console.log(timings);

        // 3. Daftarkan Jadwal ke Cron:
        
        // --- JADWAL TAHAJUD (Fixed Jam 03:00) ---
        scheduleMessage('0 3 * * *', 
            `🌙 *WAKTU TAHAJUD* 🌙\n\nSaatnya bangun untuk sholat Tahajud dan bermunajat kepada Allah SWT.`
        );

        // --- JADWAL SAHUR (45 menit sebelum Imsak - Otomatis menyesuaikan) ---
        const imsakTime = moment(timings.Imsak, 'HH:mm');
        const sahurTime = imsakTime.clone().subtract(45, 'minutes');
        scheduleMessage(`${sahurTime.minute()} ${sahurTime.hour()} * * *`,
            `🍚 *WAKTU SAHUR* 🍚\n\nSegera bangun dan makan sahur.\n⏳ Imsak pukul: ${timings.Imsak} WIB\n⏳ Subuh pukul: ${timings.Fajr} WIB`
        );

        // --- JADWAL IMSAK ---
        const imsakMoment = moment(timings.Imsak, 'HH:mm');
        scheduleMessage(`${imsakMoment.minute()} ${imsakMoment.hour()} * * *`,
            `⚠️ *WAKTU IMSAK* ⚠️\n\nWilayah: ${CITY}\nWaktu: ${timings.Imsak} WIB\n\n_Segera selesaikan makan & minum Anda. Sebentar lagi azan Subuh._`
        );

        // --- JADWAL SUBUH ---
        const subuhMoment = moment(timings.Fajr, 'HH:mm');
        scheduleMessage(`${subuhMoment.minute()} ${subuhMoment.hour()} * * *`,
            `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${CITY}\nWaktu: Subuh (${timings.Fajr} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`
        );
        
        // --- JADWAL DZUHUR ---
        const dzuhurMoment = moment(timings.Dhuhr, 'HH:mm');
        scheduleMessage(`${dzuhurMoment.minute()} ${dzuhurMoment.hour()} * * *`,
            `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${CITY}\nWaktu: Dzuhur (${timings.Dhuhr} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`
        );

        // --- JADWAL ASHAR ---
        const asharMoment = moment(timings.Asr, 'HH:mm');
        scheduleMessage(`${asharMoment.minute()} ${asharMoment.hour()} * * *`,
            `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${CITY}\nWaktu: Ashar (${timings.Asr} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`
        );

        // --- JADWAL MAGHRIB ---
        const maghribMoment = moment(timings.Maghrib, 'HH:mm');
        scheduleMessage(`${maghribMoment.minute()} ${maghribMoment.hour()} * * *`,
            `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${CITY}\nWaktu: Maghrib (${timings.Maghrib} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`
        );

        // --- JADWAL ISYA ---
        const isyaMoment = moment(timings.Isha, 'HH:mm');
        scheduleMessage(`${isyaMoment.minute()} ${isyaMoment.hour()} * * *`,
            `🕋 *WAKTU SHOLAT TIBA* 🕋\n\nWilayah: ${CITY}\nWaktu: Isya (${timings.Isha} WIB)\n\n_Mari sejenak tinggalkan aktivitas dan laksanakan ibadah._`
        );

        console.log(`[!] Sebanyak ${activeCronJobs.length} jadwal pengingat aktif hari ini.\n`);

    } catch (error) {
        console.error('❌ Gagal mengambil data jadwal sholat:', error.message);
    }
}

// Helper: Menyisipkan Task ke list eksekusi
function scheduleMessage(cronTime, messageText) {
    const job = cron.schedule(cronTime, async () => {
        const now = moment().tz(TIMEZONE).format('HH:mm:ss');
        console.log(`[${now}] Menjalankan aksi: Mengirim pengingat pesan...`);
        
        for (const target of TARGET_NUMBERS) {
            try {
                await client.sendMessage(target, messageText);
                console.log(` - Pesan sukses terkirim ke: ${target}`);
            } catch (err) {
                console.error(` - Gagal mengirim ke ${target}:`, err.message);
            }
        }
    }, {
        timezone: TIMEZONE
    });
    
    activeCronJobs.push(job);
}

// Sistem Pendeteksi ID Grup
// Jika kamu ingin tau ID sebuah grup (buat diisikan ke TARGET_NUMBERS), undang bot ke grup lalu katakan !ping.
client.on('message_create', async message => {
    if (message.body === '!ping') {
        const chat = await message.getChat();
        message.reply(`Bot Aktif!\nID Tujuanku adalah:\n*${message.from}*`);
        console.log(`\n### ID CHAT TERDETEKSI: ${message.from} (Nama Grup/Personal: ${chat.name}) ###\n`);
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
