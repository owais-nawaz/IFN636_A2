const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { exportReport } = require('../controllers/reportController');

router.get('/export', requireRole(['QALead']), exportReport);

module.exports = router;
