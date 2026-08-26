# 测量与距离

测量是空间分析的基础：长度、面积、周长、距离。NTS 在 `Geometry` 类与 `Envelope` 类上提供了一组直接的测量 API，但每个方法背后都有需要注意的细节——尤其是"平面欧氏"这个前提。本页逐方法详解，配代码、陷阱与图示。

```csharp
using NetTopologySuite.Geometries;

// 本页示例共用工厂（默认 SRID=0，平面坐标）
var factory = new GeometryFactory();
```

::: warning 全篇核心提醒
NTS 的所有测量方法（`Area` / `Length` / `Distance` / `IsWithinDistance` / `Envelope.Distance`）都是 **平面欧氏** 计算。它们只看坐标数值，不关心坐标系含义。若坐标是 WGS84 经纬度，`Area` 得到的是"平方度"、`Distance` 得到的是"度"——**没有物理意义**。要么先投影到米制坐标系，要么用 Haversine 等球面公式。
:::

## Area

**签名**：`public virtual double Area { get; }`

**语义**：返回几何的平面面积，单位为坐标系单位的平方。

- `Point` / `LineString` / `MultiPoint` / `MultiLineString`：始终返回 `0`
- `Polygon`：外壳面积 − 所有孔洞面积
- `MultiPolygon`：所有子多边形面积之和
- `GeometryCollection`：所有子几何面积之和

```csharp
var square = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});
Console.WriteLine(square.Area);   // 100

// 带孔洞：100 − 4 = 96
var hole = factory.CreateLinearRing(new[]
{
    new Coordinate(4, 4), new Coordinate(6, 4), new Coordinate(6, 6),
    new Coordinate(4, 6), new Coordinate(4, 4)
});
var withHole = factory.CreatePolygon((LinearRing)square.Shell, new[] { hole });
Console.WriteLine(withHole.Area);  // 96
```

::: warning 经纬度下 Area 无意义
`Area` 计算的是平面欧氏面积。若几何为 WGS84 经纬度，结果是"平方度"——数值没有物理意义。需要先投影到米制坐标系（如 CGCS2000 / Gauss-Kruger），再用 `Area` 得到平方米。球面面积需借助 ProjNet 等库或自行实现（见下文[球面面积](#球面面积)）。
:::

## Length

**签名**：`public virtual double Length { get; }`

**语义**：返回几何的"一维长度"，语义随几何类型变化：

| 几何类型 | Length 含义 |
| --- | --- |
| `LineString` / `LinearRing` | 所有线段长度之和 |
| `MultiLineString` | 所有线段总长 |
| `Polygon` | **所有环（外壳 + 孔洞）的周长之和** |
| `MultiPolygon` | 所有子多边形周长之和 |
| `Point` / `MultiPoint` | `0` |
| `GeometryCollection` | 所有子几何 Length 之和 |

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(3, 4), new Coordinate(6, 4)
});
Console.WriteLine(line.Length);    // 5 + 3 = 8

Console.WriteLine(square.Length);  // 40（周长）
Console.WriteLine(withHole.Length);// 40 + 8 = 48（外壳 + 孔洞周长）
```

::: tip Polygon.Length 是周长，不是边数
`Polygon.Length` 返回的是 **周长**（所有环长度之和），不是顶点数。要数顶点用 `NumPoints`，要数孔洞用 `NumInteriorRings`。
:::

## Distance

**签名**：`public double Distance(Geometry g)`

**语义**：返回两个几何之间的 **最短欧氏距离**——即 A 上某点与 B 上某点之间距离的最小值。结果为坐标系单位。

- 两点：欧氏直线距离
- 点到线：点到线段的垂直距离或端点距离
- 点到面：若点在面内返回 `0`，否则到边界的最短距离
- 面到面：若相交返回 `0`，否则边界之间最短距离

```csharp
var a = factory.CreatePoint(new Coordinate(0, 0));
var b = factory.CreatePoint(new Coordinate(3, 4));
Console.WriteLine(a.Distance(b));   // 5

