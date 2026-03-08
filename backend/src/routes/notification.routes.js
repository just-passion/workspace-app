// ── notification.routes.js ────────────────────────────
const notifRouter = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Notification } = require('../models/postgres/index');

notifRouter.use(authenticate);

notifRouter.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ notifications });
  } catch (err) { next(err); }
});

notifRouter.patch('/:id/read', async (req, res, next) => {
  try {
    await Notification.update({ isRead: true }, { where: { id: req.params.id, userId: req.user.id } });
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

notifRouter.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.update({ isRead: true }, { where: { userId: req.user.id } });
    res.json({ message: 'All marked as read' });
  } catch (err) { next(err); }
});

module.exports = notifRouter;
