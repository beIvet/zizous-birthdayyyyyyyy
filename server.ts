import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

// Allow large payloads for Canva canvas elements, vector masks, and images
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

const DATA_FILE_PATH = path.resolve(__dirname, 'src', 'data', 'canvaSiteData.json');

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now(), isProd });
});

// GET /api/site-data: Returns the master project site data
app.get('/api/site-data', (_req, res) => {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.json(parsed);
    }
    return res.status(404).json({ error: 'Site data file not found' });
  } catch (err: any) {
    console.error('Failed to read site data:', err);
    return res.status(500).json({ error: 'Failed to read site data: ' + err.message });
  }
});

// POST /api/site-data: Writes user edits directly to src/data/canvaSiteData.json
// This ensures that when the user publishes, the build bundles their exact edits!
app.post('/api/site-data', (req, res) => {
  try {
    const incoming = req.body?.siteData || req.body;
    if (!incoming || !Array.isArray(incoming.pages) || incoming.pages.length === 0) {
      return res.status(400).json({ error: 'Invalid site data structure: pages array required' });
    }

    const stamped = {
      ...incoming,
      lastSavedAt: Date.now(),
    };

    const tempPath = `${DATA_FILE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(stamped, null, 2), 'utf-8');
    fs.renameSync(tempPath, DATA_FILE_PATH);

    console.log(`[SiteData Sync] Successfully wrote ${stamped.pages.length} pages to disk at ${new Date().toISOString()}`);
    return res.json({
      success: true,
      timestamp: stamped.lastSavedAt,
      message: 'Site data saved to project files successfully',
    });
  } catch (err: any) {
    console.error('Failed to write site data to disk:', err);
    return res.status(500).json({ error: 'Failed to save site data to project: ' + err.message });
  }
});

async function startServer() {
  if (!isProd) {
    // Development mode: attach Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve static bundle from dist
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} in ${isProd ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
