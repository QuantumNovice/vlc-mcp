export interface VlcConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

export interface VlcStatus {
  state?: string;
  time?: number;
  length?: number;
  volume?: number;
  information?: unknown;
  [key: string]: unknown;
}

export interface VlcPlaylistItem {
  id?: number;
  name?: string;
  uri?: string;
  type?: string;
  duration?: number;
  [key: string]: unknown;
}

export class VlcClient {
  private readonly baseUrl: URL;

  constructor(private readonly config: VlcConfig) {
    this.baseUrl = new URL(config.baseUrl);
    if (this.baseUrl.protocol !== 'http:' && this.baseUrl.protocol !== 'https:') {
      throw new Error('VLC_BASE_URL must use HTTP or HTTPS.');
    }
    this.baseUrl.pathname = this.baseUrl.pathname.replace(/\/$/, '');
  }

  async status(command?: string, value?: string | number, parameter = 'val'): Promise<VlcStatus> {
    return await this.request<VlcStatus>('/requests/status.json', command, value, parameter);
  }

  async playlist(): Promise<VlcPlaylistItem[]> {
    const result = await this.request<{ children?: VlcPlaylistItem[]; [key: string]: unknown }>('/requests/playlist.json');
    const items: VlcPlaylistItem[] = [];
    const visit = (nodes: unknown): void => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const item = node as VlcPlaylistItem & { children?: unknown };
        if (Array.isArray(item.children)) visit(item.children);
        else if (typeof item.id === 'number') items.push(item);
      }
    };
    visit(result.children);
    return items;
  }

  async command(command: string, value?: string | number, parameter = 'val'): Promise<VlcStatus> {
    return await this.status(command, value, parameter);
  }

  private async request<T>(path: string, command?: string, value?: string | number, parameter = 'val'): Promise<T> {
    const url = new URL(`${this.baseUrl.toString().replace(/\/$/, '')}${path}`);
    if (command) url.searchParams.set('command', command);
    if (value !== undefined) url.searchParams.set(parameter, String(value));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('VLC rejected the password. Check VLC_HTTP_PASSWORD and the web interface settings.');
      }
      if (!response.ok) {
        throw new Error(`VLC returned HTTP ${response.status} ${response.statusText}.`);
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`VLC did not respond within ${this.config.timeoutMs} ms.`);
      }
      if (error instanceof TypeError) {
        throw new Error(`Could not connect to VLC at ${this.baseUrl.origin}. Ensure VLC's web interface is enabled and reachable.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function loadVlcConfig(env: NodeJS.ProcessEnv = process.env): VlcConfig {
  const timeoutMs = Number(env.VLC_HTTP_TIMEOUT_MS ?? 5000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    throw new Error('VLC_HTTP_TIMEOUT_MS must be an integer from 100 to 120000.');
  }
  return {
    baseUrl: env.VLC_BASE_URL ?? 'http://127.0.0.1:8080',
    username: env.VLC_HTTP_USERNAME ?? '',
    password: env.VLC_HTTP_PASSWORD ?? '',
    timeoutMs
  };
}
