// api/test.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getGeoportalUrls, origins } from "../libs/testUrl.js"; // поправь путь
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const URL = process.env.NEXTAUTH_URL;
const PROXY = process.env.PROXY;
let lastSuccessfulIndex = -1;

const router = express.Router();

router.get("/", async (req, res) => {
  const cadNum = req.query.cadNumber;
  const userAgent = new UserAgent();
  const agent = new HttpsProxyAgent(PROXY, {
    rejectUnauthorized: false,
  });

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

  // const ipsList = await getLocalIps(baseUrl);

  const geoportalUrls = getGeoportalUrls(cadNum);

  // const getRandomLocalIp = () =>
  //   ipsList[Math.floor(Math.random() * ipsList.length)];


async function tryUrlsSequentially(startIndex, attemptsLeft) {
  if (attemptsLeft === 0) return null;

  const idx = startIndex % geoportalUrls.length;
  const url = geoportalUrls[idx];
  console.log('TESTURL', url)
  // const localIp = getRandomLocalIp();

  try {

      const ipResponse = await axios('https://api.ipify.org?format=json', {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 10000
      });

      console.log(`🔍 Проверяем IP через → IP: ${ipResponse?.data?.ip}`);

    // =========================
    //  СЛУЧАЙ 1: test.fgishub.ru
    // =========================
    if (url.includes("test.fgishub.ru")) {
      console.log("🔍 fgishub flow...");

      const origin = origins[Math.floor(Math.random() * origins.length)];

      const resp = await axios({
        method: 'GET',
        url,
        // timeout: 4000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': 'test.fgishub.ru',
          'Origin': origin,
          // 'Referer': origin
        },
        // httpAgent: new http.Agent({ localAddress: localIp }),
        // httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
        httpsAgent: agent,
        httpAgent: agent,
      });


      if (resp?.data?.features && resp?.data?.features?.length > 0 || resp?.data?.data?.features && resp?.data?.data?.features?.length > 0) {

        lastSuccessfulIndex = idx;
        return resp.data;
      }
    }

    // =========================
    //  СЛУЧАЙ 3: binep.ru — POST поиск по координатам
    // =========================
    if (url.includes("binep.ru/api/v3/search")) {
      console.log("🔍 binep flow...");
      const postBody = {
        query: cadNum // координаты: [lonMerc, latMerc], как и просил
      };
      const localIp2 = getRandomLocalIp();

      const resp = await axios({
        method: 'POST',
        url,
        // timeout: 4000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': 'binep.ru',
          // 'Content-Type': 'application/json'
        },
        data: postBody,
        // httpAgent: new http.Agent({ localAddress: localIp2 }),
        // httpsAgent: new https.Agent({ localAddress: localIp2, rejectUnauthorized: false }),
        httpsAgent: agent,
        httpAgent: agent,
      })

      if (resp?.data?.features && resp?.data?.features?.length !==0) {
        lastSuccessfulIndex = idx;
        return resp.data;
      }
    }

        // =========================
    //  СЛУЧАЙ 4: nspd.gov.ru
    // =========================
    if (url.includes("nspd.gov.ru")) {
      console.log("🔍 nspd.gov.ru flow...");
      const resp = await axios({
        method: 'GET',
        url,
        // timeout: 4000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': 'nspd.gov.ru',
          'Referer': 'https://nspd.gov.ru',
        },
        // httpAgent: new http.Agent({ localAddress: localIp2 }),
        // httpsAgent: new https.Agent({ localAddress: localIp2, rejectUnauthorized: false }),
        httpsAgent: agent,
        httpAgent: agent,
      })

      if (resp?.data?.features && resp?.data?.features?.length !==0 || resp?.data?.data?.features && resp?.data?.data?.features?.length !==0) {
        lastSuccessfulIndex = idx;
        return resp.data;
      }
    }

    // =========================
    // ✅ СЛУЧАЙ 5: mobile.rosreestr.ru
    // =========================
    if (url.includes("mobile.rosreestr.ru")) {
      console.log("🔍 mobile.rosreestr.ru flow...");
      console.log("URL", url);
      const cookies = await getCookie();
      console.log("cookies", cookies);
      const resp = await axios({
        method: 'GET',
        url,
        // timeout: 4000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
          'Host': 'mobile.rosreestr.ru',
          'Cookie': cookies,
          'Referer': 'https://mobile.rosreestr.ru'
        },
        // httpAgent: new http.Agent({ localAddress: localIp }),
        // httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),

        httpsAgent: agent,
        httpAgent: agent,
      })

       if (resp?.data?.features && resp?.data?.features?.length !==0 || resp?.data?.data?.features && resp?.data?.data?.features?.length !==0) {
        lastSuccessfulIndex = idx;
        return resp.data;
      }
    }



    // =========================
    //  Стандартный WMS запрос
    // =========================
    console.log("standart flow...");
    const headers = {
      'User-Agent': userAgent.toString(),
    };

    if (url.includes('pub.fgislk.gov.ru')) {
      headers['Host'] = 'pub.fgislk.gov.ru';
      headers['Referer'] = 'https://pub.fgislk.gov.ru/map';
    }
    const response = await axios({
      method: 'GET',
      url,
      // timeout: 3000,
      headers,
      // httpAgent: new http.Agent({ localAddress: localIp }),
      // httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
      httpsAgent: agent,
      httpAgent: agent,
    })
    .then(({ data }) => {
      console.log("data", data);
      return data;
    })



    if (response?.data?.features && response?.data?.features?.length !==0 || response?.data?.data?.features && response?.data?.data?.features?.length !==0|| response?.data?.properties || response?.data?.feature) {
      lastSuccessfulIndex = idx;
      return response.data;
    }

    return tryUrlsSequentially(idx + 1, attemptsLeft - 1);

  } catch (err) {
    console.log('🚫 ОШИБКА ЗАПРОСА К НСПД', err?.response?.status || err.message);
     return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
  }
}

  const startFrom = (lastSuccessfulIndex + 1) % geoportalUrls.length;

  try {
    const data = await tryUrlsSequentially(startFrom, geoportalUrls.length);
    res.json(data || []);
  } catch (e) {
    console.log('ОШИБКА ЗАПРОСА К НСПД', e);
    res.json([]);
  }
});

export default router;
