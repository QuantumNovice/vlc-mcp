---
name: setup-vlc-mcp
description: Set up the vlc-mcp-server MCP server so an AI client can control VLC Media Player. Use when the user wants to install, configure, connect, verify or troubleshoot VLC control through MCP, mentions vlc-mcp-server, VLC's web/HTTP interface, or asks an AI to play, pause, seek or queue media in VLC.
---

# Set up vlc-mcp-server

Goal: get from "nothing installed" to a working `vlc_get_status` call with as little user effort as possible. Do each step yourself with your tools; only ask the user for things you cannot discover (their MCP client, a password they want to use). Package: `vlc-mcp-server` on npm. Repo: https://github.com/QuantumNovice/vlc-mcp

## 1. Check prerequisites

- `node --version` must report v20 or later. If missing, tell the user to install Node.js 20+ and stop.
- Find VLC and note its path and OS:
  - Windows: `C:\Program Files\VideoLAN\VLC\vlc.exe` (or the `(x86)` equivalent)
  - macOS: `/Applications/VLC.app/Contents/MacOS/VLC`
  - Linux: `which vlc`
- If VLC is not installed, ask the user to install it from https://www.videolan.org/vlc/. Do not download installers for them.

## 2. Enable VLC's HTTP interface

Ask the user for a password, or generate a random one and tell them. Prefer a password: some VLC versions refuse web requests when it is empty.

Option A (no config edits, per launch). Start VLC with the interface on loopback only:

```sh
vlc --extraintf=http --http-host=127.0.0.1 --http-port=8080 --http-password=<password>
```

Option B (persistent). Close VLC first, then set these keys in `vlcrc` (create the lines if missing, back the file up before editing):

| OS | vlcrc path |
| --- | --- |
| Windows | `%APPDATA%\vlc\vlcrc` |
| macOS | `~/Library/Preferences/org.videolan.vlc/vlcrc` |
| Linux | `~/.config/vlc/vlcrc` |

```ini
extraintf=http
http-password=<password>
```

Manual path for the user: **Tools → Preferences → Show settings: All → Interface → Main interfaces**, tick **Web**, then set the **Lua HTTP** password and restart VLC.

Verify VLC answers (the username is always empty):

```sh
curl -s -u ":<password>" http://127.0.0.1:8080/requests/status.json
```

A JSON body means VLC is ready. 401 means the password is wrong; connection refused means VLC is not running or the interface is not enabled. Never bind VLC to a non-loopback address.

## 3. Register the server with the user's MCP client

Ask which client they use if you cannot tell from the environment. The server command is always `npx -y vlc-mcp-server` over stdio, with these environment variables:

| Variable | Default | Set when |
| --- | --- | --- |
| `VLC_BASE_URL` | `http://127.0.0.1:8080` | VLC uses another host or port |
| `VLC_HTTP_PASSWORD` | empty | always, if you set a VLC password |
| `VLC_HTTP_USERNAME` | empty | VLC has a username (rare) |
| `VLC_HTTP_TIMEOUT_MS` | `5000` | slow VLC responses |

Config entry for clients that use an `mcpServers` JSON object (Claude Desktop, Cursor, llama.cpp). Merge it into the existing object, never replace other servers:

```json
{
  "mcpServers": {
    "vlc": {
      "command": "npx",
      "args": ["-y", "vlc-mcp-server"],
      "env": {
        "VLC_BASE_URL": "http://127.0.0.1:8080",
        "VLC_HTTP_PASSWORD": "<password>"
      }
    }
  }
}
```

| Client | How to register |
| --- | --- |
| Claude Code | `claude mcp add vlc --env VLC_HTTP_PASSWORD=<password> -- npx -y vlc-mcp-server` |
| Claude Desktop | merge the entry into `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), then restart the app |
| Hermes Agent | `hermes mcp add vlc --command npx --args -y vlc-mcp-server`, then `hermes mcp test vlc` |
| OpenClaw | `openclaw mcp add vlc --command npx --arg -y --arg vlc-mcp-server`, then `openclaw mcp doctor vlc --probe` |
| llama.cpp | save the JSON above as `vlc-mcp-servers.json` and start `llama-server` with `--mcp-servers-config vlc-mcp-servers.json` |
| OpenAI Agents SDK | `MCPServerStdio` with `command: "npx"`, `args: ["-y", "vlc-mcp-server"]`, see the README |

Hosted products (ChatGPT, OpenAI Responses API) cannot reach `127.0.0.1`; they need OpenAI's Secure MCP Tunnel, see the README. Ollama only runs the model, so configure the server in the MCP host that uses it.

Write passwords only to the user's own client config, never to files inside a shared repository, and do not echo them back unnecessarily.

## 4. Verify without the client (optional smoke test)

```sh
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 npx -y vlc-mcp-server
```

In a second shell:

```sh
curl -sS -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  --data-raw '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vlc_get_status","arguments":{}}}'
```

Stop the server afterwards. On PowerShell use `$env:MCP_TRANSPORT="http"` and `curl.exe`.

## 5. Confirm in the client

After restarting the client, ask it to "show the current VLC playback status". Tools exposed: `vlc_get_status`, `vlc_list_playlist`, `vlc_play`, `vlc_pause`, `vlc_stop`, `vlc_next`, `vlc_previous`, `vlc_set_volume` (0-512), `vlc_seek` (seconds), `vlc_add_media` (local path or URL).

## Troubleshooting

- **Connection refused / timeout**: VLC is closed, the Web interface is off, or `VLC_BASE_URL` has the wrong host/port. Re-run the curl check in step 2.
- **401 / "VLC rejected the password"**: `VLC_HTTP_PASSWORD` differs from VLC's Lua HTTP password. Keep the username empty. Restart the MCP client after changing env values.
- **Tools do not appear**: the client was not restarted, the JSON config is invalid, or `npx` is not on the client's PATH (use the absolute path to `npx`).
- **Media does not play**: the path must exist on the machine running VLC, and VLC must be allowed to open it.

## Security

`vlc_add_media` makes VLC open any path or URL it is given. Only connect trusted clients, and keep VLC's HTTP interface on localhost.
