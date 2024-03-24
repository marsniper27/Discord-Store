const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { findEntryByID, findDocuments } = require("mars-simple-mongodb");
const { SolPayment } = require("Sol-Store-Module");
const { Item } = require("../classes/items")

const solPayment = new SolPayment();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('store_detailed')
        .setDescription('Open the store in detail mode'),
    async execute(interaction) {
        const storeMessage = await interaction.deferReply()
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const storeItems = await findDocuments('store', guildId);
        let currentIndex = 0;

        const userInfo = await findEntryByID("users", guildId, userId);
        if (!userInfo.items) { userInfo.items = []; }

        // Create instances of item class for each store item
        const itemsList = storeItems.map(itemData => new Item(
            itemData.name,
            itemData.description,
            itemData.quantity,
            itemData.cost,
            itemData.paymentType,
            itemData.itemType
        ));

        let currentItem = null;

        const storeSelection = storeItems.filter(item => !userInfo.items.includes(item.name));
        let description = '';
        for (const item of storeSelection) {
            description += `${item.name}: Quantity - ${item.quantity}, Cost - ${item.cost} ${item.paymentType}\n`;
        }

        // description += `\nSelected Item: ${currentItem ? currentItem.name : 'None'}`;

        const updateItemView = async (interaction,currentIndex) => {
            const embed = itemsList[currentIndex].show() 

            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(itemsList.length === 1 || currentIndex === 0),
                    new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(itemsList.length === 1 || currentIndex === itemsList.length - 1),
                    new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
                );

            await interaction.editReply({ embeds: [embed], components: [buttonRow], ephemeral: true });
        };
        // const buttonRow = new ActionRowBuilder()
        // .addComponents(
        //     new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(itemsList.length === 1 || currentIndex === 0),
        //     new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(itemsList.length === 1 || currentIndex === itemsList.length - 1),
        //     new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
        //     new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        // );

        // await interaction.editReply({ embeds: [embed], components: [selectRow, buttonRow], ephemeral: true });

        await updateItemView(interaction, currentIndex);
        const filter = (i) => ['next','previous', 'confirm', 'cancel'].includes(i.customId) && i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (i) => {
            await i.deferUpdate()
            switch (i.customId) {
                case 'previous':
                    currentIndex = Math.max(0, currentIndex - 1);
                    await updateItemView(interaction,currentIndex);
                    // await i.deferUpdate(); // Acknowledge the button press
                    collector.resetTimer(); // Reset the timeout
                    break;
                case 'next':
                    currentIndex = Math.min(itemsList.length - 1, currentIndex + 1);
                    await updateItemView(interaction,currentIndex);
                    // await i.deferUpdate();
                    collector.resetTimer();
                    break;
                case 'confirm':
                    switch (currentItem.paymentType) {
                        case 'SOL':
                            try {
                                const walletData = await findEntryByID('wallets', 'user_wallets', userId);
                                const balance = await solPayment.getBalance(walletData.publicKey);
                                const costInLamports = currentItem.cost * await solPayment.lps()
                                if (balance < costInLamports) {
                                    await i.editReply({ content: `You do not have enough SOL for this item`, ephemeral: true });
                                    return;
                                }
                            } catch (error) {
                                console.error("Error retrieving wallet data or balance:", error);
                                await i.editReply({ content: "An error occurred while processing your request.", ephemeral: true });
                                return;
                            }
                            break;

                        case 'coins':
                            if (userInfo.coins < currentItem.cost) {
                                i.editReply({ content: `You do not have enough for this item`, components: [], embeds: [], ephemeral: true })
                                break;
                            }
                            break;

                        case 'superCoins':
                            if (userInfo.superCoins < currentItem.cost) {
                                i.editReply({ content: `You do not have enough for this item`, components: [], embeds: [], ephemeral: true })
                                break;
                            }
                            break;
                    }
                    await interaction.editReply({ content: `You've selected: ${currentItem.name} \n Processing Order`, components: [], embeds: [] });
                    collector.stop();
                    break;
                case 'cancel':
                    await interaction.editReply({ content: 'Action cancelled', components: [] });
                    collector.stop('cancelled');
                    break;
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'Interaction timed out.', components: [] });
            }
        });
    }
};
