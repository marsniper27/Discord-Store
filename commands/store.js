const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { findEntryByID, findDocument, addItemToArray, incrementFields } = require("mars-simple-mongodb");
const { SolPayment } = require("Sol-Store-Module");
const { Item } = require("../classes/items")

const solPayment = new SolPayment();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('store')
        .setDescription('Open the store'),
    async execute(interaction) {
        const storeMessage = await interaction.deferReply()
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        let userInfo = await findEntryByID("users", guildId, userId);
        if (!userInfo.items) { userInfo.items = []; }
        let userInventory = userInfo.items + userInfo.weapons + userInfo.armour + userInfo.skills + userInfo.pets
        const itemData = await findDocument("store", guildId);

        const storeItems = itemData.map(itemData => new Item(
            itemData._id,
            itemData.name,
            itemData.description,
            itemData.quantity,
            itemData.cost,
            itemData.itemType,
            itemData.paymentType
        ));
        let currentItem = null;

        const storeSelection = storeItems.filter(item => !userInventory.includes(item.name));
        let description = '';
        for (const item of storeSelection) {
            description += `${item.name}: Quantity - ${item.quantity}, Cost - ${item.cost} ${item.paymentType}\n`;
        }

        // description += `\nSelected Item: ${currentItem ? currentItem.name : 'None'}`;

        const embed = new EmbedBuilder()
            .setTitle(`Store`)
            .setDescription(description);

        const selectMenuOptions = storeSelection.map(item => ({
            label: item.name,
            description: `Cost: ${item.cost} ${item.paymentType}`,
            value: item._id.toString()
        }));

        let placeholder = 'Select an Item';
        if (currentItem) {
            placeholder = `Selected: ${currentItem.name}`;
        }

        let selectRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_item')
                    .setPlaceholder(placeholder)
                    .addOptions(selectMenuOptions)
            );

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);

        await interaction.editReply({ embeds: [embed], components: [selectRow, buttonRow], ephemeral: true });

        const filter = (i) => ['select_item', 'confirm', 'cancel'].includes(i.customId) && i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (i) => {
            await i.deferUpdate()
            switch (i.customId) {
                case 'select_item':
                    currentItem = storeItems.find(item => item._id.toString() === i.values[0]);
                    if (currentItem) {
                        i.editReply({content:''})
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
                        confirmButton.setDisabled(false);
                    } else {
                        await interaction.editReply({ content: 'Item not found.', components: [] });
                        return collector.stop('item_not_found');
                    }
                    // Update the placeholder based on currentItem
                    let placeholder = 'Select an Item';
                    if (currentItem) {
                        placeholder = `Selected: ${currentItem.name}`;
                    }

                    // Update selectRow outside the switch statement
                    selectRow = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('select_item')
                                .setPlaceholder(placeholder)
                                .addOptions(selectMenuOptions)
                        );
        
                    // Update the interaction with the new components
                    await interaction.editReply({ components: [selectRow, buttonRow] });
                    break;
                case 'confirm':
                    // Handle confirmation logic
                    await interaction.editReply({ content: `You've selected: ${currentItem.name} \n Processing Order`, components: [], embeds: [] });
                    switch (currentItem.paymentType) {
                        case 'SOL':
                            try {
                                const result = await solPayment.performSale(interaction,currentItem.cost * await solPayment.lps())
                                if(result !== false){
                                //     let userItems = userInfo[currentItem.itemType];
                                //     userItems.push(currentItem)
                                //     userInfo[currentItem.itemType] = userItems;
                                    await addItemToArray('users',guildId,userId,currentItem.itemType,currentItem.name)
                                    await interaction.editReply({ content: `${currentItem.name} has been added to your Inventory`, components: [], embeds: [] });
                                }
                            } catch (error) {
                                console.error("Error retrieving wallet data or balance:", error);
                                await i.editReply({ content: "An error occurred while processing your request.", ephemeral: true });
                                return;
                            }
                            break;

                        case 'coins':
                            await incrementFields('users',guildId,userId,{coins:-currentItem.cost})
                            await addItemToArray('users',guildId,userId,currentItem.itemType,currentItem.name)
                            await interaction.editReply({ content: `${currentItem.name} has been added to your Inventory`, components: [], embeds: [] });
                            break;

                        case 'superCoins':
                            await incrementFields('users',guildId,userId,{superCoins:-currentItem.cost})
                            await addItemToArray('users',guildId,userId,currentItem.itemType,currentItem.name)
                            await interaction.editReply({ content: `${currentItem.name} has been added to your Inventory`, components: [], embeds: [] });
                            break;
                    }
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
