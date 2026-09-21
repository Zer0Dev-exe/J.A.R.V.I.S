import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { SnapshotManager } from '../modules/recovery/snapshotManager.js';

export const backupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Sistema de copias de seguridad de canales y permisos de J.A.R.V.I.S')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Genera un snapshot instantáneo de todos los canales y permisos')
    )
    .addSubcommand((sub) =>
      sub
        .setName('restore')
        .setDescription('Reconstruye un canal borrado usando su ID previo')
        .addStringOption((opt) =>
          opt.setName('channel_id').setDescription('ID del canal que fue eliminado').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      const count = await SnapshotManager.backupGuildChannels(guild);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('💾 Snapshot Guardado')
        .setDescription(
          `Se han respaldado con éxito **${count}** canales, categorías y sus tablas de permisos en la base de datos de alta velocidad.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'restore') {
      const channelId = interaction.options.getString('channel_id', true);
      const restored = await SnapshotManager.restoreDeletedChannel(guild, channelId);

      if (!restored) {
        await interaction.editReply({
          content: `❌ No se encontró ningún respaldo disponible para el ID de canal \`${channelId}\` o falló la reconstrucción.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('♻️ Canal Restaurado')
        .setDescription(
          `El canal <#${restored.id}> (\`${restored.name}\`) ha sido reconstruido con su categoría y permisos originales intactos.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};
