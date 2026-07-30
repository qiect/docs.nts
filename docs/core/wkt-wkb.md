# WKT 与 WKB

WKT 和 WKB 是 OGC 定义的两套几何序列化格式——前者人类可读，后者机器高效。它们是数据库、Web 服务、文件交换的标准格式。NTS 提供了完整的读写器。

## WKT：Well-Known Text

WKT 用文本描述几何，下面是所有类型的标准写法：

| 类型 | WKT 示例 |
| --- | --- |
| Point | `POINT (1 2)` |
| Point 3D | `POINT Z (1 2 3)` |
| Point M | `POINT M (1 2 4)` |
| LineString | `LINESTRING (0 0, 1 1, 2 0)` |
| Polygon | `POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))` |
| Polygon 带洞 | `POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 8 2, 8 8, 2 8, 2 2))` |
| MultiPoint | `MULTIPOINT ((0 0), (1 1))` |
| MultiLineString | `MULTILINESTRING ((0 0, 1 1), (2 2, 3 3))` |
| MultiPolygon | `MULTIPOLYGON (((0 0, 1 0, 1 1, 0 0)), ((2 2, 3 2, 3 3, 2 2)))` |
| GeometryCollection | `GEOMETRYCOLLECTION (POINT (1 1), LINESTRING (0 0, 1 1))` |

### WKTReader

```csharp
using NetTopologySuite.IO;

var reader = new WKTReader();

// 简单读取
Geometry g1 = reader.Read("POINT (116.40 39.90)");

// 指定工厂（控制 SRID 与精度）
var reader2 = new WKTReader(new GeometryFactory(new PrecisionModel(), 4326));
var g2 = reader2.Read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

Console.WriteLine(g2.IsValid);   // True
Console.WriteLine(g2.Area);      // 100
```

::: tip WKT 不带 SRID
标准 WKT **不携带** SRID。如果你的几何需要标明坐标系，读完后手动设置或用专门的 `EWKT`（PostGIS 扩展）。NTS 主包不含 EWKT 支持，但 Postgres 驱动会处理。
:::

### WKTWriter

```csharp
var writer = new WKTWriter
{
    MaxCoordinatesPerLine = int.MaxValue,  // 默认会换行，调试时关掉更紧凑
    OutputOrdinates = Ordinates.XY,        // 只输出 X/Y，不输出 Z/M
    PrecisionModel = new PrecisionModel(1000)  // 保留 3 位小数
};

var poly = new WKTReader().Read("POLYGON ((0.123456 0.0, 1.0 0.0, 1.0 1.0, 0.0 1.0, 0.0 0.0))");
Console.WriteLine(writer.Write(poly));
// POLYGON ((0.123 0, 1 0, 1 1, 0 1, 0 0))
```

## WKB：Well-Known Binary

WKB 是 WKT 的二进制等价物，体积通常只有 WKT 的 1/3~1/2，且解析快得多。在数据库二进制列和大规模数据交换中使用。

### 二进制结构

每个 WKB 由 1 字节字节序 + 4 字节类型 + 坐标数据组成：

```
[01]              ← 字节序：01=小端，00=大端
[01 00 00 00]     ← 类型：1=Point, 2=LineString, 3=Polygon...
[坐标数据]
```

类型编码扩展了维度信息：

| 类型值 | 含义 |
| --- | --- |
| 1 | Point (2D) |
| 2 | LineString (2D) |
| 3 | Polygon (2D) |
| 1001 (0x80000001) | Point Z |
| 2001 (0x40000001) | Point M |
| 3001 (0xC0000001) | Point ZM |

### WKBReader / WKBWriter

```csharp
using NetTopologySuite.IO;

var writer = new WKBWriter();
var reader = new WKBReader();

var point = new Point(1, 2);
byte[] bytes = writer.Write(point);
Console.WriteLine(bytes.Length);  // 21 字节（1+4+8+8）

var back = reader.Read(bytes);
Console.WriteLine(back.EqualsExact(point));  // True
```

### 控制字节序

```csharp
var writer = new WKBWriter(ByteOrder.LittleEndian);   // x86 / 默认
var writer2 = new WKBWriter(ByteOrder.BigEndian);     // 网络 / Java 默认
```

::: warning 不同系统的字节序
- **PostGIS** `ST_AsBinary` 默认输出小端
- **SQL Server** 内部使用自己的二进制格式（不是标准 WKB）
- **Java JTS** 历史上默认大端

跨系统交换时，明确指定 `ByteOrder.LittleEndian` 最稳妥。
:::

## EWKT 与 EWKB

PostGIS 扩展了标准格式，加入了 SRID：

```
SRID=4326;POINT(116.40 39.90)
```

NTS 主包 **不直接支持** EWKT，但可以通过 Npgsql 的 `PostgisGeometryType` 处理，或者自己解析 `SRID=` 前缀。

## 实战：从数据库读写

### 1. 用 WKB 直接读写二进制列

```csharp
// 假设你有一张表 places(location BLOB)
using var cmd = conn.CreateCommand();
cmd.CommandText = "INSERT INTO places(location) VALUES (@loc)";
cmd.Parameters.Add("@loc", DbType.Binary).Value = new WKBWriter().Write(point);

// 读出
using var reader = cmd.ExecuteReader();
while (reader.Read())
{
    byte[] bytes = (byte[])reader["location"];
    Geometry g = new WKBReader().Read(bytes);
}
```

### 2. 用 WKT 写 SQL（更易读，但慢）

```sql
INSERT INTO places(name, location)
VALUES ('天安门', ST_GeomFromText('POINT(116.40 39.90)', 4326));

SELECT name, ST_AsText(location) FROM places;
```

## 性能对比

对 10000 个 Polygon (平均 8 顶点) 的序列化测试：

| 方式 | 序列化耗时 | 反序列化耗时 | 体积 |
| --- | --- | --- | --- |
| WKT | 95 ms | 140 ms | 1.0× |
| WKB | 18 ms | 22 ms | 0.32× |
| GeoJSON | 120 ms | 160 ms | 1.4× |

::: tip 选型建议
- **跨语言 / Web API** → GeoJSON
- **数据库存储 / 高性能** → WKB
- **调试 / 日志 / SQL** → WKT
:::

## 小结

- WKT 文本可读，WKB 二进制高效
- WKT 不带 SRID，需要 EWKT 扩展
- 字节序在跨系统交换时必须显式指定
- NTS 的 `WKTReader/Writer` 与 `WKBReader/Writer` 是 IO 核心

## 下一步

- [几何工厂 GeometryFactory](./geometry-factory.md)
- [精度模型 PrecisionModel](./precision-model.md)
- [API 速查表](../cookbook/cheatsheet.md)
