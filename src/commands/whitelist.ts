import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { WhitelistManager } from '../modules/whitelist/whitelistManager.js';

export const whitelistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Gestiona la lista de usuarios de confianza inmunes a las restricciones de seguridad')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Añade un usuario a la lista blanca')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Usuario de confianza').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo de inmunidad otorgada')
            .setRequired(false)
            .addChoices(
              { name: 'Inmunidad Total (FULL)', value: 'FULL' },
              { name: 'Gestión de Canales (CHANNELS)', value: 'CHANNELS' },
              { name: 'Gestión de Roles (ROLES)', value: 'ROLES' },
              { name: 'Expulsión/Baneo (MEMBERS)', value: 'MEMBERS' },
              { name: 'Invitación de Bots (BOTS)', value: 'BOTS' },
              { name: 'Webhooks (WEBHOOKS)', value: 'WEBHOOKS' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Revoca la inmunidad de un usuario')
        .addUserOption((opt) =>
          opt.setName('usuario').setDescription('Usuario a retirar').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo específico a remover (opcional)')
            .setRequired(false)
            .addChoices(
              { name: 'FULL', value: 'FULL' },
              { name: 'CHANNELS', value: 'CHANNELS' },
              { name: 'ROLES', value: 'ROLES' },
              { name: 'MEMBERS', value: 'MEMBERS' },
              { name: 'BOTS', value: 'BOTS' },
              { name: 'WEBHOOKS', value: 'WEBHOOKS' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Muestra todos los usuarios y permisos en la lista blanca')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    // Medida crítica de seguridad multiguild:
    // Solo el Dueño de este Servidor específico (guild.ownerId) o los Desarrolladores globales de la App pueden alterar la Whitelist
    const isServerOwner = interaction.user.id === guild.ownerId;
    const client = interaction.client as any;
    const isBotDeveloper = typeof client.isBotDeveloper === 'function' && client.isBotDeveloper(interaction.user.id);

    if (!isServerOwner && !isBotDeveloper) {
      await interaction.reply({
        content: '🚫 **Acceso Denegado:** Por motivos de seguridad crítica, únicamente el Dueño de este servidor puede alterar la Whitelist.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const target = interaction.options.getUser('usuario', true);
      const type = (interaction.options.getString('tipo') || 'FULL') as any;

      WhitelistManager.add(guild.id, target.id, type, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Usuario Añadido a Whitelist')
        .setDescription(`El usuario <@${target.id}> (\`${target.tag}\`) ahora cuenta con inmunidad de tipo **${type}**.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'remove') {
      const target = interaction.options.getUser('usuario', true);
      const type = interaction.options.getString('tipo') || undefined;

      const removed = WhitelistManager.remove(guild.id, target.id, type);

      if (!removed) {
        await interaction.reply({
          content: `El usuario <@${target.id}> no se encontraba en la lista blanca con ese criterio.`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🗑️ Inmunidad Revocada')
        .setDescription(`Se ha revocado la inmunidad de <@${target.id}>${type ? ` para el módulo **${type}**` : ''}.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'list') {
      const entries = WhitelistManager.list(guild.id);

      if (entries.length === 0) {
        await interaction.reply({
          content: 'No hay ningún usuario añadido en la Whitelist de este servidor (el Dueño del servidor es inmune por defecto).',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🛡️ Usuarios en Whitelist (${entries.length})`)
        .setDescription(
          entries
            .map(
              (e, idx) =>
                `**${idx + 1}.** <@${e.user_id}> (\`${e.user_id}\`)\n` +
                `   ↳ *Alcance:* \`${e.type}\` | *Añadido por:* <@${e.added_by}> | *Fecha:* <t:${Math.floor(e.added_at / 1000)}:R>`
            )
            .join('\n\n')
        )
        .setFooter({ text: 'Nota: El Dueño del servidor posee inmunidad absoluta automática.' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
