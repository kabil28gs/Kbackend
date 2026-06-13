const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory fallback state in case MongoDB is not running/available
let fallbackState = {
  startedAt: null,
  rejectCount: 0
};

let isMongoConnected = false;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/projectluv')
  .then(() => {
    console.log('MongoDB connected successfully.');
    isMongoConnected = true;
  })
  .catch((err) => {
    console.warn('⚠️ Warning: MongoDB connection failed. Using in-memory fallback state.');
    console.warn(err.message);
    isMongoConnected = false;
  });

// Schema definitions
const AnniversarySchema = new mongoose.Schema({
  startedAt: { type: Date, default: null }
});

const StatsSchema = new mongoose.Schema({
  rejectCount: { type: Number, default: 0 }
});

const Anniversary = mongoose.model('Anniversary', AnniversarySchema);
const Stats = mongoose.model('Stats', StatsSchema);

// Helper to get or create stats
async function getStatsDoc() {
  let stats = await Stats.findOne();
  if (!stats) {
    stats = new Stats({ rejectCount: 0 });
    await stats.save();
  }
  return stats;
}

// Helper to get anniversary doc
async function getAnniversaryDoc() {
  let ann = await Anniversary.findOne();
  if (!ann) {
    ann = new Anniversary({ startedAt: null });
    await ann.save();
  }
  return ann;
}

// --- API ROUTES ---

// GET /api/status - Get current countdown start time and stats
app.get('/api/status', async (req, res) => {
  try {
    if (isMongoConnected) {
      const ann = await getAnniversaryDoc();
      const stats = await getStatsDoc();
      return res.json({
        startedAt: ann.startedAt,
        rejectCount: stats.rejectCount,
        database: 'MongoDB'
      });
    } else {
      return res.json({
        startedAt: fallbackState.startedAt,
        rejectCount: fallbackState.rejectCount,
        database: 'In-Memory (Local Fallback)'
      });
    }
  } catch (error) {
    console.error('Error fetching status:', error);
    return res.status(500).json({ error: 'Failed to retrieve proposal status' });
  }
});

// POST /api/start - Start the countdown
app.post('/api/start', async (req, res) => {
  try {
    const startTimestamp = req.body.startedAt ? new Date(req.body.startedAt) : new Date();
    
    if (isMongoConnected) {
      const ann = await getAnniversaryDoc();
      ann.startedAt = startTimestamp;
      await ann.save();
      return res.json({ success: true, startedAt: ann.startedAt });
    } else {
      fallbackState.startedAt = startTimestamp;
      return res.json({ success: true, startedAt: fallbackState.startedAt });
    }
  } catch (error) {
    console.error('Error starting countdown:', error);
    return res.status(500).json({ error: 'Failed to start countdown' });
  }
});

// POST /api/reject - Increment the rejection count
app.post('/api/reject', async (req, res) => {
  try {
    if (isMongoConnected) {
      const stats = await getStatsDoc();
      stats.rejectCount += 1;
      await stats.save();
      return res.json({ success: true, rejectCount: stats.rejectCount });
    } else {
      fallbackState.rejectCount += 1;
      return res.json({ success: true, rejectCount: fallbackState.rejectCount });
    }
  } catch (error) {
    console.error('Error registering rejection attempt:', error);
    return res.status(500).json({ error: 'Failed to register rejection' });
  }
});

// POST /api/reset - Secret reset helper (mainly for development/testing)
app.post('/api/reset', async (req, res) => {
  try {
    if (isMongoConnected) {
      const ann = await getAnniversaryDoc();
      ann.startedAt = null;
      await ann.save();
      const stats = await getStatsDoc();
      stats.rejectCount = 0;
      await stats.save();
      return res.json({ success: true, startedAt: null, rejectCount: 0 });
    } else {
      fallbackState.startedAt = null;
      fallbackState.rejectCount = 0;
      return res.json({ success: true, startedAt: null, rejectCount: 0 });
    }
  } catch (error) {
    console.error('Error resetting status:', error);
    return res.status(500).json({ error: 'Failed to reset' });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
