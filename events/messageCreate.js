const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, roleMention } = require("discord.js");
const { eventshandler, db, webhookClient } = require("..");
const config = require("../config");
const { time, permissionsCalculator } = require("../functions");

const set = new Set();

module.exports = new eventshandler.event({
    event: 'messageCreate',
    run: async (client, message) => {

        if (message.author.bot) return;

        const guild = client.guilds.cache.get(config.modmail.guildId);
        const category = guild.channels.cache.find((v) => v.id === config.modmail.categoryId || v.name === 'ModMail');

        await guild.members.fetch();

        if (message.guild) {
            if (message.channel.parentId !== category.id) return;

            const data = (await db.select('mails', { channelId: message.channelId }))[0];

            const user = guild.members.cache.get(data?.authorId);

            if (!user) {
                await message.reply({
                    content: 'The author of the mail was not found, you can delete this ticket.'
                });

                return;
            };

            const perms = permissionsCalculator(message.member);

            const embed = new EmbedBuilder()
                .setAuthor({
                    name: message.author.displayName + ` [${perms}]`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setDescription(message.content?.length > 0 ? message.content : null)
                .setColor('Red')
                .setFooter({
                    text: 'Made By QwertyAviator',
                    iconURL: 'https://cdn.discordapp.com/attachments/1158826031877214209/1197803492195172403/R1q.jfif.png?ex=65c5d2ee&is=65b35dee&hm=2d1e48aabab91324b9214b8511293fcde3f19c30f19cff7ef68dd0fdb86e3478&'
                });

            if (message.attachments?.size) {
                const imageAttachment = message.attachments.find(attachment => attachment.contentType.startsWith('image/'));

                if (imageAttachment) {
                    embed.setImage(imageAttachment.proxyURL);
                } else {
                    message.attachments.forEach(attachment => {
                        user.send({ files: [attachment] });
                    });
                };
            };

            await user.send({
                embeds: [
                    embed
                ]
            }).catch(async () => {
                await message.reply({
                    content: 'The user has their DMs closed, or they blocked me!'
                });
            });

            await message.react('<:airberlintick:1198650751803719763>').catch(null);
        } else {
            const bannedCheckr = (await db.select('bans', { userId: message.author.id }))[0];

            if (bannedCheckr) {
                await message.reply({
                    content: '> **Dear Passenger**, You are currently banned for using our Support system.\n\n**Reason**: ' + bannedCheckr?.reason || 'No reason was provided.'
                });

                return;
            };

            const data = (await db.select('mails', { authorId: message.author.id }))[0];

            const channel = guild.channels.cache.find((channel) => channel.id === data?.channelId);

            if (!channel) {
                if (set.has(message.author.id)) {
                    await message.reply({
                        content: '> **Dear Passenger**, There is a currently request waiting for your response, please wait until it expires or choose one of the options.'
                    });

                    return;
                };

                const buttons = [
                    new ButtonBuilder()
                        .setCustomId('create')
                        .setEmoji('<:airberlintick:1198650751803719763>')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('cancel')
                        .setEmoji('<:airberlincross:1198650754462916679>')
                        .setStyle(ButtonStyle.Secondary)
                ];

                set.add(message.author.id);

                const sent = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`${guild.name} - Support`)
                            .setDescription('> **Dear Passenger,**\n\nThank you for contacting us, From here onwards you will be contacting our support team for any inquires or problems your facing, Would You like to create a ticket?')
                            .setFooter({
                                text: 'AirBerlin Terminal Support',
                                iconURL: 'https://cdn.discordapp.com/attachments/1158826031877214209/1197803492195172403/R1q.jfif.png?ex=65c5d2ee&is=65b35dee&hm=2d1e48aabab91324b9214b8511293fcde3f19c30f19cff7ef68dd0fdb86e3478&'
                            })
                            .setColor('Red')
                    ],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                buttons
                            )
                    ]
                });

                const collector = message.channel.createMessageComponentCollector({
                    time: 15000,
                    filter: (i) => i.user.id === message.author.id
                });

                collector.on('collect', async (i) => {
                    collector.stop();

                    set.delete(message.author.id);

                    switch (i.customId) {
                        case 'create': {
                            const permissions = [
                                {
                                    id: guild.roles.everyone.id,
                                    deny: ['ViewChannel']
                                }
                            ];

                            for (const role of config.modmail.staffRoles) {
                                const fetched = guild.roles.cache.get(role);

                                if (fetched) permissions.push({
                                    id: role,
                                    allow: ['ViewChannel', 'SendMessages', 'AttachFiles']
                                });
                            };

                            const newchannel = await guild.channels.create({
                                name: message.author.displayName,
                                nsfw: false,
                                type: 0,
                                parent: category.id,
                                permissionOverwrites: permissions
                            });

                            await db.insert('mails', {
                                authorId: message.author.id,
                                channelId: newchannel.id,
                                guildId: guild.id,
                            });

                            await sent.edit({
                                content: null,
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle(`> <:support:1199348027907911830> ${guild.name} - Support Communication System`)
                                        .setDescription('**Dear Passenger,**\n\n Your ticket has been successfully created, If your **preferred language** is not listed in the following options, it means its currently unsupported by our support team, we might soon add more. We recommend using an online translator for assistance:\u200B\n\n**🇬🇧 English | 🇩🇪 Deutsch | 🇫🇷 Français**\n\nPlease be aware that this ticket will come with a transcript file of each staff member`s message, time, date and more when the ticket will be closed.\n\nKindly describe your issue/inquiry clearly, and please include screenshots to report a staff member for his behavior.\n\n **Best wishes,**\n\n**> AirBerlin Support Team**\n')
                                        .setFooter({
                                            text: 'Made By QwertyAviator',
                                            iconURL: 'https://cdn.discordapp.com/attachments/1158826031877214209/1197803492195172403/R1q.jfif.png?ex=65c5d2ee&is=65b35dee&hm=2d1e48aabab91324b9214b8511293fcde3f19c30f19cff7ef68dd0fdb86e3478&'
                                        })
                                        .setColor('Red')
                                ],
                                components: []
                            });

                            await i.reply({
                                content: '<:airberlintick:1198650751803719763> Your ticket has been successfully created! <:airberlintick:1198650751803719763>',
                                ephemeral: true
                            });

                            const embed = new EmbedBuilder()
                                .setTitle(`New Ticket`)
                                .addFields(
                                    {
                                        name: `Author`,
                                        value: `${message.author.displayName} (\`${message.author.id}\`)`
                                    },
                                    {
                                        name: `Message`,
                                        value: `${message.content?.length > 0 ? message.content : '(None)'}`
                                    }
                                )
                                .setColor('Red');

                            if (message.attachments?.size) {
                                const imageAttachment = message.attachments.find(attachment => attachment.contentType.startsWith('image/'));
                                if (imageAttachment) {
                                    embed.setImage(imageAttachment.proxyURL);
                                } else {
                                    message.attachments.forEach(attachment => {
                                        newchannel.send({ files: [attachment] });
                                    });
                                };
                            };

                            await newchannel.send({
                                content: config.modmail.mentionStaffRolesOnNewMail ? config.modmail.staffRoles.map((v) => roleMention(v)).join(', ') : null,
                                embeds: [
                                    embed
                                ],
                                components: [
                                    new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setCustomId('Close')
                                                .setLabel('Close Ticket')
                                                .setStyle(ButtonStyle.Primary)
                                        )
                                ]
                            }).then(async (sent) => await sent.pin());
                            
                            if (webhookClient === null) return;

                            await webhookClient.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle('New Ticket created')
                                        .setDescription(`<@${message.author.id || '000000000000000000'}>'s mail has been created.\n\n**Executed by**: ${message.author.displayName} (${message.author.toString()})\n**Date**: ${time(Date.now(), 'f')} (${time(Date.now(), 'R')})`)
                                        .setFooter({ text: guild.name + '\'s Safety Logging system' })
                                        .setColor('Green')
                                ]
                            });

                            break;
                        };

                        case 'cancel': {
                            await i.reply({
                                content: '<:airberlincross:1198650754462916679> The request has been cancelled. <:airberlincross:1198650754462916679>',
                                ephemeral: true
                            });

                            await sent.edit({
                                components: [
                                    new ActionRowBuilder()
                                        .addComponents(
                                            buttons.map((v) =>
                                                v.setStyle(ButtonStyle.Secondary)
                                                    .setDisabled(true)
                                            )
                                        )
                                ]
                            });

                            break;
                        };
                    };
                });

                collector.on('end', async () => {
                    if (collector.endReason === 'time') {
                        set.delete(message.author.id);

                        await sent.edit({
                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        buttons.map((v) =>
                                            v.setStyle(ButtonStyle.Secondary)
                                                .setDisabled(true)
                                        )
                                    )
                            ]
                        });
                    };
                });

            } else {
                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: message.author.displayName,
                        iconURL: message.author.displayAvatarURL()
                    })
                    .setDescription(message.content?.length > 0 ? message.content : null)
                    .setColor('Red')
                    .setFooter({
                        text: 'Made By QwertyAviator',
                        iconURL: 'https://cdn.discordapp.com/attachments/1158826031877214209/1197803492195172403/R1q.jfif.png?ex=65c5d2ee&is=65b35dee&hm=2d1e48aabab91324b9214b8511293fcde3f19c30f19cff7ef68dd0fdb86e3478&'
                    });

                if (message.attachments?.size) {
                    const imageAttachment = message.attachments.find(attachment => attachment.contentType.startsWith('image/'));
                    if (imageAttachment) {
                        embed.setImage(imageAttachment.proxyURL);
                    } else {
                        message.attachments.forEach(attachment => {
                            channel.send({ files: [attachment] });
                        });
                    }
                }

                await channel.send({
                    embeds: [
                        embed
                    ]
                }).catch(null);

                await message.react('<:airberlintick:1198650751803719763>');
            };
        };

    }
});