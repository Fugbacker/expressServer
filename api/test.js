// api/test.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { getGeoportalUrls, origins } from "../libs/testUrl.js"; // поправь путь

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let lastSuccessfulIndex = -1;
const router = express.Router();

router.get("/", async (req, res) => {
  const cadNum = req.query.cadNumber;
  const userAgent = new UserAgent();

  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  // === Кэширование IP-адресов ===
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

  const geoportalUrls = getGeoportalUrls(cadNum);

  const getRandomLocalIp = () => {
    if (!ipsList || ipsList.length <= 1) return null;
    const randomIndex = 1 + Math.floor(Math.random() * (ipsList.length - 1));
    return ipsList[randomIndex];
  };

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

  async function tryUrlsSequentially(startIndex, attemptsLeft) {
    if (attemptsLeft === 0) return null;

    const idx = startIndex % geoportalUrls.length;
    const url = geoportalUrls[idx];
    console.log('TESTURL', url)
    const localIp = getRandomLocalIp();

    try {
      // =========================
      // test.fgishub.ru
      // =========================
      if (url.includes("test.fgishub.ru")) {
        console.log("fgishub flow...");
        const origin = origins[Math.floor(Math.random() * origins.length)];
        const resp = await axios.get(url, {
          timeout: 4000,
          headers: {
            'User-Agent': userAgent.toString(),
            'Host': 'test.fgishub.ru',
            'Origin': origin
          },
          httpAgent: new http.Agent({ localAddress: localIp }),
          httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
        });

        if ((resp?.data?.features?.length) || (resp?.data?.data?.features?.length)) {
          lastSuccessfulIndex = idx;
          return resp.data;
        }
      }

      // =========================
      // binep.ru POST
      // =========================
      if (url.includes("binep.ru/api/v3/search")) {
        console.log("binep flow...");
        const postBody = { query: cadNum };
        const localIp2 = getRandomLocalIp();

        const resp = await axios.post(url, postBody, {
          timeout: 4000,
          headers: {
            'User-Agent': userAgent.toString(),
            'Host': 'binep.ru'
          },
          httpAgent: new http.Agent({ localAddress: localIp2 }),
          httpsAgent: new https.Agent({ localAddress: localIp2, rejectUnauthorized: false })
        });

        if (resp?.data?.features?.length) {
          lastSuccessfulIndex = idx;
          return resp.data;
        }
      }

      // =========================
      // nspd.gov.ru
      // =========================
      if (url.includes("nspd.gov.ru")) {
        console.log("nspd flow...");
        const localIp2 = getRandomLocalIp();
        const referer = makeNspdReferer();
        const resp = await axios.get(url, {
          timeout: 4000,
          headers: {
            'User-Agent': userAgent.toString(),
            'Host': 'nspd.gov.ru',
            'Referer': referer
          },
          httpAgent: new http.Agent({ localAddress: localIp2 }),
          httpsAgent: new https.Agent({ localAddress: localIp2, rejectUnauthorized: false })
        });

        if ((resp?.data?.features?.length) || (resp?.data?.data?.features?.length)) {
          lastSuccessfulIndex = idx;
          return resp.data;
        }
      }

      // =========================
      // Стандартный WMS запрос
      // =========================
      console.log("standart flow...");
      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': userAgent.toString()
        },
        httpAgent: new http.Agent({ localAddress: localIp }),
        httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
      });

      if ((response?.data?.features?.length) ||
          (response?.data?.data?.features?.length) ||
          response?.data?.properties ||
          response?.data?.feature) {
        lastSuccessfulIndex = idx;
        return response.data;
      }

      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
    } catch (err) {
      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
    }
  }

  const startFrom = (lastSuccessfulIndex + 1) % geoportalUrls.length;

  try {
    const data = await tryUrlsSequentially(startFrom, geoportalUrls.length);
    console.log('ЗАПРОС К НСПД УСПЕШНЫЙ', data);
    res.json(data || []);
  } catch (e) {
    console.error('ОШИБКА ЗАПРОСА К НСПД', e);
    res.json([]);
  }
});

export default router;
