# VLC MCP Server

An MCP server that lets AI clients inspect and control VLC Media Player using its built in HTTP interface. It uses MCP `stdio` by default for local clients, with an optional loopback-only Streamable HTTP mode for curl smoke checks and local HTTP clients.

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

## Security notes

- Keep VLC's HTTP interface bound to localhost. VLC's HTTP interface does not provide transport encryption, so do not expose it directly to an untrusted network. If you configure a password, use a strong one.
- The `vlc_add_media` tool passes its input to VLC. VLC may open network URLs or local files accessible to the VLC process. Only connect trusted MCP clients and grant them access to media you are comfortable allowing VLC to open.
- The server only makes requests to the configured `VLC_BASE_URL`; do not set it to an untrusted endpoint.

## License

MIT. See [LICENSE](LICENSE).
