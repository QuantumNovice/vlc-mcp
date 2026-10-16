#!/usr/bin/env node
import { createServer as createHttpServer } from 'node:http';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { localhostHostValidation, localhostOriginValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { loadVlcConfig, VlcClient } from './vlc-client.js';

function createMcpServer(): McpServer {
  const vlc = new VlcClient(loadVlcConfig());
  const server = new McpServer({ name: 'vlc-mcp', version: '0.1.0' });

  function result(value: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
  }

  function failure(error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown VLC error occurred.';
    return { content: [{ type: 'text' as const, text: message }], isError: true };
  }

  const registerAction = (
    name: string,
    description: string,
    schema: z.ZodObject<any>,
    action: (args: Record<string, unknown>) => Promise<unknown>
  ) => {
    server.registerTool(name, {
      description,
      inputSchema: schema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    }, async (args) => {
      try {
        return result(await action(args as Record<string, unknown>));
      } catch (error) {
        return failure(error);
      }
    });
  };

  server.registerTool('vlc_get_status', {
    description: 'Get VLC playback state, current media, elapsed time, duration, and volume.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async () => {
    try {
      return result(await vlc.status());
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool('vlc_list_playlist', {
    description: 'List media items currently in the VLC playlist.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async () => {
    try {
      return result(await vlc.playlist());
    } catch (error) {
      return failure(error);
    }
  });

  registerAction('vlc_play', 'Start or resume VLC playback. Optionally play a playlist item by its numeric ID.', z.object({
    item_id: z.number().int().nonnegative().optional().describe('VLC playlist item ID. Omit to resume or start the current selection.')
  }), async ({ item_id }) => item_id === undefined
    ? await vlc.command('pl_play')
    : await vlc.command('pl_play', item_id as number, 'id'));

  registerAction('vlc_pause', 'Toggle VLC playback between paused and playing.', z.object({}), async () => await vlc.command('pl_pause'));
  registerAction('vlc_stop', 'Stop VLC playback.', z.object({}), async () => await vlc.command('pl_stop'));
  registerAction('vlc_next', 'Skip to the next item in the VLC playlist.', z.object({}), async () => await vlc.command('pl_next'));
  registerAction('vlc_previous', 'Return to the previous item in the VLC playlist.', z.object({}), async () => await vlc.command('pl_previous'));

  registerAction('vlc_set_volume', 'Set VLC volume. VLC accepts values from 0 (muted) to 512 (maximum).', z.object({
    volume: z.number().int().min(0).max(512).describe('VLC volume from 0 to 512.')
  }), async ({ volume }) => await vlc.command('volume', volume as number));

  registerAction('vlc_seek', 'Seek to a position in the currently playing media.', z.object({
    seconds: z.number().min(0).describe('Target position in seconds.')
  }), async ({ seconds }) => await vlc.command('seek', seconds as number));

  registerAction('vlc_add_media', 'Add media to the VLC playlist. Accepts a local path or media URL supported by VLC.', z.object({
    input: z.string().trim().min(1).max(4096).describe('Local media path or media URL.')
  }), async ({ input }) => await vlc.command('in_enqueue', input as string, 'input'));

  return server;
}

const transport = process.env.MCP_TRANSPORT ?? 'stdio';

if (transport === 'stdio') {
  const handle = serveStdio(createMcpServer);
  process.on('SIGINT', () => { void handle.close().finally(() => process.exit(0)); });
  process.on('SIGTERM', () => { void handle.close().finally(() => process.exit(0)); });
} else if (transport === 'http') {
  const port = Number(process.env.MCP_HTTP_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MCP_HTTP_PORT must be an integer from 1 to 65535.');
  }

  const nodeHandler = toNodeHandler(createMcpHandler(createMcpServer));
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();
  const httpServer = createHttpServer((request, response) => {
    if (!validateHost(request, response) || !validateOrigin(request, response)) return;
    void nodeHandler(request, response);
  });
  httpServer.listen(port, '127.0.0.1', () => {
    console.error(`VLC MCP HTTP endpoint listening on http://127.0.0.1:${port}/mcp`);
  });
  const shutdown = () => httpServer.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else {
  throw new Error('MCP_TRANSPORT must be either "stdio" or "http".');
}
