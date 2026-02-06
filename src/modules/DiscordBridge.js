/**
 * 🍌 BananaMoney Lite - Discord Bridge
 * Mirrors terminal to Discord channel
 */

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import Logger from '../utils/logger.js';

export class DiscordBridge {
    constructor(config, commandHandler) {
        this.config = config;
        this.commandHandler = commandHandler;
        this.client = null;
        this.channel = null;
        this.messageQueue = [];
        this.flushInterval = null;
        this.isReady = false;
    }

    /**
     * Initialize Discord bot
     */
    async init() {
        if (!this.config.discord?.enabled || !this.config.discord?.token) {
            return false;
        }

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.setupEvents();

        try {
            await this.client.login(this.config.discord.token);
            return true;
        } catch (err) {
            Logger.error(`Discord login failed: ${err.message}`);
            return false;
        }
    }

    /**
     * Setup Discord events
     */
    setupEvents() {
        this.client.once('ready', async () => {
            Logger.system(`Discord bot connected as ${this.client.user.tag}`);

            // Get the channel
            if (this.config.discord.channelId) {
                try {
                    this.channel = await this.client.channels.fetch(this.config.discord.channelId);
                    if (this.channel) {
                        Logger.system(`Discord logging to #${this.channel.name}`);
                        this.sendToDiscord('```\n🍌 BananaMoney connected to Discord!\n```');
                    }
                } catch (err) {
                    Logger.error(`Failed to fetch Discord channel: ${err.message}`);
                }
            }

            this.isReady = true;

            // Start message queue flusher (batch messages to avoid rate limits)
            this.flushInterval = setInterval(() => this.flushQueue(), 1000);
        });

        this.client.on('messageCreate', async (message) => {
            // Ignore bot messages and messages from other channels
            if (message.author.bot) return;
            if (message.channel.id !== this.config.discord.channelId) return;

            const content = message.content.trim();
            if (!content) return;

            // Check for command prefix
            if (content.startsWith('!')) {
                try {
                    await this.commandHandler(content.slice(1));
                } catch (err) {
                    this.sendToDiscord(`\`\`\`\n❌ Error: ${err.message}\n\`\`\``);
                }
            } else {
                // Regular chat - send to Minecraft
                try {
                    await this.commandHandler(`chat ${content}`);
                } catch (err) {
                    // Ignore chat errors
                }
            }
        });

        this.client.on('error', (err) => {
            Logger.error(`Discord error: ${err.message}`);
        });
    }

    /**
     * Queue a log message for Discord
     */
    queueLog(message) {
        if (!this.isReady || !this.channel) return;

        // Strip ANSI codes
        const clean = message.replace(/\x1b\[[0-9;]*m/g, '');
        this.messageQueue.push(clean);
    }

    /**
     * Flush queued messages to Discord
     */
    async flushQueue() {
        if (!this.channel || this.messageQueue.length === 0) return;

        // Batch messages (max 1900 chars to stay under 2000 limit)
        let batch = '';
        const messages = [];

        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (batch.length + msg.length + 1 > 1900) {
                messages.push(batch);
                batch = msg;
            } else {
                batch += (batch ? '\n' : '') + msg;
            }
        }

        if (batch) messages.push(batch);

        // Send batched messages
        for (const content of messages) {
            try {
                await this.channel.send(`\`\`\`\n${content}\n\`\`\``);
            } catch (err) {
                // Rate limited or other error, re-queue
                if (err.code === 50035) {
                    // Message too long, split it
                    const lines = content.split('\n');
                    this.messageQueue.unshift(...lines);
                }
            }
        }
    }

    /**
     * Send immediate message to Discord
     */
    async sendToDiscord(message) {
        if (!this.channel) return;
        try {
            await this.channel.send(message);
        } catch (err) {
            // Ignore send errors
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        if (this.client) {
            this.client.destroy();
        }
    }
}
