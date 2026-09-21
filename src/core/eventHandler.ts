import { Client, Events, GuildChannel, Message } from 'discord.js';
import { CommandHandler } from './commandHandler.js';
import { ChannelProtection } from '../modules/antinuke/channelProtection.js';
import { RoleProtection } from '../modules/antinuke/roleProtection.js';
import { MemberProtection } from '../modules/antinuke/memberProtection.js';
import { BotProtection } from '../modules/antinuke/botProtection.js';
import { WebhookProtection } from '../modules/antinuke/webhookProtection.js';
import { JoinGate } from '../modules/antiraid/joinGate.js';
import { ScamFilter } from '../modules/antiscam/scamFilter.js';
import { SpamDetector } from '../modules/antiscam/spamDetector.js';
import { SnapshotManager } from '../modules/recovery/snapshotManager.js';
import { Logger } from '../utils/logger.js';

export class EventHandler {
  public static registerEvents(client: Client, commandHandler: CommandHandler): void {
    // 1. Interacciones de comandos Slash
    client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await commandHandler.handleInteraction(interaction);
      }
    });

    // 2. Eventos Anti-Nuke: Canales
    client.on(Events.ChannelDelete, async (channel) => {
      await ChannelProtection.onChannelDelete(channel);
    });

    client.on(Events.ChannelCreate, async (channel) => {
      await ChannelProtection.onChannelCreate(channel);
    });

    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
      await ChannelProtection.onChannelUpdate(oldChannel, newChannel);
    });

    // 3. Eventos Anti-Nuke: Roles
    client.on(Events.GuildRoleDelete, async (role) => {
      await RoleProtection.onRoleDelete(role);
    });

    client.on(Events.GuildRoleCreate, async (role) => {
      await RoleProtection.onRoleCreate(role);
    });

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
      await RoleProtection.onRoleUpdate(oldRole, newRole);
    });

    // 4. Eventos Anti-Nuke: Miembros (Bans masivos y Kicks)
    client.on(Events.GuildBanAdd, async (ban) => {
      await MemberProtection.onGuildBanAdd(ban);
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      // Nota: Si el bot no tiene acceso a partials de miembros desuscritos, GuildMemberRemove puede ser parcial
      if ('guild' in member) {
        await MemberProtection.onGuildMemberRemove(member as any);
      }
    });

    // 5. Eventos Anti-Nuke & Anti-Raid: Nuevos Miembros / Bots
    client.on(Events.GuildMemberAdd, async (member) => {
      if (member.user.bot) {
        await BotProtection.onBotAdd(member);
      } else {
        await JoinGate.onMemberJoin(member);
      }
    });

    // 6. Eventos Anti-Nuke: Webhooks
    client.on(Events.WebhooksUpdate, async (channel) => {
      await WebhookProtection.onWebhookUpdate(channel);
    });

    // 7. Eventos Anti-Scam & Anti-Spam: Mensajes
    client.on(Events.MessageCreate, async (message) => {
      // Ignorar mensajes de bots o DMs
      if (message.author.bot || !message.guild) return;

      const interceptedScam = await ScamFilter.analyzeMessage(message);
      if (!interceptedScam) {
        await SpamDetector.analyzeSpam(message);
      }
    });

    client.on(Events.MessageUpdate, async (_, newMessage) => {
      if (!newMessage.guild || newMessage.author?.bot) return;
      if (newMessage.partial) {
        try {
          await newMessage.fetch();
        } catch {
          return;
        }
      }
      await ScamFilter.analyzeMessage(newMessage as Message);
    });

    // 8. Auto-snapshot inicial al entrar a un servidor
    client.on(Events.GuildCreate, async (guild) => {
      Logger.log(`Bot unido a servidor: ${guild.name} (${guild.id}). Creando snapshot inicial de seguridad...`, 'EventHandler');
      await SnapshotManager.backupGuildChannels(guild);
    });

    Logger.log('Todos los listeners de eventos de seguridad han sido registrados exitosamente.', 'EventHandler');
  }
}
