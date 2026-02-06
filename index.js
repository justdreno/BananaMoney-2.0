/**
 * 🍌 BananaMoney Lite - Entry Point
 */

import './src/utils/polyfill.js'; // MUST be first
import { BananaBot } from './src/BananaBot.js';
import { readFileSync, writeFileSync } from 'fs';
import readline from 'readline';

// Load config
const config = JSON.parse(readFileSync('./config/config.json', 'utf-8'));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt helper with default value
 */
function prompt(question, defaultValue) {
  return new Promise((resolve) => {
    const defaultText = defaultValue ? ` (default: ${defaultValue})` : '';
    rl.question(`${question}${defaultText}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Interactive setup
 */
async function setup() {
  console.log('');
  console.log('🍌 BananaMoney Lite Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Username
  const username = await prompt('Enter username', config.username);
  if (username) config.username = username;

  // Server IP
  const host = await prompt('Enter server IP', config.host);
  if (host) config.host = host;

  // Discord bot
  console.log('');
  const discordChoice = await prompt('Enable Discord bot? (y/n)', config.discord?.enabled ? 'y' : 'n');
  const discordEnabled = discordChoice.toLowerCase() === 'y' || discordChoice.toLowerCase() === 'yes';

  if (!config.discord) {
    config.discord = { enabled: false, token: '', channelId: '' };
  }
  config.discord.enabled = discordEnabled;

  // Channel ID if Discord enabled
  if (discordEnabled) {
    // Token
    if (!config.discord.token) {
      const token = await prompt('Enter Discord bot token', '');
      if (token) config.discord.token = token;
    } else {
      console.log('  ✓ Discord token found in config');
    }

    // Channel ID
    const channelId = await prompt('Enter Discord channel ID', config.discord.channelId || '');
    if (channelId) config.discord.channelId = channelId;

    if (!config.discord.token) {
      console.log('  ⚠ No Discord token - bot will not connect');
      config.discord.enabled = false;
    }
  }

  console.log('');

  // Save updated config
  try {
    writeFileSync('./config/config.json', JSON.stringify(config, null, 4));
  } catch (err) {
    console.log('  ⚠ Could not save config');
  }

  rl.close();
  return config;
}

// Run setup then start bot
setup().then((finalConfig) => {
  const bot = new BananaBot(finalConfig);
  bot.init();
});

// Handle exit
process.on('SIGINT', () => {
  console.log('\n🍌 Exiting...');
  process.exit(0);
});