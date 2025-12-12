const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

// --- 1. 初始化設定 (必須在最上面) ---
const app = express();
const PORT = 3000;
const DB_PATH = './database.db';

// --- 2. 連接資料庫 ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// --- 3. 設定 Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- 4. 路由 (Routes) ---

// 首頁
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// [API] 取得所有國家列表 (給第 1 題下拉選單用)
app.get('/api/countries', (req, res) => {
    const sql = "SELECT id, name FROM Countries ORDER BY name";
    db.all(sql, [], (err, rows) => {
        if (err) return res.send("Error");
        let options = '<option value="">-- Select a Country --</option>';
        rows.forEach(r => {
            options += `<option value="${r.id}">${r.name}</option>`;
        });
        res.send(options);
    });
});

// [API] 取得所有次區域列表 (給第 2 題下拉選單用)
app.get('/api/subregions', (req, res) => {
    const sql = "SELECT id, name FROM SubRegions ORDER BY name";
    db.all(sql, [], (err, rows) => {
        if (err) return res.send("Error");
        let options = '<option value="">-- Select Sub-Region --</option>';
        rows.forEach(r => {
            options += `<option value="${r.id}">${r.name}</option>`;
        });
        res.send(options);
    });
});

// [API] 取得所有年份列表 (給第 2 題下拉選單用)
app.get('/api/years', (req, res) => {
    const sql = "SELECT DISTINCT year FROM U5MR_Records ORDER BY year DESC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.send("Error");
        let options = '<option value="">-- Select Year --</option>';
        rows.forEach(r => {
            options += `<option value="${r.year}">${r.year}</option>`;
        });
        res.send(options);
    });
});

// --- 報表功能 ---

// 功能 1：查詢某國家的歷史數據
app.post('/report/1', (req, res) => {
    const country_id = req.body.country_id;
    const sql = `SELECT year, u5mr FROM U5MR_Records WHERE country_id = ? ORDER BY year DESC`;

    db.all(sql, [country_id], (err, rows) => {
        if (err) return res.send(err.message);
        if (!rows || rows.length === 0) return res.send("No data found.");

        let html = "<table><tr><th>Year</th><th>U5MR</th></tr>";
        rows.forEach(r => {
            html += `<tr><td>${r.year}</td><td>${r.u5mr}</td></tr>`;
        });
        html += "</table>";
        res.send(html);
    });
});

// 功能 2：次區域 + 年份 -> 顯示各國數據
app.post('/report/2', (req, res) => {
    const { subregion_id, year } = req.body;
    const sql = `
        SELECT c.name, r.u5mr 
        FROM U5MR_Records r 
        JOIN Countries c ON r.country_id = c.id 
        WHERE c.subregion_id = ? AND r.year = ? 
        ORDER BY r.u5mr ASC
    `;

    db.all(sql, [subregion_id, year], (err, rows) => {
        if (err) return res.send(err.message);
        if (!rows || rows.length === 0) return res.send("No data found for this region/year.");

        let html = "<table><tr><th>Country</th><th>U5MR</th></tr>";
        rows.forEach(r => {
            html += `<tr><td>${r.name}</td><td>${r.u5mr}</td></tr>`;
        });
        html += "</table>";
        res.send(html);
    });
});
// [API] 取得所有區域列表 (給第 3 題下拉選單用)
app.get('/api/regions', (req, res) => {
    const sql = "SELECT id, name FROM Regions ORDER BY name";
    db.all(sql, [], (err, rows) => {
        if (err) return res.send("Error");
        let options = '<option value="">-- Select Region --</option>';
        rows.forEach(r => {
            options += `<option value="${r.id}">${r.name}</option>`;
        });
        res.send(options);
    });
});

// [API] 功能 3：區域 + 年份 -> 顯示該區底下 次區域的平均 U5MR
app.post('/report/3', (req, res) => {
    const { region_id, year } = req.body;

    // SQL 邏輯：
    // 1. 連結 4 張表：U5MR -> Countries -> SubRegions
    // 2. 篩選：指定的 region_id 和 year
    // 3. 分組：依據 SubRegions.name 分組 (GROUP BY)
    // 4. 計算：用 AVG(u5mr) 算出平均
    // 5. 排序：依照平均值排序
    const sql = `
        SELECT s.name, AVG(ur.u5mr) as avg_u5mr
        FROM U5MR_Records ur
        JOIN Countries c ON ur.country_id = c.id
        JOIN SubRegions s ON c.subregion_id = s.id
        WHERE s.region_id = ? AND ur.year = ?
        GROUP BY s.name
        ORDER BY avg_u5mr ASC
    `;

    db.all(sql, [region_id, year], (err, rows) => {
        if (err) return res.send(err.message);
        if (!rows || rows.length === 0) return res.send("No data found.");

        let html = "<table><tr><th>Sub-Region</th><th>Average U5MR</th></tr>";
        rows.forEach(r => {
            // toFixed(2) 用來取小數點後兩位
            html += `<tr><td>${r.name}</td><td>${r.avg_u5mr.toFixed(2)}</td></tr>`;
        });
        html += "</table>";
        res.send(html);
    });
});

