const mongoose = require('mongoose');
const Notification = require('../models/Notification');

const LIST_LIMIT = 50;

// GET /api/notifications: the logged-in user's latest notifications, newest
// first. The unread count is taken from the database, so it stays right even
// when there are more notifications than the list shows.
async function getNotifications(req, res) {
  const recipient = req.authenticatedUser.username;
  const [notifications, unread] = await Promise.all([
    Notification.find({ recipient }).sort({ timestamp: -1 }).limit(LIST_LIMIT).lean(),
    Notification.countDocuments({ recipient, read: false }),
  ]);
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