var poly = factory.CreatePolygon(new[]
{
    new Coordinate(10, 10), new Coordinate(20, 10), new Coordinate(20, 20),
    new Coordinate(10, 20), new Coordinate(10, 10)
});
Console.WriteLine(a.Distance(poly)); // 到 (10,10) 的距离 = sqrt(200) ≈ 14.14
```

<figure class="nts-diagram">
<svg viewBox="0 0 380 160" width="380" height="160">
  <polygon points="20,45 110,45 110,125 20,125" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="50" y="90" font-family="monospace" font-size="12" fill="#0b6e4f">A</text>
  <polygon points="240,55 340,55 340,135 240,135" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="280" y="100" font-family="monospace" font-size="12" fill="#0b6e4f">B</text>
  <line x1="110" y1="95" x2="240" y2="95" stroke="#a00" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="110" cy="95" r="4" fill="#a00"/>
  <circle cx="240" cy="95" r="4" fill="#a00"/>
  <text x="150" y="86" font-family="monospace" font-size="12" fill="#a00">Distance</text>
  <text x="155" y="108" font-family="monospace" font-size="10" fill="#a00">（最短连线）</text>
</svg>
<figcaption>Distance：两几何之间最短欧氏距离</figcaption>
</figure>

::: warning 空几何与几何集合的行为
- **空几何**：`a.Distance(空几何)` 返回 `0`（NTS 把空集当作"无处不在"，距离定义为 0）。若你依赖 Distance 排除空对象，记得先判 `IsEmpty`。
- **几何集合**：`Distance` 会自动展开 `GeometryCollection` / `Multi*`，返回所有子组合对中距离的最小值。无需手动遍历。
- `Distance(g)` 中 `g` 为 `null` 会抛 `ArgumentNullException`。
:::

::: tip Distance 仍是平面欧氏
经纬度下 `Distance` 返回"度"，且在不同纬度代表不同米数。两点经纬度直接 `Distance` 后再乘换算系数是 **错误** 做法。请用 [Haversine](#haversine-大圆距离) 或先[投影](#投影方案)。
:::

## IsWithinDistance

**签名**：`public bool IsWithinDistance(Geometry g, double distance)`

**语义**：判断 `this.Distance(g) <= distance`，但实现上做了优化——内部用 **Envelope（边界框）预过滤**：先比较两个几何的外接矩形距离，若 Envelope 间距离已大于 `distance`，立即返回 `false`，无需进入精确几何计算。

```csharp
// a 与 b 距离是否 ≤ 0.5
if (a.IsWithinDistance(b, 0.5))
{
    // 在阈值内
}
```

::: tip 批量查询优先用 IsWithinDistance
`IsWithinDistance(b, d)` 通常比 `a.Distance(b) <= d` 更快，因为它能在 Envelope 阶段就排除明显过远的几何。在大批量距离筛选（如"找出 3 公里内所有门店"）时，配合空间索引 `STRtree` 先粗筛 Envelope，再用 `IsWithinDistance` 精筛，性能最佳。

注意：`IsWithinDistance` 对"在阈值内"的情况仍需精确计算，所以它优化的是"明显在阈值外"的快速排除。
:::

## Envelope：边界框

`Envelope`（`NetTopologySuite.Geometries.Envelope`）是几何的 **轴对齐边界框**（MBR / Bounding Box），由 `(minX, maxX, minY, maxY)` 四个值定义。它是 `double` 精度的可变类，比 `Polygon` 轻量得多，是所有空间索引（`STRtree`、`Quadtree`）的底层基础。

```csharp
var poly = factory.CreatePolygon(new[]
{
    new Coordinate(2, 3), new Coordinate(8, 1), new Coordinate(10, 7),
    new Coordinate(4, 9), new Coordinate(2, 3)
});

