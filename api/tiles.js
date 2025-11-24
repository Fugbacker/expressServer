// api/tiles.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { proxyList} from "../libs/proxy.js";
import { getTileUrls } from "../libs/urls.js"; // поправь путь
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
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
  const PROXY = getNextProxy()
  const userAgent = new UserAgent()
  const agent = new HttpsProxyAgent(PROXY, {
    rejectUnauthorized: false,
  });

  const bbox = req.query.bbox
  const type = req.query.type
  const host = req.headers.host; // например, localhost:3000 или domain.com
  const x = req.query.x;
  const z = req.query.zoom;
  const y = req.query.y;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;


  let cachedIps = [];
  let ipsLastFetched = 0;
  const IPS_CACHE_TTL = 60 * 60 * 1000; // 5 минут

  async function getLocalIps(baseUrl) {
    const now = Date.now();
    if (now - ipsLastFetched > IPS_CACHE_TTL) {
      const ipResponse = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
      cachedIps = ipResponse.data; // вы уверены, что всегда массив
      ipsLastFetched = now;
    }
    return cachedIps;
  }

  let cachedCookies = [];
  let CookiesLastFetched = 0;
  const COOKIE_CACHE_TTL = 60 * 60 * 1000; // 5 минут

  async function getCookie() {
    const now = Date.now();
    if (now - CookiesLastFetched > COOKIE_CACHE_TTL) {
      const ipResponse = await axios.get(`${URL}/api/cookie`, { timeout: 3000 });
      cachedCookies = ipResponse.data; // вы уверены, что всегда массив
      CookiesLastFetched = now;
    }
    return cachedCookies;
  }
  const cookies = await getCookie();
  const ipsList = await getLocalIps(baseUrl);
  const localIp = ipsList[Math.floor(Math.random() * ipsList.length)];
  const mode = type === '36048' ? 'ZU' : type === '36049' ? 'BULDS' : 'ZU';
  const urlTemplates = getTileUrls(type, mode, bbox, z, x, y)
  const startIndex = urlIndex % urlTemplates.length;
  urlIndex++; // увеличить индекс для следующего запроса
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
      headers['Referer'] = 'https://nspd.gov.ru';
    }

    if (url.includes('pub.fgislk.gov.ru')) {
      headers['Host'] = 'pub.fgislk.gov.ru';
      headers['Referer'] = 'https://pub.fgislk.gov.ru/map';
    }

    if (url.includes('mobile.rosreestr.ru')) {
      headers['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';
      headers['Host'] = 'mobile.rosreestr.ru';
      headers['Referer'] = 'https://mobile.rosreestr.ru';
      headers['Cookie'] = cookies;
    }

    try {

      console.log('🌐 TILESURL:', url);
      const tileResponse = await axios.get(url, {
        responseType: 'arraybuffer',
        headers,
        // httpAgent: new http.Agent({ localAddress: localIp }),
        // httpsAgent: new https.Agent({
        //   localAddress: localIp,
        //   rejectUnauthorized: false,
        // }),
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 8000,
      });

      // console.log('tileResponse:', tileResponse.data);

      // --- Ответ клиенту ---
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
