// api/ips.js
import express from "express";
import os from "os";

const router = express.Router();

router.get("/", (req, res) => {
  const nets = os.networkInterfaces();
  const ipList = [];
  console.log('NETS', nets)
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (
        net.family === "IPv4" &&
        !net.internal &&
        !net.address.startsWith("192.168.") &&
        !net.address.startsWith("10.") &&
        !net.address.startsWith("172.")
      ) {
        ipList.push(net.address);
      }
    }
  }

  res.status(200).json(ipList);
});

export default router;