Envelope env = poly.EnvelopeInternal;   // 不创建 Polygon，性能首选
Console.WriteLine($"{env.MinX},{env.MinY} → {env.MaxX},{env.MaxY}");  // 2,1 → 10,9
```

下面逐方法详解 `Envelope` 的常用 API。

### 构造：`Envelope(minX, maxX, minY, maxY)`

**签名**：
```csharp
public Envelope(double minX, double maxX, double minY, double maxY)
public Envelope(Coordinate p1, Coordinate p2)
public Envelope(CoordinateSequence sequence)
public Envelope()   // 空 Envelope（Null）
```

**语义**：直接用坐标范围构造边界框。空构造创建一个"空"Envelope，`IsNull` 为 `true`。

```csharp
var env = new Envelope(0, 10, 0, 20);
Console.WriteLine(env.Width);   // 10
Console.WriteLine(env.Height);  // 20
Console.WriteLine(env.Area);    // 200

var empty = new Envelope();
Console.WriteLine(empty.IsNull);  // True
```

### Intersects

**签名**：
```csharp
public bool Intersects(Envelope other)
public bool Intersects(Coordinate c)
public bool Intersects(double x, double y)
```

**语义**：判断两个 Envelope 是否相交（含边界相切）。这是空间索引粗过滤最常用的判断。

```csharp
var a = new Envelope(0, 10, 0, 10);
var b = new Envelope(5, 15, 5, 15);
var far = new Envelope(20, 30, 20, 30);

Console.WriteLine(a.Intersects(b));    // True（重叠）
Console.WriteLine(a.Intersects(far));  // False
```

### Contains

**签名**：
```csharp
public bool Contains(Coordinate c)
public bool Contains(Envelope other)
```

**语义**：判断本 Envelope 是否 **完全包含** 一个坐标或另一个 Envelope（含边界）。注意方向：`a.Contains(b)` 表示 b 在 a 内部。

```csharp
var outer = new Envelope(0, 10, 0, 10);
var inner = new Envelope(2, 8, 2, 8);
var crossing = new Envelope(5, 15, 5, 15);

Console.WriteLine(outer.Contains(inner));    // True
Console.WriteLine(outer.Contains(crossing)); // False（越界）
Console.WriteLine(outer.Contains(new Coordinate(5, 5)));  // True
Console.WriteLine(outer.Contains(new Coordinate(10, 10)));// True（含边界）
```

::: tip Contains 与 Intersects 的区别
`Contains` 要求对方 **完全在内部**；`Intersects` 只要有任何重叠就为真。空间索引的候选集通常用 `Intersects`（宁可多选不可漏选），再由精确谓词过滤。
:::

### Distance

**签名**：`public double Distance(Envelope env)`

**语义**：返回两个 Envelope 之间的最短距离。若相交（含相切），返回 `0`。只看边界框，不看内部几何形状。

```csharp
var a = new Envelope(0, 10, 0, 10);
var b = new Envelope(13, 20, 0, 10);
Console.WriteLine(a.Distance(b));  // 3（水平间距）

var touching = new Envelope(10, 20, 0, 10);
Console.WriteLine(a.Distance(touching));  // 0（相切）
```

### ExpandToInclude / ExpandBy

**签名**：
```csharp
public void ExpandToInclude(Coordinate c)
public void ExpandToInclude(double x, double y)
public void ExpandToInclude(Envelope other)
public void ExpandBy(double distance)
public void ExpandBy(double deltaX, double deltaY)
```

**语义**：
- `ExpandToInclude`：把当前 Envelope 扩展到刚好包含新坐标/新 Envelope（取并集）
- `ExpandBy`：向四周均匀外扩 `distance`（或分别外扩 `deltaX` / `deltaY`）

```csharp
var env = new Envelope(0, 10, 0, 10);
env.ExpandToInclude(new Coordinate(15, 15));
Console.WriteLine($"{env.MinX},{env.MinY} → {env.MaxX},{env.MaxY}"); // 0,0 → 15,15

