# 数据库与 PostGIS

NTS 的几何模型与各数据库的空间类型 **一一对应**。本节介绍如何在 PostGIS、SQL Server、SpatiaLite 之间正确交换数据。

## 数据库空间类型对照

| NTS 类型 | PostGIS | SQL Server | SpatiaLite | MySQL |
| --- | --- | --- | --- | ---|
| `Point` | `geometry(Point)` | `geography/geometry::Point` | `POINT` | `POINT` |
| `LineString` | `geometry(LineString)` | `LineString` | `LINESTRING` | `LINESTRING` |
| `Polygon` | `geometry(Polygon)` | `Polygon` | `POLYGON` | `POLYGON` |
| `MultiPoint` | `geometry(MultiPoint)` | `MultiPoint` | `MULTIPOINT` | `MULTIPOINT` |
| `MultiLineString` | `geometry(MultiLineString)` | `MultiLineString` | `MULTILINESTRING` | `MULTILINESTRING` |
| `MultiPolygon` | `geometry(MultiPolygon)` | `MultiPolygon` | `MULTIPOLYGON` | `MULTIPOLYGON` |

## PostGIS 深度集成

PostGIS 是 PostgreSQL 的空间扩展，是开源 GIS 的黄金标准。

### 1. 启用 PostGIS

```sql
-- 一次性，每个数据库执行一次
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;   -- 可选：拓扑扩展
```

### 2. 建表与索引

```sql
CREATE TABLE places (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL,
    location geometry(Point, 4326) NOT NULL   -- 显式 SRID
);

-- 空间索引（必做）
CREATE INDEX idx_places_location ON places USING GIST (location);
```

### 3. 用 Npgsql 直接读写（不用 EF Core）

```csharp
using Npgsql;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

// 注册 NTS 类型映射
NpgsqlConnection.GlobalTypeMapper.UseNetTopologySuite();

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

// 写
await using (var cmd = new NpgsqlCommand(
    "INSERT INTO places(name, location) VALUES (@name, @loc)", conn))
{
    cmd.Parameters.AddWithValue("name", "天安门");
    cmd.Parameters.AddWithValue("loc", new Point(116.40, 39.90) { SRID = 4326 });
    await cmd.ExecuteNonQueryAsync();
}

// 读
await using (var cmd = new NpgsqlCommand(
    "SELECT name, location FROM places", conn))
await using (var reader = await cmd.ExecuteReaderAsync())
{
    while (await reader.ReadAsync())
    {
        string name = reader.GetString(0);
        Point p = (Point)reader[1];   // 直接拿到 NTS Point
        Console.WriteLine($"{name}: {p.AsText()}");
    }
}
```

::: tip UseNetTopologySuite 的作用
`NpgsqlConnection.GlobalTypeMapper.UseNetTopologySuite()` 注册了 NTS 与 PostgreSQL `geometry` 类型的双向映射。你不再需要手动用 WKB 转换——Npgsql 自动处理。
:::

### 4. 调用 PostGIS 函数

```csharp
// 用 ST_DWithin 做半径查询（用索引）
await using var cmd = new NpgsqlCommand(@"
    SELECT name, ST_Distance(location, @origin) AS d
    FROM places
    WHERE ST_DWithin(location, @origin, @radius)
    ORDER BY d
    LIMIT 10", conn);

cmd.Parameters.AddWithValue("origin", new Point(116.40, 39.90) { SRID = 4326 });
cmd.Parameters.AddWithValue("radius", 0.05);   // 度
```

## SpatiaLite (SQLite)

SpatiaLite 是 SQLite 的空间扩展，轻量、跨平台，适合桌面与移动应用。

### 启用 SpatiaLite

```csharp
var connStr = "Data Source=nts.db;";
// 加载 mod_spatialite 扩展
using var conn = new SqliteConnection(connStr);
conn.Open();
conn.LoadExtension("mod_spatialite");   // Linux/macOS
// Windows: "mod_spatialite-7.dll" 等

// 初始化元数据
using (var cmd = conn.CreateCommand())
{
    cmd.CommandText = "SELECT InitSpatialMetadata(1)";
    cmd.ExecuteNonQuery();
}
```

### 配合 EF Core

`Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite` 包内部已经处理了 SpatiaLite 兼容。但需要确保运行时能加载扩展——通常在 `UseSqlite` 时配置：

```csharp
options.UseSqlite(connStr, sql => sql.UseNetTopologySuite());
```

EF Core 的 SQLite 提供程序会自动初始化扩展。

## SQL Server 空间类型

SQL Server 内置 `geometry` 和 `geography` 类型，无需额外扩展。

```csharp
using Microsoft.Data.SqlClient;

// 通过 SqlMapper 注册 NTS（Dapper 场景）
// 或用 EF Core UseSqlServer(sql => sql.UseNetTopologySuite())

using var conn = new SqlConnection(connStr);
await conn.OpenAsync();

// 注意：SQL Server 用 SqlGeography/SqlGeometry，需通过 WKB 桥接
using var cmd = new SqlCommand(
    "INSERT INTO Places(Name, Location) VALUES(@name, geography::STGeomFromText(@wkt, 4326))", conn);
cmd.Parameters.AddWithValue("name", "天安门");
cmd.Parameters.AddWithValue("wkt", "POINT(116.40 39.90)");
await cmd.ExecuteNonQueryAsync();
```

