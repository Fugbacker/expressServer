// api/history.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { getHistoryUrls } from "../libs/urls.js"; // поправь путь под твою структуру

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let lastSuccessfulIndex = -1;

const router = express.Router();

router.get("/", async (req, res) => {
  const userAgent = new UserAgent();
  const cadNum = req.query.cadNumber;

  // базовый URL сервера для получения списка IP
  const host = req.headers.host; // localhost:3000 или IP:3000
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  let ipsList = [];
  try {
    const response = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
    ipsList = response.data;
  } catch (err) {
    console.error("Ошибка получения локальных IP:", err.message);
  }

  const getRandomLocalIp = () => ipsList[Math.floor(Math.random() * ipsList.length)];
  const localIp = getRandomLocalIp();

  const historyUrls = getHistoryUrls(cadNum);

  async function tryUrlsSequentially(startIndex, attemptsLeft) {
    if (attemptsLeft === 0) return null;

    const idx = startIndex % historyUrls.length;
    const randomIdx = Math.floor(Math.random() * historyUrls.length);
    const url = historyUrls[randomIdx];

    console.log('IP запроса HISTORY', localIp, 'URL', url);

    try {
      const isNspd = url.startsWith('https://nspd.gov.ru');

      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': userAgent.toString(),
          ...(isNspd ? { Host: 'nspd.gov.ru' } : {}),
        },
        httpAgent: new http.Agent({ localAddress: localIp }),
        httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
      });

      if (response?.data) {
        lastSuccessfulIndex = idx;
        return response.data;
      }

      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);

    } catch (e) {
      console.error(`Ошибка при запросе HISTORY ${url}: IP ${localIp}`, e.message);
      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
    }
  }

  const startFrom = (lastSuccessfulIndex + 1) % historyUrls.length;

  try {
    const data = await tryUrlsSequentially(startFrom, historyUrls.length);
    res.json(data || []);
  } catch (e) {
    console.error("Общая ошибка history:", e.message);
    res.json([]);
  }
});

export default router;
