const express = require('express');
const multer = require('multer');
const plist = require('plist');
const fs = require('fs');
const path = require('path');
const db = require('./models');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const upload = multer({ dest: 'uploads/' });

db.sequelize.sync({ force: true });  // Set to `force: true` for initial sync, then remove or set to `false`

app.use(express.json());

app.post('/upload', upload.single('file'), async (req, res) => {
    const appName = req.body.appName;
    const file = req.file;

    if (!appName || !file) {
        return res.status(400).send('AppName and file are required.');
    }

    const filePath = path.join(__dirname, file.path);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedData = plist.parse(fileContent);
    const files = parsedData.files;

    const records = [];

    for (const key in files) {
        const hash = files[key];
        await db.KeyHash.create({ appName, key, hash: hash.toString('base64') });
        records.push({ appName, key, hash: hash.toString('base64') });
    }

    fs.unlinkSync(filePath); // Clean up the uploaded file

    const csvWriter = createCsvWriter({
        path: 'uploads/uploaded_data.csv',
        header: [
            { id: 'appName', title: 'App Name' },
            { id: 'key', title: 'Key' },
            { id: 'hash', title: 'Hash' }
        ]
    });

    await csvWriter.writeRecords(records);

    res.status(200).download('uploads/uploaded_data.csv', 'uploaded_data.csv');
});

app.post('/check', upload.single('file'), async (req, res) => {
    const appName = req.body.appName;
    const file = req.file;

    if (!file) {
        return res.status(400).send('File is required.');
    }

    const filePath = path.join(__dirname, file.path);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedData = plist.parse(fileContent);
    const files = parsedData.files;

    const keys = Object.keys(files);
    const hashes = keys.map(key => files[key].toString('base64'));

    let whereClause = {
        key: keys,
        hash: hashes
    };

    if (appName) {
        whereClause.appName = appName;
    }

    const existingEntries = await db.KeyHash.findAll({
        where: whereClause
    });

    fs.unlinkSync(filePath); // Clean up the uploaded file

    const matchedRecords = existingEntries.map(entry => ({
        appName: entry.appName,
        key: entry.key,
        hash: entry.hash
    }));

    const csvWriter = createCsvWriter({
        path: 'uploads/matched_data.csv',
        header: [
            { id: 'appName', title: 'App Name' },
            { id: 'key', title: 'Key' },
            { id: 'hash', title: 'Hash' }
        ]
    });

    await csvWriter.writeRecords(matchedRecords);

    res.status(200).json({
        message: `Found ${existingEntries.length} existing key-hash pairs in the database.`,
        matchedCount: existingEntries.length,
        csvFilePath: 'uploads/matched_data.csv'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
