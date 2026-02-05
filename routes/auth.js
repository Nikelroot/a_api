import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), username: user.username, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'VALIDATION_ERROR', message: 'username/password required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'min 6 chars' });
    }

    const usernameNorm = String(username).trim();

    const exists = await User.findOne({ username: usernameNorm }).lean();
    if (exists) return res.status(409).json({ error: 'USER_EXISTS' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ username: usernameNorm, passwordHash });

    const token = signToken(user);
    // ✅ COOKIE УСТАНАВЛИВАЕТСЯ ЗДЕСЬ
    res.cookie('token', token, {
      httpOnly: true, // нельзя прочитать из JS
      secure: false, // только https
      sameSite: 'lax', // важно для фронта
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней
      path: '/'
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'VALIDATION_ERROR', message: 'username/password required' });
    }

    const user = await User.findOne({ username: String(username).trim() });
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);

    if (!ok) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    const token = signToken(user);

    // ✅ COOKIE УСТАНАВЛИВАЕТСЯ ЗДЕСЬ
    res.cookie('token', token, {
      httpOnly: true, // нельзя прочитать из JS
      secure: false, // только https
      sameSite: 'lax', // важно для фронта
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней
      path: '/'
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.id).lean();
    if (!user) return res.status(401).json({ error: 'NO_USER' });

    delete user.passwordHash;
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
  }
});

export default router;
