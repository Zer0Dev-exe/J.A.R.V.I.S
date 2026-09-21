import { Message, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';
import { WhitelistManager } from '../whitelist/whitelistManager.js';
import { Logger } from '../../utils/logger.js';
import { PunishmentHandler } from '../../utils/punishment.js';

export class ScamFilter {
  // Dominios seguros legítimos para comparación
  private static readonly LEGIT_DOMAINS = ['discord.com', 'discord.gg', 'discord.gift', 'steamcommunity.com', 'steampowered.com'];

  // Patrones regex conocidos de estafas de Nitro y Steam Phishing
  private static readonly SCAM_PATTERNS = [
    /discor[cl]-/i,
    /dlscord/i,
    /discrod/i,
    /discort/i,
    /discord-nitro/i,
    /free-nitro/i,
    /nitro-drop/i,
    /steamcom+un[il1]t/i,
    /steam-gift/i,
    /steam-promo/i,
    /steancommuni/i,
  ];

  // Regex para enlaces de invitación de Discord
  private static readonly INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]{2,32})/gi;

  // Regex para extraer dominios de URLs
  private static readonly URL_REGEX = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/gi;

  /**
   * Distancia de Levenshtein para detectar dominios casi idénticos (Typosquatting)
   */
  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // sustitución
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Evalúa si un mensaje contiene enlaces phishing o invitaciones no autorizadas.
   */
  public static async analyzeMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot || !message.member) return false;

    const guild = message.guild;
    const settings = db.getGuildSettings(guild.id);
    if (!settings.antiscam_enabled) return false;

    // Verificar si el autor es inmune
    if (WhitelistManager.isImmune(guild, message.author.id)) {
      return false;
    }

    const content = message.content;

    // 1. Detección de Phishing y Enlaces Maliciosos
    if (settings.anti_links_enabled) {
      let isPhishing = false;
      let matchedReason = '';

      // Comprobar patrones conocidos de scam
      for (const pattern of this.SCAM_PATTERNS) {
        if (pattern.test(content)) {
          isPhishing = true;
          matchedReason = `Patrón de phishing detectado: ${pattern.toString()}`;
          break;
        }
      }

      // Extraer dominios y evaluar Typosquatting
      if (!isPhishing) {
        const matches = content.matchAll(this.URL_REGEX);
        for (const match of matches) {
          const domain = match[1].toLowerCase();

          for (const legit of this.LEGIT_DOMAINS) {
            if (domain === legit || domain.endsWith('.' + legit)) {
              continue; // Dominio legítimo exacto o subdominio oficial
            }

            const dist = this.levenshtein(domain, legit);
            // Si la distancia es 1 o 2 (ej: discorcl.com vs discord.com), es un clon malicioso
            if (dist > 0 && dist <= 2) {
              isPhishing = true;
              matchedReason = `Typosquatting malicioso detectado: "${domain}" imitando a "${legit}"`;
              break;
            }
          }
          if (isPhishing) break;
        }
      }

      if (isPhishing) {
        // Eliminar mensaje inmediatamente
        await message.delete().catch(() => null);

        // Cuarentena o timeout al usuario (su cuenta puede estar comprometida por un token-grabber)
        if (message.member.moderatable) {
          await message.member.timeout(24 * 60 * 60 * 1000, `[J.A.R.V.I.S ANTI-SCAM] ${matchedReason}`).catch(() => null);
        }

        await Logger.dispatchSecurityAlert(guild, {
          module: 'Anti-Scam (Phishing)',
          action: 'ENLACE_PHISHING_BLOQUEADO',
          userId: message.author.id,
          userTag: message.author.tag,
          penaltyApplied: 'TIMEOUT_24H_Y_BORRADO',
          reason: matchedReason,
          severity: 'CRITICAL',
          details: [
            { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Contenido interceptado', value: `\`\`\`${content.slice(0, 500)}\`\`\`` },
          ],
        });

        return true;
      }
    }

    // 2. Detección de Invitaciones de Discord no autorizadas
    if (settings.anti_invites_enabled) {
      if (this.INVITE_REGEX.test(content)) {
        await message.delete().catch(() => null);

        // Advertencia temporal por timeout si insiste
        if (message.member.moderatable) {
          await message.member.timeout(10 * 60 * 1000, '[J.A.R.V.I.S ANTI-SCAM] Envío de invitaciones no autorizadas').catch(() => null);
        }

        await Logger.dispatchSecurityAlert(guild, {
          module: 'Anti-Scam (Invitaciones)',
          action: 'INVITACION_NO_AUTORIZADA',
          userId: message.author.id,
          userTag: message.author.tag,
          penaltyApplied: 'BORRADO_Y_TIMEOUT_10M',
          reason: 'Intento de promoción o difusión de invitación externa de Discord sin autorización.',
          severity: 'MEDIUM',
          details: [{ name: 'Canal', value: `<#${message.channel.id}>`, inline: true }],
        });

        return true;
      }
    }

    return false;
  }
}
