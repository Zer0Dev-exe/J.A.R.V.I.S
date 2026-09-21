import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface BotConfig {
  token: string;
  clientId: string;
  clientSecret: string;
  port: number;
  dashboardUrl: string;
  databasePath: string;
  developerIds: string[];
}

export const config: BotConfig = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',
  port: parseInt(process.env.PORT || process.env.DASHBOARD_PORT || '3000', 10),
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
  databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'jarvis_security.db'),
  developerIds: process.env.DEVELOPER_IDS
    ? process.env.DEVELOPER_IDS.split(',').map((id) => id.trim()).filter(Boolean)
    : [],
};

export const DEFAULT_LIMITS = {
  windowSeconds: 10,
  channelDeleteLimit: 2,
  channelCreateLimit: 3,
  roleDeleteLimit: 2,
  roleCreateLimit: 3,
  banLimit: 3,
  kickLimit: 3,
  webhookLimit: 2,
  joinBurstLimit: 5,
  joinBurstWindowSeconds: 5,
  minAccountAgeDays: 3,
  maxMentions: 4,
  spamMessageCount: 5,
  spamWindowSeconds: 4,
};

export type PenaltyType = 'BAN' | 'KICK' | 'QUARANTINE' | 'STRIP_ROLES';
