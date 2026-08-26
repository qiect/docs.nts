# 几何属性

每个几何对象都自带一组属性，描述它的度量、元数据、空间特征与结构。本页逐个讲解 `Geometry` 类的常用属性，配代码与图示，帮你彻底理解每个属性返回什么、什么时候会踩坑。

```csharp
using NetTopologySuite.Geometries;

// 本页示例共用工厂
var factory = new GeometryFactory();
```

## 度量属性

### Area

**签名**：`public virtual double Area { get; }`

**语义**：返回几何的平面面积，单位为坐标系单位。

- `Point` / `LineString` / `MultiPoint` / `MultiLineString`：始终返回 `0`
- `Polygon`：外壳面积 − 所有孔洞面积
- `MultiPolygon`：所有子多边形面积之和
- `GeometryCollection`：所有子几何面积之和

```csharp
var poly = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});
Console.WriteLine(poly.Area);   // 100

// 带孔洞：100 - 4 = 96
var hole = factory.CreateLinearRing(new[]
{
    new Coordinate(4, 4), new Coordinate(6, 4), new Coordinate(6, 6),
    new Coordinate(4, 6), new Coordinate(4, 4)
});
var withHole = factory.CreatePolygon(
    (LinearRing)poly.Shell, new[] { hole });
Console.WriteLine(withHole.Area);  // 96
```

::: warning 经纬度下 Area 无意义
`Area` 计算的是平面欧氏面积。若几何为 WGS84 经纬度，结果是"平方度"——数值没有物理意义。需要先投影到米制坐标系（如 CGCS2000 / Gauss-Kruger），再用 `Area` 得到平方米。球面面积需借助 ProjNet 等库。
:::

<figure class="nts-diagram">
<svg viewBox="0 0 360 140" width="360" height="140">
  <polygon points="20,20 160,20 160,120 20,120" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <polygon points="70,60 110,60 110,100 70,100" fill="#fff" stroke="#a00" stroke-width="1.5"/>
  <text x="50" y="75" font-family="monospace" font-size="11" fill="#0b6e4f">Area = 100 − 4 = 96</text>
  <text x="75" y="84" font-family="monospace" font-size="9" fill="#a00">hole</text>
</svg>
<figcaption>Area = 外壳面积 − 孔洞面积</figcaption>
</figure>

### Length

**签名**：`public virtual double Length { get; }`

**语义**：返回几何的"一维长度"，语义随几何类型变化：

| 几何类型 | Length 含义 |
| --- | --- |
| `LineString` / `MultiLineString` | 所有线段长度之和 |
| `Polygon` | 外壳周长 + 所有孔洞周长 |
| `Point` / `MultiPoint` | `0` |
| `GeometryCollection` | 所有子几何 Length 之和 |

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(3, 0), new Coordinate(3, 4)
});
Console.WriteLine(line.Length);  // 3 + 4 = 7

Console.WriteLine(withHole.Length);
// 外壳 40 + 孔洞 8 = 48
```

::: tip Polygon 的 Length 是周长，不是边数
注意 `Polygon.Length` 返回的是 **周长**（所有环的长度之和），不是顶点数。孔洞的周长也算在内。
:::

## 元数据属性

### Dimension

**签名**：`public abstract int Dimension { get; }`

**语义**：返回几何的拓扑维度。

| 返回值 | 含义 | 几何类型 |
| --- | --- | --- |
| `0` | 点 | `Point`、`MultiPoint` |
| `1` | 线 | `LineString`、`LinearRing`、`MultiLineString` |
| `2` | 面 | `Polygon`、`MultiPolygon` |
| `-1` | 空几何 | `IsEmpty` 为 `true` 时 |

```csharp
Console.WriteLine(factory.CreatePoint().Dimension);          // 0
Console.WriteLine(factory.CreateLineString(...).Dimension);  // 1
Console.WriteLine(poly.Dimension);                           // 2
Console.WriteLine(factory.CreatePolygon().Dimension);        // -1（空多边形）
```

::: warning 空几何的 Dimension 是 -1
空 `Polygon` 的 `Dimension` 返回 `-1`，不是 `2`。判断几何类型时若依赖 `Dimension`，记得先检查 `IsEmpty`。
:::

### GeometryType

**签名**：`public abstract GeometryType GeometryType { get; }`

**语义**：返回 `GeometryType` 枚举，标识几何的具体类型。

```csharp
public enum GeometryType
{
    Point, MultiPoint, LineString, LinearRing,
    MultiLineString, Polygon, MultiPolygon,
    GeometryCollection,   // 还有少数扩展类型
    CircularString, CompoundCurve, CurvePolygon, ...
}
```

```csharp
Console.WriteLine(poly.GeometryType);        // Polygon
Console.WriteLine(line.GeometryType);        // LineString

