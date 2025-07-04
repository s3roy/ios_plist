const express = require("express");
const multer = require("multer");
const plist = require("plist");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const db = require("./models");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const app = express();
const upload = multer({ dest: "uploads/" });

db.sequelize.sync({ force: true });

app.use(cors());
app.use(express.json());

// Base route to check server status
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Use `/app` as the base route for all endpoints
const router = express.Router();

router.post("/upload", upload.single("file"), async (req, res) => {
  const appName = req.body.appName;
  const file = req.file;

  if (!appName || !file) {
    return res.status(400).send("AppName and file are required.");
  }

  const filePath = path.join(__dirname, file.path);
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedData = plist.parse(fileContent);
  const files = parsedData.files;

  const records = [];

  for (const key in files) {
    const hash = files[key];
    try {
      await db.KeyHash.create({ appName, key, hash: hash.toString("base64") });
      records.push({ appName, key, hash: hash.toString("base64") });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        console.log(`Duplicate entry for ${key}, ${hash.toString("base64")}`);
      } else {
        throw error;
      }
    }
  }

  fs.unlinkSync(filePath); // Clean up the uploaded file

  const csvWriter = createCsvWriter({
    path: "uploads/uploaded_data.csv",
    header: [
      { id: "appName", title: "App Name" },
      { id: "key", title: "Key" },
      { id: "hash", title: "Hash" },
    ],
  });

  await csvWriter.writeRecords(records);

  // Read the file and send it as a response
  const csvContent = fs.readFileSync("uploads/uploaded_data.csv");

  res.status(200).json({
    message: "File processed and data saved.",
    filename: file.originalname,
    records,
    file: csvContent.toString(),
  });
});

router.post("/check", upload.single("file"), async (req, res) => {
  const appName = req.body.appName;
  const file = req.file;

  if (!file) {
    return res.status(400).send("File is required.");
  }

  const filePath = path.join(__dirname, file.path);
  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsedData = plist.parse(fileContent);
  const files = parsedData.files;

  const matchedRecords = [];

  for (const key of Object.keys(files)) {
    const hash = files[key].toString("base64");
    const match = await db.KeyHash.findOne({ where: { key, hash } });
    if (match) {
      matchedRecords.push({
        appName: match.appName,
        key: match.key,
        hash: match.hash,
      });
    }
  }

  fs.unlinkSync(filePath); // Clean up the uploaded file

  const csvWriter = createCsvWriter({
    path: "uploads/matched_data.csv",
    header: [
      { id: "appName", title: "App Name" },
      { id: "key", title: "Key" },
      { id: "hash", title: "Hash" },
    ],
  });

  await csvWriter.writeRecords(matchedRecords);

  const csvContent = fs.readFileSync("uploads/matched_data.csv");

  res.status(200).json({
    message: `Found ${matchedRecords.length} existing key-hash pairs in the database.`,
    filename: file.originalname,
    matchedCount: matchedRecords.length,
    file: csvContent.toString(),
  });
});

// Use the router for all routes starting with `/app`
app.use("/app", router);

const PORT = process.env.PORT || 2600; // Ensure the port is set to 2600
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
