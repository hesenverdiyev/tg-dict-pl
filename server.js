require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Telegram bot setup
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const bot = new TelegramBot(TOKEN, { polling: false });

// ✅ Dosya ve ayarlar
const filePath = path.join(__dirname, 'sentences.txt');
const LINES_PER_POST = 6;
const POST_INTERVAL = 8 * 60 * 60 * 1000; // 8 saat
let sentences = [];
let currentIndex = 0;

// ✅ sentences.txt yükle
function loadSentences() {
  if (!fs.existsSync(filePath)) {
    console.log('sentences.txt not found.');
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return data.split('\n').filter(line => line.trim() !== '');
}

// ✅ Gönderilecek satırları al
function getNextLines() {
  if (sentences.length === 0) return null;

  const lines = [];
  for (let i = 0; i < LINES_PER_POST; i++) {
    lines.push(sentences[currentIndex]);
    currentIndex++;
    if (currentIndex >= sentences.length) {
      currentIndex = 0; // tekrar başa dön
    }
  }
  return lines;
}

// ✅ Mesaj gönderme fonksiyonu
function sendSentences() {
  const lines = getNextLines();
  if (!lines) return;

  const message = lines
    .map((line, index) => {
      // index 0 tabanlı, yani (0, 1, 2...) -> insan gözüyle (1, 2, 3...)
      return (index % 2 === 0) ? `*${line}*` : line;
    })
    .join('\n');

  bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Mesaj gönderildi:', new Date().toLocaleString()))
    .catch(err => console.error('Telegram send error:', err.message));
}

// ✅ Sunucu başlatıldığında verileri yükle
sentences = loadSentences();

// ✅ Sunucu açıldığında ilk mesaj
sendSentences();

// ✅ Her 8 saatte bir mesaj gönder
setInterval(sendSentences, POST_INTERVAL);

// ✅ Pin-g
const url = `https://tg-dict-pl.onrender.com/`; 
const interval = 30000; // 30 saniye
let firstPingLogged = false;

function reloadWebsite() {
  axios.get(url)
    .then(response => {
      if (!firstPingLogged) {
        console.log(`Ping at ${new Date().toISOString()}: Status ${response.status}`);
        firstPingLogged = true;
      }
    })
    .catch(error => {
      console.error(`Ping error at ${new Date().toISOString()}:`, error.message);
    });
}

setInterval(reloadWebsite, interval);


// ✅ Express middleware ve admin panel kodları (öncekiyle aynı)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// (Admin panel kodları senin mevcut kodunda kalıyor, değiştirmedim)

// ✅ Sunucu başlat
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