// 判别类型最规范的方式
if (g.GeometryType == GeometryType.MultiPolygon) { ... }
```

::: tip 用 GeometryType 枚举，不要用字符串
`GeometryType` 返回枚举值，类型安全。若需字符串，用 `GeometryTypeText`（返回 `"Polygon"` 等）。避免用 `g.GetType().Name`——那返回 .NET 类名，受 NTS 版本影响。
:::

### SRID

**签名**：`public int SRID { get; }`

**语义**：返回几何的空间参考 ID（Spatial Reference ID），标识坐标所在的坐标系。

```csharp
var wgs84 = new GeometryFactory(new PrecisionModel(), 4326);
var p = wgs84.CreatePoint(new Coordinate(116.40, 39.90));
Console.WriteLine(p.SRID);  // 4326

var noSrid = new GeometryFactory().CreatePoint(new Coordinate(0, 0));
Console.WriteLine(noSrid.SRID);  // 0（未设置）
```

::: warning NTS 不校验 SRID 一致性
两个几何做运算前，NTS **不会** 检查 SRID 是否相同。混用 4326（经纬度）和 3857（Web 墨卡托）会得到无意义的结果——这是开发者的责任。

约定：所有几何从同一 `GeometryFactory` 创建，自然共享 SRID。
:::

### IsEmpty

**签名**：`public bool IsEmpty { get; }`

**语义**：几何是否为空（不含任何坐标点）。

```csharp
var empty = factory.CreatePoint();
Console.WriteLine(empty.IsEmpty);   // True

var p = factory.CreatePoint(new Coordinate(0, 0));
Console.WriteLine(p.IsEmpty);       // False
```

常见产生空几何的场景：
- `factory.CreatePoint()` / `CreateLineString()` 无坐标
- `Polygon.Buffer(-100)` 收缩到消失
- `a.Intersection(b)` 两几何不相交
- WKT `POINT EMPTY`、`GEOMETRYCOLLECTION EMPTY`

::: tip 空几何是合法几何
空几何不是 `null`，它是有效的几何对象，可以参与运算（通常传播空集）。处理查询结果时先判 `IsEmpty` 比 `!= null` 更有用。
:::

### IsValid

**签名**：`public bool IsValid { get; }`

**语义**：几何是否符合 OGC 简单要素规范（SFS）。

```csharp
// 有效正方形
var square = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});
Console.WriteLine(square.IsValid);  // True

// 无效的"领结"多边形（自相交）
var bowtie = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 10),
    new Coordinate(10, 0), new Coordinate(0, 10),
    new Coordinate(0, 0)
});
Console.WriteLine(bowtie.IsValid);  // False
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 110" width="360" height="110">
  <polygon points="20,20 120,20 120,90 20,90" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="70" y="105" text-anchor="middle" font-family="monospace" font-size="10" fill="#0b6e4f">有效</text>
  <polygon points="180,20 280,90 280,20 180,90" fill="rgba(168,99,0,0.2)" stroke="#a00" stroke-width="2"/>
  <circle cx="230" cy="55" r="3" fill="#a00"/>
  <text x="230" y="105" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">无效（自相交）</text>
</svg>
<figcaption>IsValid：领结多边形因自相交而无效</figcaption>
</figure>

常见无效原因：多边形自相交、孔洞超出外壳、孔洞相互相交、环未闭合。

::: warning 运算前先校验
无效几何参与叠加运算可能产生错误结果或异常。生产环境建议入库时用 `IsValid` 校验，无效的用 `Buffer(0)` 或 `GeometryFixer` 修复。
:::

## 空间特征属性

