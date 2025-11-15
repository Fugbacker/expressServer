import express from "express";
import cors from "cors";

// API роуты
import clickRouter from "./api/click.js";
import historyRouter from "./api/history.js";
import ipsRouter from "./api/ips.js";
import searchRouter from "./api/search.js";
import testRouter from "./api/test.js";
import tilesRouter from "./api/tiles.js";
import tooltipsRouter from "./api/tooltips.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/click", clickRouter);
app.use("/api/history", historyRouter);
app.use("/api/ips", ipsRouter);
app.use("/api/search", searchRouter);
app.use("/api/test", testRouter);
app.use("/api/tiles", tilesRouter);
app.use("/api/tooltips", tooltipsRouter);

app.get("/", (req, res) => {
  res.send("Express API Server is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