env.ExpandBy(2);   // 四周各扩 2
Console.WriteLine($"{env.MinX},{env.MinY} → {env.MaxX},{env.MaxY}"); // -2,-2 → 17,17
```

::: warning Envelope 是可变类
`ExpandToInclude` / `ExpandBy` / `Normalize` 都是 **原地修改** 当前 Envelope，不返回新对象。若需保留原值，先 `env.Copy()`。空间索引内部缓存了 Envelope，索引建好后切勿再修改已插入几何的坐标范围——索引不会自动更新。
:::

### ToGeometry / Intersection

**签名**：
```csharp
public Geometry ToGeometry(GeometryFactory factory)   // 转 Polygon
public Envelope Intersection(Envelope env)            // 求交，返回新 Envelope
```

**语义**：
- `ToGeometry`：把 Envelope 转成 `Polygon`（4 顶点矩形），便于参与几何运算。空 Envelope 转成空 `Polygon`。
- `Intersection`：返回两个 Envelope 的交集范围；不相交则返回空 Envelope。

```csharp
var env = new Envelope(0, 10, 0, 10);
Geometry box = env.ToGeometry(factory);   // Polygon
Console.WriteLine(box.Area);              // 100

var a = new Envelope(0, 10, 0, 10);
var b = new Envelope(5, 15, 5, 15);
Envelope inter = a.Intersection(b);
Console.WriteLine($"{inter.MinX},{inter.MinY} → {inter.MaxX},{inter.MaxY}"); // 5,5 → 10,10
```

<figure class="nts-diagram">
<svg viewBox="0 0 420 140" width="420" height="140">
  <!-- 相交 -->
  <text x="75" y="20" text-anchor="middle" font-family="monospace" font-size="11" fill="#333">Intersects（重叠）</text>
  <rect x="20" y="35" width="90" height="70" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="55" y="60" width="90" height="70" fill="rgba(168,99,0,0.25)" stroke="#a86300" stroke-width="2"/>
  <text x="75" y="128" text-anchor="middle" font-family="monospace" font-size="10" fill="#0b6e4f">True</text>

  <!-- 包含 -->
  <text x="210" y="20" text-anchor="middle" font-family="monospace" font-size="11" fill="#333">Contains（包含）</text>
  <rect x="160" y="30" width="100" height="85" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="185" y="50" width="50" height="45" fill="rgba(168,99,0,0.25)" stroke="#a86300" stroke-width="2"/>
  <text x="210" y="128" text-anchor="middle" font-family="monospace" font-size="10" fill="#0b6e4f">True</text>

  <!-- 距离 -->
  <text x="345" y="20" text-anchor="middle" font-family="monospace" font-size="11" fill="#333">Distance（分离）</text>
  <rect x="285" y="35" width="55" height="55" fill="rgba(11,110,79,0.25)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="360" y="55" width="45" height="45" fill="rgba(168,99,0,0.25)" stroke="#a86300" stroke-width="2"/>
  <line x1="340" y1="70" x2="360" y2="70" stroke="#a00" stroke-width="2"/>
  <text x="350" y="62" text-anchor="middle" font-family="monospace" font-size="9" fill="#a00">d</text>
  <text x="345" y="128" text-anchor="middle" font-family="monospace" font-size="10" fill="#a00">d &gt; 0</text>
</svg>
<figcaption>Envelope 三种空间关系：相交、包含、距离</figcaption>
</figure>

### Envelope.Distance 与 Geometry.Distance 的区别

两者容易混淆，但语义不同：

| | `Envelope.Distance` | `Geometry.Distance` |
| --- | --- | --- |
| 输入 | `Envelope` | `Geometry` |
| 看 | 边界框范围 | 实际几何形状 |
| 相交判定 | Envelope 重叠即返回 `0` | 几何真正相交才返回 `0` |
| 速度 | 极快（O(1)） | 较慢（需精确计算） |
| 准确性 | 下界（≤ 真实距离） | 精确 |

关键差异：**两个 Envelope 可能重叠（`Envelope.Distance == 0`），但实际几何并不相交（`Geometry.Distance > 0`）**。这是空间索引"粗筛 + 精筛"两段式查询的根本原因。

<figure class="nts-diagram">
<svg viewBox="0 0 420 160" width="420" height="160">
  <!-- 情形一：Envelope 重叠但几何分离 -->
  <text x="105" y="20" text-anchor="middle" font-family="monospace" font-size="10" fill="#333">Envelope 重叠，几何分离</text>
  <rect x="20" y="30" width="90" height="100" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4 3"/>
  <rect x="70" y="40" width="90" height="100" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4 3"/>
  <polygon points="30,125 95,125 30,55" fill="rgba(11,110,79,0.3)" stroke="#0b6e4f" stroke-width="1.5"/>
  <polygon points="85,45 145,45 145,110" fill="rgba(168,99,0,0.3)" stroke="#a86300" stroke-width="1.5"/>
  <text x="105" y="150" text-anchor="middle" font-family="monospace" font-size="9" fill="#a00">Env.Distance=0, Geom.Distance&gt;0</text>

  <!-- 情形二：两者一致 -->
  <text x="315" y="20" text-anchor="middle" font-family="monospace" font-size="10" fill="#333">几何贴近 Envelope 边</text>
  <rect x="225" y="30" width="80" height="100" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4 3"/>
  <rect x="320" y="30" width="80" height="100" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4 3"/>
  <rect x="235" y="45" width="60" height="70" fill="rgba(11,110,79,0.3)" stroke="#0b6e4f" stroke-width="1.5"/>
  <rect x="330" y="45" width="60" height="70" fill="rgba(168,99,0,0.3)" stroke="#a86300" stroke-width="1.5"/>
  <line x1="305" y1="80" x2="320" y2="80" stroke="#a00" stroke-width="2"/>
  <text x="315" y="150" text-anchor="middle" font-family="monospace" font-size="9" fill="#0b6e4f">两者相等</text>
</svg>
<figcaption>Envelope.Distance 是 Geometry.Distance 的下界，仅当几何贴近边界框时两者相等</figcaption>
</figure>

## 经纬度下的真实距离

平面欧氏测量对经纬度无效。真实地球表面距离有两个常用方案：**Haversine 公式**（两点球面距离）与**投影方案**（投影到米制坐标系后用 NTS 测量）。

### Haversine 大圆距离

Haversine 假设地球为完美球体（半径约 6371 km），计算两点间大圆弧长。代码自包含、不依赖外部库，适合 **两点间距离**：

```csharp
using System;

