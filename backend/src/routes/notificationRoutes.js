const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { getNotifications, markRead } = require('../controllers/notificationController');

const anyRole = requireRole(['Tester', 'Developer', 'QALead']);

router.get('/',           anyRole, getNotifications);
router.patch('/:id/read', anyRole, markRead);

module.exports = router;
