// api/tooltips.js
import express from "express";
import axios from "axios";
import UserAgent from "user-agents";
import http from "http";
import https from "https";

const router = express.Router();

router.get("/", async (req, res) => {
  const address = req.query.address;
  const userAgent = new UserAgent();

  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  let cachedIps = [];
  try {
    const ipResponse = await axios.get(`${baseUrl}/api/ips`);
    cachedIps = ipResponse.data;
  } catch (e) {
    console.error("Ошибка при получении локальных IP:", e.message);
  }

  const getRandomLocalIp = () => cachedIps[Math.floor(Math.random() * cachedIps.length)];
  const localIp = getRandomLocalIp();

  try {
    // 1️⃣ rosreestr
    const url1 = encodeURI(`https://lk.rosreestr.ru/account-back/address/search?term=${address}`);
    const resp1 = await axios({
      method: "GET",
      url: url1,
      timeout: 5000,
      headers: { "User-Agent": userAgent.toString() },
      httpAgent: new http.Agent({ localAddress: localIp }),
      httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
    });
    return res.json(resp1.data);
  } catch {}

  try {
    // 2️⃣ nspd
    const url2 = encodeURI(`https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${address}`);
    console.log("NSPDTOOLTIPSURL", url2);
    const resp2 = await axios({
      method: "GET",
      url: url2,
      timeout: 5000,
      headers: { "User-Agent": userAgent.toString(), "Host": "nspd.gov.ru" },
      httpAgent: new http.Agent({ localAddress: localIp }),
      httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
    });
    return res.json(resp2?.data?.data?.features || []);
  } catch {}

  try {
    // 3️⃣ mobile rosreestr
    const url3 = encodeURI(`https://mobile.rosreestr.ru/api/v1/address?term=${address}`);
    const resp3 = await axios({
      method: "GET",
      url: url3,
      timeout: 5000,
      headers: { "User-Agent": userAgent.toString() },
      httpAgent: new http.Agent({ localAddress: localIp }),
      httpsAgent: new https.Agent({ localAddress: localIp, rejectUnauthorized: false }),
    });
    return res.json(resp3.data);
  } catch (error) {
    console.error("Ошибка tooltips:", error.message);
    return res.json("error");
  }
});

export default router;
