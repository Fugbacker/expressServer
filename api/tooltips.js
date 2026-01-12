// api/tooltips.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import { HttpsProxyAgent } from "https-proxy-agent";
// import { proxyList } from "../libs/proxy.js";
import dotenv from "dotenv";
dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let proxyIndex = 0;
const router = express.Router();

export const proxyList = [
  // 'http://uysSrQ2X0l:CSgSXEOb5l@5.223.76.13:10222', // мобильные прокси с ртоацией +
  // 'http://IUPrKGtQbZ:2C6t4BtTsf@5.223.76.13:10632', // мобильные прокси с ртоацией +
  // 'http://aT22b8hm08:u9qZabSnGd@5.223.76.13:10268', // мобильные прокси с ртоацией +
  'http://eDjdIjoc0E:AsUbvA6gGp@91.221.70.204:13592', // серверные с ротацией +
  'http://f6RypmOSZy:CPnsMmEnP4@91.221.70.204:14726', // серверные с ротацией +
  'http://gxfVMs3F97:caAmvLzF26@91.221.70.204:14725', // серверные с ротацией +
  'http://947714242:hTaKYVjb4cRKuqxn0biJ_country-RU@176.9.113.112:48004',  //25GB
  'http://947714242:hTaKYVjb4cRKuqxn0biJ_country-RU@176.9.113.112:48004',
  'http://947714242:hTaKYVjb4cRKuqxn0biJ_country-RU@176.9.113.112:48004',
];

function getNextProxy() {
  const proxy = proxyList[proxyIndex % proxyList.length];
  proxyIndex++;
  return proxy;
}

// проверка валидного ответа
function isValidResponse(data) {
  if (!data) return false;
  if (typeof data === "string" && data.trim() === "") return false;
  if (Array.isArray(data) && data.length === 0) return false;
  return true;
}

router.get("/", async (req, res) => {
  const address = req.query.address;
  const userAgent = new UserAgent();

  // 👉 список сервисов
  const providers = [
    {
      name: "rosreestr",
      buildRequest: (proxy) => {
        const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });
        const url = encodeURI(
          `https://lk.rosreestr.ru/account-back/address/search?term=${address}`
        );

        return axios.get(url, {
          timeout: 3000,
          headers: { "User-Agent": userAgent.toString() },
          httpsAgent: agent,
          httpAgent: agent,
        });
      }
    },
    {
      name: "nspd",
      buildRequest: (proxy) => {
        const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });
        const url = encodeURI(
          `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${address}`
        );

        return axios.get(url, {
          timeout: 3000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "nspd.gov.ru",
          },
          httpsAgent: agent,
          httpAgent: agent,
        });
      }
    },
    {
      name: "mobile_rosreestr",
      buildRequest: (proxy) => {
        const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });
        const url = encodeURI(
          `https://mobile.rosreestr.ru/api/v1/address?term=${address}`
        );

        return axios.get(url, {
          timeout: 3000,
          headers: { "User-Agent": userAgent.toString() },
          httpsAgent: agent,
          httpAgent: agent,
        });
      }
    }
  ];

  // 🚀 создаём параллельные запросы через map
  const requests = providers.map((provider) => {
    const proxy = getNextProxy();

    // console.log(`🚀 START ${provider.name} via ${proxy}`);
    // const agent = new HttpsProxyAgent(proxy, { rejectUnauthorized: false });
    // const checkIpPromise = axios('https://api.ipify.org?format=json', {
    //   httpsAgent: agent,
    //   httpAgent: agent,
    //   timeout: 3000
    // })
    // .then(ipResponse => {
    //   console.log(`🔍 Проверяем IP через прокси → IP: ${ipResponse?.data?.ip}`);
    // })
    // .catch(e => console.log('ОШИБКА ПРОВЕРКИ АЙПИ', e?.response?.status || e.message));

    return provider
      .buildRequest(proxy)
      .then((response) => {
        const data =
          provider.name === "nspd"
            ? response?.data?.data?.features || []
            : response.data;

        if (!isValidResponse(data)) {
          throw new Error("Empty response");
        }

        console.log(`✅ SUCCESS ${provider.name}`);
        return {
          source: provider.name,
          data,
        };
      })
      .catch((err) => {
        console.log(`❌ FAIL ${provider.name}:`, err.message);
        throw err;
      });
  });

  try {
    // ⚡ ждём самый быстрый успешный
    const fastest = await Promise.any(requests);

    console.log("⚡ FASTEST PROVIDER:", fastest.source);
    return res.json(fastest.data);
  } catch (err) {
    console.log("❌ ALL PROVIDERS FAILED");
    return res.json([]);
  }
});

export default router;
