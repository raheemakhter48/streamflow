import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import supabase from '../config/supabase.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is missing! Token generation will fail.');
    throw new Error('Server configuration error: JWT_SECRET is missing');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        { 
          email: email.toLowerCase(), 
          password: hashedPassword 
        }
      ])
      .select('id, email')
      .single();

    if (error) {
      console.error('Register insert failed:', error);
      throw error;
    }

    res.status(201).json({
      success: true,
      token: generateToken(user.id),
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    res.json({
      success: true,
      token: generateToken(user.id),
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    let name = null;
    if (req.user.email && req.user.email.includes('@guest.streamflow')) {
      const parts = req.user.email.split('@')[0].split('_');
      if (parts.length >= 2) {
        name = parts.slice(1, -1).join(' ');
        if (name) {
          name = name.charAt(0).toUpperCase() + name.slice(1);
        }
      }
    }
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: name || req.user.name || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/guest
// @desc    Guest login with display name
// @access  Public
router.post('/guest', async (req, res, next) => {
  try {
    const { name } = req.body;
    const cleanName = (name && typeof name === 'string' && name.trim()) ? name.trim() : 'Guest';
    
    const sanitizedIdentifier = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'guest';
    const guestEmail = `guest_${sanitizedIdentifier}_${Date.now().toString(36)}@guest.streamflow`;

    let user;

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('guestpass123', salt);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert([
          { 
            email: guestEmail, 
            password: hashedPassword 
          }
        ])
        .select('id, email')
        .single();

      if (!error && newUser) {
        user = newUser;
      }
    } catch (dbErr) {
      console.warn('⚠️ Supabase guest creation warning:', dbErr?.message);
    }

    if (!user) {
      user = {
        id: `guest-${Date.now()}`,
        email: guestEmail
      };
    }

    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: cleanName,
        isGuest: true
      }
    });
  } catch (error) {
    console.error('Guest login failed:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Guest login failed'
    });
  }
});

export default router;

