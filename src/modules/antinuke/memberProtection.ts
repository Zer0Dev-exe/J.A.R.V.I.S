import { AuditLogEvent, GuildBan, GuildMember, User } from 'discord.js';
import { db } from '../../database/db.js';
import { rateLimiter } from '../../utils/slidingWindow.js';
import { AuditLogHelper } from '../../utils/auditLogHelper.js';
import { PunishmentHandler } from '../../utils/punishment.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { Logger } from '../../utils/logger.js';

export class MemberProtection {
  public static async onGuildBanAdd(ban: GuildBan): Promise<void> {
    const guild = ban.guild;
    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    if (!executor) return;

    if (WhitelistManager.isImmune(guild, executor.id, 'MEMBERS')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:mass_ban`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.ban_limit,
      settings.limit_window_seconds * 1000
    );

    Logger.warn(
      `Usuario ${ban.user.tag} baneado por ${executor.tag}. Conteo: ${currentCount}/${settings.ban_limit}`,
      'MemberProtection'
    );

    if (exceeded) {
      const reason = `Límite de baneos masivos superado (${currentCount}/${settings.ban_limit} en ${settings.limit_window_seconds}s)`;
      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        reason,
        'Anti-Nuke (Miembros)',
        'BANEO_MASIVO_DETECTADO'
      );

      // Desbanear a la víctima
      await guild.bans.remove(ban.user.id, '[J.A.R.V.I.S ANTI-NUKE] Desbaneo de víctima de ataque masivo').catch(() => null);
    }
  }

  public static async onGuildMemberRemove(member: GuildMember): Promise<void> {
    const guild = member.guild;
    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    // Comprobar si la salida fue por Kick en los Audit Logs
    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.MemberKick, member.id, 2, 150);
    if (!executor) return; // Si es null, fue una salida voluntaria

    if (WhitelistManager.isImmune(guild, executor.id, 'MEMBERS')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:mass_kick`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.kick_limit,
      settings.limit_window_seconds * 1000
    );

    Logger.warn(
      `Usuario ${member.user.tag} expulsado por ${executor.tag}. Conteo: ${currentCount}/${settings.kick_limit}`,
      'MemberProtection'
    );

    if (exceeded) {
      const reason = `Límite de expulsiones masivas superado (${currentCount}/${settings.kick_limit} en ${settings.limit_window_seconds}s)`;
      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        reason,
        'Anti-Nuke (Miembros)',
        'EXPULSION_MASIVA_DETECTADA'
      );
    }
  }
}
