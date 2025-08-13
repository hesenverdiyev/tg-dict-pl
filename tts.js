// .env okurken gereksiz logları kapat
require('dotenv').config({ quiet: true });

// Node.js uyarılarını bastır (ör. DeprecationWarning)
process.removeAllListeners('warning');

const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const TelegramBot = require('node-telegram-bot-api');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (!process.env.TELEGRAM_TOKEN || !process.env.CHANNEL_ID) {
  console.error('Missing env vars. Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID in .env');
  process.exit(1);
}

ffmpeg.setFfmpegPath(ffmpegPath);

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHANNEL_ID;
const INPUT_TXT = './tts-sentences.txt';

const VOICE = 'pl-PL-ZofiaNeural'; // Poland Zofia voice
const TMP_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

async function synthToWebm(text) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);
  const outDir = path.join(TMP_DIR, 'full');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const { audioFilePath } = await tts.toFile(outDir, text);
  return audioFilePath; // .webm
}

function webmToOgg(webmPath) {
  return new Promise((resolve, reject) => {
    const base = path.basename(webmPath, path.extname(webmPath));
    const out = path.join(path.dirname(webmPath), `${base}.ogg`);
    ffmpeg(webmPath)
      .audioCodec('libopus')
      .audioChannels(1)
      .format('ogg')
      .on('error', reject)
      .on('end', () => resolve(out))
      .save(out);
  });
}

async function sendVoice(oggPath, caption) {
  const stream = fs.createReadStream(oggPath);
  return bot.sendVoice(CHAT_ID, stream, {
    caption: caption?.slice(0, 1024),
    disable_notification: false
  });
}

(async () => {
  const text = fs.readFileSync(INPUT_TXT, 'utf8').trim();
  if (!text) {
    console.error('Input text file is empty.');
    process.exit(1);
  }

  const webm = await synthToWebm(text);
  const ogg = await webmToOgg(webm);
  await sendVoice(ogg, 'Yuxarıdakı cümlələrin səsləndirilməsi');

  // 🔹 Çalışma bitince dosyaları sil
  try {
    if (fs.existsSync(INPUT_TXT)) fs.unlinkSync(INPUT_TXT);
    const fullDir = path.join(TMP_DIR, 'full');
    ['audio.webm', 'audio.ogg'].forEach(file => {
      const filePath = path.join(fullDir, file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    // console.log('Geçici dosyalar silindi ✅');
  } catch (err) {
    console.error('Dosya silme hatası:', err);
  }

  // console.log('Done ✅');
})().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
