const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const flashcardRoutes = require('./routes/flashcardRoutes');
const authRoutes = require('./routes/authRoutes');
const deckRoutes = require('./routes/deckRoutes');
const tagRoutes = require('./routes/tagRoutes');
const studySessionRoutes = require('./routes/studySessionRoutes');
const contentRoutes = require('./routes/contentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const vocabularyRoutes = require('./routes/vocabularyRoutes');
const sentenceRoutes = require('./routes/sentenceRoutes');
const quizRoutes = require('./routes/quizRoutes');
const presetRoutes = require('./routes/presetRoutes');

dotenv.config();

const app = express();

const allowedOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length > 0
      ? {
          origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
              return;
            }

            callback(new Error('Origin not allowed by CORS.'));
          }
        }
      : {}
  )
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/study-sessions', studySessionRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/sentences', sentenceRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/presets', presetRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '..', 'client', 'dist');

  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
