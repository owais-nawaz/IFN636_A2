const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { exportReport, getSummary } = require('../controllers/reportController');

router.get('/export', requireRole(['QALead']), exportReport);
router.get('/summary', requireRole(['QALead']), getSummary);

module.exports = router;
