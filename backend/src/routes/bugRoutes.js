const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { createBug, getBugs, claimBug, resolveBug, verifyBug, getBugHistory } = require('../controllers/bugController');

router.get('/',            getBugs);
router.post('/',           requireRole(['Tester', 'QALead']), createBug);
router.get('/:id/history',   requireRole(['Tester', 'Developer', 'QALead']), getBugHistory);
router.patch('/:id/claim',   requireRole(['Developer']), claimBug);
router.patch('/:id/resolve', requireRole(['Developer']), resolveBug);
router.patch('/:id/verify',  requireRole(['QALead']), verifyBug);

module.exports = router;
