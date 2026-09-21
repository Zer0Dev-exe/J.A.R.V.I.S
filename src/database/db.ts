import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config, DEFAULT_LIMITS, PenaltyType } from '../config/config.js';

export interface GuildSettings {
  guild_id: string;
  antinuke_enabled: number;
  antiraid_enabled: number;
  antiscam_enabled: number;
  alert_channel_id: string | null;
  quarantine_role_id: string | null;
  channel_delete_limit: number;
  channel_create_limit: number;
  role_delete_limit: number;
  role_create_limit: number;
  ban_limit: number;
  kick_limit: number;
  webhook_limit: number;
  limit_window_seconds: number;
  default_penalty: PenaltyType;
  join_burst_limit: number;
  join_burst_window_seconds: number;
  min_account_age_days: number;
  anti_bot_enabled: number;
  anti_invites_enabled: number;
  anti_links_enabled: number;
  anti_spam_enabled: number;
  anti_mass_mention_enabled: number;
  max_mentions: number;
  auto_recovery_enabled: number;
}

export interface WhitelistEntry {
  id: number;
  guild_id: string;
  user_id: string;
  type: 'FULL' | 'CHANNELS' | 'ROLES' | 'MEMBERS' | 'BOTS' | 'WEBHOOKS';
  added_by: string;
  added_at: number;
}

export interface SecurityLogEntry {
  id?: number;
  guild_id: string;
  user_id: string;
  module: string;
  action: string;
  details: string;
  penalty_applied: string;
  timestamp: number;
}

