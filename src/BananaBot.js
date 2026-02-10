/**
 * 🍌 BananaMoney Lite - Core Bot
 */

import mineflayer from 'mineflayer';
import readline from 'readline';
import Logger from './utils/logger.js';
import { AliasManager } from './utils/AliasManager.js';
import { BoneCollector } from './modules/BoneCollector.js';
import { GuiManager } from './modules/GuiManager.js';
import { DiscordBridge } from './modules/DiscordBridge.js';
import { TpKiller } from './modules/TpKiller.js';
import { MineAndSell } from './modules/MineAndSell.js';
import { ProfileManager } from './utils/ProfileManager.js';
import { ScriptManager } from './utils/ScriptManager.js';
import { loader as autoEat } from 'mineflayer-auto-eat';
import Vec3 from 'vec3';

export class BananaBot {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.boneCollector = null;
        this.mineAndSell = null;
        this.guiManager = null;
        this.aliasManager = null;
        this.scriptManager = null;
        this.discordBridge = null;
        this.tpKiller = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '🍌 > '
        });

        // Connect logger to readline for clean output
        Logger.setReadline(this.rl);
    }

    /**
     * Initialize the bot
     */
    async init() {
        Logger.showBanner();
        this.connect();
        this.setupConsole();
        await this.initDiscord();
        this.rl.prompt();
    }

    /**
     * Initialize Discord bridge
     */
    async initDiscord() {
        if (this.config.discord?.enabled) {
            this.discordBridge = new DiscordBridge(
                this.config,
                (cmd) => this.handleDiscordCommand(cmd)
            );

            // Connect Logger to Discord
            Logger.setLogCallback((msg) => {
                if (this.discordBridge) {
                    this.discordBridge.queueLog(msg);
                }
            });

            await this.discordBridge.init();
        }
    }

    /**
     * Handle command from Discord
     */
    async handleDiscordCommand(input) {
        // Special 'chat' command for sending messages
        if (input.startsWith('chat ')) {
            const message = input.slice(5);
            if (this.bot && this.bot.entity) {
                this.bot.chat(message);
                Logger.log(`[DISCORD] ${message}`, 'CHAT');
            }
            return;
        }

        // Regular command
        await this.handleCommand(input);
    }

    /**
     * Connect to Minecraft server
     */
    connect() {
        Logger.system(`Connecting to ${this.config.host} as ${this.config.username}...`);

        this.bot = mineflayer.createBot({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            version: this.config.version,
            auth: this.config.auth,
            hideErrors: true,
            physicsEnabled: true
        });

        this.setupEvents();
        this.bot.loadPlugin(autoEat);
        this.initModules();
    }

    /**
     * Initialize modules
     */
    initModules() {
        this.boneCollector = new BoneCollector(this.bot, this.config);
        this.guiManager = new GuiManager(this.bot);
        this.profileManager = new ProfileManager();
        this.aliasManager = new AliasManager(this.config);
        this.tpKiller = new TpKiller(this.bot, this.config);
        this.mineAndSell = new MineAndSell(this.bot, this.config);
        this.scriptManager = new ScriptManager(
            this.bot,
            this.config,
            (cmd) => this.handleCommand(cmd)
        );

        this.bot.once('spawn', () => {
            this.boneCollector.init();
            this.mineAndSell.init();
            this.scriptManager.init();
        });
    }



    /**
     * Setup auto-eat events
     */
    setupAutoEat() {
        this.bot.autoEat.options = {
            priority: 'foodPoints',
            minHunger: 14,
            bannedFood: []
        };

        this.bot.autoEat.on('eatStart', (opts) => {
            Logger.info(`Auto-eating ${opts.food ? opts.food.name : 'unknown'}...`);
        });

        this.bot.autoEat.on('eatFinish', () => {
            Logger.info('Finished eating.');
        });

        Logger.system('Auto-eat module initialized.');
    }

    /**
     * Setup bot events
     */
    setupEvents() {
        // Catch unhandled errors from mineflayer internals (like the passengers bug)
        this.bot._client.on('error', (err) => {
            Logger.error(`Protocol error (ignored): ${err.message}`);
        });

        // Catch uncaught exceptions to prevent crash
        process.on('uncaughtException', (err) => {
            // Ignore the known mineflayer passengers bug
            if (err.message?.includes('passengers') || err.message?.includes('Cannot read properties of undefined')) {
                Logger.error(`Mineflayer bug caught (ignored): ${err.message}`);
                return;
            }
            Logger.error(`Uncaught Exception: ${err.message}`);
            console.error(err.stack);
        });

        // Catch unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            Logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
            // Do not exit
        });

        this.bot.on('spawn', () => {
            Logger.system('Bot successfully spawned! 🍌');
            Logger.system('Use !help for commands');
            this.setupAutoEat();
        });

        this.bot.on('messagestr', (message, position, jsonMsg) => {
            if (position === 'game_info') return;
            Logger.log(message, 'CHAT');
        });

        this.bot.on('windowOpen', (window) => {
            Logger.system(`Window opened: ${window.title || window.type}`);
        });

        this.bot.on('error', (err) => {
            Logger.error(`Error: ${err.message}`);
        });

        this.bot.on('kicked', (reason) => {
            let msg = reason;
            try {
                const json = JSON.parse(reason);
                msg = json.text || json.translate || json.extra?.[0]?.text || reason;
            } catch (e) {
                if (typeof reason === 'object') {
                    msg = reason.text || reason.translate || JSON.stringify(reason);
                }
            }
            Logger.error(`Kicked: ${msg}`);
        });

        this.bot.on('end', () => {
            Logger.error('Disconnected. Reconnecting in 5s...');
            if (this.config.autoReconnect) {
                setTimeout(() => this.connect(), this.config.reconnectDelay);
            }
        });
    }

    /**
     * Setup console input
     */
    setupConsole() {
        this.rl.on('line', (input) => {
            let raw = input.trim();

            if (!raw) {
                this.rl.prompt();
                return;
            }

            // Resolve aliases
            if (this.aliasManager) {
                raw = this.aliasManager.resolve(raw);
            }

            // Check for command prefix
            if (raw.startsWith('!')) {
                this.handleCommand(raw.slice(1)).catch(err => Logger.error(`Command error: ${err.message}`));
            } else {
                // Regular chat
                if (this.bot && this.bot.entity) {
                    this.bot.chat(raw);
                    Logger.log(`[YOU] ${raw}`, 'CHAT');
                } else {
                    Logger.error('Bot not connected.');
                }
            }

            this.rl.prompt();
        });
    }

    /**
     * Handle console commands
     */
    async handleCommand(input) {
        const args = input.toLowerCase().split(' ');
        const cmd = args[0];

        switch (cmd) {
            case 'help':
                Logger.system('=== Commands ===');
                Logger.info('!bones on/off   - Toggle bone collector');
                Logger.info('!gui            - Show current window');
                Logger.info('!click <slot>   - Click window slot');
                Logger.info('!shift <slot>   - Shift-click slot');
                Logger.info('!close          - Close window');
                Logger.info('!spawner x y z  - Set spawner position');
                Logger.info('!chest x y z    - Set chest position');
                Logger.info('!eat            - Force eat now');
                Logger.info('!autoeat on/off - Toggle auto-eat');
                Logger.info('!stats          - Show bot stats');
                Logger.info('!drop <all/held> - Drop items');
                Logger.info('!look <x> <y> <z> or <player> - Look at target');
                Logger.info('');
                Logger.system('=== Mine & Sell Commands ===');
                Logger.info('!mine <block>       - Start mining (e.g., !mine diamond_ore)');
                Logger.info('!mine off           - Stop mining');
                Logger.info('!mine status        - Show mining stats');
                Logger.info('!mine radius <n>    - Set search radius (default: 64)');
                Logger.info('');
                Logger.system('=== TP Kill Commands ===');
                Logger.info('!tpkill main <player>   - Killer: accept TPA & kill with best sword');
                Logger.info('!tpkill send <player>   - Sender: send /tpa every 5 seconds');
                Logger.info('!tpkill off             - Stop TP kill system');
                Logger.info('!tpkill status          - Show current status');
                Logger.info('');
                Logger.system('=== Script Commands ===');
                Logger.info('!script list              - List all scripts');
                Logger.info('!script enable <id>       - Enable script');
                Logger.info('!script disable <id>      - Disable script');
                Logger.info('!script delete <id>       - Delete script');
                Logger.info('!script reload            - Reload scripts from disk');
                Logger.info('!repeat <sec> <cmd>       - Create interval script');
                Logger.info('!trigger add <pat> <act>  - Add message trigger');
                Logger.info('!trigger list             - List all triggers');
                Logger.info('!trigger delete <id>      - Delete trigger');
                Logger.info('');
                Logger.system('=== Alias Commands ===');
                Logger.info('!alias add <short> <cmd>  - Create alias');
                Logger.info('!alias list               - List all aliases');
                Logger.info('!alias delete <short>     - Delete alias');
                Logger.info('');
                Logger.info('(No prefix)     - Send chat message');
                break;

            case 'alias':
                if (!this.aliasManager) {
                    Logger.error('Alias manager not initialized.');
                    break;
                }
                const aliasAction = args[1];

                if (!aliasAction || aliasAction === 'list') {
                    const aliases = this.aliasManager.list();
                    if (aliases.length === 0) {
                        Logger.info('No aliases configured.');
                    } else {
                        Logger.system('=== Aliases ===');
                        aliases.forEach(a => {
                            Logger.info(`${a.shortcut} → ${a.command}`);
                        });
                    }
                } else if (aliasAction === 'add') {
                    const fullInput = input.split(' ');
                    if (fullInput.length < 4) {
                        Logger.error('Usage: !alias add <shortcut> <command>');
                        break;
                    }
                    const shortcut = fullInput[2];
                    const command = fullInput.slice(3).join(' ');
                    this.aliasManager.add(shortcut, command);
                } else if (aliasAction === 'delete' || aliasAction === 'remove') {
                    const shortcut = args[2];
                    if (!shortcut) {
                        Logger.error('Usage: !alias delete <shortcut>');
                    } else if (this.aliasManager.remove(shortcut)) {
                        // Success message already logged by remove()
                    } else {
                        Logger.error(`Alias "${shortcut}" not found.`);
                    }
                } else if (aliasAction === 'reload') {
                    this.aliasManager.reload();
                } else {
                    Logger.error('Usage: !alias <list|add|delete|reload> [args]');
                }
                break;

            case 'bones':
                if (args[1] === 'on') {
                    if (this.boneCollector) this.boneCollector.start();
                } else if (args[1] === 'off') {
                    if (this.boneCollector) this.boneCollector.stop();
                } else {
                    Logger.error('Usage: !bones on/off');
                }
                break;

            case 'gui':
            case 'window':
                if (this.guiManager) this.guiManager.showWindow();
                break;

            case 'click':
                if (args[1] && this.guiManager) {
                    this.guiManager.clickSlot(args[1]);
                } else {
                    Logger.error('Usage: !click <slot>');
                }
                break;

            case 'shift':
                if (args[1] && this.guiManager) {
                    this.guiManager.shiftClick(args[1]);
                } else {
                    Logger.error('Usage: !shift <slot>');
                }
                break;

            case 'close':
                if (this.guiManager) this.guiManager.closeWindow();
                break;

            case 'spawner':
                if (args.length === 4) {
                    const x = parseInt(args[1]);
                    const y = parseInt(args[2]);
                    const z = parseInt(args[3]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        this.config.boneCollector.spawnerPos = { x, y, z };
                        import('./utils/config.js').then(({ saveConfig }) => {
                            if (saveConfig(this.config)) {
                                Logger.system(`Spawner position updated to ${x}, ${y}, ${z}`);
                            } else {
                                Logger.error('Failed to save config');
                            }
                        });
                        // Update runtime module if active
                        if (this.boneCollector) this.boneCollector.config.spawnerPos = { x, y, z };
                    } else {
                        Logger.error('Invalid coordinates. Usage: !spawner <x> <y> <z>');
                    }
                } else {
                    Logger.error('Usage: !spawner <x> <y> <z>');
                }
                break;

            case 'chest':
                if (args.length === 4) {
                    const x = parseInt(args[1]);
                    const y = parseInt(args[2]);
                    const z = parseInt(args[3]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        this.config.boneCollector.chestPos = { x, y, z };
                        import('./utils/config.js').then(({ saveConfig }) => {
                            if (saveConfig(this.config)) {
                                Logger.system(`Chest position updated to ${x}, ${y}, ${z}`);
                            } else {
                                Logger.error('Failed to save config');
                            }
                        });
                        // Update runtime module if active
                        if (this.boneCollector) this.boneCollector.config.chestPos = { x, y, z };
                    } else {
                        Logger.error('Invalid coordinates. Usage: !chest <x> <y> <z>');
                    }
                } else {
                    Logger.error('Usage: !chest <x> <y> <z>');
                }
                break;


            case 'repeat':
            case 'loop':
                if (args.length >= 3) {
                    const seconds = parseFloat(args[1]);
                    const fullInput = input.split(' ');
                    const commandToRun = fullInput.slice(2).join(' ');

                    if (!isNaN(seconds) && seconds > 0 && commandToRun) {
                        if (this.scriptManager) {
                            const id = this.scriptManager.addIntervalScript(seconds, commandToRun);
                            Logger.system(`Script "${id}" started: "${commandToRun}" every ${seconds}s`);
                        }
                    } else {
                        Logger.error('Invalid arguments. Usage: !repeat <seconds> <command>');
                    }
                } else {
                    Logger.error('Usage: !repeat <seconds> <command>');
                }
                break;

            case 'script':
            case 'scripts':
                if (!this.scriptManager) {
                    Logger.error('Script manager not initialized.');
                    break;
                }
                const scriptAction = args[1];
                const scriptId = args[2];

                if (!scriptAction || scriptAction === 'list') {
                    const scripts = this.scriptManager.listScripts();
                    if (scripts.length === 0) {
                        Logger.info('No scripts loaded.');
                    } else {
                        Logger.system('=== Scripts ===');
                        scripts.forEach(s => {
                            const status = s.enabled ? '✓' : '✗';
                            Logger.info(`[${status}] ${s.id} - ${s.name} (${s.type})`);
                        });
                    }
                } else if (scriptAction === 'enable') {
                    if (!scriptId) {
                        Logger.error('Usage: !script enable <id>');
                    } else if (this.scriptManager.enableScript(scriptId)) {
                        Logger.system(`Script "${scriptId}" enabled.`);
                    } else {
                        Logger.error(`Script "${scriptId}" not found.`);
                    }
                } else if (scriptAction === 'disable') {
                    if (!scriptId) {
                        Logger.error('Usage: !script disable <id>');
                    } else if (this.scriptManager.disableScript(scriptId)) {
                        Logger.system(`Script "${scriptId}" disabled.`);
                    } else {
                        Logger.error(`Script "${scriptId}" not found.`);
                    }
                } else if (scriptAction === 'delete') {
                    if (!scriptId) {
                        Logger.error('Usage: !script delete <id>');
                    } else if (this.scriptManager.deleteScript(scriptId)) {
                        Logger.system(`Script "${scriptId}" deleted.`);
                    } else {
                        Logger.error(`Script "${scriptId}" not found.`);
                    }
                } else if (scriptAction === 'reload') {
                    this.scriptManager.reload();
                } else {
                    Logger.error('Usage: !script <list|enable|disable|delete|reload> [id]');
                }
                break;

            case 'trigger':
                if (!this.scriptManager) {
                    Logger.error('Script manager not initialized.');
                    break;
                }
                const triggerAction = args[1];

                if (!triggerAction || triggerAction === 'list') {
                    const scripts = this.scriptManager.listScripts().filter(s => s.type === 'message-trigger');
                    if (scripts.length === 0) {
                        Logger.info('No triggers configured.');
                    } else {
                        Logger.system('=== Message Triggers ===');
                        scripts.forEach(s => {
                            const status = s.enabled ? '✓' : '✗';
                            Logger.info(`[${status}] ${s.id} - ${s.name}`);
                        });
                    }
                } else if (triggerAction === 'add') {
                    // !trigger add "pattern" action to take
                    const fullInput = input.split(' ');
                    if (fullInput.length < 4) {
                        Logger.error('Usage: !trigger add <pattern> <action>');
                        break;
                    }
                    const pattern = fullInput[2];
                    const action = fullInput.slice(3).join(' ');
                    const id = this.scriptManager.addQuickTrigger(pattern, action);
                    Logger.system(`Trigger "${id}" created: "${pattern}" → "${action}"`);
                } else if (triggerAction === 'delete') {
                    const triggerId = args[2];
                    if (!triggerId) {
                        Logger.error('Usage: !trigger delete <id>');
                    } else if (this.scriptManager.deleteScript(triggerId)) {
                        Logger.system(`Trigger "${triggerId}" deleted.`);
                    } else {
                        Logger.error(`Trigger "${triggerId}" not found.`);
                    }
                } else {
                    Logger.error('Usage: !trigger <list|add|delete> [args]');
                }
                break;

            case 'list':
                // Backward compatibility - redirect to !script list
                if (this.scriptManager) {
                    const scripts = this.scriptManager.listScripts();
                    if (scripts.length === 0) {
                        Logger.info('No scripts loaded.');
                    } else {
                        Logger.system('=== Scripts ===');
                        scripts.forEach(s => {
                            const status = s.enabled ? '✓' : '✗';
                            Logger.info(`[${status}] ${s.id} - ${s.name} (${s.type})`);
                        });
                    }
                }
                break;

            case 'stop':
            case 'unloop':
                // Backward compatibility - redirect to !script disable
                if (args[1] && this.scriptManager) {
                    const id = args[1];
                    if (this.scriptManager.disableScript(id)) {
                        Logger.system(`Script "${id}" disabled.`);
                    } else {
                        Logger.error(`Script "${id}" not found.`);
                    }
                } else {
                    Logger.error('Usage: !stop <id>');
                }

                break;

            case 'eat':
                if (this.bot && this.bot.autoEat) {
                    Logger.info('Forcing eat...');
                    this.bot.autoEat.eat().catch(err => {
                        Logger.error(`Could not eat: ${err.message}`);
                    });
                }
                break;

            case 'autoeat':
                if (args[1] === 'on') {
                    this.bot.autoEat.enableAuto();
                    Logger.system('Auto-eat ENABLED');
                } else if (args[1] === 'off') {
                    this.bot.autoEat.disableAuto();
                    Logger.system('Auto-eat DISABLED');
                } else {
                    Logger.error('Usage: !autoeat on/off');
                }
                break;

            case 'stats':
                if (this.bot) {
                    const health = Math.round(this.bot.health);
                    const food = Math.round(this.bot.food);
                    const saturation = Math.round(this.bot.foodSaturation);
                    const level = this.bot.experience?.level || 0;
                    const items = this.bot.inventory.items().length;
                    const armor = this.bot.inventory.slots.slice(5, 9).filter(i => i).length;

                    Logger.system('=== Bot Stats ===');
                    Logger.info(`Health: ${health}/20 | Food: ${food}/20 | Sat: ${saturation}`);
                    Logger.info(`Level: ${level} | Armor: ${armor} pcs`);
                    Logger.info(`Inventory: ${items} items`);
                    Logger.info(`Pos: ${this.bot.entity.position.floored()}`);
                }
                break;

            case 'drop':
                if (!this.bot) return;
                const dropMode = args[1] || 'all';
                Logger.system(`Dropping ${dropMode} items...`);

                try {
                    const items = this.bot.inventory.items();
                    if (dropMode === 'held') {
                        const held = this.bot.inventory.slots[this.bot.getEquipmentDestSlot('hand')];
                        if (held) await this.bot.tossStack(held);
                    } else if (dropMode === 'all') {
                        // Drop everything
                        for (const item of items) {
                            await this.bot.tossStack(item);
                            await new Promise(r => setTimeout(r, 200));
                        }
                    } else {
                        // Try to find item by name
                        const item = items.find(i => i.name.includes(dropMode));
                        if (item) await this.bot.tossStack(item);
                        else Logger.error('Item not found.');
                    }
                    Logger.system('Done dropping.');
                } catch (e) {
                    Logger.error(`Drop failed: ${e.message}`);
                }
                break;

            case 'look':
                if (!this.bot) return;
                if (args.length === 2) {
                    // Look at player
                    const player = this.bot.players[args[1]];
                    if (player && player.entity) {
                        this.bot.lookAt(player.entity.position.offset(0, 1.6, 0));
                        Logger.system(`Looking at ${args[1]}`);
                    } else {
                        Logger.error('Player not found or not visible.');
                    }
                } else if (args.length === 4) {
                    const x = parseFloat(args[1]);
                    const y = parseFloat(args[2]);
                    const z = parseFloat(args[3]);
                    this.bot.lookAt(new Vec3(x, y, z));
                    Logger.system(`Looking at ${x}, ${y}, ${z}`);
                } else {
                    Logger.error('Usage: !look <player> OR !look <x> <y> <z>');
                }
                break;


                break;

            case 'profile':
                if (!this.profileManager) return;
                const pAction = args[1];
                const pName = args[2];

                if (pAction === 'list') {
                    const profiles = this.profileManager.listProfiles();
                    Logger.system('=== Profiles ===');
                    profiles.forEach(p => Logger.info(`- ${p}`));
                } else if (pAction === 'save') {
                    if (!pName) {
                        Logger.error('Usage: !profile save <name>');
                        return;
                    }
                    const data = {
                        config: {
                            spawnerPos: this.config.boneCollector?.spawnerPos,
                            chestPos: this.config.boneCollector?.chestPos,
                            collectSlot: this.config.boneCollector?.collectSlot
                        }
                    };
                    this.profileManager.saveProfile(pName, data);
                    Logger.system(`Saved profile "${pName}"`);
                } else if (pAction === 'load') {
                    if (!pName) {
                        Logger.error('Usage: !profile load <name>');
                        return;
                    }
                    const profile = this.profileManager.getProfile(pName);
                    if (profile && profile.config) {
                        this.config.boneCollector = { ...this.config.boneCollector, ...profile.config };
                        if (this.boneCollector) {
                            this.boneCollector.config = this.config.boneCollector;
                        }
                        Logger.system(`Loaded profile "${pName}"`);
                        Logger.info(`Spawner: ${this.config.boneCollector.spawnerPos?.x},${this.config.boneCollector.spawnerPos?.y},${this.config.boneCollector.spawnerPos?.z}`);
                        Logger.info(`Chest: ${this.config.boneCollector.chestPos?.x},${this.config.boneCollector.chestPos?.y},${this.config.boneCollector.chestPos?.z}`);
                    } else {
                        Logger.error(`Profile "${pName}" not found or invalid.`);
                    }
                } else if (pAction === 'delete') {
                    if (!pName) {
                        Logger.error('Usage: !profile delete <name>');
                        return;
                    }
                    if (this.profileManager.deleteProfile(pName)) {
                        Logger.system(`Deleted profile "${pName}"`);
                    } else {
                        Logger.error('Profile not found.');
                    }
                } else {
                    Logger.error('Usage: !profile <list|save|load|delete> [name]');
                }
                break;

            case 'tpkill':
                if (!this.tpKiller) {
                    Logger.error('TP Kill module not initialized.');
                    break;
                }
                const tpAction = args[1];
                const tpTarget = input.split(' ')[2]; // Use original case for player name

                if (tpAction === 'main') {
                    if (!tpTarget) {
                        Logger.error('Usage: !tpkill main <playerName>');
                        break;
                    }
                    this.tpKiller.startMain(tpTarget);
                } else if (tpAction === 'send') {
                    if (!tpTarget) {
                        Logger.error('Usage: !tpkill send <mainBotName>');
                        break;
                    }
                    this.tpKiller.startSend(tpTarget);
                } else if (tpAction === 'off' || tpAction === 'stop') {
                    this.tpKiller.stop();
                } else if (tpAction === 'status') {
                    Logger.system(this.tpKiller.getStatus());
                } else {
                    Logger.error('Usage: !tpkill <main|send|off|status> [playerName]');
                    Logger.info('  !tpkill main <player> - Killer mode: accept TPA & kill');
                    Logger.info('  !tpkill send <player> - Sender mode: send /tpa every 5s');
                    Logger.info('  !tpkill off           - Stop TP kill system');
                    Logger.info('  !tpkill status        - Show current status');
                }
                break;

            case 'mine':
                if (!this.mineAndSell) {
                    Logger.error('MineAndSell module not initialized.');
                    break;
                }
                const mineAction = args[1];

                if (!mineAction) {
                    Logger.error('Usage: !mine <block> | !mine off | !mine status | !mine radius <n>');
                } else if (mineAction === 'off' || mineAction === 'stop') {
                    this.mineAndSell.stop();
                } else if (mineAction === 'status') {
                    this.mineAndSell.showStatus();
                } else if (mineAction === 'radius') {
                    const radius = parseInt(args[2]);
                    if (!isNaN(radius) && radius > 0 && radius <= 256) {
                        this.mineAndSell.searchRadius = radius;
                        Logger.system(`Search radius set to ${radius} blocks`);
                    } else {
                        Logger.error('Usage: !mine radius <1-256>');
                    }
                } else {
                    // Block name - could be multi-word
                    const fullInput = input.split(' ');
                    const blockName = fullInput.slice(1).join('_');
                    this.mineAndSell.start(blockName);
                }
                break;

            default:
                Logger.error(`Unknown command: ${cmd}. Type !help`);
        }
    }
}
