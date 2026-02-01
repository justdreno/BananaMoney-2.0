# 🍌 BananaMoney Lite

A powerful, pure Mineflayer bot for Minecraft with an advanced script system.

![Version](https://img.shields.io/badge/version-3.0.0-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Minecraft](https://img.shields.io/badge/minecraft-1.20.1-blue.svg)

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bananamoney-lite.git
cd bananamoney-lite

# Install dependencies
npm install

# Configure your bot
# Edit config/config.json with your server details

# Start the bot
npm start
```

---

## ⚙️ Configuration

Edit `config/config.json`:

```json
{
    "host": "play.example.net",
    "port": 25565,
    "username": "YourUsername",
    "version": "1.20.1",
    "auth": "offline",
    "autoReconnect": true,
    "reconnectDelay": 5000
}
```

| Option | Description |
|--------|-------------|
| `host` | Server address |
| `port` | Server port (default: 25565) |
| `username` | Bot username |
| `version` | Minecraft version |
| `auth` | Authentication type (`offline` or `microsoft`) |
| `autoReconnect` | Auto-reconnect on disconnect |
| `reconnectDelay` | Delay before reconnect (ms) |

---

## 🎮 Commands

All commands start with `!` prefix.

### General Commands

| Command | Description |
|---------|-------------|
| `!help` | Show all commands |
| `!stats` | Show bot health, food, position |
| `!look <player>` or `!look <x> <y> <z>` | Look at target |
| `!drop <all/held/item>` | Drop items |
| `!eat` | Force eat |
| `!autoeat on/off` | Toggle auto-eat |

### Window/GUI Commands

| Command | Description |
|---------|-------------|
| `!gui` | Show current window contents |
| `!click <slot>` | Click a slot |
| `!shift <slot>` | Shift-click a slot |
| `!close` | Close current window |

### Alias Commands

| Command | Description |
|---------|-------------|
| `!alias list` | List all aliases |
| `!alias add <short> <cmd>` | Create a new alias |
| `!alias delete <short>` | Delete an alias |
| `!alias reload` | Reload aliases from disk |

### Bone Collector Commands

| Command | Description |
|---------|-------------|
| `!bones on/off` | Toggle bone collector |
| `!spawner <x> <y> <z>` | Set spawner position |
| `!chest <x> <y> <z>` | Set chest position |

---

## 📜 Script System

BananaMoney includes a powerful script system for automation.

### Script Commands

| Command | Description |
|---------|-------------|
| `!script list` | List all scripts with status |
| `!script enable <id>` | Enable a script |
| `!script disable <id>` | Disable a script |
| `!script delete <id>` | Delete a script permanently |
| `!script reload` | Reload all scripts from disk |

### Quick Commands

| Command | Description |
|---------|-------------|
| `!repeat <seconds> <command>` | Create interval script |
| `!trigger add <pattern> <action>` | Create message trigger |
| `!trigger list` | List all message triggers |
| `!trigger delete <id>` | Delete a trigger |

---

## 🔔 Message Triggers

Message triggers execute actions when specific messages appear in chat.

### Quick Trigger Example

```bash
# React when someone says "hello"
!trigger add hello Hello there friend! 🍌

# Run a command when a message appears  
!trigger add "balance" !/pay someuser 100
```

### Script File Example

Create a file in `scripts/` folder (e.g., `scripts/my-trigger.json`):

```json
{
    "id": "greet-players",
    "name": "Greet New Players",
    "type": "message-trigger",
    "enabled": true,
    "trigger": {
        "pattern": "joined the game",
        "matchType": "contains",
        "ignoreCase": true,
        "source": "all"
    },
    "action": {
        "type": "chat",
        "value": "Welcome to the server! 🍌"
    },
    "cooldown": 5000
}
```

### Match Types

| Type | Description |
|------|-------------|
| `exact` | Message must exactly match pattern |
| `contains` | Message must contain pattern |
| `startsWith` | Message must start with pattern |
| `regex` | Pattern is a regular expression |

### Action Types

| Type | Description |
|------|-------------|
| `chat` | Send a chat message |
| `command` | Execute a bot command (without `!` prefix) |

### Variables

Use these in your action value:
- `{message}` - The full message that triggered
- `{player}` - The player who sent the message (if detectable)

---

## ⏱️ Interval Scripts

Run commands or chat messages at regular intervals.

### Quick Command

```bash
# Check balance every 60 seconds
!repeat 60 /balance

# Send chat every 5 minutes
!repeat 300 Anyone want to trade?
```

### Script File Example

Create `scripts/my-loop.json`:

```json
{
    "id": "balance-check",
    "name": "Check Balance",
    "type": "interval",
    "enabled": true,
    "interval": 60000,
    "action": {
        "type": "chat",
        "value": "/balance"
    }
}
```

---

## 📁 Project Structure

```
BananaMoney-2.0/
├── config/
│   └── config.json         # Bot configuration
├── scripts/                 # Script files
│   ├── example-autoreply.json
│   └── example-loop.json
├── src/
│   ├── BananaBot.js        # Main bot class
│   ├── modules/
│   │   ├── BoneCollector.js
│   │   └── GuiManager.js
│   └── utils/
│       ├── ScriptManager.js   # Script management
│       ├── MessageTrigger.js  # Trigger system
│       ├── AliasManager.js
│       ├── ProfileManager.js
│       └── logger.js
├── index.js                # Entry point
└── package.json
```

---

## 🛡️ Features

- ✅ **Multi-script execution** - Run multiple scripts simultaneously
- ✅ **Message triggers** - React to chat messages with pattern matching
- ✅ **Interval scripts** - Execute commands at regular intervals
- ✅ **File persistence** - Scripts saved as JSON in `scripts/` folder
- ✅ **Cooldown support** - Prevent trigger spam
- ✅ **Regex matching** - Powerful pattern matching with regex
- ✅ **Variable substitution** - Use `{message}` and `{player}` in actions
- ✅ **Auto-eat** - Automatically eat when hungry
- ✅ **GUI management** - Interact with windows/inventories
- ✅ **Bone collector** - Automated farming module
- ✅ **Command aliases** - Create shortcuts for common commands
- ✅ **Profile system** - Save and load configurations

---

## 🔧 Examples

### Auto-Reply Bot

```json
{
    "id": "auto-reply",
    "name": "Auto Reply",
    "type": "message-trigger",
    "enabled": true,
    "trigger": {
        "pattern": "banana",
        "matchType": "contains",
        "ignoreCase": true
    },
    "action": {
        "type": "chat",
        "value": "Did someone say banana? 🍌"
    },
    "cooldown": 10000
}
```

### AFK Announcement

```json
{
    "id": "afk-announce",
    "name": "AFK Announcement",
    "type": "interval",
    "enabled": true,
    "interval": 300000,
    "action": {
        "type": "chat",
        "value": "[AFK] I'm currently away but my bot is running!"
    }
}
```

### Regex Trigger

```json
{
    "id": "dm-response",
    "name": "Respond to DMs",
    "type": "message-trigger",
    "enabled": true,
    "trigger": {
        "pattern": "\\[.*? -> me\\]",
        "matchType": "regex",
        "ignoreCase": true
    },
    "action": {
        "type": "chat",
        "value": "Thanks for the message! I'll respond when I'm back."
    },
    "cooldown": 30000
}
```

---

## 📝 License

MIT License - Feel free to use and modify!

---

## 🍌 Happy Botting!
