# 第一个几何对象

本节用一节代码课的方式，让你亲手创建 NTS 中的三大基础几何类型：点、线、面。读完后你将能熟练用 `GeometryFactory` 构造任意几何，并理解坐标数组与闭合环的规则。

## GeometryFactory：几何对象的工厂

NTS 中所有几何对象都通过 `GeometryFactory` 创建。它统一管理 **精度模型 (PrecisionModel)** 和 **SRID (空间参考 ID)**，保证同一工厂产出的几何可以互相运算。

```csharp
using NetTopologySuite.Geometries;

// 默认工厂：浮点精度，SRID = 0
var factory = new GeometryFactory();

// 也可以指定精度模型和 SRID
var wgs84 = new GeometryFactory(
    new PrecisionModel(PrecisionModels.Floating),  // 浮点精度
    4326);                                          // WGS84 经纬度

var cgcs2000 = new GeometryFactory(
    new PrecisionModel(PrecisionModels.Floating),
    4490);                                          // CGCS2000
```

::: tip 为什么要区分 SRID？
SRID 标识坐标所在的"空间参考系统"。两个几何做运算前，NTS **不会** 校验 SRID 是否一致——这是开发者的责任。混用 4326（经纬度）和 3857（Web 墨卡托米制）会让结果完全无意义。
:::

## Point：点

点是 NTS 中最简单的几何，由一个 `Coordinate` 构成。

```csharp
var p1 = factory.CreatePoint(new Coordinate(116.40, 39.90));
var p2 = new Point(116.40, 39.90);          // 语法糖，等价于上面

// 空点（没有坐标）
var empty = factory.CreatePoint();
Console.WriteLine(empty.IsEmpty);            // True

// 带高程 (Z) 和测量值 (M) 的点
var p3d = new Point(116.40, 39.90, 50.0);    // Z = 50 米
var pm  = new Point(116.40, 39.90) { M = 120 }; // M = 120

Console.WriteLine($"X={p1.X}, Y={p1.Y}");
Console.WriteLine($"3D 点: X={p3d.X}, Y={p3d.Y}, Z={p3d.Z}");
```

## LineString：线

线由 **至少 2 个** `Coordinate` 构成。`LineString` 有两个特殊子类：

- `LinearRing`：闭合环，首尾坐标必须相同，且不能自相交。
- `LineString`：普通折线。

```csharp
var coords = new[]
{
    new Coordinate(0, 0),
    new Coordinate(1, 2),
    new Coordinate(3, 1),
    new Coordinate(4, 4)
};
var line = factory.CreateLineString(coords);

Console.WriteLine($"长度 = {line.Length}");  // 1+2+3 ≈ 6.65
Console.WriteLine("顶点数 = " + line.NumPoints);

// LinearRing：首尾必须相同
var ringCoords = new[]
{
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)   // ← 闭合
};
var ring = factory.CreateLinearRing(ringCoords);
Console.WriteLine($"是否闭合 = {ring.IsClosed}, 是否有效 = {ring.IsValid}");
```

## Polygon：多边形

多边形由 **1 个外壳 (shell)** + **0 到多个孔洞 (holes)** 构成。每个 shell/hole 都是 `LinearRing`。

```csharp
// 外壳：一个 10x10 的正方形
var shell = factory.CreateLinearRing(new[]
{
    new Coordinate(0, 0),
    new Coordinate(10, 0),
    new Coordinate(10, 10),
    new Coordinate(0, 10),
    new Coordinate(0, 0)
});

// 孔洞：中央一个 2x2 的洞
var hole = factory.CreateLinearRing(new[]
{
    new Coordinate(4, 4),
    new Coordinate(6, 4),
    new Coordinate(6, 6),
    new Coordinate(4, 6),
    new Coordinate(4, 4)
});

var poly = factory.CreatePolygon(shell, new[] { hole });

Console.WriteLine($"面积 = {poly.Area}");   // 100 - 4 = 96
Console.WriteLine($"周长 = {poly.Length}"); // 外壳 40 + 孔洞 8 = 48
Console.WriteLine($"有效 = {poly.IsValid}");
```

