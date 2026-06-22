import { protect } from './auth.js';

export const requireAdmin = [
  protect,
  (req, res, next) => {
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Admin access is not configured'
      });
    }

    if (!adminEmails.includes(req.user.email.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  }
];
