import jwt from 'jsonwebtoken';
import supabase from '../config/supabase.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log('⚠️ No token found in headers');
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', decoded.id)
        .maybeSingle();
      
      if (error || !user) {
        console.error('❌ User not found in Supabase:', error?.message || 'User does not exist');
        return res.status(401).json({
          success: false,
          message: 'Session expired, please login again'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('❌ JWT Verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  } catch (error) {
    next(error);
  }
};

