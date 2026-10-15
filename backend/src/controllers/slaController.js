const slaService = require('../services/slaService');

// POST /api/sla/run: runs the SLA escalation on demand (QA Leads only).
async function runSla(req, res) {
  try {
    const { checked, escalated } = await slaService.runEscalation();
    res.json({ success: true, message: `${escalated.length} bug(s) escalated.`, checked, escalated });
  } catch (err) {
    console.error('[sla] manual run failed:', err.message);
    res.status(500).json({ success: false, errors: ['SLA escalation run failed.'] });
  }
}

module.exports = { runSla };
