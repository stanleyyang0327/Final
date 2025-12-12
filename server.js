const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = './database.db';

// 連接資料庫
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// 首頁
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// API: 測試資料庫連線
app.get('/api/test', (req, res) => {
    db.all("SELECT * FROM U5MR_Records LIMIT 5", [], (err, rows) => {
        if (err) return res.send(err.message);

        let html = "<table border='1'><tr><th>ID</th><th>Year</th><th>U5MR</th></tr>";
        rows.forEach(r => {
            html += `<tr><td>${r.id}</td><td>${r.year}</td><td>${r.u5mr}</td></tr>`;
        });
        html += "</table>";
        res.send(html);
    });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));