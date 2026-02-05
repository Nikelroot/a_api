import jwt from 'jsonwebtoken';
import User from '../../models/User.js';

export function auth() {
  return async (req, res, next) => {
    try {
      const token = req.cookies?.token || null;
      // const h = req.headers.authorization || '';
      // const token = h.startsWith('Bearer ') ? h.slice(7) : null;

      console.log('token', req.url, token);
      if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

      const payload = jwt.verify(token, process.env.JWT_SECRET); // throws if invalid/expired

      // Важно: не доверяем ролям/username из токена как источнику истины
      // Доверяем только id, и тянем актуальные данные из БД
      const user = await User.findById(payload.id)
        .select('_id username roles isBlocked') // нужные поля
        .lean();

      if (!user) return res.status(401).json({ error: 'USER_NOT_FOUND' });
      if (user.isBlocked) return res.status(403).json({ error: 'USER_BLOCKED' });

      req.user = user; // теперь req.user — актуальный пользователь из БД
      next();
    } catch (e) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
  };
}
