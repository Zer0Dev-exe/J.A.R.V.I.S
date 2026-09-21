import { AuditLogEvent, GuildChannel, DMChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { db } from '../../database/db.js';
import { rateLimiter } from '../../utils/slidingWindow.js';
import { AuditLogHelper } from '../../utils/auditLogHelper.js';
import { PunishmentHandler } from '../../utils/punishment.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { SnapshotManager } from '../recovery/snapshotManager.js';
import { Logger } from '../../utils/logger.js';

export class ChannelProtection {
  public static async onChannelDelete(channel: GuildChannel | DMChannel): Promise<void> {
    if (!channel || !('guild' in channel) || !channel.guild) return;
    const guild = channel.guild;

    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    // Obtener al ejecutor del borrado desde los Audit Logs
    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);
    if (!executor) return;

    // Verificar si es inmune
    if (WhitelistManager.isImmune(guild, executor.id, 'CHANNELS')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:channel_delete`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.channel_delete_limit,
      settings.limit_window_seconds * 1000
    );

    Logger.warn(
      `Canal #${channel.name} borrado por ${executor.tag} (${executor.id}). Conteo actual: ${currentCount}/${settings.channel_delete_limit}`,
      'ChannelProtection'
    );

    if (exceeded) {
      const reason = `Límite de borrado de canales superado (${currentCount}/${settings.channel_delete_limit} en ${settings.limit_window_seconds}s)`;
      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        reason,
        'Anti-Nuke (Canales)',
        'BORRADO_MASIVO_CANALES'
      );

      // Si está habilitada la auto-recuperación, restaurar el canal destruido
      if (settings.auto_recovery_enabled) {
        await SnapshotManager.restoreDeletedChannel(guild, channel.id);
      }
    }
  }

  public static async onChannelCreate(channel: NonThreadGuildBasedChannel): Promise<void> {
    if (!channel || !channel.guild) return;
    const guild = channel.guild;

    // Respaldar canal nuevo de forma automática
    await SnapshotManager.backupChannel(channel);

    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);
    if (!executor) return;

    if (WhitelistManager.isImmune(guild, executor.id, 'CHANNELS')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:channel_create`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.channel_create_limit,
      settings.limit_window_seconds * 1000
    );

    if (exceeded) {
      const reason = `Límite de creación masiva de canales superado (${currentCount}/${settings.channel_create_limit} en ${settings.limit_window_seconds}s)`;
      
      // Eliminar el canal creado no autorizado
      await channel.delete('[J.A.R.V.I.S ANTI-NUKE] Canal creado durante ataque masivo').catch(() => null);

      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        reason,
        'Anti-Nuke (Canales)',
        'CREACION_MASIVA_CANALES'
      );
    }
  }

  public static async onChannelUpdate(oldChannel: GuildChannel | DMChannel, newChannel: GuildChannel | DMChannel): Promise<void> {
    if ('guild' in newChannel && newChannel.guild && newChannel instanceof GuildChannel) {
      await SnapshotManager.backupChannel(newChannel);
    }
  }
}
