const express = require('express');
const router  = express.Router();
const { requireRole } = require('../middleware/auth');
const { runSla } = require('../controllers/slaController');

router.post('/run', requireRole(['QALead']), runSla);

module.exports = router;
