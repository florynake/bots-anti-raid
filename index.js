const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const config = require('./config.json');
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

const spamMap = new Map();

client.once('ready', async () => {
    console.log('Bot is ready!');
    await deployCommands();
});

// Message handler for anti-spam and anti-link
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    // Anti-link system
    if (message.content.includes('http') || message.content.includes('www')) {
        if (message.channel.id !== config.permissionChLink) {
            await message.delete();
            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`**User:** ${message.author}\n**Sent Link:** ${message.content}\n**Response:** Delete Messages`);
            
            const logChannel = message.guild.channels.cache.get(config.logs);
            await logChannel.send({ embeds: [embed] });
        }
    }

    // Anti-spam system
    if (!spamMap.has(message.author.id)) {
        spamMap.set(message.author.id, { messages: 1, timer: Date.now() });
    } else {
        const userData = spamMap.get(message.author.id);
        userData.messages++;

        if (userData.messages === 3 && Date.now() - userData.timer <= 5000) {
            const messages = await message.channel.messages.fetch({ 
                limit: 3,
                before: message.id 
            });
            
            await message.channel.bulkDelete(messages);
            await message.member.timeout(3600000, 'Spam detection');

            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setDescription(`**User:** ${message.author}\n**Timeout:** 1 hour\n**Response:** Delete Messages`);

            const logChannel = message.guild.channels.cache.get(config.logs);
            await logChannel.send({ embeds: [embed] });
            
            spamMap.delete(message.author.id);
        } else if (Date.now() - userData.timer >= 5000) {
            userData.messages = 1;
            userData.timer = Date.now();
        }
    }
});

// Command handlers
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const hasPermission = interaction.member.roles.cache.has(config.ownerRoleId);
    
    if (!hasPermission) {
        return await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    if (interaction.commandName === 'ban') {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        await interaction.guild.members.ban(user, { reason });

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`**Admin:** ${interaction.user}\n**Ban - Reason:** ${reason}\n**User:** ${user.tag}`);

        const logChannel = interaction.guild.channels.cache.get(config.logs);
        await logChannel.send({ embeds: [embed] });
        
        await interaction.reply({ content: `Successfully banned ${user.tag}`, ephemeral: true });
    }

    if (interaction.commandName === 'mute') {
        const user = interaction.options.getUser('user');
        const time = interaction.options.getString('time');
        const member = await interaction.guild.members.fetch(user.id);

        let duration;
        switch(time) {
            case '1min': duration = 60000; break;
            case '1hour': duration = 3600000; break;
            case '1day': duration = 86400000; break;
            case '1week': duration = 604800000; break;
        }

        await member.timeout(duration);

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`**Admin:** ${interaction.user}\n**Mute Duration:** ${time}\n**User:** ${user.tag}`);

        const logChannel = interaction.guild.channels.cache.get(config.logs);
        await logChannel.send({ embeds: [embed] });
        
        await interaction.reply({ content: `Successfully muted ${user.tag} for ${time}`, ephemeral: true });
    }
});

async function deployCommands() {
    const commands = [
        {
            name: 'ban',
            description: 'Ban a user',
            options: [
                {
                    name: 'user',
                    type: 6,
                    description: 'The user to ban',
                    required: true
                },
                {
                    name: 'reason',
                    type: 3,
                    description: 'Reason for ban',
                    required: true
                }
            ]
        },
        {
            name: 'mute',
            description: 'Mute a user',
            options: [
                {
                    name: 'user',
                    type: 6,
                    description: 'The user to mute',
                    required: true
                },
                {
                    name: 'time',
                    type: 3,
                    description: 'Mute duration',
                    required: true,
                    choices: [
                        { name: '1 Minute', value: '1min' },
                        { name: '1 Hour', value: '1hour' },
                        { name: '1 Day', value: '1day' },
                        { name: '1 Week', value: '1week' }
                    ]
                }
            ]
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('Commands deployed successfully!');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}

client.login(config.token);
