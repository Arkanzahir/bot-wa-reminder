require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const moment = require('moment-timezone');

// ======= SETUP WEB SERVER =======
const app = express();
const port = process.env.PORT || 3000;

// ======= SETUP DATABASE MONGOOSE =======
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Terhubung ke MongoDB Atlas!'))
    .catch(err => console.error('❌ Gagal koneksi ke MongoDB:', err));

const userSchema = new mongoose.Schema({
    nickname: { type: String, unique: true },
    jid: String,
    addedAt: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
    title: String,
    course: String,
    deadline: Date,
    participants: [String],
    groupId: String,
    isNotified: { type: Boolean, default: false },
    isDone: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const scheduleSchema = new mongoose.Schema({
    hari: Number,
    jam: String,
    matkul: String,
    ruang: String,
    participants: [String],
    groupId: String
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);
const Schedule = mongoose.model('Schedule', scheduleSchema);

// ======= DATA WARISAN (MIGRATION SOURCE & ALARM SHOLAT) =======
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
    { hari: 1, jam: '10:00', matkul: 'Pengolahan Sinyal Digital (U)', ruang: 'TW2-501', peserta: ['Rafli'] },
    { hari: 2, jam: '10:00', matkul: 'Jaringan Komunikasi Data (T)', ruang: 'TW2-502', peserta: ['Rafli'] },
    { hari: 3, jam: '10:00', matkul: 'Rangkaian Elektronika (T)', ruang: 'C-111', peserta: ['Rafli'] },
    { hari: 3, jam: '13:30', matkul: 'Sistem Tertanam dalam Telekomunikasi (U)', ruang: 'TW2-503', peserta: ['Rafli'] },
    { hari: 5, jam: '07:00', matkul: 'Proses Stokastik (U)', ruang: 'TW2-503', peserta: ['Rafli'] },
    { hari: 5, jam: '08:00', matkul: 'Kalkulus 2 (124)', ruang: 'TW1-802', peserta: ['Rafli'] },
    { hari: 5, jam: '13:30', matkul: 'Jaringan Komunikasi Nirkabel (U)', ruang: 'TW2-505', peserta: ['Rafli'] },
    { hari: 6, jam: '07:00', matkul: 'Laboratorium Teknik Telekomunikasi 2 (T)', ruang: 'C-101', peserta: ['Rafli'] },
    { hari: 2, jam: '15:30', matkul: 'Manajemen Basis Data (B)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 3, jam: '07:00', matkul: 'Otomata (C)', ruang: 'TIF 111', peserta: ['Hilman'] },
    { hari: 3, jam: '10:00', matkul: 'Probabilitas dan Statistik (A)', ruang: 'TIF 102', peserta: ['Hilman'] },
    { hari: 3, jam: '13:30', matkul: 'Perancangan Perangkat Lunak (B)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 3, jam: '15:30', matkul: 'Pembelajaran Mesin (B)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 4, jam: '10:00', matkul: 'Perancangan dan Analisis Algoritma (F)', ruang: 'TIF 104', peserta: ['Hilman'] },
    { hari: 5, jam: '13:30', matkul: 'Etika Profesi (A)', ruang: 'IF-219', peserta: ['Hilman'] },
    { hari: 1, jam: '10:00', matkul: 'Pengolahan Sinyal Digital (U)', ruang: 'TW2-501', peserta: ['Lutfan'] },
    { hari: 2, jam: '07:00', matkul: 'Sistem Komunikasi (U)', ruang: 'TW2-504', peserta: ['Lutfan'] },
    { hari: 3, jam: '07:00', matkul: 'Sistem Komunikasi (U)', ruang: 'TW2-501', peserta: ['Lutfan'] },
    { hari: 3, jam: '13:30', matkul: 'Sistem Tertanam dalam Telekomunikasi (U)', ruang: 'TW2-503', peserta: ['Lutfan'] },
    { hari: 4, jam: '10:00', matkul: 'Rekayasa Internet (T)', ruang: 'TW2-503', peserta: ['Lutfan'] },
    { hari: 4, jam: '13:30', matkul: 'Elektronika Telekomunikasi (U)', ruang: 'TW2-501', peserta: ['Lutfan'] },
    { hari: 5, jam: '07:00', matkul: 'Proses Stokastik (U)', ruang: 'TW2-503', peserta: ['Lutfan'] },
    { hari: 5, jam: '13:30', matkul: 'Jaringan Komunikasi Nirkabel (U)', ruang: 'TW2-505', peserta: ['Lutfan'] },
    { hari: 1, jam: '12:30', matkul: 'Kelas Bahasa', ruang: '404', peserta: ['Anna'] },
    { hari: 2, jam: '07:00', matkul: 'Tafsir dan Hadist Ekonomi', ruang: '402', peserta: ['Anna'] },
    { hari: 2, jam: '10:00', matkul: 'Manajemen', ruang: '406', peserta: ['Anna'] },
    { hari: 2, jam: '15:15', matkul: 'Bahasa Arab', ruang: '402', peserta: ['Anna'] },
    { hari: 3, jam: '07:00', matkul: 'Statistik', ruang: '302', peserta: ['Anna'] },
    { hari: 3, jam: '11:00', matkul: 'Ulum Hadist', ruang: '303', peserta: ['Anna'] },
    { hari: 4, jam: '07:00', matkul: 'Ekonomi Makro', ruang: '501', peserta: ['Anna'] },
    { hari: 4, jam: '09:45', matkul: 'Ekonomi Mikro II', ruang: '302', peserta: ['Anna'] },
    { hari: 4, jam: '14:45', matkul: 'Kewarganegaraan', ruang: '501', peserta: ['Anna'] },
    { hari: 1, jam: '07:00', matkul: 'Perancangan Arsitektur 2 (C)', ruang: 'SF-101/102', peserta: ['Rafi'] },
    { hari: 2, jam: '13:30', matkul: 'Perancangan Tanggap Bencana (A)', ruang: 'SF-101', peserta: ['Rafi'] },
    { hari: 2, jam: '07:00', matkul: 'Perencanaan Produksi (D)', ruang: 'IE-105', peserta: ['Kahfi'] }
];

const TIMEZONE = 'Asia/Jakarta';
const COUNTRY = 'Indonesia';

// ======= STATE & HELPERS =======
let activeCronJobs = [];
let isInitializing = false;

async function getJidByName(name) {
    if (MENTIONS_DB[name]) return MENTIONS_DB[name];
    const u = await User.findOne({ nickname: new RegExp(`^${name}$`, 'i') });
    return u ? u.jid : null;
}

async function getMentionsList(participants) {
    const jids = [];
    const textList = [];
    for (const p of participants) {
        const jid = await getJidByName(p);
        if (jid) {
            jids.push(jid);
            textList.push(`@${jid.split('@')[0]}`);
        } else { textList.push(p); }
    }
    return { jids, text: textList.join(', ') };
}

// ======= MIGRATION SCRIPT =======
async function runMigration() {
    try {
        if (await User.countDocuments() === 0) {
            console.log('🚀 Migrating Users...');
            for (const [name, jid] of Object.entries(MENTIONS_DB)) await User.create({ nickname: name, jid });
        }
        if (await Schedule.countDocuments() === 0) {
            console.log('🚀 Migrating Schedules...');
            for (const k of KULIAH_DB) {
                const group = (k.peserta.includes('Anna')) ? '205080426999829@lid' : '120363400351305898@g.us';
                await Schedule.create({ ...k, groupId: group, participants: k.peserta });
            }
        }
    } catch (e) { console.error('Migration Error:', e); }
}

// ======= DAILY SCHEDULER =======
async function initializeDailySchedule() {
    if (isInitializing) return;
    isInitializing = true;
    activeCronJobs.forEach(j => j.stop());
    activeCronJobs = [];

    try {
        const cities = [...new Set(TARGET_NUMBERS.map(t => t.city))];
        for (const city of cities) {
            const res = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${COUNTRY}&method=11`);
            const timings = res.data.data.timings;
            const targets = TARGET_NUMBERS.filter(t => t.city === city);

            const prays = { 'Tahajud': '03:00', 'Imsak': timings.Imsak, 'Subuh': timings.Fajr, 'Dzuhur': timings.Dhuhr, 'Ashar': timings.Asr, 'Maghrib': timings.Maghrib, 'Isya': timings.Isha };
            for (const [name, time] of Object.entries(prays)) {
                const m = moment(time, 'HH:mm');
                const job = cron.schedule(`${m.minute()} ${m.hour()} * * *`, () => {
                    targets.forEach(t => client.sendMessage(t.id, `🕋 *WAKTU ${name.toUpperCase()}*\nWilayah: ${city}\nWaktu: ${time} WIB`));
                }, { timezone: TIMEZONE });
                job.start();
                activeCronJobs.push(job);
            }
        }

        // University Schedule
        const dbDay = moment().day() === 0 ? 7 : moment().day();
        const schedules = await Schedule.find({ hari: dbDay });
        for (const s of schedules) {
            const time = moment(s.jam, 'HH:mm').subtract(45, 'minutes');
            const job = cron.schedule(`${time.minute()} ${time.hour()} * * *`, async () => {
                const { jids, text } = await getMentionsList(s.participants);
                const msg = `🎓 *JADWAL KULIAH*\n⏰ ${s.jam} WIB\n📚 ${s.matkul}\n📍 ${s.ruang}\n👥 ${text}`;
                await client.sendMessage(s.groupId, msg, { mentions: jids });
            }, { timezone: TIMEZONE });
            job.start();
            activeCronJobs.push(job);
        }
    } catch (e) { console.error('Schedule Error:', e); }
    isInitializing = false;
}

// ======= AUTO-CLEANUP ENGINE (BI-WEEKLY) =======
// Menghapus tugas yang sudah "Done" atau sudah lewat deadline > 14 hari
// Berjalan setiap tanggal 1 dan 15 jam 00:00
cron.schedule('0 0 1,15 * *', async () => {
    console.log('🧹 [Maintenance] Menjalankan Auto-Cleanup Database...');
    try {
        const thresholdDate = moment().subtract(14, 'days').toDate();
        const result = await Task.deleteMany({
            $or: [
                { isDone: true },
                { deadline: { $lt: thresholdDate } }
            ]
        });
        console.log(`✅ [Maintenance] Berhasil menghapus ${result.deletedCount} data usang.`);
    } catch (e) {
        console.error('❌ [Maintenance] Gagal menjalankan Auto-Cleanup:', e);
    }
}, { timezone: TIMEZONE });

// ======= WHATSAPP CLIENT =======
const client = new Client({ 
    authStrategy: new LocalAuth(), 
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] } 
});

client.on('qr', q => qrcode.generate(q, { small: true }));
client.on('ready', async () => {
    console.log('✅ Bot is Ready!');
    await runMigration();
    initializeDailySchedule();
});

client.on('message_create', async msg => {
    if (msg.isStatus) return;

    const chat = await msg.getChat();
    const senderJid = msg.author || msg.from;
    const isOwner = msg.fromMe;
    const body = msg.body.trim();

    // --- 1. PING & INTRO ---
    if (body.toLowerCase() === '!ping') {
        let resp = `Pong! 🏓\nID Chat ini: \`${msg.from}\`\n\n`;
        resp += `--- 🤖 *INFO BOT* ---\n`;
        resp += `Agar bisa di-tag biru otomatis, silakan daftar dulu ya!\n`;
        resp += `Caranya ketik: *!panggil [NamaKamu]*\nContoh: \`!panggil Asep\``;
        return msg.reply(resp);
    }

    // --- 2. PANGGIL (Self-Register) ---
    if (body.toLowerCase().startsWith('!panggil ')) {
        const nickname = body.replace(/!panggil /i, '').trim();
        if (!nickname) return msg.reply('⚠️ Masukkan nama panggilan! Contoh: !panggil Asep');
        try {
            const existing = await User.findOne({ nickname: new RegExp(`^${nickname}$`, 'i') });
            if (existing && existing.jid !== senderJid) return msg.reply('⚠️ Nama sudah dipakai orang lain.');
            await User.findOneAndUpdate({ jid: senderJid }, { nickname, jid: senderJid }, { upsert: true });
            msg.reply(`✅ *Salam kenal, ${nickname}!* Nomor kamu terdaftar.`);
        } catch (err) { msg.reply('❌ Gagal daftar.'); }
        return;
    }

    // --- 3. HELP (Design Approved) ---
    if (body.toLowerCase() === '!help') {
        if (isOwner) {
            let h = `👑 *DASHBOARD ADMIN ARKAN*\n━━━━━━━━━━━━━━\n\n*SISTEM*\n• !status\n• !kenalan\n• !broadcast\n• !backup\n\n*SHOLAT*\n• !tambah / !hapus / !cek\n\n*ADMIN*\n• !ping\n\n_Izin penuh diaktifkan._`;
            return msg.reply(h);
        } else {
            let h = `📝 PANDUAN BOT KONTRAKAN 📝\n\nHalo! Kamu bisa pakai fitur-fitur ini:\n\n👤 *IDENTITAS*\n!panggil [Namamu] -> Daftar biar bisa di-tag biru.\n\n📚 *MANAJEMEN TUGAS*\n!tugas tambah [Info] -> Catat tugas baru.\n!tugas cek -> Liat daftar tugas aktif.\n!tugas done [ID] -> Tandai tugas selesai.\n\n🎓 *JADWAL KULIAH*\n!kuliah tambah -> Masukkin jadwal kuliah.\n!kuliah list -> Liat jadwal hari ini.\n\n💡 _Ingat: Ketik !tugas atau !kuliah saja untuk bantuan detil formatnya._`;
            return msg.reply(h);
        }
    }

    // --- 4. TUGAS ---
    if (body.toLowerCase().startsWith('!tugas')) {
        const cmd = body.split(' ')[1]?.toLowerCase();
        if (cmd === 'tambah') {
            const c = body.replace(/!tugas tambah /i, '').split('|');
            if (c.length < 3) return msg.reply('⚠️ !tugas tambah Judul | Matkul | YYYY-MM-DD | Peserta(opsional)');
            try {
                const deadline = moment(c[2].trim(), 'YYYY-MM-DD').toDate();
                await Task.create({ title: c[0].trim(), course: c[1].trim(), deadline, participants: c[3] ? c[3].split(',').map(p=>p.trim()) : [], groupId: msg.from });
                msg.reply('✅ Tugas berhasil dicatat!');
            } catch (e) { msg.reply('❌ Format salah.'); }
            return;
        }
        if (cmd === 'cek' || cmd === 'list') {
            const user = await User.findOne({ jid: senderJid });
            const nickname = user?.nickname || '';
            const query = chat.isGroup ? { groupId: msg.from } : { $or: [{ groupId: msg.from }, { participants: nickname }] };
            
            // Hanya tampilkan yang isDone: false dan deadline >= hari ini
            const tasks = await Task.find({ 
                ...query, 
                isDone: false,
                deadline: { $gte: moment().startOf('day').toDate() } 
            }).sort({ deadline: 1 });

            if (!tasks.length) return msg.reply('📭 Tidak ada tugas aktif.');
            
            let m = chat.isGroup ? '📅 *DAFTAR TUGAS GRUP*\n\n' : '📅 *DAFTAR TUGAS PRIBADI & GRUP*\n\n';
            tasks.forEach((t, i) => {
                const isPersonal = t.groupId === msg.from && !chat.isGroup;
                m += `${i+1}. *${t.title}* ${isPersonal ? '(📌 Pribadi)' : ''}\n   📚 ${t.course}\n   🗓️ ${moment(t.deadline).format('DD MMM YYYY')}\n   👥 ${t.participants.length ? t.participants.join(', ') : 'Semua'}\n   🆔 \`${t._id}\`\n\n`;
            });
            return msg.reply(m + '_Ketik !tugas done [ID] jika sudah selesai._');
        }
        if (cmd === 'done') {
            const user = await User.findOne({ jid: senderJid });
            if (!user) return msg.reply('⚠️ Kamu harus daftar dulu! Ketik: !panggil [Nama]');
            
            const id = body.split(' ')[2];
            try {
                const task = await Task.findOneAndUpdate(
                    { _id: id, $or: [{ groupId: msg.from }, { participants: user.nickname }] },
                    { isDone: true },
                    { new: true }
                );
                if (task) {
                    msg.reply(`✅ *${task.title}* ditandai selesai oleh *${user.nickname}*!\nTugas ini telah diarsipkan.`);
                } else {
                    msg.reply('⚠️ Tugas tidak ditemukan atau kamu tidak punya akses.');
                }
            } catch (e) { msg.reply('❌ ID tidak valid.'); }
            return;
        }
        if (cmd === 'hapus') {
            const id = body.split(' ')[2];
            try {
                const del = await Task.findByIdAndDelete(id);
                msg.reply(del ? `🗑️ *${del.title}* dihapus.` : '⚠️ ID tidak ditemukan.');
            } catch (e) { msg.reply('❌ ID tidak valid.'); }
            return;
        }
        return msg.reply('ℹ️ *Bantuan !tugas*:\n• !tugas tambah Judul | Matkul | YYYY-MM-DD\n• !tugas cek\n• !tugas done [ID]\n• !tugas hapus [ID]');
    }

    // --- 5. KULIAH ---
    if (body.toLowerCase().startsWith('!kuliah')) {
        const cmd = body.split(' ')[1]?.toLowerCase();
        if (cmd === 'tambah') {
            const c = body.replace(/!kuliah tambah /i, '').split('|');
            // Jika di grup butuh 5 info, jika japri boleh 4 info (auto-diri sendiri)
            if (chat.isGroup && c.length < 5) return msg.reply('⚠️ Format Grup: !kuliah tambah Hari(1-7) | HH:mm | Matkul | Ruang | Peserta');
            if (!chat.isGroup && c.length < 4) return msg.reply('⚠️ Format Japri: !kuliah tambah Hari(1-7) | HH:mm | Matkul | Ruang');

            try {
                const user = await User.findOne({ jid: senderJid });
                const participants = c[4] ? c[4].split(',').map(p=>p.trim()) : (user ? [user.nickname] : []);
                
                await Schedule.create({ 
                    hari: parseInt(c[0]), 
                    jam: c[1].trim(), 
                    matkul: c[2].trim(), 
                    ruang: c[3].trim(), 
                    participants, 
                    groupId: msg.from 
                });
                msg.reply(`✅ Jadwal kuliah disimpan!\n\n📚 ${c[2].trim()}\n👥 Peserta: ${participants.join(', ')}`);
                initializeDailySchedule();
            } catch (e) { msg.reply('❌ Gagal menyimpan jadwal. Pastikan format benar.'); }
            return;
        }
        if (cmd === 'list' || cmd === 'cek') {
            const user = await User.findOne({ jid: senderJid });
            const nickname = user?.nickname || '';
            const query = chat.isGroup ? { groupId: msg.from } : { $or: [{ groupId: msg.from }, { participants: nickname }] };

            const sch = await Schedule.find(query).sort({ hari: 1, jam: 1 });
            if (!sch.length) return msg.reply('📭 Jadwal kuliah kosong.');
            
            const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            let m = chat.isGroup ? '🎓 *JADWAL KULIAH GRUP*\n\n' : '🎓 *JADWAL KULIAH SAYA*\n\n';
            sch.forEach(s => {
                const isPersonal = s.groupId === msg.from && !chat.isGroup;
                m += `📅 *${days[s.hari]}* | ${s.jam} ${isPersonal ? '(📌 Pribadi)' : ''}\n└ ${s.matkul}\n📍 ${s.ruang}\n👥 ${s.participants.join(', ')}\n\n`;
            });
            return msg.reply(m);
        }
    }

    // --- 6. ADMIN TOOLS (Owner Only) ---
    if (isOwner) {
        if (body.startsWith('!tambah ')) {
            const parts = body.split(' ');
            const newId = parts[1]?.trim();
            const newCity = parts[2]?.trim() || 'Surabaya';
            const newName = parts.slice(3).join(' ').trim() || 'Tanpa Nama';
            if (newId && !TARGET_NUMBERS.find(t => t.id === newId)) {
                TARGET_NUMBERS.push({ id: newId, name: newName, city: newCity });
                msg.reply(`✅ Ditambahkan: ${newName}`);
                initializeDailySchedule();
            }
        } else if (body === '!cek') {
            let list = '📍 *TARGET AKTIF*\n\n';
            TARGET_NUMBERS.forEach((t, i) => list += `${i+1}. ${t.name} (${t.city})\n`);
            msg.reply(list);
        } else if (body.startsWith('!broadcast ')) {
            const txt = body.replace(/!broadcast /i, '');
            const gFromTasks = await Task.distinct('groupId');
            const gFromSch = await Schedule.distinct('groupId');
            const jids = await User.distinct('jid');
            const all = new Set([...gFromTasks, ...gFromSch, ...jids, ...TARGET_NUMBERS.map(t=>t.id)]);
            for (const id of all) { try { await client.sendMessage(id, `📢 *BROADCAST*\n\n${txt}`); } catch(e){} }
            msg.reply('✅ Broadcast selesai.');
        } else if (body === '!status') {
            const u = await User.countDocuments();
            const t = await Task.countDocuments({ deadline: { $gte: moment().toDate() } });
            msg.reply(`🤖 *STATUS*\nUptime: ${Math.floor(process.uptime()/60)}m\nUser: ${u}\nTugas: ${t}\nDB: MongoDB Connected`);
        } else if (body === '!kenalan') {
            const users = await User.find();
            let m = '👥 *KEANGGOTAAN TERDAFTAR*\n\n';
            users.forEach(u => m += `• ${u.nickname} (${u.jid.split('@')[0]})\n`);
            msg.reply(m);
        }
    }
});

client.initialize();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(port, () => console.log(`Server on ${port}`));