### Envelope / EnvelopeInternal

**签名**：
```csharp
public Envelope EnvelopeInternal { get; }   // 内部缓存，性能首选
public Geometry Envelope { get; }           // 返回 Polygon 形式
```

**语义**：几何的最小外接矩形（MBR / Bounding Box）。

- `EnvelopeInternal`：返回 `Envelope` 结构体（minX, maxX, minY, maxY），轻量、不创建几何
- `Envelope`：返回 `Polygon`（4 个顶点的矩形），用于参与几何运算

```csharp
var shape = factory.CreatePolygon(new[]
{
    new Coordinate(2, 3), new Coordinate(8, 1), new Coordinate(10, 7),
    new Coordinate(4, 9), new Coordinate(2, 3)
});

Envelope env = shape.EnvelopeInternal;
Console.WriteLine($"{env.MinX},{env.MinY} ~ {env.MaxX},{env.MaxY}");
// 2,1 ~ 10,9

Geometry box = shape.Envelope;   // Polygon
Console.WriteLine(box.Area);     // 8 × 8 = 64
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <rect x="40" y="20" width="240" height="100" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="5 4"/>
  <polygon points="80,50 220,30 260,90 120,110" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="100" y="80" font-family="monospace" font-size="10" fill="#0b6e4f">几何</text>
  <text x="150" y="14" font-family="monospace" font-size="10" fill="#999">Envelope（外接矩形）</text>
</svg>
<figcaption>Envelope：最小外接矩形</figcaption>
</figure>

::: tip 索引查询用 EnvelopeInternal
`STRtree` 等空间索引的 `Insert` 与 `Query` 都用 `Envelope`。性能敏感场景始终用 `EnvelopeInternal`，避免创建 `Polygon` 对象的开销。
:::

### Centroid

**签名**：`public Point Centroid { get; }`

**语义**：返回几何的**质心**（重心）。对多边形而言是面积加权中心。

```csharp
var L = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 3),
    new Coordinate(3, 3), new Coordinate(3, 10), new Coordinate(0, 10),
    new Coordinate(0, 0)
});
var c = L.Centroid;
Console.WriteLine($"{c.X}, {c.Y}");  // 约 4.12, 4.12
```

::: warning 质心可能落在几何外部
对凹多边形或带孔洞的多边形，质心可能落在 **几何之外**。例如 C 形、L 形多边形的质心常落在凹处。

如果你的需求是"几何内部的一个代表点"（如图标注记位置），请用 `InteriorPoint`。
:::

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <polygon points="40,40 200,40 200,70 90,70 90,130 40,130" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <circle cx="100" cy="70" r="4" fill="#a00"/>
  <text x="108" y="74" font-family="monospace" font-size="10" fill="#a00">Centroid（凹处外部）</text>
  <circle cx="75" cy="55" r="4" fill="#0b6e4f"/>
  <text x="55" y="50" font-family="monospace" font-size="10" fill="#0b6e4f">InteriorPoint</text>
</svg>
<figcaption>L 形多边形：Centroid 落在凹处外部，InteriorPoint 保证在内部</figcaption>
</figure>

### InteriorPoint

**签名**：`public Point InteriorPoint { get; }`

**语义**：返回一个**保证在几何内部**的代表点。

- `Polygon`：返回内部某点（通常在最大内切水平线的中点）
- `LineString`：返回线上的某点
- `Point`：返回点本身
- 空几何：返回空 `Point`

```csharp
var ip = L.InteriorPoint;
Console.WriteLine($"{ip.X}, {ip.Y}");   // 例如 65, 55
Console.WriteLine(ip.Within(L));        // True
Console.WriteLine(L.Centroid.Within(L)); // False（质心在外）
```

::: tip 标注用 InteriorPoint
地图上给多边形标名字、加图标，用 `InteriorPoint`——它保证落在几何内部，不会被遮挡或溢出。`Centroid` 可能落在孔洞或凹处。
:::

### Boundary

**签名**：`public abstract Geometry Boundary { get; }`

**语义**：返回几何的**边界**，类型随几何不同：

| 几何类型 | Boundary 返回 |
| --- | --- |
| `Point` / `MultiPoint` | 空 `GeometryCollection` |
| `LineString` | `MultiPoint`（两个端点） |
| `LinearRing` | 空（闭合环无边界） |
| `Polygon` | `MultiLineString`（外壳 + 孔洞环） |

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 5), new Coordinate(10, 0)
});
var b = line.Boundary;
Console.WriteLine(b.GeometryType);      // MultiPoint
Console.WriteLine(b.NumGeometries);     // 2（两端点）

var polyBoundary = poly.Boundary;
Console.WriteLine(polyBoundary.GeometryType);  // LineString（仅外壳）
Console.WriteLine(withHole.Boundary.NumGeometries);  // 2（外壳+孔洞）
```

