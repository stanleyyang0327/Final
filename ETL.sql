-- 1. 建立正式 Schema
CREATE TABLE IF NOT EXISTS Regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS SubRegions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    region_id INTEGER,
    FOREIGN KEY(region_id) REFERENCES Regions(id)
);

CREATE TABLE IF NOT EXISTS Countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    iso_alpha3 TEXT UNIQUE,
    subregion_id INTEGER,
    FOREIGN KEY(subregion_id) REFERENCES SubRegions(id)
);

CREATE TABLE IF NOT EXISTS U5MR_Records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_id INTEGER,
    year INTEGER,
    u5mr REAL,
    FOREIGN KEY(country_id) REFERENCES Countries(id),
    UNIQUE(country_id, year)
);

-- 2. ETL 流程

-- [Step 1] 載入區域
INSERT OR IGNORE INTO Regions (name)
SELECT DISTINCT region FROM TempGeo WHERE region IS NOT NULL AND region != '';

-- [Step 2] 載入次區域 (注意：這裡加上了雙引號 "sub-region")
INSERT OR IGNORE INTO SubRegions (name, region_id)
SELECT DISTINCT t."sub-region", r.id
FROM TempGeo t
JOIN Regions r ON t.region = r.name
WHERE t."sub-region" IS NOT NULL AND t."sub-region" != '';

-- [Step 3] 載入國家
INSERT OR IGNORE INTO Countries (name, iso_alpha3, subregion_id)
SELECT DISTINCT t.name, t."alpha-3", s.id
FROM TempGeo t
JOIN SubRegions s ON t."sub-region" = s.name;

-- [Step 4] 載入數據
INSERT OR IGNORE INTO U5MR_Records (country_id, year, u5mr)
SELECT c.id, ts.Year, ts.U5MR
FROM TempStats ts
JOIN Countries c ON ts.Code = c.iso_alpha3
WHERE ts.U5MR IS NOT NULL;

-- 3. 清理
DROP TABLE IF EXISTS TempGeo;
DROP TABLE IF EXISTS TempStats;