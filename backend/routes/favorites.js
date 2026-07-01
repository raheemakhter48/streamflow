import express from 'express';
import { protect } from '../middleware/auth.js';
import supabase from '../config/supabase.js';

const router = express.Router();

// ========== FAVORITES ==========

// @route   GET /api/favorites
// @desc    Get user's favorites
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: favorites.map(fav => ({
        id: fav.id,
        channelName: fav.channel_name,
        channelUrl: fav.channel_url,
        channelLogo: fav.channel_logo,
        category: fav.category,
        createdAt: fav.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/favorites
// @desc    Add channel to favorites
// @access  Private
router.post('/', protect, async (req, res, next) => {
  try {
    const { channelName, channelUrl, channelLogo, category } = req.body;

    if (!channelName || !channelUrl) {
      return res.status(400).json({
        success: false,
        message: 'Channel name and URL are required'
      });
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('channel_url', channelUrl)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Channel already in favorites'
      });
    }

    const { data: favorite, error } = await supabase
      .from('favorites')
      .insert([
        {
          user_id: req.user.id,
          channel_name: channelName,
          channel_url: channelUrl,
          channel_logo: channelLogo || null,
          category: category || null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Added to favorites',
      data: {
        id: favorite.id,
        channelName: favorite.channel_name,
        channelUrl: favorite.channel_url,
        channelLogo: favorite.channel_logo,
        category: favorite.category
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/favorites/:channelUrl
// @desc    Remove channel from favorites
// @access  Private
router.delete('/:channelUrl', protect, async (req, res, next) => {
  try {
    const { channelUrl } = req.params;
    const decodedUrl = decodeURIComponent(channelUrl);

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', req.user.id)
      .eq('channel_url', decodedUrl);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    next(error);
  }
});

// ========== RECENTLY WATCHED ==========

// @route   GET /api/favorites/recently-watched
// @desc    Get user's recently watched channels
// @access  Private
router.get('/recently-watched', protect, async (req, res, next) => {
  try {
    const { data: recentlyWatched, error } = await supabase
      .from('recently_watched')
      .select('*')
      .eq('user_id', req.user.id)
      .order('watched_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({
      success: true,
      data: recentlyWatched.map(item => ({
        id: item.id,
        channelName: item.channel_name,
        channelUrl: item.channel_url,
        channelLogo: item.channel_logo,
        category: item.category,
        watchedAt: item.watched_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/favorites/recently-watched
// @desc    Add channel to recently watched
// @access  Private
router.post('/recently-watched', protect, async (req, res, next) => {
  try {
    const { channelName, channelUrl, channelLogo, category } = req.body;

    if (!channelName || !channelUrl) {
      return res.status(400).json({
        success: false,
        message: 'Channel name and URL are required'
      });
    }

    // Keep one recent entry per channel, even when an admin replaces its URL.
    await supabase
      .from('recently_watched')
      .delete()
      .eq('user_id', req.user.id)
      .eq('channel_name', channelName);

    // Also remove an older entry that may use the same URL under another label.
    await supabase
      .from('recently_watched')
      .delete()
      .eq('user_id', req.user.id)
      .eq('channel_url', channelUrl);

    // Insert new entry
    const { data: recentlyWatched, error } = await supabase
      .from('recently_watched')
      .insert([
        {
          user_id: req.user.id,
          channel_name: channelName,
          channel_url: channelUrl,
          channel_logo: channelLogo || null,
          category: category || null,
          watched_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Record watch event for DAU analytics — fire-and-forget, never blocks the response
    supabase.from('admin_watch_events').insert({
      user_id: req.user.id,
      channel_name: channelName,
      source: 'web',
      watched_at: new Date().toISOString()
    }).then(() => {}).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: recentlyWatched.id,
        channelName: recentlyWatched.channel_name,
        channelUrl: recentlyWatched.channel_url,
        channelLogo: recentlyWatched.channelLogo,
        category: recentlyWatched.category,
        watchedAt: recentlyWatched.watched_at
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
