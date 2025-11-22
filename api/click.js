// api/click.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getClickUrls, origins } from "../libs/urls.js"; // поправь путь под твою структуру
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const URL = process.env.NEXTAUTH_URL;
const PROXY = process.env.PROXY;
let lastSuccessfulIndex = -1;

const router = express.Router();

router.get("/", async (req, res) => {
  const bbox = req.query.bbox;
  const inputType = req.query.type;

  const x = req.query.x;
  const z = req.query.zoom;
  const y = req.query.y;
  const yandexX = req.query.yandexX;
  const yandexY = req.query.yandexY;
  const convertedType = inputType === '36048' ? '1' : inputType === '36049' ? '5' : inputType;
  const userAgent = new UserAgent();
  const agent = new HttpsProxyAgent(PROXY, {
    rejectUnauthorized: false,
  });


  const host = req.headers.host; // например, localhost:3000 или domain.com
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

  const ipsList = await getLocalIps(baseUrl);

  const clickUrls = getClickUrls(inputType, convertedType, bbox, z, x, y);
  // 🔁 Случайный выбор IP
  const getRandomLocalIp = () =>
    ipsList[Math.floor(Math.random() * ipsList.length)];

async function tryUrlsSequentially(startIndex, attemptsLeft) {
  if (attemptsLeft === 0) return null;

  const idx = startIndex % clickUrls.length;
  const url = clickUrls[idx];
  console.log('CLICKURL', url)
  const localIp = getRandomLocalIp();

  try {
    // =========================
    // СЛУЧАЙ 1: roscadastres.com
    // =========================
    if (url.includes("api.roscadastres.com")) {
      console.log("🔍 roscadastres flow...");

      const cadUrl = `https://api.roscadastres.com/pkk_files/coordinates2.php?t=${convertedType}&lat=${yandexX}&lng=${yandexY}&lat_merc=${x}&lng_merc=${y}`;

      console.log("cadUrl", cadUrl);

      const response = await axios({
        method: 'GET',
        url: cadUrl,
        timeout: 3000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': 'api.roscadastres.com'
        },
        // httpAgent: new http.Agent({ localAddress: localIp }),
        // httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
        httpsAgent: agent,
        httpAgent: agent,
      });

      console.log("response", response?.data);

      const cadnumber = response?.data?.features?.[0]?.attrs?.cn;

      if (!cadnumber) throw new Error("No cadnumber");

      const localIp1 = getRandomLocalIp();
      const objectUrl = `https://api.roscadastres.com/pkk_files/data2.php?type=${convertedType}&id=${cadnumber}`;
      console.log("objectUrl", objectUrl);
      const response1 = await axios({
        method: 'GET',
        url: objectUrl,
        timeout: 3000,
        headers: {
          'User-Agent': userAgent.toString(),
          'Host': 'api.roscadastres.com'
        },
        // httpAgent: new http.Agent({ localAddress: localIp1 }),
        // httpsAgent: new https.Agent({ localAddress: localIp1, rejectUnauthorized: false }),
        httpsAgent: agent,
        httpAgent: agent,
      });



      if (response1?.data) {
        lastSuccessfulIndex = idx;
        return response1.data;
      }
    }

    // =========================
    // СЛУЧАЙ 2: test.fgishub.ru
    // =========================
    if (url.includes("test.fgishub.ru")) {
      console.log("🔍 fgishub flow...");


      const origin = origins[Math.floor(Math.random() * origins.length)];

      const resp = await axios({
        method: 'GET',
        url,
        timeout: 4000,
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

      if (resp?.data?.features && resp?.data?.features?.length > 0) {
        lastSuccessfulIndex = idx;
        return resp.data;
      }
    }

    // =========================
    // СЛУЧАЙ 3: binep.ru — POST поиск по координатам
    // =========================
    if (url.includes("binep.ru/api/v3/search")) {
      console.log("🔍 binep flow...");
      const postBody = {
        coord: [parseFloat(yandexY), parseFloat(yandexX)] // координаты: [lonMerc, latMerc], как и просил
      };
      const localIp2 = getRandomLocalIp();

      const resp = await axios({
        method: 'POST',
        url,
        timeout: 4000,
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

      const localIp2 = getRandomLocalIp();
      const resp = await axios({
        method: 'GET',
        url,
        timeout: 4000,
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
      console.log("mobile.rosreestr.ru...");
      const cookies = await getCookie();
      const resp = await axios({
        method: 'GET',
        url,
        timeout: 4000,
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
      .then(({ data }) => {
        console.log("data", data);
        return data;
       })

       if (resp?.data?.features && resp?.data?.features?.length !==0 || resp?.data?.data?.features && resp?.data?.data?.features?.length !==0) {
        lastSuccessfulIndex = idx;
        return resp.data;
      }
    }

    // =========================
    // ✅ Стандартный WMS запрос
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
      timeout: 3000,
      headers,
      // httpAgent: new http.Agent({ localAddress: localIp }),
      // httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
      httpsAgent: agent,
      httpAgent: agent,
    });

    if (response?.data?.features && response?.data?.features?.length !==0) {
      lastSuccessfulIndex = idx;
      return response.data;
    }

    return tryUrlsSequentially(idx + 1, attemptsLeft - 1);

  } catch (err) {
    console.log('ОШИБКА ЗАПРОСА К НСПД!!!', err);
    return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
  }
}

  const startFrom = (lastSuccessfulIndex + 1) % clickUrls.length;

  try {
    const data = await tryUrlsSequentially(startFrom, clickUrls.length);
    res.json(data || 'error');
  } catch (e) {
    console.log('ОШИБКА ЗАПРОСА К НСПД', e);
    res.json('error');
  }
});

export default router;
