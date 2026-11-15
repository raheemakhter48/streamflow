-- MySQL Schema for StreamFlow
-- Run: mysql -u streamflow_user -p streamflow_db < mysql_schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(255) NULL,
  `username` VARCHAR(255) NULL,
  `avatar_url` TEXT NULL,
  `full_name` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. IPTV Credentials Table
CREATE TABLE IF NOT EXISTS `iptv_credentials` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `provider_name` VARCHAR(255) NULL,
  `username` VARCHAR(255) NULL,
  `password` VARCHAR(255) NULL,
  `server_url` TEXT NULL,
  `m3u_url` TEXT NULL,
  `epg_url` TEXT NULL,
  `m3u_content` LONGTEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_iptv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Favorites Table
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `channel_name` VARCHAR(255) NOT NULL,
  `channel_logo` TEXT NULL,
  `channel_url` TEXT NOT NULL,
  `category` VARCHAR(255) NULL,
  `stream_type` VARCHAR(50) DEFAULT 'live',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_favorites_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Recently Watched Table
CREATE TABLE IF NOT EXISTS `recently_watched` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `channel_name` VARCHAR(255) NOT NULL,
  `channel_logo` TEXT NULL,
  `channel_url` TEXT NOT NULL,
  `category` VARCHAR(255) NULL,
  `stream_type` VARCHAR(50) DEFAULT 'live',
  `watched_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recent_user` (`user_id`),
  INDEX `idx_recent_time` (`watched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Playlist Cache Table
CREATE TABLE IF NOT EXISTS `playlist_cache` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `content` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cache_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. IPTV Regions Table
CREATE TABLE IF NOT EXISTS `iptv_regions` (
  `code` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `countries` JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. IPTV Channels Table
CREATE TABLE IF NOT EXISTS `iptv_channels` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `country` VARCHAR(50) NULL,
  `category` VARCHAR(255) NULL,
  `logo_url` TEXT NULL,
  INDEX `idx_channels_country` (`country`),
  INDEX `idx_channels_category` (`category`),
  INDEX `idx_channels_name` (`name`),
  INDEX `idx_channels_composite` (`country`, `category`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. IPTV Streams Table
CREATE TABLE IF NOT EXISTS `iptv_streams` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `channel_id` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NULL,
  `url` TEXT NOT NULL,
  `resolution` VARCHAR(50) NULL,
  `is_working` BOOLEAN DEFAULT TRUE,
  `last_checked_at` TIMESTAMP NULL,
  `last_status_code` INT NULL,
  `last_error` TEXT NULL,
  INDEX `idx_streams_channel` (`channel_id`),
  INDEX `idx_streams_working` (`is_working`, `channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Admin Channels Table
CREATE TABLE IF NOT EXISTS `admin_channels` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `logo_url` TEXT NULL,
  `country` VARCHAR(50) NULL,
  `category` VARCHAR(255) NULL,
  `stream_url` TEXT NULL,
  `iframe_embed` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'working',
  `is_manual_override` BOOLEAN NOT NULL DEFAULT FALSE,
  `last_checked_at` TIMESTAMP NULL,
  `last_status_code` INT NULL,
  `last_error` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_admin_channels_country` (`country`),
  INDEX `idx_admin_channels_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Admin Filter Options Table
CREATE TABLE IF NOT EXISTS `admin_filter_options` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `type` VARCHAR(50) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `value` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_type_value` (`type`, `value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Admin Watch Events Table
CREATE TABLE IF NOT EXISTS `admin_watch_events` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NULL,
  `channel_id` VARCHAR(36) NULL,
  `channel_name` VARCHAR(255) NOT NULL,
  `source` VARCHAR(255) NULL,
  `watched_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_watch_time` (`watched_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Admin API Metrics Table
CREATE TABLE IF NOT EXISTS `admin_api_metrics` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `route` VARCHAR(255) NOT NULL,
  `method` VARCHAR(20) NOT NULL,
  `status_code` INT NULL,
  `duration_ms` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_metrics_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Admin Scrape Runs Table
CREATE TABLE IF NOT EXISTS `admin_scrape_runs` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `channel_id` VARCHAR(36) NULL,
  `channel_name` VARCHAR(255) NULL,
  `status` VARCHAR(50) NOT NULL,
  `duration_ms` INT NULL,
  `discovered_url` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Admin Notifications Table
CREATE TABLE IF NOT EXISTS `admin_notifications` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Activity Log Table
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `session_id` VARCHAR(255) NULL,
  `event_type` VARCHAR(100) NULL,
  `details` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_act_session` (`session_id`),
  INDEX `idx_act_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
