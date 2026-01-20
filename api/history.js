// api/history.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import { HttpsProxyAgent } from "https-proxy-agent";
import { proxyList } from "../libs/proxy.js";
import { getHistoryUrls } from "../libs/urls.js"; // поправь путь под твою структуру

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let lastSuccessfulIndex = -1;

const router = express.Router();

let proxyIndex = 0;

function getNextProxy() {
  const proxy = proxyList[proxyIndex % proxyList.length];
  proxyIndex++;
  return proxy;
}

router.get("/", async (req, res) => {
  const userAgent = new UserAgent();
  const cadNum = req.query.cadNumber;
  console.log("🔎 Поиск по кадастровому номеру:", cadNum) ;

  const historyUrls = getHistoryUrls(cadNum);

  async function tryUrlsSequentially(startIndex, attemptsLeft) {
    if (attemptsLeft === 0) return null;

    const idx = startIndex % historyUrls.length;
    const randomIdx = Math.floor(Math.random() * historyUrls.length);
    const url = historyUrls[randomIdx];

    try {
      const isNspd = url.startsWith('https://nspd.gov.ru');
      const proxy = getNextProxy();
      const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });

      const response = await axios.get(url, {
        timeout: 6000,
        headers: {
          'User-Agent': userAgent.toString(),
          ...(isNspd ? { Host: 'nspd.gov.ru' } : {}),
        },
        httpsAgent: agent,
        httpAgent: agent,
      });

      if (response?.data) {
        lastSuccessfulIndex = idx;
        return response.data;
      }

      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);

    } catch (e) {
      console.error(`Ошибка при запросе HISTORY ${url}`, e.message);
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
