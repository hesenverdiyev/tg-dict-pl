require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
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

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Data load/save functions
const loadData = () => {
  try {
    const data = fs.readFileSync('data/content.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      hero: {
        title: "Welcome to InnovateTech Solutions",
        subtitle: "Transforming businesses through cutting-edge technology solutions",
        buttonText: "Get Started",
        backgroundImage: "https://images.pexels.com/photos/3184638/pexels-photo-3184638.jpeg"
      },
      about: {
        title: "About Our Company",
        description: "We are a leading technology company specializing in innovative solutions that drive business growth and digital transformation.",
        mission: "To empower businesses with technology solutions that create lasting value and competitive advantages.",
        vision: "To be the most trusted technology partner for companies seeking digital excellence.",
        image: "https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg"
      },
      services: [
        {
          id: 1,
          title: "Web Development",
          description: "Custom web applications built with modern technologies",
          icon: "💻",
          image: "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg"
        },
        {
          id: 2,
          title: "Mobile Apps",
          description: "Native and cross-platform mobile applications",
          icon: "📱",
          image: "https://images.pexels.com/photos/147413/twitter-facebook-together-exchange-of-information-147413.jpeg"
        },
        {
          id: 3,
          title: "Cloud Solutions",
          description: "Scalable cloud infrastructure and migration services",
          icon: "☁️",
          image: "https://images.pexels.com/photos/2004161/pexels-photo-2004161.jpeg"
        }
      ],
      contact: {
        address: "123 Tech Street, Innovation City, IC 12345",
        phone: "+1 (555) 123-4567",
        email: "info@innovatetech.com"
      }
    };
  }
};

const saveData = (data) => {
  fs.writeFileSync('data/content.json', JSON.stringify(data, null, 2));
};

// Initialize data if not exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}
if (!fs.existsSync('data/content.json')) {
  saveData(loadData());
}

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// Routes
app.get('/', (req, res) => {
  const data = loadData();
  res.render('index', { data });
});

app.get('/about', (req, res) => {
  const data = loadData();
  res.render('about', { data });
});

app.get('/services', (req, res) => {
  const data = loadData();
  res.render('services', { data });
});

app.get('/contact', (req, res) => {
  const data = loadData();
  res.render('contact', { data, message: null });
});

app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('Contact form submission:', { name, email, message });
  const data = loadData();
  res.render('contact', { 
    data, 
    message: { type: 'success', text: 'Thank you for your message! We will get back to you soon.' }
  });
});

app.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.isAuthenticated = true;
    res.redirect('/admin');
  } else {
    res.render('admin/login', { error: 'Invalid credentials' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin', requireAuth, (req, res) => {
  const data = loadData();
  res.render('admin/dashboard', { data });
});

app.post('/admin/hero', requireAuth, (req, res) => {
  const data = loadData();
  data.hero = {
    title: req.body.title,
    subtitle: req.body.subtitle,
    buttonText: req.body.buttonText,
    backgroundImage: req.body.backgroundImage
  };
  saveData(data);
  res.redirect('/admin');
});

app.post('/admin/about', requireAuth, (req, res) => {
  const data = loadData();
  data.about = {
    title: req.body.title,
    description: req.body.description,
    mission: req.body.mission,
    vision: req.body.vision,
    image: req.body.image
  };
  saveData(data);
  res.redirect('/admin');
});

app.post('/admin/services', requireAuth, (req, res) => {
  const data = loadData();
  const serviceIndex = parseInt(req.body.serviceIndex);
  if (serviceIndex >= 0 && serviceIndex < data.services.length) {
    data.services[serviceIndex] = {
      id: data.services[serviceIndex].id,
      title: req.body.title,
      description: req.body.description,
      icon: req.body.icon,
      image: req.body.image
    };
  }
  saveData(data);
  res.redirect('/admin');
});

app.post('/admin/contact', requireAuth, (req, res) => {
  const data = loadData();
  data.contact = {
    address: req.body.address,
    phone: req.body.phone,
    email: req.body.email
  };
  saveData(data);
  res.redirect('/admin');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
