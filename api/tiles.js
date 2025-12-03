// api/tiles.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { proxyList } from "../libs/proxy.js";
import { getTileUrls } from "../libs/urls.js";
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const URL = process.env.NEXTAUTH_URL;

let proxyIndex = 0;
let urlIndex = 0;
const router = express.Router();

function getNextProxy() {
  const proxy = proxyList[proxyIndex % proxyList.length];
  proxyIndex++;
  return proxy;
}

router.get("/", async (req, res) => {
  const cadNum = req.query.cadNumber;
  const userAgent = new UserAgent();

  const bbox = req.query.bbox;
  const type = req.query.type;
  const host = req.headers.host;
  const x = req.query.x;
  const z = req.query.zoom;
  const y = req.query.y;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  // === Кэш IP ===
  let cachedIps = [];
  let ipsLastFetched = 0;
  const IPS_CACHE_TTL = 60 * 60 * 1000;

  async function getLocalIps(baseUrl) {
    const now = Date.now();
    if (now - ipsLastFetched > IPS_CACHE_TTL) {
      const ipResponse = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
      cachedIps = ipResponse.data;
      ipsLastFetched = now;
    }
    return cachedIps;
  }

  // === Кэш cookies ===
  let cachedCookies = [];
  let CookiesLastFetched = 0;
  const COOKIE_CACHE_TTL = 60 * 60 * 1000;

  async function getCookie() {
    const now = Date.now();
    if (now - CookiesLastFetched > COOKIE_CACHE_TTL) {
      const ipResponse = await axios.get(`${URL}/api/cookie`, { timeout: 3000 });
      cachedCookies = ipResponse.data;
      CookiesLastFetched = now;
    }
    return cachedCookies;
  }

  const cookies = await getCookie();
  const ipsList = await getLocalIps(baseUrl);
  const getRandomLocalIp = () => ipsList[Math.floor(Math.random() * ipsList.length)];

  const mode = type === '36048' ? 'ZU' : type === '36049' ? 'BULDS' : 'ZU';
  const urlTemplates = getTileUrls(type, mode, bbox, z, x, y);

  // === ПАРАЛЛЕЛЬНЫЙ ФЛОУ С ОТМЕНОЙ ===
  const controllers = [];
  const requests = urlTemplates.map((url) => {
    const PROXY = getNextProxy();
    // console.log('PROXY:', PROXY);
    console.log('🌐 TILESURL:', url);

    const controller = new AbortController();
    controllers.push({ controller, url });
    const agent = new HttpsProxyAgent(PROXY, { rejectUnauthorized: false });

    const headers = { 'User-Agent': userAgent.toString() };

    if (url.includes('geo.mapbaza.ru')) {
      headers['Host'] = 'geo.mapbaza.ru';
      headers['Referer'] = 'https://map.ru';
    }
    if (url.includes('nspd.gov.ru')) {
      headers['Host'] = 'nspd.gov.ru';
      headers['Referer'] = 'https://nspd.gov.ru';
    }
    if (url.includes('pub.fgislk.gov.ru')) {
      headers['Host'] = 'pub.fgislk.gov.ru';
      headers['Referer'] = 'https://pub.fgislk.gov.ru/map';
    }
    if (url.includes('mobile.rosreestr.ru')) {
      headers['Host'] = 'mobile.rosreestr.ru';
      headers['Referer'] = 'https://mobile.rosreestr.ru';
      headers['Cookie'] = cookies;
      headers['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';
    }

    return axios.get(url, {
      responseType: 'arraybuffer',
      headers,
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 8000,
      signal: controller.signal
    }).then(res => ({ data: res.data, url }));
  });

  try {
    const fastest = await Promise.any(requests);
    console.log('✅ FASTEST SUCCESS FROM:', fastest.url);

    // отменяем все остальные
    controllers.forEach(({ controller, url }) => {
      if (url !== fastest.url) {
        controller.abort();
        console.log('✖️ Отменён запрос:', url);
      }
    });

    return res.status(200).send(fastest.data);
  } catch (e) {
    console.log('🚫 Ни один источник не ответил успешно');
    return res.status(500).json({
      error: 'Не удалось получить тайл',
      details: e.message
    });
  }
});

export default router;