// 两点经纬度（度）→ 球面距离（米）
static double HaversineMeters(double lon1, double lat1, double lon2, double lat2)
{
    const double R = 6371000;            // 地球半径，米
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
Console.WriteLine($"{meters / 1000:F1} km");  // ≈ 1067.4 km
```

::: tip Haversine 的精度与适用场景
Haversine 假设地球是球体，误差约 0.5%。若需更高精度（毫米级），应使用基于椭球体的 **Vincenty 公式** 或地理库。Haversine 只算两点，对线/多边形要算"点到线段的球面最短距离"会复杂得多——这种场景请用下面的投影方案。
:::

### 投影方案

把经纬度几何投影到米制投影坐标系（如 Web 墨卡托 EPSG:3857，单位米），再用 NTS 的 `Distance` / `Area` / `Length` 直接得到米与平方米。这适合 **区域级数据**（一个城市、一个省）的批量测量。

下面用 [ProjNet](https://github.com/NetTopologySuite/ProjNet4GeoAPI) 完整实现，重点修复两个常见 bug：**`CoordinateTransformFilter` 必须正确定义**，**变换必须通过 `Apply` 真正执行**。

```csharp
// 安装：dotnet add package ProjNet
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

// 1. 构造 WGS84(4326) → Web 墨卡托(3857) 的数学变换
var wgs84 = GeographicCoordinateSystem.WGS84;
var webMercator = ProjectedCoordinateSystem.WebMercator;
var ctFactory = new CoordinateTransformationFactory();
MathTransform mathTransform =
    ctFactory.CreateFromCoordinateSystems(wgs84, webMercator).MathTransform;

// 2. 正确定义坐标变换过滤器：把每个坐标送进 MathTransform
private sealed class CoordinateTransformFilter : ICoordinateSequenceFilter
{
    private readonly MathTransform _transform;
    public CoordinateTransformFilter(MathTransform t) => _transform = t;

    public bool Done => false;          // false = 处理所有坐标
    public bool GeometryChanged => true;

    public void Filter(CoordinateSequence seq, int i)
    {
        // ProjNet 的 Transform 接收单点坐标数组 [x, y]，返回变换后的 [x', y']
        double[] result = _transform.Transform(new[] { seq.GetX(i), seq.GetY(i) });
        seq.SetX(i, result[0]);
        seq.SetY(i, result[1]);
    }
}

// 3. 在副本上执行变换（不改原几何），并更新 SRID
Geometry ProjectToWebMercator(Geometry g)
{
    Geometry copy = g.Copy();
    copy.Apply(new CoordinateTransformFilter(mathTransform));  // 关键：真正执行变换
    copy.SRID = 3857;
    return copy;
}
```

```csharp
// 使用示例：北京天安门（经纬度）投影后测距
var wgsFactory = new GeometryFactory(new PrecisionModel(), 4326);
var beijing = wgsFactory.CreatePoint(new Coordinate(116.40, 39.90));
var shanghai = wgsFactory.CreatePoint(new Coordinate(121.49, 31.24));

var bj3857 = ProjectToWebMercator(beijing);
var sh3857 = ProjectToWebMercator(shanghai);

Console.WriteLine($"{bj3857.Distance(sh3857) / 1000:F1} km");  // ≈ 1018 km
```

::: warning 旧代码的两个 Bug
常见的错误写法：

```csharp
// ❌ Bug 1：CoordinateTransformFilter 未定义就直接 new
// ❌ Bug 2：创建了 filter 却没调用 Apply，只返回 g.Copy()
Geometry Project(Geometry g)
{
    var filter = new CoordinateTransformFilter(transformation.MathTransform);
    return g.Copy();   // 变换从未执行！
}
```

`ICoordinateSequenceFilter` 本身不触发任何计算，必须通过 `geometry.Apply(filter)` 才会遍历坐标序列并调用 `Filter`。上面的正确实现定义了过滤器类、调用了 `Apply`、并在副本上操作。
:::

### 投影选择建议

Web 墨卡托（EPSG:3857）是全球通用，但 **在离赤道越远的地方面积/距离变形越大**——同尺寸的地块在 60°N 看起来比赤道处大近 4 倍。

<figure class="nts-diagram">
<svg viewBox="0 0 420 170" width="420" height="170">
  <text x="110" y="18" text-anchor="middle" font-family="monospace" font-size="10" fill="#333">地球表面（同尺寸方块）</text>
  <circle cx="110" cy="100" r="60" fill="rgba(11,110,79,0.08)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="100" y="120" width="20" height="14" fill="rgba(11,110,79,0.45)" stroke="#0b6e4f" stroke-width="1"/>
  <text x="125" y="131" font-family="monospace" font-size="9" fill="#0b6e4f">赤道附近</text>
  <rect x="100" y="55" width="20" height="14" fill="rgba(168,99,0,0.45)" stroke="#a86300" stroke-width="1"/>
  <text x="125" y="66" font-family="monospace" font-size="9" fill="#a86300">高纬度</text>

  <text x="200" y="100" font-family="monospace" font-size="18" fill="#666">⇒</text>

  <text x="315" y="18" text-anchor="middle" font-family="monospace" font-size="10" fill="#333">Web 墨卡托投影后</text>
  <rect x="290" y="120" width="20" height="14" fill="rgba(11,110,79,0.45)" stroke="#0b6e4f" stroke-width="1"/>
  <text x="315" y="131" font-family="monospace" font-size="9" fill="#0b6e4f">变形小</text>
  <rect x="282" y="40" width="36" height="48" fill="rgba(168,99,0,0.45)" stroke="#a86300" stroke-width="1"/>
  <text x="325" y="66" font-family="monospace" font-size="9" fill="#a86300">变形大</text>
  <text x="315" y="158" text-anchor="middle" font-family="monospace" font-size="9" fill="#a00">高纬度被拉伸</text>
</svg>
<figcaption>Web 墨卡托的投影变形带：纬度越高，面积/距离放大越多</figcaption>
</figure>

| 场景 | 推荐投影 |
| --- | --- |
| 全球底图、低精度概览 | Web 墨卡托（EPSG:3857） |
| 中国境内精确测量 | **CGCS2000 / Gauss-Kruger 分带投影**（如 EPSG:4527 等，按经度选带） |
| 单个城市级分析 | 该城市的 UTM 带或地方投影 |
| 两点距离 | 直接用 Haversine，无需投影 |

::: warning Web 墨卡托不适合高纬度精确测量
Web 墨卡托在 60°N 处面积放大约 4 倍，在 85°N 处趋于无穷。在中国做面积/距离的精确统计（如宗地、配送区），务必用 **CGCS2000 / Gauss-Kruger** 这类等角横轴墨卡托分带投影，并按所在经度选择正确分带。跨带数据需先换带或统一到同一带。
:::

## 球面面积

经纬度多边形的真实球面面积，NTS 不内置。两种思路：

1. **投影后用 Area**：投影到合适的米制投影，`Area` 即平方米。适合中小区域。
2. **球面三角法**（L'Huilier / 球面过剩公式）：把多边形三角剖分，对每个三角形用球面过剩角求面积再求和。适合跨国、洲际级大区域。

下面给出基于球面过剩公式的可选实现，用于不需要投影的快速估算：

```csharp
using System;

// 球面多边形面积（经纬度顶点，按顺序闭合），返回平方米
static double SphericalPolygonArea(Coordinate[] ring)
{
    const double R = 6378137;                 // WGS84 长半轴，米
    int n = ring.Length - 1;                  // 末点与首点重复
    double sum = 0;
    for (int i = 0; i < n; i++)
    {
        var p1 = ring[i];
        var p2 = ring[(i + 1) % n];
        sum += (p2.X - p1.X) * Math.PI / 180 *
               (2 + Math.Sin(p1.Y * Math.PI / 180) +
                    Math.Sin(p2.Y * Math.PI / 180));
    }
    return Math.Abs(sum * R * R / 2);
}
```

::: tip 何时需要球面面积
对单个城市（边长几十公里），投影后 `Area` 与球面面积差异可忽略。对跨省、洲际范围，球面公式更准。NTS 不提供球面面积，但 ProjNet 投影 + NTS `Area` 是最省事的工程方案。
:::

## 退化几何（零面积环）

"退化"几何指面积或长度为 0 的几何，常见来源：所有顶点共线、所有顶点重合、`Buffer(0)` 修复失败后的残余。

```csharp
// 共线"环"：所有点在一条直线上，Area = 0
var degenerate = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(5, 5), new Coordinate(10, 10),
    new Coordinate(0, 0)
});
Console.WriteLine(degenerate.Area);      // 0
Console.WriteLine(degenerate.IsValid);   // False（环面积必须 > 0）
```

::: warning 退化几何的陷阱
- 退化多边形 `IsValid` 为 `false`，参与叠加运算可能抛异常或产生空结果
- 退化环的 `Length` 仍大于 0（线段长度之和），不要用 `Length == 0` 判空
- 判断"几何是否为空"用 `IsEmpty`，判断"几何是否退化"用 `Area == 0 && !IsEmpty` 配合 `IsValid`
- 入库时建议用 `GeometryFixer` 修复或直接丢弃退化几何
:::

## 综合案例：配送效率统计

假设几何已投影到米制坐标系（如 CGCS2000 / Gauss-Kruger），统计某门店配送区的效率指标：

```csharp
// 假设几何已投影到米制（SRID 已设为对应分带）
var store = factory.CreatePoint(new Coordinate(500000, 3040000));
var deliveryZone = store.Buffer(3000);        // 3 公里配送范围
var roads = LoadRoadNetwork();                // MultiLineString，道路网
var customers = LoadCustomers();              // 客户点集合

