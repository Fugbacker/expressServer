// api/search.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getSearchAdressUrls, origins } from "../libs/urls.js";
import { proxyList } from "../libs/proxy.js";
import dotenv from "dotenv";

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const URL = process.env.NEXTAUTH_URL;

const router = express.Router();

let proxyIndex = 0;
function getNextProxy() {
  const proxy = proxyList[proxyIndex % proxyList.length];
  proxyIndex++;
  return proxy;
}

/* ============================
   Cookie cache
============================ */
let cachedCookies = "";
let cookiesLastFetched = 0;
const COOKIE_CACHE_TTL = 60 * 60 * 1000; // 1 час

async function getCookie() {
  const now = Date.now();

  if (!cachedCookies || now - cookiesLastFetched > COOKIE_CACHE_TTL) {
    console.log("🍪 Обновляем cookie...");
    const response = await axios.get(`${URL}/api/cookie`, { timeout: 3000 });
    cachedCookies = response.data;
    cookiesLastFetched = now;
  }

  return cachedCookies;
}

/* ============================
   Router
============================ */
router.get("/", async (req, res) => {
  const cadNum = req.query.cadNumber;

  if (!cadNum) {
    return res.status(400).json({ error: "cadNumber is required" });
  }

  const userAgent = new UserAgent();
  const geoportalUrls = getSearchAdressUrls(cadNum);

  console.log("🔎 Поиск по кадастровому номеру:", cadNum);
  console.log("🌍 URL:", geoportalUrls.length);

  const requests = geoportalUrls.map((url) => {
    const proxy = getNextProxy();
    const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });

    console.log("🧭 Proxy:", proxy, "→", url);

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
    /* ============================
       CASE 1 — test.fgishub.ru
    ============================ */
    if (url.includes("test.fgishub.ru")) {
      const origin = origins[Math.floor(Math.random() * origins.length)];

      return axios
        .get(url, {
          timeout: 10000,
          headers: {
            "User-Agent": userAgent.toString(),
            Host: "test.fgishub.ru",
            Origin: origin,
          },
          httpsAgent: agent,
          httpAgent: agent,
        })
        .then(({ data }) => validateResponse(url, data))
        .catch((e) => handleError(url, e));
    }

    /* ============================
       CASE 2 — binep.ru POST
    ============================ */
    if (url.includes("binep.ru/api/v3/search")) {
      return axios
        .post(
          url,
          { query: cadNum },
          {
            timeout: 10000,
            headers: {
              "User-Agent": userAgent.toString(),
              Host: "binep.ru",
            },
            httpsAgent: agent,
            httpAgent: agent,
          }
        )
        .then(({ data }) => validateResponse(url, data))
        .catch((e) => handleError(url, e));
    }

    /* ============================
       CASE 3 — nspd.gov.ru
    ============================ */
    if (url.includes("nspd.gov.ru/api/geoportal")) {
      return axios
        .get(url, {
          // timeout: 10000,
          headers: {
            "User-Agent": userAgent.toString(),
            Host: "nspd.gov.ru",
            Referer: "https://nspd.gov.ru",
          },
          httpsAgent: agent,
          httpAgent: agent,
        })
        .then(({ data }) => validateResponse(url, data))
        .catch((e) => handleError(url, e));
    }

    /* ============================
       CASE 4 — mobile.rosreestr.ru + Cookie
    ============================ */
    if (url.includes("mobile.rosreestr.ru")) {
      return getCookie().then((cookies) => {
        return axios
          .get(url, {
            timeout: 10000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
              Host: "mobile.rosreestr.ru",
              Cookie: cookies,
              Referer: "https://mobile.rosreestr.ru",
            },
            httpsAgent: agent,
            httpAgent: agent,
          })
          .then(({ data }) => validateResponse(url, data))
          .catch((e) => handleError(url, e));
      });
    }

    /* ============================
       CASE 5 — Default GET / WMS
    ============================ */
    const headers = {
      "User-Agent": userAgent.toString(),
    };

    if (url.includes("pub.fgislk.gov.ru")) {
      headers.Host = "pub.fgislk.gov.ru";
      headers.Referer = "https://pub.fgislk.gov.ru/map";
    }

    return axios
      .get(url, {
        timeout: 10000,
        headers,
        httpsAgent: agent,
        httpAgent: agent,
      })
      .then(({ data }) => validateResponse(url, data))
      .catch((e) => handleError(url, e));
  });

  /* ============================
     Fastest successful
  ============================ */
  Promise.any(requests)
    .then((result) => {
      console.log("⚡ FASTEST:", result.url);
      res.json(result.data || []);
    })
    .catch(() => {
      console.log("❌ Все источники недоступны");
      res.json([]);
    });
});

/* ============================
   Helpers
============================ */

function validateResponse(url, data) {
  if (
    (typeof data === "string" && data.trim() === "") ||
    (data?.features && data.features.length === 0)
  ) {
    throw new Error("Empty response");
  }

  console.log("✅ OK:", url);
  return { url, data };
}

function handleError(url, error) {
  const status = error?.response?.status;
  const msg = error?.message;
  // console.log("🚫 ERROR:", error);
  console.log("❌ ERROR:", url, status || msg);
  throw error; // важно для Promise.any
}

export default router;
