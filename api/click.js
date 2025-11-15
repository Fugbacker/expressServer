// api/click.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";
import { getClickUrls, origins } from "../libs/urls.js"; // поправь путь под твою структуру

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

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

  const host = req.headers.host; // для baseUrl
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  let cachedIps = [];
  let ipsLastFetched = 0;
  const IPS_CACHE_TTL = 60 * 60 * 1000; // 1 час

  async function getLocalIps(baseUrl) {
    const now = Date.now();
    if (now - ipsLastFetched > IPS_CACHE_TTL) {
      const ipResponse = await axios.get(`${baseUrl}/api/ips`, { timeout: 3000 });
      cachedIps = ipResponse.data;
      ipsLastFetched = now;
    }
    return cachedIps;
  }

  const ipsList = await getLocalIps(baseUrl);
  const clickUrls = getClickUrls(inputType, convertedType, bbox, z, x, y);

  const getRandomLocalIp = () => ipsList[Math.floor(Math.random() * ipsList.length)];

  function makeNspdReferer(options = {}) {
    const layer = options.layer ?? "36048";
    const center = options.center ?? { x: 4857231.604740751, y: 5388693.217185968 };
    const radius = options.radius ?? 5000;

    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1));
    const randFloat = (min, max, decimals = 12) => (Math.random() * (max - min) + min).toFixed(decimals);

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

    const idx = startIndex % clickUrls.length;
    const url = clickUrls[idx];
    console.log("CLICKURL", url);
    const localIp = getRandomLocalIp();

    try {
      // =========================
      // СЛУЧАЙ 1: roscadastres.com
      // =========================
      if (url.includes("api.roscadastres.com")) {
        console.log("🔍 roscadastres flow...");
        const cadUrl = `https://api.roscadastres.com/pkk_files/coordinates2.php?t=${convertedType}&lat=${yandexX}&lng=${yandexY}&lat_merc=${x}&lng_merc=${y}`;

        const response = await axios({
          method: "GET",
          url: cadUrl,
          timeout: 3000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "api.roscadastres.com"
          },
          httpAgent: new http.Agent({ localAddress: localIp }),
          httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
        });

        const cadnumber = response?.data?.features?.[0]?.attrs?.cn;
        if (!cadnumber) throw new Error("No cadnumber");

        const localIp1 = getRandomLocalIp();
        const objectUrl = `https://api.roscadastres.com/pkk_files/data2.php?type=${convertedType}&id=${cadnumber}`;
        console.log("objectUrl", objectUrl);

        const response1 = await axios({
          method: "GET",
          url: objectUrl,
          timeout: 3000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "api.roscadastres.com"
          },
          httpAgent: new http.Agent({ localAddress: localIp1 }),
          httpsAgent: new https.Agent({ localAddress: localIp1, rejectUnauthorized: false }),
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
          method: "GET",
          url,
          timeout: 4000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "test.fgishub.ru",
            "Origin": origin,
          },
          httpAgent: new http.Agent({ localAddress: localIp }),
          httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
        });

        if (resp?.data?.features?.length > 0) {
          lastSuccessfulIndex = idx;
          return resp.data;
        }
      }

      // =========================
      // СЛУЧАЙ 3: binep.ru — POST поиск по координатам
      // =========================
      if (url.includes("binep.ru/api/v3/search")) {
        console.log("🔍 binep flow...");
        const postBody = { coord: [parseFloat(yandexY), parseFloat(yandexX)] };
        const localIp2 = getRandomLocalIp();

        const resp = await axios({
          method: "POST",
          url,
          timeout: 4000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "binep.ru",
          },
          data: postBody,
          httpAgent: new http.Agent({ localAddress: localIp2 }),
          httpsAgent: new https.Agent({ localAddress: localIp2, rejectUnauthorized: false }),
        });

        if (resp?.data?.features?.length) {
          lastSuccessfulIndex = idx;
          return resp.data;
        }
      }

      // =========================
      // СЛУЧАЙ 4: nspd.gov.ru
      // =========================
      if (url.includes("nspd.gov.ru")) {
        console.log("🔍 nspd.gov.ru flow...");
        const localIp2 = getRandomLocalIp();
        const referer = makeNspdReferer();

        const resp = await axios({
          method: "GET",
          url,
          timeout: 4000,
          headers: {
            "User-Agent": userAgent.toString(),
            "Host": "nspd.gov.ru",
            "Referer": referer,
          },
          httpAgent: new http.Agent({ localAddress: localIp2 }),
          httpsAgent: new https.Agent({ localAddress: localIp2, rejectUnauthorized: false }),
        });

        if (resp?.data?.features?.length || resp?.data?.data?.features?.length) {
          lastSuccessfulIndex = idx;
          return resp.data;
        }
      }

      // =========================
      // Стандартный WMS запрос
      // =========================
      console.log("standard flow...");
      const headers = { "User-Agent": userAgent.toString() };
      if (url.includes("pub.fgislk.gov.ru")) {
        headers["Host"] = "pub.fgislk.gov.ru";
        headers["Referer"] = "https://pub.fgislk.gov.ru/map";
      }

      const response = await axios({
        method: "GET",
        url,
        timeout: 3000,
        headers,
        httpAgent: new http.Agent({ localAddress: localIp }),
        httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
      });

      if (response?.data?.features?.length) {
        lastSuccessfulIndex = idx;
        return response.data;
      }

      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
    } catch (err) {
      return tryUrlsSequentially(idx + 1, attemptsLeft - 1);
    }
  }

  const startFrom = (lastSuccessfulIndex + 1) % clickUrls.length;

  try {
    const data = await tryUrlsSequentially(startFrom, clickUrls.length);
    res.json(data || "error");
  } catch (e) {
    res.json("error");
  }
});

export default router;
