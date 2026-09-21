import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { PenaltyType } from '../config/config.js';
import { db } from '../database/db.js';
import { Logger } from './logger.js';

export class PunishmentHandler {
  /**
   * Aplica la sanción correspondiente de manera inmediata para frenar ataques destructivos.
   */
  public static async executePenalty(
    guild: Guild,
    targetUserId: string,
    penalty: PenaltyType,
    reason: string,
    moduleName: string,
    actionName: string
  ): Promise<string> {
    let appliedPenalty: string = penalty;
    const settings = db.getGuildSettings(guild.id);

    try {
      const member = await guild.members.fetch(targetUserId).catch(() => null);

      if (penalty === 'BAN') {
        await guild.members.ban(targetUserId, { reason: `[J.A.R.V.I.S SECURITY] ${reason}` });
        appliedPenalty = 'BAN';
      } else if (penalty === 'KICK') {
        if (member && member.kickable) {
          await member.kick(`[J.A.R.V.I.S SECURITY] ${reason}`);
          appliedPenalty = 'KICK';
        } else {
          // Fallback si no es kickable por jerarquía
          appliedPenalty = await this.stripDangerousRoles(guild, targetUserId, reason);
        }
      } else if (penalty === 'QUARANTINE') {
        if (member) {
          appliedPenalty = await this.applyQuarantine(guild, member, settings.quarantine_role_id, reason);
        } else {
          await guild.members.ban(targetUserId, { reason: `[J.A.R.V.I.S QUARANTINE-BAN] ${reason}` });
          appliedPenalty = 'BAN';
        }
      } else if (penalty === 'STRIP_ROLES') {
        appliedPenalty = await this.stripDangerousRoles(guild, targetUserId, reason);
      }
    } catch (err) {
      Logger.error(`Error al aplicar penalización ${penalty} a ${targetUserId}:`, err, 'Punishment');
      // Intentar último recurso: aislar o degradar
      appliedPenalty = await this.stripDangerousRoles(guild, targetUserId, reason).catch(() => 'FAILED');
    }

    // Despachar alerta de seguridad a Discord y registrar en SQLite
    await Logger.dispatchSecurityAlert(guild, {
      module: moduleName,
      action: actionName,
      userId: targetUserId,
      penaltyApplied: appliedPenalty,
      reason,
      severity: 'CRITICAL',
    });

    return appliedPenalty;
  }

  /**
   * Pone al miembro en cuarentena: le retira roles con permisos elevados,
   * le asigna el rol de cuarentena y le aplica timeout de aislamiento.
   */
  private static async applyQuarantine(
    guild: Guild,
    member: GuildMember,
    quarantineRoleId: string | null,
    reason: string
  ): Promise<string> {
    try {
      // 1. Aplicar timeout (aislamiento temporal de 28 días, el máximo de Discord)
      if (member.moderatable) {
        await member.timeout(28 * 24 * 60 * 60 * 1000, `[J.A.R.V.I.S QUARANTINE] ${reason}`).catch(() => null);
      }

      // 2. Retirar roles peligrosos
      await this.stripDangerousRoles(guild, member.id, reason);

      // 3. Asignar rol de cuarentena si existe
      if (quarantineRoleId) {
        const qRole = guild.roles.cache.get(quarantineRoleId);
        if (qRole && qRole.position < (guild.members.me?.roles.highest.position || 0)) {
          await member.roles.add(qRole, `[J.A.R.V.I.S QUARANTINE] ${reason}`);
        }
      }

      return 'QUARANTINE';
    } catch (err) {
      Logger.error(`Fallo al aplicar cuarentena sobre ${member.id}:`, err, 'Punishment');
      return 'FAILED';
    }
  }

  /**
   * Despoja al usuario de cualquier rol con permisos administrativos o de moderación
   */
  public static async stripDangerousRoles(guild: Guild, userId: string, reason: string): Promise<string> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return 'MEMBER_NOT_FOUND';

      const botHighestRole = guild.members.me?.roles.highest.position || 0;

      const dangerousPermissions = [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.ManageWebhooks,
      ];

      const rolesToRemove = member.roles.cache.filter((role) => {
        // No tocar @everyone
        if (role.id === guild.id) return false;
        // Debe ser inferior al rol del bot para poder quitarlo
        if (role.position >= botHighestRole) return false;
        // Tiene algún permiso peligroso
        return dangerousPermissions.some((perm) => role.permissions.has(perm));
      });

      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove, `[J.A.R.V.I.S STRIP-ROLES] ${reason}`);
        return `STRIPPED_${rolesToRemove.size}_ROLES`;
      }

      return 'NO_ROLES_TO_STRIP';
    } catch (err) {
      Logger.error(`Error al remover roles peligrosos de ${userId}:`, err, 'Punishment');
      return 'STRIP_FAILED';
    }
  }
}
