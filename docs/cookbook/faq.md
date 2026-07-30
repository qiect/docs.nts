# 常见问题 FAQ

按场景分类的常见问题与解决方案。

## 安装与版本

### Q1: NTS 与 GeoAPI 的关系？

NTS 2.x 已经把 GeoAPI **内联** 到主包，不再需要单独安装 `GeoAPI` 包。如果你看到旧教程让你 `dotnet add package GeoAPI`，那是过时的。只装 `NetTopologySuite` 即可。

### Q2: NTS 支持哪些 .NET 版本？

NTS 2.x 同时支持：

- .NET Framework 4.6.1+
- .NET Core 3.1
- .NET 5/6/7/8
- .NET Standard 2.0

### Q3: NTS 与 EF Core 版本如何搭配？

| EF Core | 推荐的 NTS 插件版本 |
| --- | --- |
| EF Core 8 | `*.NetTopologySuite` 8.x |
| EF Core 7 | `*.NetTopologySuite` 7.x |
| EF Core 6 | `*.NetTopologySuite` 6.x |

EF Core 的 NTS 插件与 EF Core 主版本必须一致。

### Q4: 升级 NTS 后编译报错？

NTS 2.x 有一些破坏性变更，常见修复：

```csharp
// 旧 (NTS 1.x)
var seq = new CoordinateArraySequence(coords);

// 新 (NTS 2.x)
var seq = new CoordinateArraySequence(coords);
// 或用工厂
var seq = factory.CoordinateSequenceFactory.Create(coords);
```

```csharp
// 旧：WKTWriter 默认会换行
// 新：要设置 MaxCoordinatesPerLine 才不换行
var writer = new WKTWriter { MaxCoordinatesPerLine = int.MaxValue };
```

## 几何构造

### Q5: 多边形构造抛 ArgumentException "Points of LinearRing do not form a closed linestring"

`LinearRing` 要求 **首尾坐标相同**：

```csharp
// ❌ 错误
var ring = factory.CreateLinearRing(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10)
    // 缺少闭合点
});

// ✅ 正确
var ring = factory.CreateLinearRing(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10, 10), new Coordinate(0, 10), new Coordinate(0, 0)
});
```

### Q6: IsValid 返回 false，几何是"领结"形状

自相交的多边形无效。修复：

```csharp
if (!poly.IsValid)
{
    poly = GeometryFixer.Fix(poly);   // NTS 2.3+
    // 或 poly = poly.Buffer(0);       // 老版本
}
```

### Q7: 多边形孔洞超出外壳怎么办？

`GeometryFixer` 能修复。或手动用 `Intersection` 把孔洞约束在外壳内：

```csharp
var validHole = hole.Intersection(shell.Buffer(0));
```

## 谓词与判断

### Q8: Contains 与 Covers 有什么区别？

`Contains` 是 **严格内部**——边界接触返回 false。`Covers` 包含边界。

```csharp
poly.Contains(pointOnEdge);   // false
poly.Covers(pointOnEdge);     // true
```

日常业务用 `Covers` 更符合直觉。

### Q9: 两个相交的线 Intersects 返回 false？

可能是浮点精度问题。试试降低精度模型或轻微 `Buffer(epsilon)`：

```csharp
var a = line1.Buffer(1e-6);
if (a.Intersects(line2)) { /* ... */ }
```

### Q10: MultiPolygon.Contains(point) 在任一子多边形内都返回 true 吗？

是的。`MultiPolygon` 的谓词会遍历所有子几何，任一为 true 即返回 true。无需手动遍历。

## 距离与测量

### Q11: Distance 返回的"距离"单位是什么？

是 **坐标系单位**。经纬度下是"度"，米制投影下是"米"。

### Q12: 怎么算两个 GPS 点的真实米距离？

```csharp
// 方案 1：投影到米制后用 Distance（适合批量）
var projected = ProjectToWebMercator(point);
double meters = projected.Distance(otherProjected);

// 方案 2：Haversine 直接算（适合两点）
double meters = Haversine(lon1, lat1, lon2, lat2);
```

Haversine 公式见 [测量与距离](../analysis/measurement.md)。

### Q13: Area 在经纬度下有意义吗？

没有。"平方度"不是物理单位。要么投影到米制，要么用球面公式。

## 性能

### Q14: 1 万个点判断多边形内特别慢

用 `PreparedGeometry`：

```csharp
var prepared = PreparedGeometryFactory.Prepare(polygon);
foreach (var p in points)
    if (prepared.Covers(p)) { /* ... */ }
```

或用 `IndexedPointInAreaLocator`（更快）。

### Q15: 大批量 Union 太慢

不要循环 `Union`，用 `UnaryUnionOperation`：

```csharp
var merged = new UnaryUnionOperation(list).Union();   // O(n log n)
// 而不是
// var merged = list.Aggregate((a, b) => a.Union(b));  // O(n²)
```

### Q16: 数据库空间查询慢

**建空间索引**！

