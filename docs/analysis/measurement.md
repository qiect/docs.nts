# 测量与距离

测量是空间分析的基础：长度、面积、周长、距离。NTS 在 `Geometry` 类上提供了一组直接的方法，但每个方法背后都有需要注意的细节。

## 长度与面积

```csharp
var factory = new GeometryFactory();

var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(3, 4), new Coordinate(6, 4)
});

Console.WriteLine(line.Length);  // 5 + 3 = 8

var square = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});

Console.WriteLine(square.Area);   // 100
Console.WriteLine(square.Length); // 40（周长）
```

::: warning Length 对不同类型的含义
- **LineString / LinearRing**：所有线段长度之和
- **Polygon**：所有环（外壳 + 孔洞）的周长之和
- **MultiLineString**：所有线段总长
- **Point**：0
- **GeometryCollection**：所有子几何 Length 之和
:::

## Distance：最短距离

`a.Distance(b)` 返回两个几何之间的 **最短欧氏距离**：

```csharp
var a = factory.CreatePoint(new Coordinate(0, 0));
var b = factory.CreatePoint(new Coordinate(3, 4));

Console.WriteLine(a.Distance(b));  // 5

var poly = factory.CreatePolygon(...);   // [10,20]×[10,20]
Console.WriteLine(a.Distance(poly));     // 距离多边形最近点
```

`Distance` 是 **平面欧氏距离**——基于坐标系直接计算。如果你的坐标是经纬度，结果是"度"，需要转换才能得到米。

### IsWithinDistance：距离阈值

```csharp
if (a.IsWithinDistance(b, 0.5))
{
    // 距离 ≤ 0.5
}
```

`IsWithinDistance` 内部使用 Envelope 空间索引快速排除明显过远的几何，比 `Distance < threshold` 更快。批量查询时优先用它。

## 经纬度下的真实距离

`Distance` 是平面欧氏距离，经纬度下需要换算成米。常见做法：

### 1. 投影到米制坐标系

用 ProjNet 等库把经纬度投影到适合该地区的米制投影：

```csharp
// 安装 ProjNet
// dotnet add package ProjNet

using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

// WGS84 (4326) → Web 墨卡托 (3857)，单位米
var wgs84 = GeographicCoordinateSystem.WGS84;
var webMercator = ProjectedCoordinateSystem.WebMercator;
var ctFactory = new CoordinateTransformationFactory();
var transformation = ctFactory.CreateFromCoordinateSystems(wgs84, webMercator);

// 把几何投影到米制
Geometry ProjectToWebMercator(Geometry g)
{
    var filter = new CoordinateTransformFilter(transformation.MathTransform);
    return g.Copy();  // 注意：要在副本上做
}
```

::: warning 投影会改变距离
Web 墨卡托在高纬度变形很大。如果你在中国做精确测量，应使用 **CGCS2000 / Gauss-Kruger 分带投影**（如 EPSG:4527 等）。如果只是粗略距离，可以用 Haversine 公式直接算。
:::

### 2. Haversine 大圆距离

对两点间的真实地球表面距离，可以直接用 Haversine：

```csharp
static double HaversineMeters(double lon1, double lat1, double lon2, double lat2)
{
    const double R = 6371000; // 地球半径，米
    double φ1 = lat1 * Math.PI / 180;
    double φ2 = lat2 * Math.PI / 180;
    double dφ = (lat2 - lat1) * Math.PI / 180;
    double dλ = (lon2 - lon1) * Math.PI / 180;

    double a = Math.Sin(dφ / 2) * Math.Sin(dφ / 2) +
               Math.Cos(φ1) * Math.Cos(φ2) *
               Math.Sin(dλ / 2) * Math.Sin(dλ / 2);
    double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    return R * c;
}

// 北京天安门 → 上海外滩
double meters = HaversineMeters(116.40, 39.90, 121.49, 31.24);
// ≈ 1067 km
```

::: tip 复杂几何的地理距离
Haversine 只算两点。如果几何是线或多边形，要算"点到线段的球面最短距离"会复杂得多。实践中：

- 投影 + NTS Distance（适合区域级数据）
- 把多边形/线拆成顶点，分别算 Haversine 后取最小（近似）
:::

## Envelope：边界框

`Envelope` 是几何的轴对齐边界框，提供超快的空间判断：

```csharp
var poly = factory.CreatePolygon(...);
Envelope env = poly.EnvelopeInternal;

Console.WriteLine($"{env.MinX},{env.MinY} → {env.MaxX},{env.MaxY}");

// Envelope 之间的快速判断
env.Intersects(otherEnv);
env.Contains(point);
env.Distance(otherEnv);   // 边界框距离
```

`Envelope` 是空间索引的底层基础——所有 R-tree、Quadtree 都用它做粗过滤。

## Length / Area 的几何形态判断

注意 `Length` 在 Polygon 上的语义：是 **周长**，不是边数。如果你要数顶点：

```csharp
poly.NumPoints        // 所有顶点（包括重复的闭合点）
poly.Coordinates.Count // 同上
poly.NumInteriorRings // 内部孔洞数
```

## 周长与面积的"米制"换算

如果你的几何是经纬度，直接算 `Area` 得到的是"平方度"，没有物理意义。换算思路：

- 投影到米制坐标系后 `Area` / `Length` 就是平方米 / 米
- 或者用球面三角法（Vitenshtein 公式）直接算球面面积，但 NTS 不内置

::: tip 球面面积公式
对小型区域（如单个城市）：

```
面积 ≈ 投影后 Area
```

对大型区域（跨国、洲际），用球面公式更准确。NTS 不直接提供，可以借助 GeoAPI 的地理坐标系或外部库。
:::

## 一个综合案例：配送效率统计

```csharp
// 假设几何已投影到米制
var store      = factory.CreatePoint(new Coordinate(500000, 3040000));
var deliveryZone = store.Buffer(3000);    // 3 公里范围
var roads      = LoadRoadNetwork();       // MultiLineString，道路网

// 1. 配送区面积
Console.WriteLine($"配送区面积: {deliveryZone.Area / 1_000_000:F2} km²");

// 2. 配送区内道路总长（米）
var roadsInZone = roads.Intersection(deliveryZone);
Console.WriteLine($"区内道路: {roadsInZone.Length / 1000:F2} km");

// 3. 道路密度 (km/km²)
double density = roadsInZone.Length / deliveryZone.Area;
Console.WriteLine($"道路密度: {density * 1000:F2} km/km²");

// 4. 最远的客户
double maxDist = customers.Max(c => store.Distance(c));
Console.WriteLine($"最远客户距离: {maxDist / 1000:F2} km");
```

## 小结

| 方法 | 含义 | 单位 |
| --- | --- | --- |
| `g.Length` | 线长 / 多边形周长 | 坐标系单位 |
| `g.Area` | 面积 | 坐标系单位² |
| `a.Distance(b)` | 平面欧氏最短距离 | 坐标系单位 |
| `a.IsWithinDistance(b, d)` | 距离 ≤ d 判断（快） | 坐标系单位 |
| `g.EnvelopeInternal` | 轴对齐边界框 | 坐标系单位 |

::: warning 核心提醒
NTS 的所有测量方法都是 **平面欧氏**。经纬度坐标直接用会得到无意义的"度"或"平方度"。要么投影到米制，要么用 Haversine 等球面公式。
:::

## 下一步

- [最近点与投影](./nearest-points.md)：找到几何间最近的具体位置
- [空间索引 STRtree](../advanced/spatial-index.md)：批量距离查询加速
- [PreparedGeometry](../advanced/prepared-geometry.md)
