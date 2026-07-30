# 缓冲区 Buffer

`Buffer` 是 NTS 中最常用的几何运算之一——把一个点变成圆、把一条线变成"走廊"、把多边形向外扩张或向内收缩。它在配送范围、生态保护区、噪声带、安全距离等场景无处不在。

## 最简单的缓冲

```csharp
var factory = new GeometryFactory();

var p = factory.CreatePoint(new Coordinate(0, 0));
var circle = p.Buffer(5.0);   // 半径 5 的圆

Console.WriteLine(circle.NumPoints);   // 65（默认 4 象限分段）
Console.WriteLine(circle.Area);        // ≈ 78.54 (π × 25)
```

::: tip 单位 = 坐标系单位
`distance` 的单位是 **坐标系单位**。如果你的几何是经纬度 (WGS84)，那 `Buffer(0.5)` 是 0.5 度；如果是 Web 墨卡托 (EPSG:3857)，那是 0.5 米。
:::

## 象限分段数：圆有多圆

NTS 用多边形逼近圆。`quadrantSegments` 控制每个象限的弧段数：

```csharp
var c1 = p.Buffer(5.0, 4);    // 4 段/象限 = 16 边形
var c2 = p.Buffer(5.0, 8);    // 8 段/象限 = 32 边形（默认）
var c3 = p.Buffer(5.0, 32);   // 32 段/象限 = 128 边形，几乎完美圆
```

| quadrantSegments | 边数 | 顶点数 | 误差 |
| --- | --- | --- | --- |
| 4 | 16 | 17 | ~7.6% |
| 8 (默认) | 32 | 33 | ~1.9% |
| 16 | 64 | 65 | ~0.5% |
| 32 | 128 | 129 | ~0.1% |

```csharp
// 通过 BufferParameters 精细控制
var pars = new BufferParameters
{
    QuadrantSegments = 16,
    EndCapStyle = EndCapStyle.Round,
    JoinStyle = JoinStyle.Round,
    MitreLimit = 5.0
};
var buffer = p.Buffer(5.0, pars);
```

## 端点风格 EndCapStyle

只对线和开放多边形有效，控制线段端点的形状：

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 5)
});

var round  = line.Buffer(1, new BufferParameters { EndCapStyle = EndCapStyle.Round });
var flat   = line.Buffer(1, new BufferParameters { EndCapStyle = EndCapStyle.Flat });
var square = line.Buffer(1, new BufferParameters { EndCapStyle = EndCapStyle.Square });
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 100" width="360" height="100">
  <g font-family="monospace" font-size="10" fill="#444">
    <!-- Round -->
    <line x1="20" y1="50" x2="80" y2="50" stroke="#0b6e4f" stroke-width="2"/>
    <path d="M 20 50 m -8 0 a 8 8 0 0 1 16 0 m 64 0 a 8 8 0 0 1 0 -8" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f"/>
    <text x="50" y="80" text-anchor="middle">Round</text>

    <!-- Flat -->
    <line x1="150" y1="50" x2="210" y2="50" stroke="#0b6e4f" stroke-width="2"/>
    <rect x="150" y="42" width="60" height="16" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f"/>
    <text x="180" y="80" text-anchor="middle">Flat</text>

    <!-- Square -->
    <line x1="280" y1="50" x2="340" y2="50" stroke="#0b6e4f" stroke-width="2"/>
    <rect x="272" y="42" width="76" height="16" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f"/>
    <text x="310" y="80" text-anchor="middle">Square</text>
  </g>
</svg>
<figcaption>三种端点风格</figcaption>
</figure>

## 连接风格 JoinStyle

控制折线转弯处的填充方式：

```csharp
var pars = new BufferParameters
{
    JoinStyle = JoinStyle.Round    // Round / Mitre / Bevel
};
```

| JoinStyle | 形状 | 适用 |
| --- | --- | --- |
| `Round` (默认) | 圆弧过渡 | 视觉平滑，通用 |
| `Mitre` | 尖角延伸 | 直角折线，建筑轮廓 |
| `Bevel` | 平直切角 | 折中方案 |

`Mitre` 风格下，尖角过窄会无限延伸。`MitreLimit`（默认 5.0）控制最大延伸比，超过则自动降级为 Bevel。

## 单边缓冲

`BufferParameters.IsSingleSided = true` 让缓冲区只生成在线的一侧：

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0)
});

// 只在右侧生成 1 单位缓冲
var pars = new BufferParameters
{
    IsSingleSided = true,
    JoinStyle = JoinStyle.Mitre,
    EndCapStyle = EndCapStyle.Flat
};
var rightOnly = line.Buffer(1, pars);