```sql
-- PostGIS
CREATE INDEX idx_xxx ON tbl USING GIST (geom);

-- SpatiaLite
SELECT CreateSpatialIndex('tbl', 'geom');
```

并确认查询用的是 `ST_Intersects`、`ST_DWithin` 这类能走索引的函数，而不是 `ST_Distance < r`。

### Q17: PreparedGeometry 还是不够快？

考虑：

1. 是否几何变化频繁（如果是，PreparedGeometry 缓存失效）
2. 改用 `IndexedPointInAreaLocator`（针对"点是否在多边形内"）
3. 用 STRtree 粗过滤再精确判断
4. 把数据下推到数据库（PostGIS），用索引加速

## 序列化

### Q18: 序列化 Geometry 时报循环引用

NTS 的 `Geometry` 含导航属性。用专门的转换器：

```csharp
// System.Text.Json
services.AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new GeoJsonConverterFactory()));

// Newtonsoft.Json
services.AddNewtonsoftJson(o => o.SerializerSettings.Converters.Add(new GeometryConverter()));
```

### Q19: WKT 与 WKB 怎么选？

| 场景 | 推荐 |
| --- | --- |
| 日志、SQL、调试 | WKT |
| 数据库存储、跨语言二进制 | WKB |
| Web API | GeoJSON |
| 跨系统精确交换 | WKB |

### Q20: EWKT 在 NTS 中支持吗？

主包不支持。但 Npgsql 在与 PostGIS 交互时自动处理 `SRID=4326;POINT(...)` 格式。

## 数据库

### Q21: EF Core 报 "UseNetTopologySuite" not found

确认装了对应数据库的 NTS 插件：

```bash
# SQLite
dotnet add package Microsoft.EntityFrameworkCore.Sqlite.NetTopologySuite

# PostgreSQL
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
```

### Q22: 报错 "SRID does not match"

数据库列有固定 SRID 约束，你的几何 SRID 不一致：

```csharp
// ❌ 几何 SRID 默认是 0
var p = new Point(116.40, 39.90);

// ✅ 与数据库列 SRID 一致
var p = new Point(116.40, 39.90) { SRID = 4326 };
```

或在工厂级别统一：

```csharp
var factory = new GeometryFactory(new PrecisionModel(), 4326);
var p = factory.CreatePoint(new Coordinate(116.40, 39.90));
// p.SRID == 4326
```

### Q23: EF Core 翻译不了某 NTS 方法

部分方法不能翻译成 SQL（如 `NearestPoints`、带 `BufferParameters` 的 `Buffer`）。这些会被客户端执行——拉全表数据再过滤。规避：

1. 用可翻译的方法先粗过滤
2. 客户端再精细处理

```csharp
var candidates = await db.Places
    .Where(p => p.Location.Distance(origin) < 0.05)
    .ToListAsync();   // 翻译成 SQL

var result = candidates
    .Where(p => SomeUntranslatableCheck(p))
    .ToList();        // 客户端过滤
```

### Q24: SQLite + NTS 报 "no such function: ST_X"

NTS 插件要求 SQLite 启用 SpatiaLite 扩展。EF Core 的 SQLite NTS 提供程序会自动加载，但运行环境必须有 `mod_spatialite` 库。Linux 安装：

```bash
sudo apt install libsqlite3-mod-spatialite
```

## 其他

### Q25: NTS 能处理 3D 几何吗？

部分支持。`Coordinate` 有 `Z` 字段，但大部分运算（Buffer、Intersects 等）只在 2D 上做。3D 距离、3D 体积不在 NTS 范围内。

### Q26: NTS 能做坐标转换吗？

主包不做。用 [ProjNet](https://github.com/NetTopologySuite/ProjNet4GeoAPI) 库。

### Q27: NTS 是线程安全的吗？

几何对象 **只读**——读多线程安全。但 `Coordinate` 可变，多线程修改要小心。`GeometryFactory` 单例使用通常安全。`PreparedGeometry` 缓存可被多线程并发查询。

### Q28: 怎么测试几何是否相等？

```csharp
g1.EqualsExact(g2);          // 严格逐顶点
g1.EqualsTopologically(g2);  // 拓扑（无视顺序）
g1.EqualsNormalized(g2);     // 归一化后比较
```

业务场景一般用 `EqualsTopologically`。

### Q29: 怎么把 GeometryCollection 拆开？

```csharp
foreach (Geometry sub in collection.Geometries)
{
    // sub 是 Point / LineString / Polygon 等
}
```

或用 `PolygonExtracter.Extract`、`PointExtracter.Extract` 提取特定类型。

### Q30: 怎么从 GeoJSON 创建 NTS 几何？

```csharp
using NetTopologySuite.IO.GeoJSON;

var json = @"{""type"":""Point"",""coordinates"":[116.40, 39.90]}";
var reader = new GeoJsonReader();
var geom = reader.Read(json);
// geom 是 Point
```

## 下一步

- [API 速查表](./cheatsheet.md)
- [官方资料与链接](./resources.md)