::: warning Boundary 不是轮廓线
`Polygon.Boundary` 返回的是 `MultiLineString`，包含外壳和所有孔洞的环——不是"外轮廓"。若只要外轮廓，用 `poly.ExteriorRing`（返回 `LineString`）。
:::

### ConvexHull

**签名**：`public Geometry ConvexHull()`（注意是方法，不是属性）

**语义**：返回几何的最小凸包——把所有顶点用橡皮筋绷紧后的形状。

```csharp
var star = factory.CreatePolygon(new[]
{
    new Coordinate(50, 0), new Coordinate(61, 35), new Coordinate(98, 35),
    new Coordinate(68, 57), new Coordinate(79, 91), new Coordinate(50, 70),
    new Coordinate(21, 91), new Coordinate(32, 57), new Coordinate(2, 35),
    new Coordinate(39, 35), new Coordinate(50, 0)
});
var hull = star.ConvexHull();
Console.WriteLine(hull.GeometryType);   // Polygon
Console.WriteLine(star.Area);           // 约 2386
Console.WriteLine(hull.Area);           // 约 7030（更大）
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <polygon points="80,20 110,75 60,130 10,75 40,20" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5" stroke-dasharray="4 3"/>
  <polygon points="50,20 60,40 80,55 60,70 50,95 40,70 20,55 40,40" fill="rgba(168,99,0,0.3)" stroke="#a86300" stroke-width="2"/>
  <text x="120" y="80" font-family="monospace" font-size="10" fill="#0b6e4f">ConvexHull（虚线）</text>
  <text x="30" y="60" font-family="monospace" font-size="10" fill="#a86300">原几何</text>
</svg>
<figcaption>ConvexHull：最小凸包络</figcaption>
</figure>

::: tip 何时用 ConvexHull
凸包计算很快（O(n log n)），常用于：碰撞检测的粗筛、形状相似度对比、空间索引的辅助几何、轨迹的范围近似。
:::

## 结构与导航属性

### NumGeometries

**签名**：`public int NumGeometries { get; }`

**语义**：返回几何包含的子几何数。

- 单一几何（`Point` / `LineString` / `Polygon`）：返回 `1`
- `Multi*` 与 `GeometryCollection`：返回实际子几何数

```csharp
var single = factory.CreatePoint(new Coordinate(0, 0));
Console.WriteLine(single.NumGeometries);  // 1

var mp = factory.CreateMultiPoint(new[]
{
    new Point(0, 0), new Point(1, 1), new Point(2, 2)
});
Console.WriteLine(mp.NumGeometries);  // 3
```

::: tip 统一遍历模式
所有几何（包括单一类型）都可以用统一模式遍历，无需先判断是否为 `Multi*`：

```csharp
for (int i = 0; i < g.NumGeometries; i++)
{
    var part = g.GetGeometryN(i);
    // 处理每个子几何
}
```

单一几何这个循环只执行一次，返回自身。
:::

### NumPoints

**签名**：`public int NumPoints { get; }`

**语义**：返回几何的顶点数。

| 几何类型 | NumPoints 含义 |
| --- | --- |
| `Point` | `1`（空点为 `0`） |
| `LineString` | 实际顶点数（含重复的闭合点） |
| `LinearRing` | 顶点数（含首尾重复点） |
| `Polygon` | 所有环的顶点数之和 |

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(1, 1), new Coordinate(2, 2)
});
Console.WriteLine(line.NumPoints);  // 3

var ring = factory.CreateLinearRing(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)   // 闭合
});
Console.WriteLine(ring.NumPoints);  // 5（含重复闭合点）
```

