import jwt from 'jsonwebtoken';

export function auth() {
  return (req, res, next) => {
    try {
      const h = req.headers.authorization || '';
      const token = h.startsWith('Bearer ') ? h.slice(7) : null;

      if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload; // { id, username, roles }
      next();
    } catch (e) {
      console.log('catch', e);
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
  };
}
