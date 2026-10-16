# VLC MCP Server

![VLC media player cone icon](assets/vlc-icon.png)

An MCP server that lets AI clients inspect and control VLC Media Player using its built in HTTP interface. It uses MCP `stdio` by default for local clients, with an optional loopback-only Streamable HTTP mode for curl smoke checks and local HTTP clients.

The VLC cone icon is from [VideoLAN](https://images.videolan.org/images/vlc128x128.png). VLC and the cone logo are VideoLAN trademarks; this independent project is not affiliated with VideoLAN.

## What it can do

| Tool | Purpose |
| --- | --- |
| `vlc_get_status` | Read playback state, media, elapsed time, duration, and volume |
| `vlc_list_playlist` | List media items and their VLC playlist IDs |
| `vlc_play` | Resume playback, or play a playlist item by ID |
| `vlc_pause` | Toggle playback pause state |
| `vlc_stop` | Stop playback |
| `vlc_next` / `vlc_previous` | Change playlist item |
| `vlc_set_volume` | Set volume from 0 to 512 |
| `vlc_seek` | Seek to a position in seconds |
| `vlc_add_media` | Add a local media path or a VLC supported media URL to the playlist |

## Requirements

- Node.js 20 or later
- VLC Media Player with the HTTP interface enabled
- An MCP client that can launch a local command over `stdio`

## Quick setup with npm

### 1. Start VLC and enable its HTTP interface

1. Install and open VLC Media Player on the same computer where this MCP server will run.
2. Open **Tools → Preferences**. At the bottom left, change **Show settings** from *Simple* to **All**.
3. In the left panel, open **Interface → Main interfaces** and check **Web**.
4. Open **Interface → Main interfaces → Lua** and set the **Lua HTTP** password if your VLC setup requires one. VLC uses an empty username by default; this server also defaults both username and password to empty. Save the preferences and restart VLC after changing them.
5. Keep VLC's web interface on its default local address, `http://127.0.0.1:8080`. Do not expose the HTTP interface to the internet.

VLC preference labels can vary slightly by version. The setting is part of VLC's Lua HTTP interface. Leave the username blank unless your VLC server is configured with a username. If you set a Lua HTTP password, set `VLC_HTTP_PASSWORD` to the same value in the MCP client's environment.

### 2. Run the published MCP server

No clone or local build is needed. The [published npm package](https://www.npmjs.com/package/vlc-mcp-server) can be run with `npx`; it downloads the package on first launch:

```sh
npx -y vlc-mcp-server
```

The command starts the MCP stdio server. Usually, put it in your AI client's MCP config so the client starts it automatically.

To install it globally instead, run `npm install --global vlc-mcp-server`; then use `vlc-mcp-server` as the MCP config `command` with an empty `args` array.

### 3. Add the server to your AI client

Add this entry under `mcpServers` in your AI client's configuration:

```json
{
  "vlc": {
    "command": "npx",
    "args": ["-y", "vlc-mcp-server"],
    "env": {
      "VLC_BASE_URL": "http://127.0.0.1:8080"
    }
  }
}
```

If the config already has an `mcpServers` object, add only the `vlc` property and keep the other server entries. Save the file and restart the client. If VLC has a Lua HTTP password, add `VLC_HTTP_PASSWORD` to `env`; leave `VLC_HTTP_USERNAME` empty unless you configured one.

### 4. Ask the AI to control VLC

Try these prompts:

- “Show the current VLC playback status.”
- “List the VLC playlist.”
- “Add a media file to VLC's playlist.”
- “Play the first item in the playlist.”
- “Pause VLC and set the volume to 120.”
- “Seek to 90 seconds.”

To play a specific item, first ask for the playlist, then pass the item's numeric ID to `vlc_play`. `vlc_add_media` accepts a local path or a URL that VLC supports. VLC needs permission to read the file or access the URL.

## Install as a Claude Code plugin

```
/plugin marketplace add QuantumNovice/vlc-mcp
/plugin install vlc-mcp --marketplace QuantumNovice/vlc-mcp
```

## Connect from Claude Desktop

Claude Desktop can launch the package over stdio. Open `%APPDATA%\Claude\claude_desktop_config.json` (create it if needed) and add this under `mcpServers`:

```json
{
  "vlc": {
    "command": "npx",
    "args": ["-y", "vlc-mcp-server"],
    "env": {
      "VLC_BASE_URL": "http://127.0.0.1:8080"
    }
  }
}
```

If the file already contains other MCP servers, add only the `vlc` entry inside `mcpServers`. Save the file and restart Claude Desktop. Open a chat and ask Claude to list the VLC playlist. For current Claude Desktop extension options, see [Anthropic's local MCP server guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

## Connect from OpenAI

### OpenAI Agents SDK (local stdio)

For an application you run locally, install the [OpenAI Agents SDK for JavaScript](https://openai.github.io/openai-agents-js/guides/mcp/) in that application with `npm install @openai/agents`. This example starts the published VLC package as a local process:

```js
import { Agent, MCPServerStdio, run } from "@openai/agents";

const server = new MCPServerStdio({
  name: "VLC",
  command: "npx",
  args: ["-y", "vlc-mcp-server"],
  env: {
    VLC_BASE_URL: "http://127.0.0.1:8080",
    VLC_HTTP_USERNAME: "",
    VLC_HTTP_PASSWORD: process.env.VLC_HTTP_PASSWORD ?? ""
  }
});

await server.connect();
try {
  const agent = new Agent({
    name: "VLC assistant",
    instructions: "Use the VLC tools to answer the user's request.",
    mcpServers: [server]
  });
  const response = await run(agent, "Show the current VLC playback status.");
  console.log(response.finalOutput);
} finally {
  await server.close();
}
```

Set `OPENAI_API_KEY` before running the application. Set `VLC_HTTP_PASSWORD` only if you configured a Lua HTTP password in VLC. OpenAI's [Agents SDK MCP guide](https://openai.github.io/openai-agents-js/guides/mcp/) documents local stdio and HTTP server connections.

### ChatGPT or the OpenAI Responses API

ChatGPT and OpenAI hosted API requests cannot connect directly to this computer's `127.0.0.1` endpoint. To use this local VLC server from those hosted products, use [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels/). Create a tunnel in OpenAI Platform, run `tunnel-client` on this computer, and point it at this server's local stdio command or HTTP endpoint. Then add the tunnel in ChatGPT as a custom MCP server, or pass its `tunnel_id` in an OpenAI Responses API MCP tool. Tunnel setup and access depend on your OpenAI Platform and ChatGPT workspace permissions; see [OpenAI's tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels/).

## Connect from Hermes Agent

Hermes Agent supports local stdio MCP servers. Register the published npm package with Hermes' MCP CLI:

```powershell
hermes mcp add vlc --command npx --args -y vlc-mcp-server
hermes mcp test vlc
```

Start or restart Hermes with `hermes chat`, then ask it to show the VLC status. The server defaults to empty username and password. If you configured a Lua HTTP password, add it under `mcp_servers.vlc.env.VLC_HTTP_PASSWORD` in Hermes config. Hermes MCP setup and config options are documented in the [Hermes MCP guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp).

## Use Ollama models with an MCP host

Ollama runs the model; configure the MCP server in the agent or client that connects to that model. Ollama's `/api/chat` tool calling takes function definitions from the client, so it does not use this server's MCP config directly. Use an MCP-capable host such as Hermes Agent or OpenClaw, then select Ollama as that host's model provider. Ollama's [`ollama launch`](https://ollama.com/blog/improved-performance-and-model-support-with-gguf) can set up supported agent integrations:

```powershell
ollama pull qwen3
ollama launch hermes --model qwen3
# Or use OpenClaw:
ollama launch openclaw --model qwen3
```

Then configure the `vlc` MCP server in Hermes or OpenClaw using the section above. Use a model with tool calling support; `ollama show qwen3` displays the model capabilities. For direct application code, your app must act as the MCP client and forward discovered MCP tools to Ollama's chat API; see [Ollama tool support](https://ollama.com/blog/tool-support).

## Connect from llama.cpp

Recent `llama-server` builds support MCP servers over stdio (the feature is marked experimental). Save this Cursor-style MCP config as `vlc-mcp-servers.json`:

```json
{
  "mcpServers": {
    "vlc": {
      "command": "npx",
      "args": ["-y", "vlc-mcp-server"],
      "env": {
        "VLC_BASE_URL": "http://127.0.0.1:8080"
      }
    }
  }
}
```

Append this option to the command you already use to start `llama-server.exe` from the directory containing the config file:

```text
--mcp-servers-config vlc-mcp-servers.json
```

If VLC has a Lua HTTP password, add `VLC_HTTP_PASSWORD` to the config's `env`. The MCP tools are then registered alongside the model server's other tools. See the [llama.cpp MCP server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#mcp-servers).

## Connect from OpenClaw

OpenClaw supports local stdio MCP servers. Add the published package and probe its tools:

```powershell
openclaw mcp add vlc `
  --command npx `
  --arg -y `
  --arg vlc-mcp-server
openclaw mcp doctor vlc --probe
```

The probe should list the VLC tools. To set a VLC password or other environment values, edit the `vlc` server in OpenClaw's **Settings → MCP** page or its `mcp.servers` config. Keep `VLC_HTTP_PASSWORD` empty unless you set a Lua HTTP password in VLC.

OpenClaw's [MCP guide](https://docs.openclaw.ai/tools/mcp) documents the UI, CLI, and config options.

## Test the MCP endpoint with curl

The MCP endpoint uses stdio by default. To test with curl, start the published package in its optional local HTTP mode:

```powershell
$env:MCP_TRANSPORT = "http"
$env:MCP_HTTP_PORT = "3000"
npx -y vlc-mcp-server
```

Leave that window running. In a second PowerShell window, initialize an MCP connection:

```powershell
curl.exe -sS -X POST http://127.0.0.1:3000/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  --data-raw '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl-smoke-test","version":"1.0.0"}}}'
```

List the MCP tools:

```powershell
curl.exe -sS -X POST http://127.0.0.1:3000/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  --data-raw '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call VLC status (VLC must be running and its HTTP interface enabled):

```powershell
curl.exe -sS -X POST http://127.0.0.1:3000/mcp `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  --data-raw '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"vlc_get_status","arguments":{}}}'
```

The responses may be returned as Server-Sent Events (`event: message` followed by a JSON `data:` line). This HTTP mode is bound to `127.0.0.1`; it is for local checks and local clients. Stop it with **Ctrl+C**.

### 5. Troubleshoot a connection

- **Connection refused or timeout:** Make sure VLC is open, the Web interface is enabled, and `VLC_BASE_URL` points to the computer running VLC.
- **401 Unauthorized:** Leave `VLC_HTTP_USERNAME` empty. If you set a Lua HTTP password in VLC, copy it into `VLC_HTTP_PASSWORD` and restart the MCP client. If you did not set one, keep both values empty.
- **Media does not play:** Confirm VLC can open the same file or URL directly. Check that the path exists on the computer running VLC.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `VLC_BASE_URL` | `http://127.0.0.1:8080` | VLC HTTP interface URL |
| `VLC_HTTP_USERNAME` | empty | Username for VLC's HTTP/Lua interface |
| `VLC_HTTP_PASSWORD` | empty | Password set for VLC's HTTP/Lua interface |
| `VLC_HTTP_TIMEOUT_MS` | `5000` | Request timeout, from 100 to 120000 milliseconds |
| `MCP_TRANSPORT` | `stdio` | MCP transport: `stdio` or local `http` |
| `MCP_HTTP_PORT` | `3000` | Port for local HTTP mode |

## Build from source

To work on the server source instead of using the npm package, clone and build it:

```powershell
git clone https://github.com/QuantumNovice/vlc-mcp.git
Set-Location .\vlc-mcp
npm install
npm run build
```

Run the built server with `npm start`. It waits for an MCP client on standard input/output. The MCP protocol uses stdout; the server does not write application logs to stdout.

## MCP Registry publishing

This repository includes `server.json` and the matching `mcpName` field in `package.json` for the official MCP Registry. The Registry lists MCP servers and is distinct from GitHub Marketplace, which publishes GitHub Apps and Actions. To submit this server to the MCP Registry, publish the npm package and GitHub repository first, then authenticate and publish with the official CLI:

```sh
npm publish --access public
mcp-publisher login github
mcp-publisher validate
mcp-publisher publish
```

The Registry namespace in `server.json` and `package.json` is `io.github.QuantumNovice/vlc-mcp`. Create the GitHub repository at the configured URL before publishing; registry publication requires GitHub authentication for the account that controls this namespace.

## Security notes

- Keep VLC's HTTP interface bound to localhost. VLC's HTTP interface does not provide transport encryption, so do not expose it directly to an untrusted network. If you configure a password, use a strong one.
- The `vlc_add_media` tool passes its input to VLC. VLC may open network URLs or local files accessible to the VLC process. Only connect trusted MCP clients and grant them access to media you are comfortable allowing VLC to open.
- The server only makes requests to the configured `VLC_BASE_URL`; do not set it to an untrusted endpoint.

## License

MIT. See [LICENSE](LICENSE).
