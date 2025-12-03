import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getClickUrls, origins } from "../libs/urls.js";
import { proxyList } from "../libs/proxy.js";
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const URL = process.env.NEXTAUTH_URL;
const router = express.Router();

// перемешаем прокси для одного раунда, чтобы они не повторялись
function getUniqueProxiesForRound(count) {
  const shuffled = [...proxyList].sort(() => Math.random() - 0.5);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]); // если прокси < URL, пойдём по кругу
  }
  return result;
}

router.get("/", async (req, res) => {
  const { bbox, type, x, y, zoom, yandexX, yandexY } = req.query;
  const convertedType = type === "36048" ? "1" : type === "36049" ? "5" : type;
  const userAgent = new UserAgent();

  const clickUrls = getClickUrls(type, convertedType, bbox, zoom, x, y);
  console.log("🔗 All Click URLs:", clickUrls);

  const proxiesForThisRound = getUniqueProxiesForRound(clickUrls.length);
  console.log("🕸 Proxies for round:", proxiesForThisRound);

  // Случайный IP (как у тебя было)
  let cachedIps = [];
  let ipsFetchedAt = 0;
  const IPS_CACHE_TTL = 60 * 60 * 1000;
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const baseUrl = `${protocol}://${host}`;

  async function getLocalIps() {
    const now = Date.now();
    if (now - ipsFetchedAt > IPS_CACHE_TTL) {
      const ipResponse = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
      cachedIps = ipResponse.data;
      ipsFetchedAt = now;
    }
    return cachedIps;
  }

  let cachedCookies = [];
  let cookiesFetchedAt = 0;
  const COOKIE_CACHE_TTL = 60 * 60 * 1000;

  async function getCookie() {
    const now = Date.now();
    if (now - cookiesFetchedAt > COOKIE_CACHE_TTL) {
      const cookieResponse = await axios.get(`${URL}/api/cookie`, { timeout: 3000 });
      cachedCookies = cookieResponse.data;
      cookiesFetchedAt = now;
    }
    return cachedCookies;
  }

  const ipsList = await getLocalIps();
  const getRandomLocalIp = () => ipsList[Math.floor(Math.random() * ipsList.length)];

  // === формируем параллельные запросы ===
  const requestPromises = clickUrls.map((url, i) => {
    const proxy = proxiesForThisRound[i];
    const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });
    const localIp = getRandomLocalIp();

    // =========================
    // СЛУЧАЙ 1: roscadastres.com
    // =========================
    if (url.includes("api.roscadastres.com")) {
      console.log(`🧩 [1] roscadastres.com flow for ${url}`);

      const cadUrl = `https://api.roscadastres.com/pkk_files/coordinates2.php?t=${convertedType}&lat=${yandexX}&lng=${yandexY}&lat_merc=${x}&lng_merc=${y}`;

      return axios.get(cadUrl, {
        timeout: 3000,
        headers: {
          "User-Agent": userAgent.toString(),
          "Host": "api.roscadastres.com",
        },
        httpsAgent: agent,
        httpAgent: agent,
      }).then(async (response) => {
        const cadnumber = response?.data?.features?.[0]?.attrs?.cn;
        if (!cadnumber) throw new Error("No cadnumber");

        const objectUrl = `https://api.roscadastres.com/pkk_files/data2.php?type=${convertedType}&id=${cadnumber}`;
        return axios.get(objectUrl, {
          timeout: 3000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "api.roscadastres.com",
          },
          httpsAgent: agent,
          httpAgent: agent,
        }).then(({ data }) => data);
      });
    }

    // =========================
    // СЛУЧАЙ 2: test.fgishub.ru
    // =========================
    if (url.includes("test.fgishub.ru")) {
      console.log(`🧩 [2] test.fgishub.ru flow for ${url}`);
      const origin = origins[Math.floor(Math.random() * origins.length)];

      return axios.get(url, {
        timeout: 4000,
        headers: {
          "User-Agent": userAgent.toString(),
          "Host": "test.fgishub.ru",
          "Origin": origin,
        },
        httpsAgent: agent,
        httpAgent: agent,
      }).then(({ data }) => {
        if (!data?.features?.length) throw new Error("No features");
        return data;
      });
    }

    // =========================
    // СЛУЧАЙ 3: binep.ru POST
    // =========================
    if (url.includes("binep.ru/api/v3/search")) {
      console.log(`🧩 [3] binep.ru POST flow for ${url}`);
      const postBody = {
        coord: [parseFloat(yandexY), parseFloat(yandexX)],
      };

      return axios.post(url, postBody, {
        timeout: 4000,
        headers: {
          "User-Agent": userAgent.toString(),
          "Host": "binep.ru",
        },
        httpsAgent: agent,
        httpAgent: agent,
      }).then(({ data }) => {
        if (!data?.features?.length) throw new Error("No features");
        return data;
      });
    }

    // =========================
    // СЛУЧАЙ 4: nspd.gov.ru GET
    // =========================
    if (url.includes("nspd.gov.ru")) {
      console.log(`🧩 [4] nspd.gov.ru flow for ${url}`);

      return axios.get(url, {
        timeout: 4000,
        headers: {
          "User-Agent": userAgent.toString(),
          "Host": "nspd.gov.ru",
          "Referer": "https://nspd.gov.ru",
        },
        httpsAgent: agent,
        httpAgent: agent,
      }).then(({ data }) => {
        const hasFeatures = data?.features?.length || data?.data?.features?.length;
        if (!hasFeatures) throw new Error("No features");
        return data;
      });
    }

    // =========================
    // СЛУЧАЙ 5: mobile.rosreestr.ru GET + Cookie
    // =========================
    if (url.includes("mobile.rosreestr.ru")) {
      console.log(`🧩 [5] mobile.rosreestr.ru flow for ${url}`);

      return getCookie().then((cookies) => {
        return axios.get(url, {
          timeout: 4000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
            "Host": "mobile.rosreestr.ru",
            "Cookie": cookies,
            "Referer": "https://mobile.rosreestr.ru",
          },
          httpsAgent: agent,
          httpAgent: agent,
        }).then(({ data }) => {
          const hasFeatures = data?.features?.length || data?.data?.features?.length;
          if (!hasFeatures) throw new Error("No features");
          return data;
        });
      });
    }

    // =========================
    // Стандартный WMS GET
    // =========================
    console.log(`🧩 [WMS] Standard GET/WMS flow for ${url}`);

    const headers = { "User-Agent": userAgent.toString() };
    if (url.includes("pub.fgislk.gov.ru")) {
      headers["Host"] = "pub.fgislk.gov.ru";
      headers["Referer"] = "https://pub.fgislk.gov.ru/map";
    }

    return axios.get(url, {
      timeout: 3000,
      headers,
      httpsAgent: agent,
      httpAgent: agent,
    }).then(({ data }) => {
      if (!data?.features?.length) throw new Error("No features");
      return data;
    });
  });

  // 🔥 ждём самый быстрый SUCCESS из параллельных запросов
  try {
    const fastestData = await Promise.any(requestPromises);
    console.log("⚡ Fastest Success Response received");
    res.json(fastestData);
  } catch (err) {
    console.log("❌ All URLs failed:", err?.message);
    res.json([]);
  }
});

export default router;
