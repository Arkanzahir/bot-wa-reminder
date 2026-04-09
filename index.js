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
// Tujuan Pengiriman: Bisa banyak grup / japri sekaligus
const TARGET_NUMBERS = [
    { id: '120363400351305898@g.us', name: 'Grup Kontrakan BME' },
    { id: '101902545113296@lid', name: 'Japri Arkan' }
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
        
        // 2. Fitur Tambah Target Gaib (Format: !tambah ID Nama Lengkap Target)
        if (msg.body.startsWith('!tambah ')) {
            const parts = msg.body.split(' ');
            const newId = parts[1]?.trim();
            const newName = parts.slice(2).join(' ').trim() || 'Tanpa Nama (Manual)';
            
            if (newId && !TARGET_NUMBERS.find(t => t.id === newId)) {
                TARGET_NUMBERS.push({ id: newId, name: newName });
                msg.reply(`✅ SUKSES DITAMBAHKAN:\n*${newName}*\n(ID: ${newId})\n\nTarget akan dikirimi alarm sholat mulai saat ini! 😎`);
            } else {
                msg.reply(`⚠️ GAGAL:\nFormat salah (Harus: !tambah ID Nama), atau ID sudah terdaftar.`);
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
            const list = TARGET_NUMBERS.map((t, n) => `${n+1}. *${t.name}*\n   └ ID: ${t.id}`).join('\n\n');
            msg.reply(`📂 *DAFTAR TARGET AKTIF:*\n\n${list}\n\n_(Total: ${TARGET_NUMBERS.length} Tujuan)_`);
        }

        // 5. Fitur Bantuan / Panduan
        if (msg.body === '!help' || msg.body === '!bantuan') {
            msg.reply(`🤖 *PANDUAN ADMIN BOT SHOLAT* 🤖\n\n` +
            `Berikut panduan penulisan perintahnya:\n\n` +
            `1️⃣ *!ping*\n└ Fungsi: Mengetahui ID dari sebuah chat/grup.\n└ Cara: Ketik !ping di grup yang dituju\n\n` +
            `2️⃣ *!tambah <ID> <Nama>*\n└ Fungsi: Mendaftarkan grup/orang ke alarm sholat.\n└ Cara: \`!tambah 12345@g.us Grup Keluarga\`\n\n` +
            `3️⃣ *!hapus <ID>*\n└ Fungsi: Menghapus grup/orang dari alarm.\n└ Cara: \`!hapus 12345@g.us\`\n\n` +
            `4️⃣ *!cek*\n└ Fungsi: Melihat daftar orang yang akan menerima pesan saat ini.\n\n` +
            `⚠️ _Catatan: Saat mencopy ID, pastikan tanda bintang (*) atau spasi berlebih tidak ikut tercopy!_`);
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
