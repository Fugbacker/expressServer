// api/search.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getGeoportalUrls, origins } from "../libs/urls.js";
import { proxyList } from "../libs/proxy.js";
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const URL = process.env.NEXTAUTH_URL;

let proxyIndex = 0;
let lastSuccessfulIndex = -1;

const router = express.Router();

function getNextProxy() {
  const proxy = proxyList[proxyIndex % proxyList.length];
  proxyIndex++;
  return proxy;
}

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
      const ipResponse = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
      cachedIps = ipResponse.data;
      ipsLastFetched = now;
    }
    return cachedIps;
  }

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
    return cachedIps;
  }

  const ipsList = await getLocalIps(baseUrl);
  const geoportalUrls = getGeoportalUrls(cadNum);

  const getRandomLocalIp = () =>
    ipsList[Math.floor(Math.random() * ipsList.length)];

  // === Форма‐мейкер для 5 случаев ===
  const requests = geoportalUrls.map((url) => {
    const PROXY = getNextProxy();
    // console.log('PROXY:', PROXY, '→', url);

    const agent = new HttpsProxyAgent(PROXY, { rejectUnauthorized: false });
    const localIp = getRandomLocalIp();

    // IP проверка (оставляем как у тебя было)
    // const checkIpPromise = axios('https://api.ipify.org?format=json', {
    //   httpsAgent: agent,
    //   httpAgent: agent,
    //   timeout: 3000
    // })
    // .then(ipResponse => {
    //   console.log(`🔍 Проверяем IP через прокси → IP: ${ipResponse?.data?.ip}`);
    // })
    // .catch(e => console.log('ОШИБКА ПРОВЕРКИ АЙПИ', e?.response?.status || e.message));

    // =========================
    //  СЛУЧАЙ 1: test.fgishub.ru
    // =========================
    if (url.includes("test.fgishub.ru")) {
      const origin = origins[Math.floor(Math.random() * origins.length)];
      return axios.get(url, {
        timeout: 4000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': "test.fgishub.ru",
          'Origin': origin
        },
        httpsAgent: agent,
        httpAgent: agent,
      })
      .then(({ data }) => ({ url, data }))
    }

    // =========================
    //  СЛУЧАЙ 2: binep.ru POST
    // =========================
    if (url.includes("binep.ru/api/v3/search")) {
      const postBody = { query: cadNum };
      return axios.post(url, postBody, {
        timeout: 4000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': "binep.ru"
        },
        httpsAgent: agent,
        httpAgent: agent,
      })
      .then(({ data }) => ({ url, data }))
    }

    // =========================
    //  СЛУЧАЙ 3: nspd.gov.ru GET
    // =========================
    if (url.includes("nspd.gov.ru/api/geoportal") || url.includes("nspd.gov.ru/api/geoportal")) {
      return axios.get(url, {
        timeout: 4000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': "nspd.gov.ru",
          'Referer': "https://nspd.gov.ru"
        },
        httpsAgent: agent,
        httpAgent: agent,
      })
      .then(({ data }) => ({ url, data }))
    }

    // =========================
    //  СЛУЧАЙ 4: mobile.rosreestr.ru GET + Cookie
    // =========================
    if (url.includes("mobile.rosreestr.ru")) {
      return getCookie().then(cookies => {
        return axios.get(url, {
          timeout: 4000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
            'Host': 'mobile.rosreestr.ru',
            'Cookie': cookies,
            'Referer': 'https://mobile.rosreestr.ru'
          },
          httpsAgent: agent,
          httpAgent: agent,
        })
        .then(({ data }) => ({ url, data }))
      });
    }

    // =========================
    //  СЛУЧАЙ 5: стандартный GET / WMS
    // =========================
    let headers = { 'User-Agent': userAgent.toString() };

    if (url.includes('pub.fgislk.gov.ru')) {
      headers['Host'] = 'pub.fgislk.gov.ru';
      headers['Referer'] = 'https://pub.fgislk.gov.ru/map';
    }

    return axios.get(url, {
      timeout: 4000,
      headers,
      httpsAgent: agent,
      httpAgent: agent,
    })
    .then(({ data }) => {
      if (typeof data === "string" && data.trim() === "") {
        throw new Error("Empty response"); // считаем как ошибку → Promise.any перейдёт к следующему
      }
      return { url, data };
    })
  });

  // 🔥 Ждём первый успешный из всех параллельных запросов
    Promise.any(requests)
      .then(result => {
        console.log("⚡ Fastest URL:", result.url);
        // console.log("🔍 Data:", result.data.length);
        res.json(result.data || []);
      })
      .catch(err => {
        console.log("❌ Fastest returned empty or all failed:", err.message);
        res.json([]); // возвращаем []
      });

});

export default router;
