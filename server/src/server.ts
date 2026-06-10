import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { openDatabase } from './db/database.ts';
import { initMetrics } from './db/metrics.ts';
import { loadLlmSettings } from './llm/settings.ts';
import { registerRoutes } from './routes/index.ts';
import { startScheduler, stopScheduler } from './scheduler/index.ts';
import { refreshAll } from './services/collector.ts';

const PORT = Number(process.env.PORT ?? 5180);
const HOST = process.env.HOST ?? '127.0.0.1';

const db = openDatabase();
initMetrics(db); // ADR-13: LLM 計測 sink を設定
loadLlmSettings(db);
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// 引数なしコマンドは空ボディの application/json で来るため {} として受ける。
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  try {
    const text = typeof body === 'string' ? body : body.toString();
    done(null, text.length > 0 ? JSON.parse(text) : {});
  } catch (e) {
    done(e instanceof Error ? e : new Error('invalid json'));
  }
});

registerRoutes(app, db);

// 本番: ビルド済み SPA (dist/) を配信。dev は Vite が配信し /api・/events を proxy する。
const distDir = join(import.meta.dirname, '..', '..', 'dist');
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/events')) {
      void reply.code(404).send({ kind: 'not_found', message: `unknown endpoint: ${req.url}` });
      return;
    }
    void reply.sendFile('index.html'); // SPA フォールバック
  });
  console.log('[server] serving SPA from dist/');
}

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`[server] listening on http://${HOST}:${PORT}`);

  // 常駐収集ループ（ブラウザを開いていなくても収集が走る）。
  startScheduler(db);

  // 起動時の即時収集は env で明示的に有効化する（ランチャ用、A4）。
  if (process.env.COLLECT_ON_START === '1') {
    refreshAll(db, false)
      .then((r) => console.log(`[startup] collected ${r.saved} articles`))
      .catch((e: unknown) => console.error('[startup] collect failed', e));
  }

  const shutdown = (): void => {
    stopScheduler();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
