/**
 * 🍌 BananaMoney - TP Kill System
 * Two modes:
 *   MAIN (killer) - Auto-accepts TPA requests, kills arriving player with best sword (1.9 PVP)
 *   SEND (sender) - Sends /tpa <target> every 5 seconds
 *
 * Commands:
 *   !tpkill main <playerName>  - Start killer mode, wait for <playerName> to TP
 *   !tpkill send <mainBotName> - Start sender mode, send /tpa to <mainBotName>
 *   !tpkill off                - Stop TP kill system
 *   !tpkill status             - Show current status
 */

import Logger from '../utils/logger.js';

// Sword tiers ordered best to worst for selection
const SWORD_TIERS = [
    'netherite_sword',
    'diamond_sword',
    'iron_sword',
    'stone_sword',
    'golden_sword',
    'wooden_sword'
];

// Common TPA chat patterns (works on most servers)
const TPA_PATTERNS = [
    /(\w+) has requested to teleport to you/i,
    /(\w+) wants to teleport to you/i,
    /teleport request from (\w+)/i,
    /(\w+) has sent you a teleport request/i,
    /(\w+) would like to teleport to you/i,
    /(\w+) is requesting to teleport to you/i
];

// TPA accept commands to try (different servers use different ones)
const TPA_ACCEPT_COMMANDS = '/tpaccept';

// Attack cooldown for 1.9 PVP (swords have 1.6 attack speed = 625ms cooldown)
const SWORD_COOLDOWN_MS = 625;

export class TpKiller {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config;

        // State
        this.mode = null;           // 'main' or 'send' or null
        this.targetPlayer = null;   // Player name to interact with
        this.running = false;

        // Sender interval
        this.sendInterval = null;

        // Main mode tracking
        this.attackInterval = null;
        this.isAttacking = false;

