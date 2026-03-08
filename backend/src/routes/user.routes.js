const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { User, WorkspaceMember } = require('../models/postgres/index');
const { Op } = require('sequelize');

router.use(authenticate);

// GET /api/users/search?q=name&workspaceId=xxx
// Search users by name or email — used for @mention dropdown and invite
router.get('/search', async (req, res, next) => {
  try {
    const { q = '', workspaceId } = req.query;
    const where = {
      [Op.or]: [
        { name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ],
    };

    let users;
    if (workspaceId) {
      // Only return members of this workspace
      const members = await WorkspaceMember.findAll({
        where: { workspaceId },
        include: [{ model: User, as: 'user', where, attributes: ['id', 'name', 'email', 'avatar'] }],
      });
      users = members.map(m => m.user).filter(Boolean);
    } else {
      users = await User.findAll({ where, attributes: ['id', 'name', 'email', 'avatar'], limit: 20 });
    }

    res.json({ users });
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'name', 'email', 'avatar'] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router;