// 1. 配送区面积（平方米 → 平方公里）
Console.WriteLine($"配送区面积: {deliveryZone.Area / 1_000_000:F2} km²");

// 2. 配送区内道路总长（米 → 公里）
var roadsInZone = roads.Intersection(deliveryZone);
Console.WriteLine($"区内道路: {roadsInZone.Length / 1000:F2} km");

// 3. 道路密度（km / km²）
double density = roadsInZone.Length / deliveryZone.Area;
Console.WriteLine($"道路密度: {density * 1000:F2} km/km²");

// 4. 最远客户距离（用 IsWithinDistance 快速筛除过远客户后取最大值）
double maxDist = customers.Max(c => store.Distance(c));
Console.WriteLine($"最远客户距离: {maxDist / 1000:F2} km");

// 5. 3 公里内客户数（IsWithinDistance 比 Distance 快）
int inRange = customers.Count(c => store.IsWithinDistance(c, 3000));
Console.WriteLine($"3 公里内客户: {inRange}");
```

## 小结速查表

| 方法 / 属性 | 返回类型 | 含义 | 单位 |
| --- | --- | --- | --- |
| `g.Area` | `double` | 平面面积 | 坐标系单位² |
| `g.Length` | `double` | 线长 / 多边形周长 | 坐标系单位 |
| `a.Distance(b)` | `double` | 两几何最短欧氏距离 | 坐标系单位 |
| `a.IsWithinDistance(b, d)` | `bool` | 距离 ≤ d（Envelope 预过滤） | 坐标系单位 |
| `g.EnvelopeInternal` | `Envelope` | 外接矩形（轻量） | 坐标系单位 |
| `g.Envelope` | `Geometry` | 外接矩形（Polygon） | 坐标系单位 |
| `new Envelope(minX,maxX,minY,maxY)` | `Envelope` | 构造边界框 | 坐标系单位 |
| `env.Intersects(other)` | `bool` | 是否相交（含相切） | — |
| `env.Contains(c)` / `Contains(env)` | `bool` | 是否完全包含 | — |
| `env.Distance(other)` | `double` | 边界框最短距离（≤ 几何距离） | 坐标系单位 |
| `env.ExpandToInclude(...)` | `void` | 原地扩展到包含目标 | — |
| `env.ExpandBy(d)` | `void` | 原地向四周外扩 | — |
| `env.ToGeometry(factory)` | `Geometry` | 转 Polygon | — |
| `env.Intersection(other)` | `Envelope` | 求交，返回新 Envelope | — |
| `HaversineMeters(...)` | `double` | 两点球面距离 | 米 |
| `SphericalPolygonArea(...)` | `double` | 球面多边形面积 | 平方米 |

::: warning 核心提醒
NTS 的所有测量方法都是 **平面欧氏**。经纬度坐标直接用会得到无意义的"度"或"平方度"。要么投影到米制坐标系（CGCS2000 / Gauss-Kruger 优先，Web 墨卡托仅适合低纬低精度），要么用 Haversine / 球面公式。
:::

## 下一步

- [最近点与投影](./nearest-points.md)：找到几何间最近的具体位置（`NearestPoints` / `ClosestPoints`）
- [几何属性](../02-geometry-fundamentals/geometry-properties.md)：`Area` / `Length` / `Envelope` 等属性的总览
- [空间索引 STRtree](../06-performance/spatial-index.md)：用 Envelope 做批量距离查询加速
- [PreparedGeometry](../06-performance/prepared-geometry.md)：重复谓词判断的性能优化
- [空间谓词](../03-spatial-relations/relationships.md)：`Intersects` / `Within` 等关系判断