        // Bound listener reference for cleanup
        this._onMessage = null;
    }

    /**
     * Start killer mode (main bot)
     * Listens for TPA from targetPlayer, auto-accepts, then kills on arrival
     */
    startMain(playerName) {
        this.stop(); // Clean up any previous state

        this.mode = 'main';
        this.targetPlayer = playerName;
        this.running = true;

        Logger.system(`=== TP KILL: MAIN MODE ===`);
        Logger.system(`Waiting for TPA from "${playerName}"...`);
        Logger.system(`Will auto-accept and kill with best sword (1.9 PVP)`);

        // Equip best sword immediately
        this.equipBestSword();

        // Listen for chat messages
        this._onMessage = (message, position) => {
            if (position === 'game_info') return;
            this.handleMainMessage(message);
        };
        this.bot.on('messagestr', this._onMessage);

        // Start scanning for nearby target player to attack
        this.attackInterval = setInterval(() => {
            if (!this.running || this.mode !== 'main') return;
            this.tryAttackTarget();
        }, SWORD_COOLDOWN_MS);
    }

    /**
     * Start sender mode (now bot)
     * Sends /tpa <mainBotName> every 5 seconds
     */
    startSend(mainBotName) {
        this.stop(); // Clean up any previous state

        this.mode = 'send';
        this.targetPlayer = mainBotName;
        this.running = true;

        Logger.system(`=== TP KILL: SEND MODE ===`);
        Logger.system(`Sending /tpa to "${mainBotName}" every 5 seconds...`);

        // Send immediately
        this.sendTpa();

        // Then every 5 seconds
        this.sendInterval = setInterval(() => {
            if (!this.running) return;
            this.sendTpa();
        }, 5000);
    }

    /**
     * Stop the TP kill system
     */
    stop() {
        this.running = false;

        // Clear send interval
        if (this.sendInterval) {
            clearInterval(this.sendInterval);
            this.sendInterval = null;
        }

        // Clear attack interval
        if (this.attackInterval) {
            clearInterval(this.attackInterval);
            this.attackInterval = null;
        }

        // Remove message listener
        if (this._onMessage) {
            this.bot.removeListener('messagestr', this._onMessage);
            this._onMessage = null;
        }

        if (this.mode) {
            Logger.system('TP Kill system: STOPPED');
        }

        this.mode = null;
        this.targetPlayer = null;
        this.isAttacking = false;
    }

    /**
     * Handle chat messages in main mode
     * Detect TPA requests and auto-accept
     */
    handleMainMessage(message) {
        if (!this.running || this.mode !== 'main') return;

        const msgLower = message.toLowerCase();
        const targetLower = this.targetPlayer.toLowerCase();

        // Check if this is a TPA request from our target
        for (const pattern of TPA_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                const sender = match[1];
                if (sender.toLowerCase() === targetLower) {
                    Logger.system(`TPA detected from ${sender}! Accepting...`);
                    this.acceptTpa();
                    return;
                }
            }
        }

        // Fallback: check if message contains the player name AND common TPA keywords
        if (msgLower.includes(targetLower) &&
            (msgLower.includes('teleport') || msgLower.includes('tpa') || msgLower.includes('tp request'))) {
            Logger.system(`TPA-like message detected from ${this.targetPlayer}! Accepting...`);
            this.acceptTpa();
        }
    }

    /**
     * Accept a TPA request
     */
    acceptTpa() {
        if (!this.bot || !this.bot.entity) return;

        Logger.system(`Sending: ${TPA_ACCEPT_COMMANDS}`);
        this.bot.chat(TPA_ACCEPT_COMMANDS);

        // Also equip best sword in preparation
        this.equipBestSword();
    }

    /**
     * Send a TPA request (sender mode)
     */
    sendTpa() {
        if (!this.bot || !this.bot.entity) return;

        const cmd = `/tpa ${this.targetPlayer}`;
        Logger.info(`[TP Send] ${cmd}`);
        this.bot.chat(cmd);
    }

    /**
     * Find and equip the best sword in inventory
     * Priority: netherite > diamond > iron > stone > golden > wooden
     */
    equipBestSword() {
        if (!this.bot) return null;

        const items = this.bot.inventory.items();

        for (const tier of SWORD_TIERS) {
            const sword = items.find(item => item.name === tier);
            if (sword) {
                this.bot.equip(sword, 'hand').then(() => {
                    Logger.system(`Equipped: ${sword.displayName || sword.name}`);
                }).catch(() => {
                    // Already equipped or failed silently
                });
                return sword;
            }
        }

        // No sword found, check for any item with "sword" in name (modded swords etc)
        const anySword = items.find(item => item.name.includes('sword'));
        if (anySword) {
            this.bot.equip(anySword, 'hand').then(() => {
                Logger.system(`Equipped (modded): ${anySword.displayName || anySword.name}`);
            }).catch(() => {});
            return anySword;
        }

        Logger.error('No sword found in inventory!');
        return null;
    }

    /**
     * Try to attack the target player (1.9 PVP)
     * Called on interval matching sword cooldown
     */
    tryAttackTarget() {
        if (!this.bot || !this.bot.entity || !this.targetPlayer) return;

        const player = this.bot.players[this.targetPlayer];
        if (!player || !player.entity) return;

        const distance = this.bot.entity.position.distanceTo(player.entity.position);

        // Attack range ~3.5 blocks for swords
        if (distance <= 3.5) {
            if (!this.isAttacking) {
                this.isAttacking = true;
                Logger.system(`Target "${this.targetPlayer}" in range! Attacking...`);
                this.equipBestSword();
            }

            // Look at player head level and attack
            this.bot.lookAt(player.entity.position.offset(0, 1.6, 0), true).then(() => {
                this.bot.attack(player.entity);
            }).catch(() => {});
        } else if (this.isAttacking && distance > 6) {
            // Player moved out of range
            this.isAttacking = false;
            Logger.info(`Target "${this.targetPlayer}" out of range (${distance.toFixed(1)} blocks)`);
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        if (!this.mode) {
            return 'TP Kill: OFF';
        }

        if (this.mode === 'main') {
            return `TP Kill: MAIN mode | Target: ${this.targetPlayer} | ${this.isAttacking ? 'ATTACKING' : 'Waiting...'}`;
        }

        if (this.mode === 'send') {
            return `TP Kill: SEND mode | Sending /tpa to: ${this.targetPlayer}`;
        }

        return 'TP Kill: Unknown state';
    }
}
