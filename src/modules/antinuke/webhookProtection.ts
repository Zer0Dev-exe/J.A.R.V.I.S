import { AuditLogEvent, NonThreadGuildBasedChannel } from 'discord.js';
import { db } from '../../database/db.js';
import { rateLimiter } from '../../utils/slidingWindow.js';
import { AuditLogHelper } from '../../utils/auditLogHelper.js';
import { PunishmentHandler } from '../../utils/punishment.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { Logger } from '../../utils/logger.js';

export class WebhookProtection {
  public static async onWebhookUpdate(channel: NonThreadGuildBasedChannel): Promise<void> {
    const guild = channel.guild;
    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    // Buscar creación de webhook en los Audit Logs
    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.WebhookCreate, undefined, 2, 200);
    if (!executor) return;

    if (WhitelistManager.isImmune(guild, executor.id, 'WEBHOOKS')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:webhook_create`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.webhook_limit,
      settings.limit_window_seconds * 1000
    );

    if (exceeded) {
      // Eliminar webhooks creados recientemente en el canal
      if ('fetchWebhooks' in channel) {
        const webhooks = await channel.fetchWebhooks().catch(() => null);
        if (webhooks) {
          for (const [, wh] of webhooks) {
            if (wh.owner?.id === executor.id) {
              await wh.delete('[J.A.R.V.I.S ANTI-NUKE] Webhook malicioso eliminado').catch(() => null);
            }
          }
        }
      }

      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        `Límite de creación de webhooks superado (${currentCount}/${settings.webhook_limit} en ${settings.limit_window_seconds}s)`,
        'Anti-Nuke (Webhooks)',
        'CREACION_MASIVA_WEBHOOKS'
      );
    }
  }
}
