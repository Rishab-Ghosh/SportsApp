
const express = require('express');
const { getVideos } = require('../lib/videos');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const sport = req.query.sport || 'All';
    const videos = await getVideos(sport);
    res.json({ sport, ...videos });
  } catch (err) {
    console.error('[videos] route failed:', err.message);
    res.json({ sport: req.query.sport || 'All', debate: [], highlights: {}, news: [], error: err.message });
  }
});

module.exports = router;
