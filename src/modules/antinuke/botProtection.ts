import { AuditLogEvent, GuildMember } from 'discord.js';
import { db } from '../../database/db.js';
import { AuditLogHelper } from '../../utils/auditLogHelper.js';
import { PunishmentHandler } from '../../utils/punishment.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { Logger } from '../../utils/logger.js';

export class BotProtection {
  public static async onBotAdd(member: GuildMember): Promise<void> {
    if (!member.user.bot) return;
    const guild = member.guild;

    const settings = db.getGuildSettings(guild.id);
    if (!settings.anti_bot_enabled) return;

    // Verificar si el bot está explícitamente en la lista blanca
    if (WhitelistManager.isImmune(guild, member.id, 'BOTS')) {
      return;
    }

    // 1. Expulsar o banear inmediatamente al bot no autorizado
    await guild.members.ban(member.id, {
      reason: '[J.A.R.V.I.S ANTI-BOT] Bot no autorizado añadido al servidor',
    }).catch(() => null);

    // 2. Averiguar qué administrador o usuario invitó al bot
    const inviter = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.BotAdd, member.id);
    if (inviter) {
      if (!WhitelistManager.isImmune(guild, inviter.id, 'BOTS')) {
        await PunishmentHandler.executePenalty(
          guild,
          inviter.id,
          settings.default_penalty,
          `Adición de bot no autorizado: ${member.user.tag} (${member.id})`,
          'Anti-Bot',
          'BOT_NO_AUTORIZADO'
        );
      }
    } else {
      await Logger.dispatchSecurityAlert(guild, {
        module: 'Anti-Bot',
        action: 'BOT_NO_AUTORIZADO',
        userId: member.id,
        userTag: member.user.tag,
        penaltyApplied: 'BAN_AL_BOT',
        reason: 'Bot detectado y baneado inmediatamente de forma preventiva.',
        severity: 'HIGH',
      });
    }
  }
}