// 负距离则在左侧
var leftOnly = line.Buffer(-1, pars);
```

应用：道路中线 → 单侧人行道；河流 → 单侧河岸。

## 负缓冲：收缩多边形

多边形支持负距离缓冲——向内收缩：

```csharp
var square = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});

var shrunk = square.Buffer(-2.0);  // 向内收缩 2 单位
Console.WriteLine($"原面积 = {square.Area}, 收缩后面积 = {shrunk.Area}");
// 原面积 = 100, 收缩后面积 = 36
```

::: warning 收缩可能产生空集
如果缓冲距离大于几何到中心的距离（如圆形半径），结果会是 **空几何**。例如半径 5 的圆 `Buffer(-6)` 返回空 Polygon。
:::

## Buffer(0)：经典修复技巧

`g.Buffer(0)` 是 GIS 圈最经典的"几何修复"招式。它能：

- 修复多边形自相交
- 移除退化（面积为 0）的部分
- 整合重叠区域

```csharp
var bowtie = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 10),
    new Coordinate(10, 0), new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Console.WriteLine(bowtie.IsValid);  // False
var fixed = bowtie.Buffer(0);
Console.WriteLine(fixed.IsValid);   // True
```

但 `Buffer(0)` 不是万能的——对于复杂错误，用 `GeometryFixer` 更可靠。

## 高级参数

`BufferParameters` 还提供：

```csharp
var pars = new BufferParameters
{
    QuadrantSegments = 8,
    EndCapStyle = EndCapStyle.Round,
    JoinStyle = JoinStyle.Round,
    MitreLimit = 5.0,
    IsSingleSided = false,
    SimplifyFactor = 0.01,    // 简化输出的边数
    // 高级：曲线偏移与精度模型
};
```

## 实战案例：店铺 3 公里配送范围

```csharp
// 假设几何已投影到米制坐标系（如 CGCS2000 / Gauss-Kruger）
var store = factory.CreatePoint(new Coordinate(500000, 3040000));

var pars = new BufferParameters
{
    QuadrantSegments = 16,    // 64 边形，足够圆滑
    EndCapStyle = EndCapStyle.Round,
    JoinStyle = JoinStyle.Round
};

var deliveryZone = store.Buffer(3000, pars);  // 半径 3000 米

// 进一步：从配送范围中扣除不可达区域（如河流）
var riverBuffer = river.Buffer(50);  // 河流两侧 50 米
var reachable = deliveryZone.Difference(riverBuffer);

Console.WriteLine($"可达面积 = {reachable.Area / 1_000_000:F2} km²");
```

## 性能注意

1. **quadrantSegments 越大越慢**：默认 8 已经足够，不要无脑调到 64。
2. **大批量缓冲用 BufferOp**：直接 `new BufferOp(g).GetResultGeometry(distance)` 比 `g.Buffer` 略快，可复用参数。
3. **避免重复缓冲**：如果你只是想"看看是否在范围里"，用 `Distance() < threshold` 或 `PreparedGeometry.Covers()` 通常更快，不需要真的生成缓冲区几何。

## 常见坑

### 1. 经纬度坐标用米单位缓冲

```csharp
// ❌ 错误：经纬度下 Buffer(3000) 表示 3000 度
var point = new Point(116.40, 39.90);
var zone = point.Buffer(3000);  // 巨大的几何，覆盖整个地球

// ✅ 正确：先投影到米制坐标系
var projected = ProjectToWebMercator(point);  // 用 ProjNet 等库
var zone = projected.Buffer(3000);             // 3000 米
```

### 2. 缓冲后几何无效

罕见但可能发生，特别是输入本身有问题时。运算前用 `IsValid` 校验。

### 3. 缓冲合并缺口

```csharp
// 一组相邻的圆，单独 buffer 后再 union 可能有缝
var circles = centers.Select(c => p.Buffer(r)).ToList();
var merged = circles.Aggregate((a, b) => a.Union(b));  // 可能有缝

// ✅ 更好：合并所有中心点，再一次性 buffer
// 或：使用 UnaryUnionOperation 让 NTS 处理拓扑
```

## 小结

| 参数 | 作用 |
| --- | --- |
| `distance` | 半径，正=外扩，负=内缩 |
| `quadrantSegments` | 弧度近似精度（默认 8） |
| `EndCapStyle` | 线端形状：Round/Flat/Square |
| `JoinStyle` | 折角填充：Round/Mitre/Bevel |
| `MitreLimit` | Mitre 模式下的最大尖角比 |
| `IsSingleSided` | 单边缓冲 |

## 下一步

- [凸包与简化](./convex-simplify.md)
- [空间谓词](../predicates/relationships.md)
- [API 速查表](../cookbook/cheatsheet.md)
