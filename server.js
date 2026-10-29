// Entry point: starts the Express server after connecting to MongoDB
require('dotenv').config(); // loads MONGODB_URI and PORT from the .env file

const path = require('path');
const express = require('express');
const connectDB = require('./src/config/db');
const studentRoutes = require('./src/routes/studentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // lets us read JSON sent by fetch()
app.use(express.static(path.join(__dirname, 'public'))); // serves the website (HTML, CSS, JS)

// API routes -> /api/students, /api/students/:id, /api/stats
app.use('/api', studentRoutes);

// Unknown /api URL -> JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// Broken JSON in a request body -> friendly 400 instead of a crash
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Unexpected server error' });
});

// Connect to the database first, then start listening for requests
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`StudentHub is running at http://localhost:${PORT}`);
  });
}

start();