::: warning SQL Server 的特殊性
SQL Server 用 `Microsoft.SqlServer.Types` 的 `SqlGeometry`/`SqlGeography`，**不是直接用 NTS**。要交换数据需要通过 WKB 或 WKT 转换。EF Core 的 `UseSqlServer().UseNetTopologySuite()` 会自动处理这个桥接。
:::

## 坐标系与 SRID

### 各数据库的 SRID 表

| SRID | 含义 |
| --- | --- |
| 4326 | WGS84 经纬度（最常用） |
| 4490 | CGCS2000 经纬度（中国国标） |
| 3857 | Web 墨卡托（米制，Web 地图） |
| 4527 | CGCS2000 / 3 度带 / 38 度带（米制，中国高精度） |

### PostGIS 中的坐标系转换

```sql
-- 把经纬度 (4326) 转成 Web 墨卡托 (3857) 再算距离（米）
SELECT ST_Distance(
    ST_Transform(location, 3857),
    ST_Transform(ST_SetSRID(ST_MakePoint(116.40, 39.90), 4326), 3857)
) AS meters
FROM places;
```

### 在 NTS 中转坐标系

NTS **不直接提供** 坐标系转换——这是 ProjNet 库的职责：

```bash
dotnet add package ProjNet
```

```csharp
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

Geometry Project(Geometry g, int fromSrid, int toSrid)
{
    var csFactory = new CoordinateSystemFactory();
    var from = csFactory.CreateFromWkt(GetWktForSrid(fromSrid));
    var to   = csFactory.CreateFromWkt(GetWktForSrid(toSrid));

    var tf = new CoordinateTransformationFactory()
        .CreateFromCoordinateSystems(from, to);

    var filter = new CoordinateTransformFilter(tf.MathTransform);
    var copy = g.Copy();
    copy.Apply(filter);
    copy.SRID = toSrid;
    return copy;
}

class CoordinateTransformFilter(MathTransform transform) : ICoordinateSequenceFilter
{
    public bool Done => false;
    public bool GeometryChanged => true;

    public void Filter(CoordinateSequence seq, int i)
    {
        double x = seq.GetX(i), y = seq.GetY(i);
        (x, y) = transform.Transform(x, y);
        seq.SetX(i, x);
        seq.SetY(i, y);
    }
}
```

## 数据交换最佳实践

### 1. 永远设置 SRID

```csharp
// ❌ 错误：SRID 默认 0
var p = new Point(116.40, 39.90);

// ✅ 正确
var p = new Point(116.40, 39.90) { SRID = 4326 };
```

### 2. 数据库列约束 SRID

```sql
-- PostGIS：约束列只能存 4326
location geometry(Point, 4326) NOT NULL
```

### 3. 序列化时显式指定

```csharp
// WKB 不携带 SRID。如果跨系统传输，用 EWKB 或单独传 SRID
var bytes = new WKBWriter().Write(geom);
// 配合 SRID 元数据一起传
```

## 性能优化清单

| 措施 | 效果 |
| --- | --- |
| 建空间索引 (GIST / R-tree) | 查询从 O(n) → O(log n) |
| 用 ST_DWithin 替代 Distance < r | PostGIS 能用索引 |
| 限制 SRID 一致 | 避免运行时投影 |
| 避免在 SELECT 中算 Geometry | WKB 序列化开销大，按需取 |
| 用 materialized view 预计算 | 复杂空间聚合大幅加速 |

## 实战：从 PostGIS 迁移到 SQLite

```csharp
// 1. 从 PostGIS 读
NpgsqlConnection.GlobalTypeMapper.UseNetTopologySuite();
using var pg = new NpgsqlConnection(pgConn);
await pg.OpenAsync();
using var cmd = new NpgsqlCommand("SELECT name, location FROM places", pg);
using var reader = await cmd.ExecuteReaderAsync();

// 2. 写入 SQLite（用 EF Core 或原生 SqliteConnection）
while (await reader.ReadAsync())
{
    var name = reader.GetString(0);
    var point = (Point)reader[1];

    // SRID 一致性：SQLite 默认列也是 4326
    sqliteDb.Places.Add(new Place { Name = name, Location = point });
}
await sqliteDb.SaveChangesAsync();
```

## 小结

- NTS 类型与 PostGIS / SpatiaLite / SQL Server 空间类型一一对应
- PostGIS 用 Npgsql + `UseNetTopologySuite()` 直接交换 NTS 对象
- SQLite 用 EF Core 的 NTS 插件，自动处理 SpatiaLite 扩展
- SQL Server 需通过 WKB 桥接（EF Core 已封装）
- **SRID 一致性是空间数据交换的第一守则**

## 下一步

- [EF Core 集成](./ef-core.md)
- [API 速查表](../appendix/cheatsheet.md)
- [官方资料与链接](../appendix/resources.md)
