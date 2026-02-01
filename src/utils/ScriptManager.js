/**
 * 🍌 BananaMoney - Script Manager
 * Manages scripts: loading, saving, lifecycle, and execution
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Logger from './logger.js';
import { MessageTrigger } from './MessageTrigger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ScriptManager {
    /**
     * @param {Object} bot - Mineflayer bot instance
     * @param {Object} config - Config object
     * @param {Function} commandHandler - Function to handle commands
     */
    constructor(bot, config, commandHandler) {
        this.bot = bot;
        this.config = config;
        this.commandHandler = commandHandler;

        // Script storage
        this.scripts = new Map();          // All loaded scripts (file-based)
        this.triggers = new Map();         // Message triggers
        this.intervals = new Map();        // Active interval scripts

        // Counters for runtime scripts
        this.scriptIdCounter = 1;
        this.triggerIdCounter = 1;

        // Scripts directory
        this.scriptsDir = join(__dirname, '../../scripts');

        // Ensure scripts directory exists
        this.ensureScriptsDir();
    }

    /**
     * Initialize the script manager
     */
    init() {
        this.loadAllScripts();
        this.setupMessageListener();
        Logger.system(`Script Manager initialized. ${this.scripts.size} scripts loaded.`);
    }

    /**
     * Ensure scripts directory exists
     */
    ensureScriptsDir() {
        if (!existsSync(this.scriptsDir)) {
            mkdirSync(this.scriptsDir, { recursive: true });
            Logger.system('Created scripts/ directory');
        }
    }

    /**
     * Load all scripts from the scripts directory
     */
    loadAllScripts() {
        try {
            const files = readdirSync(this.scriptsDir).filter(f => f.endsWith('.json'));

            for (const file of files) {
                try {
                    const filePath = join(this.scriptsDir, file);
                    const content = readFileSync(filePath, 'utf-8');
                    const script = JSON.parse(content);
                    this.registerScript(script, false); // Don't save, just loading
                } catch (e) {
                    Logger.error(`Failed to load script ${file}: ${e.message}`);
                }
            }
        } catch (e) {
            Logger.error(`Failed to read scripts directory: ${e.message}`);
        }
    }

    /**
     * Setup message listener for triggers
     */
    setupMessageListener() {
        this.bot.on('messagestr', (message, position, jsonMsg) => {
            // Skip action bar messages
            if (position === 'game_info') return;

            const source = position === 'system' ? 'system' : 'chat';

            // Extract player name if it's a chat message
            let player = null;
            const chatMatch = message.match(/^<([^>]+)>\s*(.*)$/);
            if (chatMatch) {
                player = chatMatch[1];
            }

            // Check all triggers
            this.triggers.forEach((trigger, id) => {
                if (trigger.matches(message, source)) {
                    const result = trigger.execute(this.bot, { message, player });

                    // Handle command type actions
                    if (result && result.type === 'command' && this.commandHandler) {
                        this.commandHandler(result.value);
                    }
                }
            });
        });
    }

    /**
     * Register a script
     * @param {Object} script - Script configuration
     * @param {boolean} save - Whether to save to file
     * @returns {string} Script ID
     */
    registerScript(script, save = true) {
        const id = script.id || `script_${this.scriptIdCounter++}`;
        script.id = id;

        switch (script.type) {
            case 'message-trigger':
                const trigger = new MessageTrigger(script);
                this.triggers.set(id, trigger);
                this.scripts.set(id, { ...script, instance: trigger });
                break;

            case 'interval':
                this.scripts.set(id, script);
                if (script.enabled !== false) {
                    this.startIntervalScript(script);
                }
                break;

            default:
                this.scripts.set(id, script);
        }

        if (save) {
            this.saveScript(script);
        }

        return id;
    }

    /**
     * Start an interval-based script
     * @param {Object} script
     */
    startIntervalScript(script) {
        if (this.intervals.has(script.id)) {
            clearInterval(this.intervals.get(script.id));
        }

        const interval = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;

            try {
                if (script.action?.type === 'command' && this.commandHandler) {
                    this.commandHandler(script.action.value);
                } else if (script.action?.type === 'chat') {
                    this.bot.chat(script.action.value);
                }
            } catch (e) {
                Logger.error(`Interval script "${script.name}" error: ${e.message}`);
            }
        }, script.interval || 5000);

        this.intervals.set(script.id, interval);
    }

    /**
     * Stop an interval-based script
     * @param {string} id
     */
    stopIntervalScript(id) {
        if (this.intervals.has(id)) {
            clearInterval(this.intervals.get(id));
            this.intervals.delete(id);
        }
    }

    /**
     * Save script to file
     * @param {Object} script
     */
    saveScript(script) {
        try {
            const filename = `${script.id}.json`;
            const filePath = join(this.scriptsDir, filename);

            // Don't save instance reference
            const saveData = { ...script };
            delete saveData.instance;

            writeFileSync(filePath, JSON.stringify(saveData, null, 2));
            Logger.info(`Script "${script.name}" saved to ${filename}`);
        } catch (e) {
            Logger.error(`Failed to save script: ${e.message}`);
        }
    }

    /**
     * Quick add a message trigger
     * @param {string} pattern - Pattern to match
     * @param {string} action - Action (chat message or !command)
     * @param {Object} options - Additional options
     * @returns {string} Trigger ID
     */
    addQuickTrigger(pattern, action, options = {}) {
        const isCommand = action.startsWith('!');

        const script = {
            id: `trigger_${this.triggerIdCounter++}`,
            name: options.name || `Quick Trigger: ${pattern.substring(0, 20)}`,
            type: 'message-trigger',
            enabled: true,
            trigger: {
                pattern: pattern,
                matchType: options.matchType || 'contains',
                ignoreCase: options.ignoreCase !== false,
                source: options.source || 'all'
            },
            action: {
                type: isCommand ? 'command' : 'chat',
                value: isCommand ? action.slice(1) : action
            },
            cooldown: options.cooldown || 3000
        };

        return this.registerScript(script, true);
    }

    /**
     * Add a repeat/interval script (replaces old !repeat command)
     * @param {number} seconds - Interval in seconds
     * @param {string} command - Command or chat to execute
     * @returns {string} Script ID
     */
    addIntervalScript(seconds, command) {
        const isCommand = command.startsWith('!');

        const script = {
            id: `interval_${this.scriptIdCounter++}`,
            name: `Repeat: ${command.substring(0, 20)}`,
            type: 'interval',
            enabled: true,
            interval: seconds * 1000,
            action: {
                type: isCommand ? 'command' : 'chat',
                value: isCommand ? command.slice(1) : command
            }
        };

        return this.registerScript(script, true);
    }

    /**
     * Enable a script
     * @param {string} id
     * @returns {boolean}
     */
    enableScript(id) {
        const script = this.scripts.get(id);
        if (!script) return false;

        script.enabled = true;

        if (script.type === 'message-trigger' && this.triggers.has(id)) {
            this.triggers.get(id).enabled = true;
        } else if (script.type === 'interval') {
            this.startIntervalScript(script);
        }

        this.saveScript(script);
        return true;
    }

    /**
     * Disable a script
     * @param {string} id
     * @returns {boolean}
     */
    disableScript(id) {
        const script = this.scripts.get(id);
        if (!script) return false;

        script.enabled = false;

        if (script.type === 'message-trigger' && this.triggers.has(id)) {
            this.triggers.get(id).enabled = false;
        } else if (script.type === 'interval') {
            this.stopIntervalScript(id);
        }

        this.saveScript(script);
        return true;
    }

    /**
     * Delete a script
     * @param {string} id
     * @returns {boolean}
     */
    deleteScript(id) {
        const script = this.scripts.get(id);
        if (!script) return false;

        // Stop if running
        if (script.type === 'interval') {
            this.stopIntervalScript(id);
        }

        // Remove from maps
        this.scripts.delete(id);
        this.triggers.delete(id);

        // Delete file
        try {
            const filePath = join(this.scriptsDir, `${id}.json`);
            if (existsSync(filePath)) {
                unlinkSync(filePath);
            }
        } catch (e) {
            Logger.error(`Failed to delete script file: ${e.message}`);
        }

        return true;
    }

    /**
     * Get all scripts
     * @returns {Array}
     */
    listScripts() {
        return Array.from(this.scripts.values()).map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            enabled: s.enabled
        }));
    }

    /**
     * Reload all scripts from disk
     */
    reload() {
        // Clear existing
        this.intervals.forEach((interval) => clearInterval(interval));
        this.intervals.clear();
        this.triggers.clear();
        this.scripts.clear();

        // Reload
        this.loadAllScripts();
        Logger.system(`Reloaded ${this.scripts.size} scripts`);
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        this.intervals.forEach((interval) => clearInterval(interval));
        this.intervals.clear();
    }
}

export default ScriptManager;