::: warning 闭合环的 NumPoints 含重复点
`LinearRing` 的首尾坐标相同，`NumPoints` 会把闭合点算两次。若要"不重复的顶点数"，对 `Polygon` 用 `NumPoints - NumInteriorRings - 1`。
:::

### Coordinates

**签名**：`public virtual Coordinate[] Coordinates { get; }`

**语义**：返回几何的所有顶点数组。

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(3, 4), new Coordinate(6, 4)
});

Coordinate[] all = line.Coordinates;
Console.WriteLine(all.Length);  // 3
foreach (var c in all)
    Console.WriteLine($"({c.X}, {c.Y})");
```

不同类型的 `Coordinates`：
- `Point`：1 个坐标（空点为 0）
- `LineString`：所有顶点
- `Polygon`：外壳顶点 + 所有孔洞顶点（顺序拼接）
- `MultiPolygon`：所有子多边形的顶点依次拼接

::: warning Coordinates 创建副本
`Coordinates` 每次返回新数组，修改它 **不影响** 原几何。若需高效访问顶点，用 `CoordinateSequence`（通过 `g.GetCoordinateSequence()` 或类型特定属性）。

注意 `Coordinate` 本身是**可变**的——修改 `Coordinates()` 返回的副本里的坐标不影响几何，但若你通过 `g.Coordinates[0].X = ...` 这种写法，由于数组元素是引用，可能影响原几何。安全做法是构造新几何。
:::

### GetGeometryN

**签名**：`public abstract Geometry GetGeometryN(int n);`

**语义**：返回第 `n` 个子几何（从 0 开始）。

```csharp
var mp = factory.CreateMultiPolygon(new[]
{
    poly,           // 子 0
    withHole        // 子 1
});

Console.WriteLine(mp.GetGeometryN(0).Area);  // 100
Console.WriteLine(mp.GetGeometryN(1).Area);  // 96
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 130" width="360" height="130">
  <rect x="20" y="30" width="80" height="70" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="50" y="70" text-anchor="middle" font-family="monospace" font-size="11" fill="#0b6e4f">[0]</text>
  <rect x="140" y="30" width="80" height="70" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="160" y="50" width="20" height="20" fill="#fff" stroke="#a00" stroke-width="1.5"/>
  <text x="175" y="70" text-anchor="middle" font-family="monospace" font-size="11" fill="#0b6e4f">[1]</text>
  <rect x="260" y="30" width="80" height="70" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="295" y="70" text-anchor="middle" font-family="monospace" font-size="11" fill="#0b6e4f">[2]</text>
  <text x="180" y="118" text-anchor="middle" font-family="monospace" font-size="10" fill="#666">MultiPolygon.GetGeometryN(i)</text>
</svg>
<figcaption>GetGeometryN：按索引访问子几何</figcaption>
</figure>

::: tip 单一几何的 GetGeometryN(0)
对单一几何（非集合），`GetGeometryN(0)` 返回自身。配合 `NumGeometries` 可实现统一遍历。
:::

## 形态判断属性

### IsSimple

**签名**：`public virtual bool IsSimple { get; }`

**语义**：几何是否"简单"——即没有自相交（除端点外）。

| 几何类型 | 非简单的情况 |
| --- | --- |
| `Point` | 始终 `true` |
| `LineString` | 自相交、自相切、自重合 |
| `MultiPoint` | 有重复点 |
| `MultiLineString` | 子线之间相交（除端点） |
| `Polygon` / `MultiPolygon` | 始终 `true`（用 `IsValid` 判断） |

```csharp
var simple = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 5), new Coordinate(10, 0)
});
Console.WriteLine(simple.IsSimple);  // True

var selfCross = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(10, 0)
});
Console.WriteLine(selfCross.IsSimple);  // False（中间相交）
```

### IsClosed / IsRing

**签名**：
```csharp
public virtual bool IsClosed { get; }   // 首尾坐标是否相同
public bool IsRing { get; }              // IsClosed && IsSimple
```

**语义**：
- `IsClosed`：仅看首尾坐标是否相同，不看是否自相交
- `IsRing`：闭合 **且** 简单（无自相交）

