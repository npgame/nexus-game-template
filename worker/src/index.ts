import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  handleApply,
  handleInit,
  handlePerspective,
  handleTurnState,
  type GameEvent,
  type InitContext,
} from '@nexusgame/game-sdk';
import logic from '../../logic/index';
import type { TemplateState } from '../../logic/index';

type AssetFetcher = { fetch: (request: Request) => Promise<Response> };

type Bindings = {
  ASSETS: AssetFetcher;
  UI_BASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const WORKER_VERIFY_SIGNATURE = 'NEXUS_GAME_WORKER_VERIFIED_V1';

app.use('/*', cors());

// UI 资源走公开路由，避免 iframe 直接拿不到跨域响应
app.get('/game-ui.js', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/_ui.js';
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'application/javascript');
  return newResponse;
});

app.get('/style.css', async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'text/css');
  return newResponse;
});

app.get('/game-ui.html', async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'text/html');
  return newResponse;
});

app.get('/metadata', (c) => {
  const metadata = logic.getMetadata();
  const uiBaseUrl = c.env.UI_BASE_URL || new URL(c.req.url).origin;
  return c.json({
    ...metadata,
    ui: {
      mode: 'url',
      url: `${uiBaseUrl}/game-ui.html`,
    },
  });
});

app.get('/__nexus_worker_verify', (c) =>
  c.text(WORKER_VERIFY_SIGNATURE, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
);

// /init 和 /apply 会顺带返回 turnState；/turn-state 用于恢复、回溯和调试。
app.post('/init', async (c) => {
  const body = await c.req.json<InitContext>();
  try {
    return c.json(handleInit(logic, body));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/turn-state', async (c) => {
  const body = await c.req.json<{ state: TemplateState }>();
  try {
    return c.json(handleTurnState(logic, body.state));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/apply', async (c) => {
  const body = await c.req.json<{ state: TemplateState; event: GameEvent }>();
  try {
    return c.json(handleApply(logic, body.state, body.event));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/perspective', async (c) => {
  const body = await c.req.json<{ state: TemplateState; roleId: string | null }>();
  try {
    return c.json(handlePerspective(logic, body.state, body.roleId));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/state-prompt', async (c) => {
  const body = await c.req.json<{ perspective: any }>();
  try {
    const statePrompt =
      typeof logic.generateStatePrompt === 'function'
        ? logic.generateStatePrompt(body.perspective)
        : undefined;
    return c.json({ statePrompt });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default app;
