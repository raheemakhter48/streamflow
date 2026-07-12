import jwt from 'jsonwebtoken';
import { protect } from './auth.js';

const requireAdminPanelSession = (req, res, next) => {
  const panelToken = req.headers['x-admin-session'];

  if (!panelToken) {
    return res.status(403).json({
      success: false,
      message: 'Admin console session required'
    });
  }

  try {
    const decoded = jwt.verify(String(panelToken), process.env.JWT_SECRET);
    const configuredEmail = String(process.env.ADMIN_PANEL_EMAIL || '').trim().toLowerCase();

    if (decoded.purpose !== 'admin-panel' || decoded.email !== configuredEmail) {
      throw new Error('Invalid admin console token');
    }

    req.admin = { email: decoded.email };
    next();
  } catch {
    return res.status(403).json({
      success: false,
      message: 'Admin console session expired'
    });
  }
};

const requireLegacyAdminUser = [
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

export const requireAdmin = [
  (req, res, next) => {
    if (process.env.ADMIN_PANEL_PASSWORD) {
      return requireAdminPanelSession(req, res, next);
    }

    return requireLegacyAdminUser[0](req, res, (error) => {
      if (error) return next(error);
      return requireLegacyAdminUser[1](req, res, next);
    });
  }
];