```csharp
var open = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 0), new Coordinate(5, 5)
});
Console.WriteLine(open.IsClosed);  // False

var closed = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 0), new Coordinate(5, 5),
    new Coordinate(0, 0)
});
Console.WriteLine(closed.IsClosed);  // True
Console.WriteLine(closed.IsRing);    // True

// 闭合但自相交
var bowtieRing = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 10),
    new Coordinate(10, 0), new Coordinate(0, 10),
    new Coordinate(0, 0)
});
Console.WriteLine(bowtieRing.IsClosed);  // True
Console.WriteLine(bowtieRing.IsRing);    // False（不简单）
```

::: warning LinearRing 始终闭合且简单
`LinearRing` 构造时就要求闭合且不自相交，所以 `IsClosed` 和 `IsRing` 始终为 `true`。`IsClosed`/`IsRing` 主要用于普通 `LineString`。
:::

## 常用配套方法

以下不是属性，但与几何属性紧密相关，常用在同一场景。

### Normalize

**签名**：`public abstract void Normalize()`（实例方法，修改自身）

**语义**：将几何归一化到规范形式——顶点按坐标排序、环方向标准化（外壳 CCW、孔洞 CW）。归一化后，两个拓扑相等的几何具有相同的顶点序列。

```csharp
var a = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});

// 顶点顺序不同的"同一个"多边形
var b = factory.CreatePolygon(new[]
{
    new Coordinate(10, 10), new Coordinate(10, 0), new Coordinate(0, 0),
    new Coordinate(0, 10), new Coordinate(10, 10)
});

Console.WriteLine(a.EqualsExact(b));  // False（顺序不同）
a.Normalize();
b.Normalize();
Console.WriteLine(a.EqualsExact(b));  // True（归一化后一致）
```

### Reverse

**签名**：`public abstract Geometry Reverse()`（返回新几何）

**语义**：反转所有顶点顺序，返回新几何（不改原几何）。

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 5), new Coordinate(10, 0)
});
var reversed = line.Reverse();
// 顶点变为 (10,0) → (5,5) → (0,0)
```

对 `Polygon`，`Reverse` 会同时反转外壳与孔洞的方向。

### Copy

**签名**：`public Geometry Copy()`

**语义**：深拷贝几何（含所有顶点与元数据）。`Coordinate` 是可变的，赋值只是引用拷贝，修改会影响原几何——需要独立副本时用 `Copy()`。

```csharp
var p = factory.CreatePoint(new Coordinate(1, 2));
var shallow = p;            // 引用同一个对象
var deep = p.Copy();        // 独立副本
```

## 属性速查表

| 属性 | 返回类型 | 含义 |
| --- | --- | --- |
| `Area` | `double` | 面积（坐标系单位²） |
| `Length` | `double` | 周长 / 线长 |
| `Dimension` | `int` | 0/1/2，空为 -1 |
| `GeometryType` | `GeometryType` | 几何类型枚举 |
| `SRID` | `int` | 空间参考 ID |
| `IsEmpty` | `bool` | 是否为空 |
| `IsValid` | `bool` | 是否符合 OGC SFS |
| `EnvelopeInternal` | `Envelope` | 外接矩形（轻量） |
| `Envelope` | `Geometry` | 外接矩形（Polygon） |
| `Centroid` | `Point` | 质心（可能在外部） |
| `InteriorPoint` | `Point` | 内部代表点（保证在内部） |
| `Boundary` | `Geometry` | 边界 |
| `NumGeometries` | `int` | 子几何数 |
| `NumPoints` | `int` | 顶点数 |
| `Coordinates` | `Coordinate[]` | 所有顶点（副本） |
| `IsSimple` | `bool` | 是否无自相交 |
| `IsClosed` | `bool` | 首尾是否相同 |
| `IsRing` | `bool` | IsClosed && IsSimple |

## 下一步

- [坐标与几何层级](./geometry-hierarchy.md)：理解属性背后的类型继承
- [几何工厂 GeometryFactory](./geometry-factory.md)：构造几何的入口
- [精度模型](./precision-model.md)：浮点精度如何影响属性计算
- [空间谓词](../03-spatial-relations/relationships.md)：用几何做关系判断
