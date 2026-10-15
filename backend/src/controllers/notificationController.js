const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// GET /api/notifications: the logged-in user's own notifications, newest first.
async function getNotifications(req, res) {
  const recipient = req.authenticatedUser.username;
  const notifications = await Notification.find({ recipient }).sort({ timestamp: -1 }).lean();
  const unread = notifications.filter(n => !n.read).length;
  res.json({ success: true, count: notifications.length, unread, notifications });
}

// PATCH /api/notifications/:id/read. Someone else's notification gets the same
// 404 as an unknown one, so users can't probe which IDs exist.
async function markRead(req, res) {
  const { id } = req.params;
  const recipient = req.authenticatedUser.username;

  if (!mongoose.isValidObjectId(id))
    return res.status(404).json({ success: false, errors: ['Notification not found.'] });

  const updated = await Notification.findOneAndUpdate(
    { _id: id, recipient },
    { read: true },
    { new: true }
  );
  if (!updated) return res.status(404).json({ success: false, errors: ['Notification not found.'] });

  res.json({ success: true, notification: updated });
}

module.exports = { getNotifications, markRead };
