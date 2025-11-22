import { MongoClient, ObjectId } from "mongodb";
import express from "express";

const router = express.Router();
const mongoUrl = "mongodb://127.0.0.1:27018";
const client = new MongoClient(mongoUrl, { useUnifiedTopology: true });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// Настройки
const COLLECTION_NAME = "cadastrMap";
const STATE_COLLECTION = "_cleanup_state";
const BATCH_SIZE = 2000; // размер батча
const BUCKET_SIZE = 10;  // размер "ведра" для Promise.all
const MAX_BATCHES = 200;  // сколько батчей обрабатывать за один запрос

// Хвост бинарника, по которому ищем дубликаты
const TAIL_TO_DELETE = "jp+WL6XFx3OD00Y1J4ZAAAAAAC7Uq4IdDouNcafZRHgv5Wfy6dWJWl0+nzLbN1fe1YAAAAAANySTbX5gNdp0ZnEIsC/ddKa0A5NeJtr8gAAAAAAM6O84RYdTu9sd9+/iwDjLf86rImKfzrVLtSeCwAAAAAAnUvz6T6r4o85/P66HxcBGh0/EROsmPRVOSSx9jwAAACm4W++dkAT1YGDFwAAAABJRU5ErkJggg==";

async function ensureClient() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
}

async function processBatch(db, batchNumber) {
  const tiles = db.collection(COLLECTION_NAME);
  const state = db.collection(STATE_COLLECTION);

  // Загружаем позицию
  const docState = await state.findOne({ key: "cleanup" });
  let fromId = docState?.lastId ? new ObjectId(docState.lastId) : null;

  console.log(`\n=== Batch ${batchNumber} Start ===`);
  console.log("Last processed _id:", fromId || "none");

  // Для обратного обхода: берем _id < fromId
  const query = fromId ? { _id: { $lt: fromId } } : {};

  // Берём батч в обратном порядке
  const batch = await tiles
    .find(query)
    .sort({ _id: -1 }) // обратный порядок
    .limit(BATCH_SIZE)
    .toArray();

  console.log(`Batch loaded: ${batch.length} documents.`);

  if (batch.length === 0) return null; // конец коллекции

  const lastId = batch[batch.length - 1]._id;
  const duplicates = [];

  // Разбиваем на ведра для Promise.all
  for (let i = 0; i < batch.length; i += BUCKET_SIZE) {
    const bucket = batch.slice(i, i + BUCKET_SIZE);

    await Promise.all(
      bucket.map(async (doc) => {
        if (!doc.image?.buffer) return;

        // Берем последние байты бинарника по длине TAIL_TO_DELETE
        const buf = doc.image.buffer.toString("base64").slice(-TAIL_TO_DELETE.length)
        const tail = buf.slice(-TAIL_TO_DELETE.length).toString("base64");
        // const buf = doc.image.buffer;
        // const tail = buf.slice(-TAIL_TO_DELETE.length).toString("base64");
        // console.log("БИНАРНИК конца:", tail);

        if (tail === TAIL_TO_DELETE) {
          console.log("Дубликат найден:", tail);
          duplicates.push(doc._id);
        }
      })
    );

    console.log(`Processed ${Math.min(i + BUCKET_SIZE, batch.length)}/${batch.length} documents in this batch...`);
  }

  // Удаляем дубликаты
  if (duplicates.length > 0) {
    const delResult = await tiles.deleteMany({ _id: { $in: duplicates } });
    console.log(`Deleted ${delResult.deletedCount} duplicates in this batch.`);
  } else {
    console.log("No duplicates found in this batch.");
  }

  // Сохраняем прогресс
  await state.updateOne(
    { key: "cleanup" },
    { $set: { lastId: String(lastId) } },
    { upsert: true }
  );

  console.log(`Batch finished. Last _id: ${lastId}`);
  console.log("-------------------------------------------------");

  return { processed: batch.length, deleted: duplicates.length, lastId };
}

router.get("/", async (req, res) => {
  try {
    await ensureClient();
    const db = client.db(process.env.MONGO_COLLECTION);

    const results = [];

    for (let i = 0; i < MAX_BATCHES; i++) {
      const result = await processBatch(db, i + 1);
      if (!result) break; // достигли конца коллекции
      results.push(result);
    }

    res.json({
      message: "Batch processing finished",
      batchesProcessed: results.length,
      results,
      nextRun: "Обнови страницу, если есть ещё батчи",
    });
  } catch (e) {
    console.error("Ошибка:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