// [API] 功能 4：關鍵字搜尋 (限定 2023 年)
app.post('/search', (req, res) => {
    const keyword = req.body.keyword;

    // SQL 邏輯：
    // 1. 連結 Countries 和 U5MR_Records
    // 2. WHERE 條件：
    //    - 年份必須是 2023 (題目要求)
    //    - 國家名稱包含關鍵字 (LIKE %關鍵字%)
    // 3. ORDER BY：依照國家名稱排序
    const sql = `
        SELECT c.name, r.u5mr 
        FROM Countries c
        JOIN U5MR_Records r ON c.id = r.country_id
        WHERE r.year = 2023 AND c.name LIKE ? 
        ORDER BY c.name ASC
    `;

    // % 符號是 SQL 的萬用字元，代表前後可以有任何文字
    db.all(sql, [`%${keyword}%`], (err, rows) => {
        if (err) return res.send(err.message);

        if (!rows || rows.length === 0) {
            return res.send("<p>No matches found for 2023.</p>");
        }

        let html = "<table><tr><th>Country</th><th>U5MR (2023)</th></tr>";
        rows.forEach(r => {
            html += `<tr><td>${r.name}</td><td>${r.u5mr}</td></tr>`;
        });
        html += "</table>";
        res.send(html);
    });
});

// [API] 功能 5：新增下一年的紀錄
app.post('/record/add', (req, res) => {
    const { country_id, u5mr } = req.body;

    // 步驟 1: 先找出該國家目前最大的年份
    db.get("SELECT MAX(year) as max_year FROM U5MR_Records WHERE country_id = ?", [country_id], (err, row) => {
        if (err) return res.send(err.message);

        // 如果該國完全沒資料，就預設從 2000 年開始，否則就年份 + 1
        const nextYear = (row && row.max_year) ? row.max_year + 1 : 2000;

        // 步驟 2: 插入新資料
        const sql = "INSERT INTO U5MR_Records (country_id, year, u5mr) VALUES (?, ?, ?)";

        db.run(sql, [country_id, nextYear, u5mr], function (err) {
            if (err) {
                // 如果重複新增同一年，資料庫會報錯 (因為我們有設 UNIQUE 限制)
                return res.send("Error: " + err.message);
            }
            res.send(`Success! Added record for <strong>Year ${nextYear}</strong> with U5MR: ${u5mr}`);
        });
    });
});
// [API] 功能 6：更新現有紀錄
app.post('/record/update', (req, res) => {
    const { country_id, year, u5mr } = req.body;

    // SQL UPDATE 語法
    const sql = "UPDATE U5MR_Records SET u5mr = ? WHERE country_id = ? AND year = ?";

    db.run(sql, [u5mr, country_id, year], function (err) {
        if (err) return res.send("Error: " + err.message);

        // this.changes 代表受影響的行數
        if (this.changes === 0) {
            return res.send("No record found for this country and year. Cannot update.");
        }

        res.send(`Success! Updated record for <strong>Year ${year}</strong> with new U5MR: ${u5mr}`);
    });
});

// [API] 功能 7：刪除指定範圍內的紀錄
app.post('/record/delete', (req, res) => {
    const { country_id, start_year, end_year } = req.body;

    // 防呆機制：確保起始年份不大於結束年份
    if (parseInt(start_year) > parseInt(end_year)) {
        return res.send("Error: Start Year cannot be greater than End Year.");
    }

    // SQL DELETE 語法
    // 使用 AND year BETWEEN ? AND ? 也可以，這裡用 >= 和 <= 更直觀
    const sql = "DELETE FROM U5MR_Records WHERE country_id = ? AND year >= ? AND year <= ?";

    db.run(sql, [country_id, start_year, end_year], function (err) {
        if (err) return res.send("Error: " + err.message);

        // this.changes 代表刪除了幾筆資料
        if (this.changes === 0) {
            return res.send("No records found to delete in this range.");
        }

        res.send(`Success! Deleted <strong>${this.changes}</strong> records for this country between ${start_year} and ${end_year}.`);
    });
});

// [API] 功能 8 (自選)：列出當年 U5MR 最高的 5 個國家
app.post('/report/8', (req, res) => {
    const { year } = req.body;

    // SQL: 找出當年數據 -> 降序排列 (最高在前) -> 取前 5 筆
    const sql = `
        SELECT c.name, r.u5mr 
        FROM U5MR_Records r 
        JOIN Countries c ON r.country_id = c.id 
        WHERE r.year = ? 
        ORDER BY r.u5mr DESC 
        LIMIT 5
    `;

    db.all(sql, [year], (err, rows) => {
        if (err) return res.send(err.message);
        if (!rows || rows.length === 0) return res.send("No data found for this year.");

        let html = "<table><tr><th>Rank</th><th>Country</th><th>U5MR</th></tr>";
        rows.forEach((r, index) => {
            html += `<tr><td>${index + 1}</td><td>${r.name}</td><td>${r.u5mr}</td></tr>`;
        });
        html += "</table>";
        res.send(html);
    });
});
// --- 5. 啟動伺服器 (必須在最下面) ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});