export interface ChannelBackupEntry {
  id?: number;
  guild_id: string;
  channel_id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
  topic: string | null;
  nsfw: number;
  rate_limit_per_user: number;
  permission_overwrites: string;
  updated_at: number;
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.databasePath);
    // Habilitar Write-Ahead Logging (WAL) para máxima velocidad de lectura y escritura concurrente
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        antinuke_enabled INTEGER DEFAULT 1,
        antiraid_enabled INTEGER DEFAULT 1,
        antiscam_enabled INTEGER DEFAULT 1,
        alert_channel_id TEXT DEFAULT NULL,
        quarantine_role_id TEXT DEFAULT NULL,
        channel_delete_limit INTEGER DEFAULT ${DEFAULT_LIMITS.channelDeleteLimit},
        channel_create_limit INTEGER DEFAULT ${DEFAULT_LIMITS.channelCreateLimit},
        role_delete_limit INTEGER DEFAULT ${DEFAULT_LIMITS.roleDeleteLimit},
        role_create_limit INTEGER DEFAULT ${DEFAULT_LIMITS.roleCreateLimit},
        ban_limit INTEGER DEFAULT ${DEFAULT_LIMITS.banLimit},
        kick_limit INTEGER DEFAULT ${DEFAULT_LIMITS.kickLimit},
        webhook_limit INTEGER DEFAULT ${DEFAULT_LIMITS.webhookLimit},
        limit_window_seconds INTEGER DEFAULT ${DEFAULT_LIMITS.windowSeconds},
        default_penalty TEXT DEFAULT 'QUARANTINE',
        join_burst_limit INTEGER DEFAULT ${DEFAULT_LIMITS.joinBurstLimit},
        join_burst_window_seconds INTEGER DEFAULT ${DEFAULT_LIMITS.joinBurstWindowSeconds},
        min_account_age_days INTEGER DEFAULT ${DEFAULT_LIMITS.minAccountAgeDays},
        anti_bot_enabled INTEGER DEFAULT 1,
        anti_invites_enabled INTEGER DEFAULT 1,
        anti_links_enabled INTEGER DEFAULT 1,
        anti_spam_enabled INTEGER DEFAULT 1,
        anti_mass_mention_enabled INTEGER DEFAULT 1,
        max_mentions INTEGER DEFAULT ${DEFAULT_LIMITS.maxMentions},
        auto_recovery_enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        added_by TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        UNIQUE(guild_id, user_id, type)
      );

      CREATE TABLE IF NOT EXISTS security_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        penalty_applied TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS channel_backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        parent_id TEXT,
        position INTEGER,
        topic TEXT,
        nsfw INTEGER,
        rate_limit_per_user INTEGER,
        permission_overwrites TEXT,
        updated_at INTEGER NOT NULL,
        UNIQUE(guild_id, channel_id)
      );

      CREATE INDEX IF NOT EXISTS idx_whitelist_guild_user ON whitelist(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_guild ON security_logs(guild_id);
      CREATE INDEX IF NOT EXISTS idx_backups_guild ON channel_backups(guild_id);
    `);
  }

  public getGuildSettings(guildId: string): GuildSettings {
    const stmt = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
    let settings = stmt.get(guildId) as GuildSettings | undefined;

    if (!settings) {
      const insert = this.db.prepare(`
        INSERT INTO guild_settings (guild_id) VALUES (?)
      `);
      insert.run(guildId);
      settings = stmt.get(guildId) as GuildSettings;
    }

    return settings;
  }

  public updateGuildSettings(guildId: string, partial: Partial<GuildSettings>): void {
    const keys = Object.keys(partial).filter((k) => k !== 'guild_id');
    if (keys.length === 0) return;

    // Asegurar que exista
    this.getGuildSettings(guildId);

    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => (partial as Record<string, unknown>)[k]);
    values.push(guildId);

    const stmt = this.db.prepare(`UPDATE guild_settings SET ${setClause} WHERE guild_id = ?`);
    stmt.run(...values);
  }

  public getWhitelist(guildId: string): WhitelistEntry[] {
    const stmt = this.db.prepare('SELECT * FROM whitelist WHERE guild_id = ?');
    return stmt.all(guildId) as WhitelistEntry[];
  }

  public isWhitelisted(guildId: string, userId: string, type?: string): boolean {
    if (type) {
      const stmt = this.db.prepare(`
        SELECT 1 FROM whitelist 
        WHERE guild_id = ? AND user_id = ? AND (type = 'FULL' OR type = ?)
      `);
      return !!stmt.get(guildId, userId, type);
    }
    const stmt = this.db.prepare('SELECT 1 FROM whitelist WHERE guild_id = ? AND user_id = ?');
    return !!stmt.get(guildId, userId);
  }

  public addWhitelist(guildId: string, userId: string, type: string, addedBy: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO whitelist (guild_id, user_id, type, added_by, added_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(guildId, userId, type, addedBy, Date.now());
  }

  public removeWhitelist(guildId: string, userId: string, type?: string): boolean {
    if (type) {
      const stmt = this.db.prepare('DELETE FROM whitelist WHERE guild_id = ? AND user_id = ? AND type = ?');
      const res = stmt.run(guildId, userId, type);
      return res.changes > 0;
    }
    const stmt = this.db.prepare('DELETE FROM whitelist WHERE guild_id = ? AND user_id = ?');
    const res = stmt.run(guildId, userId);
    return res.changes > 0;
  }

  public logSecurityAction(log: SecurityLogEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO security_logs (guild_id, user_id, module, action, details, penalty_applied, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(log.guild_id, log.user_id, log.module, log.action, log.details, log.penalty_applied, log.timestamp || Date.now());
  }

  public getRecentSecurityLogs(guildId: string, limit: number = 10): SecurityLogEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM security_logs WHERE guild_id = ? ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(guildId, limit) as SecurityLogEntry[];
  }

  public saveChannelBackup(backup: ChannelBackupEntry): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO channel_backups 
      (guild_id, channel_id, name, type, parent_id, position, topic, nsfw, rate_limit_per_user, permission_overwrites, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      backup.guild_id,
      backup.channel_id,
      backup.name,
      backup.type,
      backup.parent_id,
      backup.position,
      backup.topic,
      backup.nsfw,
      backup.rate_limit_per_user,
      backup.permission_overwrites,
      Date.now()
    );
  }

  public getChannelBackup(guildId: string, channelId: string): ChannelBackupEntry | undefined {
    const stmt = this.db.prepare('SELECT * FROM channel_backups WHERE guild_id = ? AND channel_id = ?');
    return stmt.get(guildId, channelId) as ChannelBackupEntry | undefined;
  }

  public removeChannelBackup(guildId: string, channelId: string): void {
    const stmt = this.db.prepare('DELETE FROM channel_backups WHERE guild_id = ? AND channel_id = ?');
    stmt.run(guildId, channelId);
  }

  public close(): void {
    this.db.close();
  }
}

export const db = new DatabaseManager();
