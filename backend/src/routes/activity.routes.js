const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { ActivityLog } = require('../models/postgres/index');

router.use(authenticate);

router.get('/:workspaceId', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const activity = await ActivityLog.findAll({
      where: { workspaceId: req.params.workspaceId },
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset: Number(offset),
    });
    res.json({ activity });
  } catch (err) { next(err); }
});

module.exports = router;
