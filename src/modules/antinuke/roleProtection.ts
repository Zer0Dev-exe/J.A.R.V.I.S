import { AuditLogEvent, PermissionFlagsBits, Role } from 'discord.js';
import { db } from '../../database/db.js';
import { rateLimiter } from '../../utils/slidingWindow.js';
import { AuditLogHelper } from '../../utils/auditLogHelper.js';
import { PunishmentHandler } from '../../utils/punishment.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { Logger } from '../../utils/logger.js';

export class RoleProtection {
  public static async onRoleDelete(role: Role): Promise<void> {
    if (!role.guild) return;
    const guild = role.guild;

    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.RoleDelete, role.id);
    if (!executor) return;

    if (WhitelistManager.isImmune(guild, executor.id, 'ROLES')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:role_delete`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.role_delete_limit,
      settings.limit_window_seconds * 1000
    );

    Logger.warn(
      `Rol @${role.name} borrado por ${executor.tag}. Conteo: ${currentCount}/${settings.role_delete_limit}`,
      'RoleProtection'
    );

    if (exceeded) {
      const reason = `Límite de borrado de roles superado (${currentCount}/${settings.role_delete_limit} en ${settings.limit_window_seconds}s)`;
      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        reason,
        'Anti-Nuke (Roles)',
        'BORRADO_MASIVO_ROLES'
      );

      // Recrear rol de emergencia
      await guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
        reason: '[J.A.R.V.I.S ANTI-NUKE] Recreación de rol eliminado en ataque',
      }).catch((e) => Logger.error('Fallo al recrear rol:', e, 'RoleProtection'));
    }
  }

  public static async onRoleCreate(role: Role): Promise<void> {
    if (!role.guild) return;
    const guild = role.guild;

    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.RoleCreate, role.id);
    if (!executor) return;

    if (WhitelistManager.isImmune(guild, executor.id, 'ROLES')) {
      return;
    }

    const key = `antinuke:${guild.id}:${executor.id}:role_create`;
    const { exceeded, currentCount } = rateLimiter.hit(
      key,
      settings.role_create_limit,
      settings.limit_window_seconds * 1000
    );

    if (exceeded) {
      const reason = `Límite de creación masiva de roles superado (${currentCount}/${settings.role_create_limit} en ${settings.limit_window_seconds}s)`;

      await role.delete('[J.A.R.V.I.S ANTI-NUKE] Rol creado en ataque').catch(() => null);

      await PunishmentHandler.executePenalty(
        guild,
        executor.id,
        settings.default_penalty,
        reason,
        'Anti-Nuke (Roles)',
        'CREACION_MASIVA_ROLES'
      );
    }
  }

  public static async onRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
    if (!newRole.guild) return;
    const guild = newRole.guild;

    const settings = db.getGuildSettings(guild.id);
    if (!settings.antinuke_enabled) return;

    // Detectar escalada de privilegios (dar Administrador a un rol normal o a @everyone)
    const dangerousPerms = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.BanMembers,
    ];

    const gainedDangerous = dangerousPerms.some(
      (perm) => !oldRole.permissions.has(perm) && newRole.permissions.has(perm)
    );

    if (gainedDangerous) {
      const executor = await AuditLogHelper.fetchExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
      if (!executor) return;

      if (!WhitelistManager.isImmune(guild, executor.id, 'ROLES')) {
        // Revertir permisos
        await newRole.setPermissions(oldRole.permissions, '[J.A.R.V.I.S ANTI-NUKE] Reversión de escalada no autorizada');

        await PunishmentHandler.executePenalty(
          guild,
          executor.id,
          settings.default_penalty,
          `Intento de otorgar permisos administrativos no autorizados al rol @${newRole.name}`,
          'Anti-Nuke (Roles)',
          'ESCALADA_PERMISOS_ROL'
        );
      }
    }
  }
}
