import { GuildMember } from 'discord.js';
import { db } from '../../database/db.js';
import { rateLimiter } from '../../utils/slidingWindow.js';
import { RaidDetector } from './raidDetector.js';
import { PunishmentHandler } from '../../utils/punishment.js';
import { Logger } from '../../utils/logger.js';

export class JoinGate {
  public static async onMemberJoin(member: GuildMember): Promise<void> {
    if (member.user.bot) return; // Los bots se gestionan en BotProtection

    const guild = member.guild;
    const settings = db.getGuildSettings(guild.id);
    if (!settings.antiraid_enabled) return;

    // 1. Detección de Join-Burst (Raid masivo de cuentas coordinadas)
    const burstKey = `antiraid:join_burst:${guild.id}`;
    const { exceeded, currentCount } = rateLimiter.hit(
      burstKey,
      settings.join_burst_limit,
      settings.join_burst_window_seconds * 1000
    );

    if (exceeded) {
      Logger.warn(
        `¡ALERTA DE RAID! Oleada masiva de entradas detectada: ${currentCount} miembros en ${settings.join_burst_window_seconds}s en ${guild.name}`,
        'JoinGate'
      );

      // Activar lockdown automático preventivo
      if (!RaidDetector.isLockedDown(guild.id)) {
        await RaidDetector.enableLockdown(guild, 'Join-burst masivo detectado por Anti-Raid');
      }

      // Expulsar a las cuentas que entran durante el burst
      if (member.kickable) {
        await member.kick('[J.A.R.V.I.S ANTI-RAID] Entrada durante oleada de raid').catch(() => null);
      }

      await Logger.dispatchSecurityAlert(guild, {
        module: 'Anti-Raid',
        action: 'JOIN_BURST_DETECTADO',
        userId: member.id,
        userTag: member.user.tag,
        penaltyApplied: 'KICK_Y_LOCKDOWN',
        reason: `Raid masivo en curso (${currentCount} usuarios en ${settings.join_burst_window_seconds}s). Modo de contención activado.`,
        severity: 'CRITICAL',
      });
      return;
    }

    // 2. Filtro de Edad de Cuenta (Account Age Filter)
    if (settings.min_account_age_days > 0) {
      const now = Date.now();
      const accountAgeMs = now - member.user.createdTimestamp;
      const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

      if (accountAgeDays < settings.min_account_age_days) {
        const formattedAge = accountAgeDays < 1 
          ? `${Math.round(accountAgeMs / (1000 * 60 * 60))} horas`
          : `${accountAgeDays.toFixed(1)} días`;

        // Si hay rol de cuarentena, aislar; si no, expulsar
        let penaltyApplied = 'KICK';
        if (settings.quarantine_role_id) {
          penaltyApplied = await PunishmentHandler.executePenalty(
            guild,
            member.id,
            'QUARANTINE',
            `Cuenta demasiado reciente (${formattedAge} de antigüedad. Mínimo exigido: ${settings.min_account_age_days} días)`,
            'Anti-Raid',
            'FILTRO_CUENTA_NUEVA'
          );
        } else if (member.kickable) {
          await member.kick(`[J.A.R.V.I.S ANTI-RAID] Cuenta creada hace menos de ${settings.min_account_age_days} días`).catch(() => null);
          
          await Logger.dispatchSecurityAlert(guild, {
            module: 'Anti-Raid',
            action: 'CUENTA_NUEVA_EXPULSADA',
            userId: member.id,
            userTag: member.user.tag,
            penaltyApplied: 'KICK',
            reason: `Cuenta creada hace solo ${formattedAge} (Mínimo exigido: ${settings.min_account_age_days} días).`,
            severity: 'MEDIUM',
          });
        }
      }
    }
  }
}
