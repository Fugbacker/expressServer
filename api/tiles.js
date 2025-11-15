// api/tiles.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { getTileUrls } from "../libs/urls.js"; // поправь путь

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let urlIndex = 0;
const router = express.Router();

router.get("/", async (req, res) => {
  const userAgent = new UserAgent();
  const bbox = req.query.bbox;
  const type = req.query.type;
  const x = req.query.x;
  const z = req.query.zoom;
  const y = req.query.y;

  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  // Кэширование IP
  let cachedIps = [];
  let ipsLastFetched = 0;
  const IPS_CACHE_TTL = 60 * 60 * 1000;

  async function getLocalIps(baseUrl) {
    const now = Date.now();
    if (now - ipsLastFetched > IPS_CACHE_TTL) {
      try {
        const ipResponse = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
        cachedIps = ipResponse.data;
        ipsLastFetched = now;
      } catch (e) {
        console.error("Ошибка получения локальных IP:", e.message);
      }
    }
    return cachedIps;
  }

  const ipsList = await getLocalIps(baseUrl);
  const localIp = ipsList[Math.floor(Math.random() * ipsList.length)];
  const mode = type === '36048' ? 'ZU' : type === '36049' ? 'BULDS' : 'ZU';
  const urlTemplates = getTileUrls(type, mode, bbox, z, x, y);
  const startIndex = urlIndex % urlTemplates.length;
  urlIndex++;

  function makeNspdReferer(options = {}) {
    const layer = options.layer ?? "36048";
    const center = options.center ?? { x: 4857231.604740751, y: 5388693.217185968 };
    const radius = options.radius ?? 5000;

    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1));
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const coordX = (center.x + dx).toFixed(12);
    const coordY = (center.y + dy).toFixed(12);

    const thematic = "Default";
    const baseLayerId = randInt(1, 999);
    const theme_id = randInt(1, 999);
    const zoom = randInt(0, 22);
    const is_copy_url = Math.random() < 0.9 ? "true" : "false";

    const qs = new URLSearchParams({
      thematic,
      baseLayerId: String(baseLayerId),
      theme_id: String(theme_id),
      zoom: String(zoom),
      coordinate_x: coordX,
      coordinate_y: coordY,
      is_copy_url,
      active_layers: String(layer)
    });

    return `https://nspd.gov.ru/map?${qs.toString()}`;
  }

  let lastError = null;

  for (let i = 0; i < urlTemplates.length; i++) {
    const idx = (startIndex + i) % urlTemplates.length;
    const url = urlTemplates[idx];

    console.log(`[FETCH] Попытка ${i + 1}/${urlTemplates.length}: ${url}`);

    const headers = {
      'User-Agent': userAgent.toString(),
    };

    if (url.includes('geo.mapbaza.ru')) {
      headers['Host'] = 'geo.mapbaza.ru';
      headers['Referer'] = 'https://map.ru';
    }

    if (url.includes('nspd.gov.ru')) {
      headers['Host'] = 'nspd.gov.ru';
      headers['Referer'] = makeNspdReferer();
    }

    if (url.includes('pub.fgislk.gov.ru')) {
      headers['Host'] = 'pub.fgislk.gov.ru';
      headers['Referer'] = 'https://pub.fgislk.gov.ru/map';
    }

    try {
      console.log('🌐 URL:', url);
      const tileResponse = await axios.get(url, {
        responseType: 'arraybuffer',
        headers,
        httpAgent: new http.Agent({ localAddress: localIp }),
        httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
        timeout: 8000,
      });

      return res.status(200).send(tileResponse.data);
    } catch (error) {
      console.error(`[ERROR] Ошибка при получении тайла (${url}):`, error?.response?.status || error.message);
      lastError = error;
    }
  }

  res.status(500).json({
    error: 'Не удалось получить изображение',
    details: lastError?.message || 'Все источники недоступны',
  });
});

export default router;
