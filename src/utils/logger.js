/**
 * 🍌 BananaMoney Lite Logger
 * Fixed to not interrupt console input
 */

import chalk from 'chalk';
import figlet from 'figlet';
import readline from 'readline';

const bananaColor = chalk.hex('#FFD700');
const infoColor = chalk.cyan;
const errorColor = chalk.red;
const mutedColor = chalk.gray;

class Logger {
  constructor() {
    this.rl = null;
    this.onLog = null; // Callback for log forwarding (Discord)
  }

  /**
   * Set readline instance for proper output handling
   */
  setReadline(rl) {
    this.rl = rl;
  }

  /**
   * Set log callback for forwarding logs
   */
  setLogCallback(callback) {
    this.onLog = callback;
  }

  /**
   * Print message without interrupting input
   */
  print(text) {
    // Forward to callback if set
    if (this.onLog) {
      // Strip ANSI codes for callback
      const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
      this.onLog(clean);
    }

    if (this.rl) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.log(text);
      this.rl.prompt(true);
    } else {
      console.log(text);
    }
  }

  showBanner() {
    console.clear();
    console.log(bananaColor(figlet.textSync('BananaMoney', { horizontalLayout: 'full' })));
    console.log(bananaColor('=================================================='));
    console.log(bananaColor('  🍌  Lite Edition - Pure & Simple'));
    console.log(bananaColor('=================================================='));
    console.log('');
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${type}]`;

    let coloredPrefix;
    switch (type) {
      case 'INFO': coloredPrefix = infoColor(prefix); break;
      case 'ERROR': coloredPrefix = errorColor(prefix); break;
      case 'CHAT': coloredPrefix = bananaColor(prefix); break;
      default: coloredPrefix = mutedColor(prefix);
    }

    this.print(`${coloredPrefix} ${message}`);
  }

  info(msg) { this.log(msg, 'INFO'); }
  error(msg) { this.log(msg, 'ERROR'); }
  chat(sender, msg) { this.print(`${bananaColor(`[CHAT] <${sender}>`)} ${msg}`); }
  system(msg) { this.print(`${bananaColor('[🍌]')} ${msg}`); }
}

export default new Logger();