<figure class="nts-diagram">
<svg viewBox="0 0 220 140" width="220" height="140">
  <rect x="20" y="20" width="180" height="100" fill="rgba(11,110,79,0.15)" stroke="#0b6e4f" stroke-width="2"/>
  <rect x="90" y="60" width="40" height="20" fill="#fff" stroke="#0b6e4f" stroke-width="2"/>
  <text x="60" y="78" font-family="monospace" font-size="11" fill="#0b6e4f">外壳 shell</text>
  <text x="140" y="75" font-family="monospace" font-size="10" fill="#a00">孔洞 hole</text>
</svg>
<figcaption>Polygon = 外壳 + 孔洞集合</figcaption>
</figure>

## Multi 系列集合类型

当需要表达"一组同类型的几何"时，用对应的 `Multi*` 类型：

| 单一类型 | 集合类型 |
| --- | --- |
| `Point` | `MultiPoint` |
| `LineString` | `MultiLineString` |
| `Polygon` | `MultiPolygon` |

```csharp
var mp = factory.CreateMultiPoint(new[]
{
    new Point(0, 0),
    new Point(1, 1),
    new Point(2, 2)
});

Console.WriteLine($"几何数 = {mp.NumGeometries}");  // 3
Console.WriteLine($"整体面积 = {mp.Area}");          // 0（点没有面积）
```

## 把几何写出来：WKT

WKT (Well-Known Text) 是 OGC 标准的文本表示。`WKTReader` / `WKTWriter` 是最常用的诊断与调试工具。

```csharp
using NetTopologySuite.IO;

var reader = new WKTReader();
var g = reader.Read("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");

var writer = new WKTWriter { MaxCoordinatesPerLine = int.MaxValue };
Console.WriteLine(writer.Write(g));
// POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))
```

更多 WKT 细节见 [WKT 与 WKB](../core/wkt-wkb.md)。

## 一个综合练习：判断轨迹是否进入禁区

```csharp
var factory = new GeometryFactory();

// 一条移动轨迹：5 个采样点
var track = factory.CreateLineString(new[]
{
    new Coordinate(0, 0),
    new Coordinate(2, 1),
    new Coordinate(5, 3),
    new Coordinate(8, 5),
    new Coordinate(10, 8)
});

// 禁区：一个矩形
var zone = factory.CreatePolygon(new[]
{
    new Coordinate(4, 2),
    new Coordinate(7, 2),
    new Coordinate(7, 4),
    new Coordinate(4, 4),
    new Coordinate(4, 2)
});

bool entered = track.Intersects(zone);
Console.WriteLine($"轨迹进入禁区？ {entered}");

// 进一步：截取进入禁区的部分
var segment = track.Intersection(zone);
Console.WriteLine($"在禁区内的线段长度 = {segment.Length:F3}");
```

## 小结

| 概念 | 关键点 |
| --- | --- |
| `GeometryFactory` | 所有几何的入口，统一精度与 SRID |
| `Coordinate` | 不可变的二维坐标（可扩展 Z/M） |
| `Point` / `LineString` / `Polygon` | 三大基础类型 |
| `LinearRing` | 闭合、不自相交的线环，是 Polygon 的基本构件 |
| `Multi*` 类型 | 同类型几何的集合 |
| `WKTReader` / `WKTWriter` | 文本序列化，调试利器 |

## 下一步

- [坐标与几何层级](../core/geometry-hierarchy.md)：理解完整的类型继承树
- [几何工厂 GeometryFactory](../core/geometry-factory.md)：工厂的更多用法
- [WKT 与 WKB](../core/wkt-wkb.md)：文本与二进制序列化格式
