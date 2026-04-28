import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { HttpError } from './error.js';

export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw new HttpError(401, 'Invalid session');
    req.user = user;
    next();
  } catch (e) {
    if (e instanceof HttpError) return next(e);
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Forbidden'));
  next();
};
