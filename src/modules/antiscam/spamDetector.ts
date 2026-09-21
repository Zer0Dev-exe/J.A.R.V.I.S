import { Message } from 'discord.js';
import { db } from '../../database/db.js';
import { rateLimiter } from '../../utils/slidingWindow.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { Logger } from '../../utils/logger.js';
import { DEFAULT_LIMITS } from '../../config/config.js';

export class SpamDetector {
  public static async analyzeSpam(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot || !message.member) return false;

    const guild = message.guild;
    const settings = db.getGuildSettings(guild.id);
    if (!settings.antiscam_enabled) return false;

    if (WhitelistManager.isImmune(guild, message.author.id)) {
      return false;
    }

    // 1. Detección de Menciones Masivas (Anti-Mass Mention / Ghost Ping)
    if (settings.anti_mass_mention_enabled) {
      const mentionCount = message.mentions.users.size + message.mentions.roles.size;
      const hasEveryone = message.mentions.everyone;

      if (hasEveryone || mentionCount >= settings.max_mentions) {
        await message.delete().catch(() => null);

        if (message.member.moderatable) {
          await message.member.timeout(60 * 60 * 1000, '[J.A.R.V.I.S ANTI-SPAM] Menciones masivas no autorizadas').catch(() => null);
        }

        await Logger.dispatchSecurityAlert(guild, {
          module: 'Anti-Spam (Menciones)',
          action: 'MENCION_MASIVA',
          userId: message.author.id,
          userTag: message.author.tag,
          penaltyApplied: 'BORRADO_Y_TIMEOUT_1H',
          reason: hasEveryone 
            ? 'Intento de mención a @everyone/@here en canal público.'
            : `Superó el límite de menciones permitidas (${mentionCount}/${settings.max_mentions}).`,
          severity: 'HIGH',
          details: [{ name: 'Canal', value: `<#${message.channel.id}>`, inline: true }],
        });

        return true;
      }
    }

    // 2. Detección de Flood de Mensajes (Envío ultra rápido)
    if (settings.anti_spam_enabled) {
      const key = `antispam:flood:${guild.id}:${message.author.id}`;
      const { exceeded, currentCount } = rateLimiter.hit(
        key,
        DEFAULT_LIMITS.spamMessageCount,
        DEFAULT_LIMITS.spamWindowSeconds * 1000
      );

      if (exceeded) {
        await message.delete().catch(() => null);

        if (message.member.moderatable) {
          await message.member.timeout(15 * 60 * 1000, '[J.A.R.V.I.S ANTI-SPAM] Envío masivo de mensajes (Flood)').catch(() => null);
        }

        await Logger.dispatchSecurityAlert(guild, {
          module: 'Anti-Spam (Flood)',
          action: 'SPAM_MENSAJES_RAPIDOS',
          userId: message.author.id,
          userTag: message.author.tag,
          penaltyApplied: 'BORRADO_Y_TIMEOUT_15M',
          reason: `Flood de mensajes detectado (${currentCount} mensajes en ${DEFAULT_LIMITS.spamWindowSeconds}s).`,
          severity: 'MEDIUM',
          details: [{ name: 'Canal', value: `<#${message.channel.id}>`, inline: true }],
        });

        return true;
      }
    }

    return false;
  }
}
