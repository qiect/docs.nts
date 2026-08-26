# 缓冲区 Buffer

`Buffer` 是 NTS 中最常用的几何运算之一——把一个点变成圆、把一条线变成"走廊"、把多边形向外扩张或向内收缩。它在配送范围、生态保护区、噪声带、安全距离等场景无处不在。

NTS 的缓冲功能由两类 API 承载：

- `Geometry.Buffer(...)`：`Geometry` 上的便捷方法，四个重载
- `BufferOp`：底层操作类，可复用参数、性能更优

参数控制则统一收敛到 `BufferParameters` 类。本页按重载逐个拆解。

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Buffer;
using NetTopologySuite.Geometries.Utilities;   // GeometryFixer

// 本页示例共用工厂
var factory = new GeometryFactory();
```

## Buffer(distance)

**签名**：`public Geometry Buffer(double distance)`

**语义**：基础重载。返回距输入几何所有点不超过 `distance` 的点集，使用默认参数（`quadrantSegments = 8`、`EndCapStyle.Round`、`JoinStyle.Round`、`MitreLimit = 5.0`）。

| 输入几何 | 行为 |
| --- | --- |
| `Point` | 圆盘（多边形逼近） |
| `LineString` | "走廊"形多边形，端点圆头 |
| `Polygon` (正距离) | 外壳向外扩张，孔洞向内收缩 |
| `Polygon` (负距离) | 外壳向内收缩，孔洞向外扩张 |
| `Multi*` / `GeometryCollection` | 各子几何分别缓冲后合并 |

```csharp
var p = factory.CreatePoint(new Coordinate(0, 0));
var circle = p.Buffer(5.0);   // 半径 5 的圆

Console.WriteLine(circle.NumPoints);   // 33（默认 8 段/象限 = 32 边形 + 闭合点）
Console.WriteLine(circle.Area);        // ≈ 78.04（略小于 π × 25 ≈ 78.54）
Console.WriteLine(circle.GeometryType);// Polygon
```

::: tip 单位 = 坐标系单位
`distance` 的单位是 **坐标系单位**。如果几何是经纬度（WGS84），`Buffer(0.5)` 是 0.5 度；如果是 Web 墨卡托（EPSG:3857），则是 0.5 米。需要"米制缓冲"必须先投影，详见文末[常见坑](#常见坑)。
:::

## Buffer(distance, quadrantSegments)

**签名**：`public Geometry Buffer(double distance, int quadrantSegments)`

**语义**：在基础重载上增加圆弧精度控制。NTS 用多边形逼近圆弧，`quadrantSegments` 指定每个象限的分段数，整圆边数 = `4 × quadrantSegments`。

```csharp
var c1 = p.Buffer(5.0, 4);    // 4 段/象限 = 16 边形
var c2 = p.Buffer(5.0, 8);    // 8 段/象限 = 32 边形（等同默认）
var c3 = p.Buffer(5.0, 32);   // 32 段/象限 = 128 边形，几乎完美圆
```

**误差对照表**（NTS 用内接多边形逼近圆弧，最大径向误差 = `r × (1 − cos(π/n))`，`n = 4 × q`）：

| quadrantSegments | 边数 (n) | 顶点数 | 最大径向误差 | 面积 (r=5) | 面积相对误差 |
| --- | --- | --- | --- | --- | --- |
| 1 | 4 | 5 | ≈ 29.3% | ≈ 50.00 | −36.3% |
| 2 | 8 | 9 | ≈ 7.6% | ≈ 70.71 | −9.97% |
| 4 | 16 | 17 | ≈ 1.92% | ≈ 76.54 | −2.55% |
| 8（默认） | 32 | 33 | ≈ 0.48% | ≈ 78.04 | −0.64% |
| 16 | 64 | 65 | ≈ 0.12% | ≈ 78.41 | −0.16% |
| 32 | 128 | 129 | ≈ 0.03% | ≈ 78.51 | −0.04% |

::: warning 误差随半径线性放大
表中的"径向误差"是相对值（占 `distance` 的比例），**绝对径向偏差与 `distance` 成正比**。例如 `distance = 1000 m`、`q = 8` 时，最大径向偏差约 `1000 × 0.0048 = 4.8 m`；做配送范围、合规距离时务必留意。

NTS 官方建议：`q=8` 时径向误差 < 2%（足够多数场景）；要 < 1% 用 `q=12`；要 < 0.1% 用 `q=18`。
:::

## Buffer(distance, BufferParameters)

**签名**：`public Geometry Buffer(double distance, BufferParameters bufferParameters)`

**语义**：全参数控制重载。`BufferParameters` 暴露所有可调选项，详见下文 [BufferParameters 类](#bufferparameters-类)。

```csharp
var pars = new BufferParameters
{
    QuadrantSegments = 16,
    EndCapStyle = EndCapStyle.Round,
    JoinStyle = JoinStyle.Round,
    MitreLimit = 5.0,
    IsSingleSided = false,
    SimplifyFactor = 0.01
};
var buffer = p.Buffer(5.0, pars);
```

::: tip 一次构造、多次复用
`BufferParameters` 是普通可变对象，构造一次可传给多个 `Buffer` 调用。批量缓冲时这比每个调用走"便捷重载"略快——更重要的是参数集中可维护。
:::

## Buffer(distance, quadrantSegments, endCapStyle)

**签名**：`public Geometry Buffer(double distance, int quadrantSegments, EndCapStyle endCapStyle)`

**语义**：便捷重载，省去构造 `BufferParameters`。仅暴露三个最常用参数，其余保持默认（`JoinStyle.Round`、`MitreLimit = 5.0`）。只对 `LineString` 系列的端点形状有影响，对 `Polygon` 与 `Point` 无效。

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 5)
});

// 圆头走廊：32 边形圆弧端
var round = line.Buffer(1.0, 8, EndCapStyle.Round);

// 平头走廊：端点直切，不外延
var flat = line.Buffer(1.0, 8, EndCapStyle.Flat);

// 方头走廊：端点向外延伸一个 distance
var square = line.Buffer(1.0, 8, EndCapStyle.Square);
```

::: tip 重载选择速记
- 只改距离 → `Buffer(distance)`
- 还要调圆弧精度 → `Buffer(distance, quadrantSegments)`
- 还要调端点形状（且仅改这三项）→ `Buffer(distance, q, endCapStyle)`
- 要改 JoinStyle / MitreLimit / 单边 / 简化 → `Buffer(distance, BufferParameters)`
:::

## BufferParameters 类

`BufferParameters` 是所有缓冲可选项的统一入口。下面逐字段详解。

### QuadrantSegments

**签名**：`public int QuadrantSegments { get; set; }`，默认 `8`

**语义**：每个象限的圆弧分段数，整圆边数 = `4 × QuadrantSegments`。等价于 `Buffer(distance, quadrantSegments)` 中的第二个参数。取值越大，圆弧越平滑、几何越大、计算越慢。

```csharp
var pars = new BufferParameters { QuadrantSegments = 16 };
Console.WriteLine(pars.QuadrantSegments);  // 16
```

::: warning 不要无脑调大
`QuadrantSegments = 64` 时，单个点的缓冲就有 256 个顶点。批量缓冲（如 10 万个配送点）会让结果几何膨胀一个数量级，序列化、存储、渲染都受影响。多数业务场景 `8` 或 `16` 足够。
:::

### EndCapStyle

**签名**：`public EndCapStyle EndCapStyle { get; set; }`，默认 `EndCapStyle.Round`

**语义**：控制 `LineString` 端点的填充方式。对 `Polygon` 与 `Point` 无效。

| 取值 | 形状 | 几何行为 |
| --- | --- | --- |
| `Round`（默认） | 半圆 | 端点处用圆弧包络，半径 = `distance` |
| `Flat` | 直切 | 端点处垂直于线段方向直接切平，不向外延伸 |
| `Square` | 方头 | 端点处向外延伸 `distance` 后再切平 |

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
<svg viewBox="0 0 360 110" width="360" height="110">
  <g font-family="monospace" font-size="10" fill="#444">
    <!-- Round -->
    <line x1="20" y1="55" x2="80" y2="55" stroke="#0b6e4f" stroke-width="2"/>
    <path d="M 20 50 L 80 50 A 5 5 0 0 1 80 60 L 20 60 A 5 5 0 0 1 20 50 Z" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <text x="50" y="85" text-anchor="middle">Round</text>
    <text x="50" y="98" text-anchor="middle" fill="#888">半圆包络</text>

    <!-- Flat -->
    <line x1="150" y1="55" x2="210" y2="55" stroke="#0b6e4f" stroke-width="2"/>
    <rect x="150" y="50" width="60" height="10" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <text x="180" y="85" text-anchor="middle">Flat</text>
    <text x="180" y="98" text-anchor="middle" fill="#888">直切不延伸</text>

    <!-- Square -->
    <line x1="280" y1="55" x2="340" y2="55" stroke="#0b6e4f" stroke-width="2"/>
    <rect x="275" y="50" width="70" height="10" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <text x="310" y="85" text-anchor="middle">Square</text>
    <text x="310" y="98" text-anchor="middle" fill="#888">外延一个 distance</text>
  </g>
</svg>
<figcaption>三种 EndCapStyle：圆头 / 平头 / 方头</figcaption>
</figure>

::: tip Flat 与 Square 的差别
两者都"直切"，但 `Flat` 在端点处切平，`Square` 在端点之外再延伸 `distance` 后才切平。`Square` 适合"封头"语义（如管口、墙端），`Flat` 适合"对齐到端点"语义。
:::

### JoinStyle

**签名**：`public JoinStyle JoinStyle { get; set; }`，默认 `JoinStyle.Round`

**语义**：控制折线**转角处**（非端点）的填充方式。与 `EndCapStyle` 互补：`EndCapStyle` 管线段开头/结尾，`JoinStyle` 管中间转弯。

| 取值 | 形状 | 适用 |
| --- | --- | --- |
| `Round`（默认） | 圆弧过渡 | 视觉平滑，通用 |
| `Mitre` | 尖角延伸 | 直角折线、建筑轮廓、 Cadastral |
| `Bevel` | 平直切角 | 折中方案，避免尖角过长 |

```csharp
var pars = new BufferParameters
{
    JoinStyle = JoinStyle.Mitre    // Round / Mitre / Bevel
};
var b = line.Buffer(1, pars);
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 130" width="360" height="130">
  <g font-family="monospace" font-size="10" fill="#444">
    <!-- Round: 折线 + 圆弧外角 -->
    <polyline points="15,90 50,90 50,30 95,30" fill="none" stroke="#0b6e4f" stroke-width="2"/>
    <path d="M 15 85 L 45 85 A 5 5 0 0 1 50 80 L 50 35 A 5 5 0 0 0 55 30 L 95 30 L 95 25 L 55 25 A 10 10 0 0 1 45 35 L 45 80 A 10 10 0 0 0 35 85 L 15 85 Z" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <text x="55" y="115" text-anchor="middle">Round</text>
    <text x="55" y="127" text-anchor="middle" fill="#888">圆弧外角</text>

    <!-- Mitre: 折线 + 尖角延伸 -->
    <polyline points="135,90 170,90 170,30 215,30" fill="none" stroke="#0b6e4f" stroke-width="2"/>
    <path d="M 135 85 L 165 85 L 178 22 L 215 25 L 215 30 L 170 30 L 170 90 L 135 90 Z" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <circle cx="178" cy="22" r="2.5" fill="#a00"/>
    <text x="175" y="115" text-anchor="middle">Mitre</text>
    <text x="175" y="127" text-anchor="middle" fill="#888">尖角延伸（红点）</text>

    <!-- Bevel: 折线 + 平直切角 -->
    <polyline points="255,90 290,90 290,30 335,30" fill="none" stroke="#0b6e4f" stroke-width="2"/>
    <path d="M 255 85 L 285 85 L 295 25 L 335 25 L 335 30 L 290 30 L 290 90 L 255 90 Z" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <text x="295" y="115" text-anchor="middle">Bevel</text>
    <text x="295" y="127" text-anchor="middle" fill="#888">平直切角</text>
  </g>
</svg>
<figcaption>三种 JoinStyle：折线转角处的外缘填充方式</figcaption>
</figure>

::: warning Mitre 与尖角过窄
`Mitre` 模式下，当折线夹角很小（接近 0°）时，尖角会无限延伸。NTS 用 `MitreLimit` 保护——超过限制自动降级为 `Bevel`，详见下节。
:::

### MitreLimit

**签名**：`public double MitreLimit { get; set; }`，默认 `5.0`

**语义**：仅在 `JoinStyle = Mitre` 时生效。`MitreLimit` 是"尖角延伸比"的最大值：

```
mitreRatio = 尖角顶点到折线交点的距离 / distance
```

当某转角处的 `mitreRatio` 超过 `MitreLimit` 时，该转角自动降级为 `Bevel`，避免几何尖刺飞出过远。

```csharp
// 锐角折线
var sharp = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0),
    new Coordinate(10.1, 0.1)   // 极小夹角
});

// 默认 MitreLimit=5，尖角会被截断为 Bevel
var safe = sharp.Buffer(1, new BufferParameters { JoinStyle = JoinStyle.Mitre });

// 放宽限制，尖角延伸更长（但几何可能拉得很远）
var sharp2 = sharp.Buffer(1, new BufferParameters
{
    JoinStyle = JoinStyle.Mitre,
    MitreLimit = 50.0
});
```

::: tip 默认 5.0 的来历
`MitreLimit = 5.0` 意味着允许尖角顶点延伸到 5 倍 `distance` 处。对应的最小内角约 11.4°——比这更尖的角都会被降级。这个值是 JTS/NTS 多年实践的经验值，覆盖大多数建筑轮廓与 Cadastral 场景，一般无需调整。
:::

### IsSingleSided

**签名**：`public bool IsSingleSided { get; set; }`，默认 `false`

**语义**：单边缓冲。设为 `true` 后，缓冲区只生成在 `LineString` 的一侧。**方向由 `distance` 的符号决定**（按线前进方向定义"左/右"）：

| `distance` 符号 | 生成侧 |
| --- | --- |
| 正值 | **左侧** |
| 负值 | **右侧** |

仅对 `LineString` 系列有效；对 `Point` 等同普通缓冲，对 `Polygon` 无意义。

```csharp
var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0)
});

var pars = new BufferParameters
{
    IsSingleSided = true,
    JoinStyle = JoinStyle.Mitre
    // EndCapStyle 在单边模式下被忽略，无需设置
};

// 正距离 → 左侧
var leftOnly  = line.Buffer(+1, pars);

// 负距离 → 右侧
var rightOnly = line.Buffer(-1, pars);
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <g font-family="monospace" font-size="10" fill="#444">
    <!-- 上图：正距离 → 左侧（线水平向右，"上"即左侧） -->
    <line x1="40" y1="50" x2="220" y2="50" stroke="#0b6e4f" stroke-width="2"/>
    <polygon points="40,50 220,50 220,30 40,30" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="1.5"/>
    <circle cx="40" cy="50" r="3" fill="#0b6e4f"/>
    <circle cx="220" cy="50" r="3" fill="#0b6e4f"/>
    <text x="30" y="54" text-anchor="end" fill="#0b6e4f">起点</text>
    <text x="232" y="54" fill="#0b6e4f">→ 方向</text>
    <text x="130" y="22" text-anchor="middle" fill="#0b6e4f">左侧（正距离）</text>
    <text x="130" y="68" text-anchor="middle" fill="#888">Buffer(+1, IsSingleSided=true)</text>

    <!-- 下图：负距离 → 右侧（线水平向右，"下"即右侧） -->
    <line x1="40" y1="100" x2="220" y2="100" stroke="#0b6e4f" stroke-width="2"/>
    <polygon points="40,100 220,100 220,120 40,120" fill="rgba(168,99,0,0.25)" stroke="#a86300" stroke-width="1.5"/>
    <circle cx="40" cy="100" r="3" fill="#0b6e4f"/>
    <circle cx="220" cy="100" r="3" fill="#0b6e4f"/>
    <text x="130" y="140" text-anchor="middle" fill="#a86300">右侧（负距离）</text>
    <text x="130" y="92" text-anchor="middle" fill="#888">Buffer(-1, IsSingleSided=true)</text>
  </g>
</svg>
<figcaption>单边缓冲的方向：正距离在左侧，负距离在右侧（沿线前进方向，"左/右"按行进方向定义）</figcaption>
</figure>

::: tip 应用场景
- 道路中线 → 单侧人行道 / 单侧绿化带
- 河流中线 → 单侧河岸保护带
- 国界线 → 单侧军事缓冲区
- 单侧停车位、单侧广告牌控制线
:::

::: warning 单边模式下 EndCapStyle 被忽略
JTS/NTS 源码明确："The End Cap Style for single-sided buffers is always ignored."。单边缓冲的端点形状由系统强制为 `Flat`，无论你设什么 `EndCapStyle` 都不会生效。调整端点形状只能通过 `JoinStyle`（影响转角，不影响端点）。
:::

### SimplifyFactor

**签名**：`public double SimplifyFactor { get; set; }`，默认 `0.01`（约 1%）

**语义**：缓冲结果的简化容差。NTS 在生成缓冲后会做轻量 Douglas-Peucker 简化，去除几乎共线的冗余顶点。容差 = `SimplifyFactor × distance`。

```csharp
// 关闭简化（保留所有顶点）
var noSimplify = new BufferParameters { SimplifyFactor = 0.0 };

// 更激进简化（5% 容差，顶点更少但精度下降）
var aggressive = new BufferParameters { SimplifyFactor = 0.05 };
```

| SimplifyFactor | 行为 |
| --- | --- |
| `0.0` | 不简化，保留全部圆弧顶点 |
| `0.01`（默认） | 去除几乎共线的冗余点，几何面积损失通常 < 0.1% |
| `0.05`+ | 显著减少顶点，但圆弧明显变直，慎用 |

::: tip 简化只影响"显示精度"
`SimplifyFactor` 简化的是**结果几何**的顶点数，不影响 `distance` 本身的语义。需要"几何更轻"以减小存储/渲染压力时调大；需要保留精确圆弧用于后续运算时设为 `0.0`。
:::

## BufferOp 类

**签名**：

```csharp
public class BufferOp
{
    public BufferOp(Geometry g);
    public BufferOp(Geometry g, BufferParameters pars);

    public Geometry GetResultGeometry(double distance);
}
```

**语义**：`Buffer` 的底层操作类。`Geometry.Buffer(...)` 内部就是 `new BufferOp(this, pars).GetResultGeometry(distance)`。直接使用 `BufferOp` 的两个理由：

1. **复用参数对象**：批量缓冲多个几何共享同一 `BufferParameters`，省去每次重新解析
2. **可扩展性**：`BufferOp` 暴露更多内部钩子（如自定义偏移曲线），便于高级定制

```csharp
// 单次：等价于 p.Buffer(5.0, pars)
var op = new BufferOp(p, pars);
var result = op.GetResultGeometry(5.0);

// 批量：构造一次 BufferOp 模板参数，对每个几何新建 op
var sharedPars = new BufferParameters
{
    QuadrantSegments = 16,
    JoinStyle = JoinStyle.Round
};

Geometry[] buffers = points
    .Select(pt =>
    {
        var bop = new BufferOp(pt, sharedPars);
        return bop.GetResultGeometry(3000);   // 3km 半径
    })
    .ToArray();
```

::: tip 几何不同则要新建 BufferOp
`BufferOp` 构造时绑定输入几何，不能复用同一个 `BufferOp` 实例处理多个几何。可复用的是 `BufferParameters`，不是 `BufferOp` 本身。
:::

::: warning 性能差距通常很小
对单次调用，`g.Buffer(distance)` 与 `new BufferOp(g).GetResultGeometry(distance)` 性能几乎一致——便捷方法本身只是一层薄封装。`BufferOp` 的优势在批量场景下复用参数与可扩展性，不是"单次更快"。
:::

## 负缓冲：收缩多边形

**签名**：复用所有 `Buffer` 重载，`distance` 传负值

**语义**：对 `Polygon` 传负距离，外壳向内收缩、孔洞向外扩张。常用于"内缩安全距离"、"挖中心留边框"。

```csharp
var square = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0), new Coordinate(10, 10),
    new Coordinate(0, 10), new Coordinate(0, 0)
});

var shrunk = square.Buffer(-2.0);  // 向内收缩 2 单位
Console.WriteLine($"原面积 = {square.Area}, 收缩后面积 = {shrunk.Area}");
// 原面积 = 100, 收缩后面积 = 36（边长 10 - 2×2 = 6）
```

::: warning 收缩可能产生空集
如果负距离大于几何到中心的"最小半宽"，结果会是 **空几何**（`IsEmpty = true`），不是 `null`。

```csharp
var small = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(3, 0), new Coordinate(3, 3),
    new Coordinate(0, 3), new Coordinate(0, 0)
});
var gone = small.Buffer(-5.0);
Console.WriteLine(gone.IsEmpty);   // True
Console.WriteLine(gone.GeometryType); // Polygon（空 Polygon，不是 null）
```

后续运算前务必检查 `IsEmpty`，否则 `Difference`、`Intersection` 等会得到意外结果。
:::

::: tip 负缓冲 + 正缓冲 = 形态学闭运算
`g.Buffer(-d).Buffer(+d)` 是形态学闭运算的几何版——能去除几何上的小毛刺与孔洞，但保留主体形状。常用于清理扫描矢量化数据。
:::

## Buffer(0)：经典修复技巧

`g.Buffer(0)` 是 GIS 圈最经典的"几何修复"招式。它通过零距离缓冲强制走一遍叠加运算，副作用是：

- 修复多边形自相交（按 even-odd 规则重新解释内部区域）
- 移除退化（面积为 0）的部分
- 整合重叠区域为单一外壳
- 丢弃方向错误的孔洞或外壳

```csharp
var bowtie = factory.CreatePolygon(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 10),
    new Coordinate(10, 0), new Coordinate(0, 10),
    new Coordinate(0, 0)
});

Console.WriteLine(bowtie.IsValid);   // False
var fixed = bowtie.Buffer(0);
Console.WriteLine(fixed.IsValid);    // True
Console.WriteLine(fixed.GeometryType); // MultiPolygon（领结被拆成两个三角形）
Console.WriteLine(fixed.NumGeometries); // 2
```

::: warning Buffer(0) 不保留原拓扑
`Buffer(0)` 用 even-odd 规则重新解释几何，可能把"原本想保留"的部分也合并或丢弃。例如带共享边的相邻多边形各自 `Buffer(0)` 后会沿共享边合并——这不一定是想要的结果。
:::

::: tip 复杂修复请用 GeometryFixer
对于自相交、孔洞越界、环方向错误等复杂场景，NTS 2.x 提供的 `GeometryFixer` 更稳健，且尽量保留原始顶点。详见下节。
:::

## GeometryFixer 类

**签名**：

```csharp
public class GeometryFixer
{
    public GeometryFixer(Geometry geom);

    public bool KeepCollapsed { get; set; }   // 默认 false
    public bool KeepMulti { get; set; }       // 默认 false

    public Geometry GetResult();                              // 实例方法
    public static Geometry Fix(Geometry geom);                // 静态快捷
    public static Geometry Fix(Geometry geom, bool isKeepMulti);
}
```

**语义**：NTS 2.x 提供的几何修复类。比 `Buffer(0)` 更智能——它分析几何结构、按问题类型分别处理，**尽量保留原始顶点与拓扑**，而不是像 `Buffer(0)` 那样整体重算。即便是有效输入也会被处理一遍，可能产生微小调整；输出始终是新对象。

`GeometryFixer` 的内部规则（来自官方文档）：

| 输入 | 处理 |
| --- | --- |
| 顶点含非有限 X/Y | 移除 |
| 重复顶点 | 折叠为单个 |
| 空 `Point` / `LineString` | 视为有效，原样返回 |
| 集合中的空元素 | 移除 |
| `Point` | 保留有效坐标，否则返回 `EMPTY` |
| `LineString` | 修复坐标 |
| `LinearRing` | 修复坐标；若无法成为有效环则降级为 `LineString` |
| `Polygon` | 转为有效 `Polygon` 或 `MultiPolygon`，保留尽量多的范围与顶点 |
| `Polygon` 的孔洞 | 与外壳相交部分从外壳减去；在外壳之外的孔洞转为独立 `Polygon` |
| `MultiPolygon` | 每个子多边形先修复，再通过并集保证互不重叠 |
| `GeometryCollection` | 逐元素修复 |
| 退化的线/面（面积或长度为 0） | 由 `KeepCollapsed` 决定 |

**两个关键属性**：

- `KeepCollapsed`（默认 `false`）：退化几何是否保留。`false` → 转为空（在集合中会被移除）；`true` → 转为低一维的有效几何（如收缩成线的多边形 → `LineString`）。
- `KeepMulti`（默认 `false`）：修复后的 `Multi*` 若只剩一个子元素，是否仍以 `Multi*` 类型返回。`false` → 拆包返回单一类型；`true` → 保留 `Multi*` 外壳。

```csharp
using NetTopologySuite.Geometries.Utilities;

// 静态快捷方式（最常用）
var fixed1 = GeometryFixer.Fix(bowtie);
Console.WriteLine(fixed1.IsValid);  // True

// 实例方式：精细控制
var fixer = new GeometryFixer(bowtie)
{
    KeepCollapsed = true,    // 保留退化部分（转为低维几何）
    KeepMulti = true         // 修复后即使只剩一个多边形也保留 MultiPolygon 类型
};
var fixed2 = fixer.GetResult();

// 静态第二参数：等价于设 KeepMulti
var fixed3 = GeometryFixer.Fix(bowtie, isKeepMulti: true);
```

### Buffer(0) 与 GeometryFixer 对比

| 维度 | `Buffer(0)` | `GeometryFixer` |
| --- | --- | --- |
| 引入版本 | 一直存在 | NTS 2.x |
| 算法 | 整体重算（零距离叠加） | 按问题分类逐项处理 |
| 顶点保留 | 否（重新生成） | 是（尽量保留原顶点） |
| 复杂自相交 | 拆分有效区域 | 拆分有效区域 |
| 性能 | 走完整叠加流水线，大几何较慢 | 不走叠加，通常更快但仍非"免费" |
| 对 `Point` / `LineString` | 几乎无变化 | 修复重复点、非有限坐标、退化环 |
| 空几何处理 | 返回空几何 | 空元素从集合中移除，原子空几何原样返回 |
| 可配置性 | 无 | `KeepCollapsed` / `KeepMulti` |
| 推荐场景 | 兼容老版本、"我就想合并重叠"语义 | **新项目首选** |

::: tip 迁移建议
新项目直接用 `GeometryFixer.Fix(g)`，更稳健、性能更好、语义清晰。`Buffer(0)` 留给老代码兼容与"我就想合并重叠"的特定语义场景。
:::

## 缓冲结果结构

不论输入是 `Point`、`LineString` 还是 `Polygon`，`Buffer` 的结果**始终是面状几何**：

| 输入 | 输出类型 | 说明 |
| --- | --- | --- |
| `Point` | `Polygon` | 单个多边形（圆的逼近） |
| `MultiPoint` | `MultiPolygon` 或 `Polygon` | 点足够近时合并为单多边形 |
| `LineString` | `Polygon` | 走廊形，无孔洞 |
| `MultiLineString` | `MultiPolygon` 或 `Polygon` | 相近的线合并 |
| `Polygon`（正距离） | `Polygon` 或 `MultiPolygon` | 可能有孔洞（见下） |
| `Polygon`（负距离） | `Polygon` 或空 | 收缩后可能分裂为多个 |

**孔洞的产生**：当 `Polygon` 含孔洞且做正距离缓冲时，外壳向外扩张、孔洞向内收缩——孔洞仍保留为孔洞。当孔洞在某处收缩到闭合，那部分孔洞消失。

```csharp
var shell = factory.CreateLinearRing(new[]
{
    new Coordinate(0, 0), new Coordinate(20, 0), new Coordinate(20, 20),
    new Coordinate(0, 20), new Coordinate(0, 0)
});
var hole = factory.CreateLinearRing(new[]
{
    new Coordinate(8, 8), new Coordinate(12, 8), new Coordinate(12, 12),
    new Coordinate(8, 12), new Coordinate(8, 8)
});
var withHole = factory.CreatePolygon(shell, new[] { hole });

var expanded = withHole.Buffer(2);   // 外扩 2，孔洞内缩 2
Console.WriteLine(expanded.NumInteriorRings);  // 1（孔洞还在，但变小）
Console.WriteLine(expanded.Area);              // ≈ (24²) − (4²) = 560
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 160" width="360" height="160">
  <g font-family="monospace" font-size="10" fill="#444">
    <!-- 原几何 -->
    <rect x="40" y="40" width="80" height="80" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
    <rect x="70" y="70" width="20" height="20" fill="#fff" stroke="#a00" stroke-width="1.5"/>
    <text x="80" y="138" text-anchor="middle">原几何</text>
    <text x="80" y="150" text-anchor="middle" fill="#888">20×20，孔 4×4</text>

    <!-- 缓冲后 -->
    <rect x="170" y="30" width="100" height="100" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
    <rect x="215" y="75" width="10" height="10" fill="#fff" stroke="#a00" stroke-width="1.5"/>
    <text x="220" y="148" text-anchor="middle">Buffer(+2)</text>
    <text x="220" y="158" text-anchor="middle" fill="#888">24×24，孔 2×2</text>
  </g>
</svg>
<figcaption>带孔多边形的正距离缓冲：外壳扩张、孔洞收缩</figcaption>
</figure>

::: tip 结果可能是 MultiPolygon
如果输入多边形是凹形且缓冲距离较大，外壳向内"塌陷"会导致结果分裂为多个不相连的多边形——NTS 会自动返回 `MultiPolygon`。处理结果时不要假设类型，用 `NumGeometries` / `GetGeometryN` 统一遍历。
:::

## 实战案例：店铺 3 公里配送范围

完整流程：投影 → 缓冲 → 扣除河流 → 统计可达面积。

```csharp
// 1. 假设几何已投影到米制坐标系（如 CGCS2000 / Gauss-Kruger）
var store = factory.CreatePoint(new Coordinate(500000, 3040000));

// 2. 配置参数：64 边形足够圆滑，圆角风格
var pars = new BufferParameters
{
    QuadrantSegments = 16,    // 64 边形
    EndCapStyle = EndCapStyle.Round,
    JoinStyle = JoinStyle.Round,
    SimplifyFactor = 0.01     // 默认值，去冗余顶点
};

// 3. 生成 3km 配送范围
var deliveryZone = store.Buffer(3000, pars);

// 4. 河流两侧 50m 不可达
var riverBuffer = river.Buffer(50, new BufferParameters
{
    QuadrantSegments = 8,
    JoinStyle = JoinStyle.Mitre,
    EndCapStyle = EndCapStyle.Round
});

// 5. 扣除河流缓冲区
var reachable = deliveryZone.Difference(riverBuffer);

Console.WriteLine($"配送范围面积 = {deliveryZone.Area / 1_000_000:F2} km²");
Console.WriteLine($"可达面积 = {reachable.Area / 1_000_000:F2} km²");
Console.WriteLine($"河流阻挡 = {(deliveryZone.Area - reachable.Area) / 1_000_000:F2} km²");
```

::: warning Difference 后可能产生 MultiPolygon
河流横切配送范围会让 `reachable` 分裂为多块。如果下游代码假设是单个 `Polygon`，会出问题。统一用 `NumGeometries` / `GetGeometryN` 遍历。
:::

## 性能注意

1. **`QuadrantSegments` 越大越慢**
   默认 `8` 通常足够，调到 `64` 会让单个缓冲的顶点数膨胀 8 倍，下游所有运算（叠加、序列化、渲染）一起变慢。先评估误差容忍度，再决定是否上调。

2. **批量缓冲用 `BufferOp` 复用参数**
   ```csharp
   var sharedPars = new BufferParameters { QuadrantSegments = 16 };
   foreach (var pt in points)
   {
       var bop = new BufferOp(pt, sharedPars);
       yield return bop.GetResultGeometry(3000);
   }
   ```

3. **避免"为了判断而缓冲"**
   如果你只是想"看 B 是否在 A 的 3km 内"，**不要** 生成 `A.Buffer(3000).Contains(B)`——这是反模式。直接用距离判断或预构建几何：
   ```csharp
   // ✅ 快：直接距离判断
   if (a.Distance(b) <= 3000) { ... }

   // ✅ 更快：多次判断时用 PreparedGeometry
   var zone = a.Buffer(3000);
   var prepared = NetTopologySuite.Geometries.Prepared.PreparedGeometryFactory.Prepare(zone);
   foreach (var b in candidates)
       if (prepared.Covers(b)) { ... }
   ```

4. **`SimplifyFactor` 减小结果体积**
   默认 `0.01` 已经做了轻度简化。需要更轻的结果几何（如传给前端渲染）可调到 `0.02 ~ 0.05`，但要确认精度可接受。

5. **`Buffer(0)` 修复 ≠ 免费**
   `Buffer(0)` 走完整叠加流水线，对大几何可能很慢。需要批量修复时优先 `GeometryFixer`。

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

::: warning Web 墨卡托在高纬失真
Web 墨卡托（EPSG:3857）在高纬度地区面积失真严重——60°N 处距离放大约 2 倍。需要精确距离时改用等距投影或 UTM 投影。
:::

### 2. 缓冲后几何无效

罕见但可能发生，特别是输入本身有问题时。运算前用 `IsValid` 校验，无效的先用 `GeometryFixer.Fix` 修复。

```csharp
if (!g.IsValid)
    g = GeometryFixer.Fix(g);
var buf = g.Buffer(100);
```

### 3. 缓冲合并缺口

```csharp
// ❌ 一组相邻的点，单独 buffer 后再 union 可能有缝
var circles = centers.Select(c => c.Buffer(r)).ToList();
var merged = circles.Aggregate((a, b) => a.Union(b));  // 可能有缝

// ✅ 更好：合并所有中心点为 MultiPoint，再一次性 buffer
var multiPoint = factory.CreateMultiPoint(centers.ToArray());
var merged2 = multiPoint.Buffer(r);

// ✅ 或者：用 UnaryUnionOp 让 NTS 处理拓扑
var merged3 = NetTopologySuite.Operation.Union.UnaryUnionOp.Union(circles);
```

### 4. 单边缓冲方向记反

`IsSingleSided = true` 时方向由 `distance` 符号决定：**正距离 → 左侧**，**负距离 → 右侧**（沿线前进方向）。这与"正数外扩"的直觉相反——很多人凭直觉传正值想生成"右侧"缓冲，结果跑到了左侧。

如果你的缓冲跑到了不想的一侧：
- 想要左侧 → 传正值
- 想要右侧 → 传负值
- 或者用 `line.Reverse()` 翻转线方向再传原值

### 5. 负缓冲返回空集未检查

```csharp
// ❌ 不检查 IsEmpty，后续 Difference 得到空集
var shrunk = poly.Buffer(-100);
var result = other.Difference(shrunk);  // 若 shrunk 为空，result = other 副本

// ✅ 显式检查
var shrunk = poly.Buffer(-100);
if (shrunk.IsEmpty)
    Console.WriteLine("缓冲距离过大，几何完全收缩");
```

## 小结速查表

### 重载一览

| 重载 | 适用 |
| --- | --- |
| `Buffer(distance)` | 只调距离 |
| `Buffer(distance, quadrantSegments)` | 还要调圆弧精度 |
| `Buffer(distance, BufferParameters)` | 全参数控制 |
| `Buffer(distance, quadrantSegments, endCapStyle)` | 便捷：调距离 + 精度 + 端点形状 |
| `new BufferOp(g).GetResultGeometry(distance)` | 批量复用参数、可扩展 |

### BufferParameters 字段

| 字段 | 类型 | 默认 | 作用 |
| --- | --- | --- | --- |
| `QuadrantSegments` | `int` | `8` | 每象限分段数，控制圆弧精度 |
| `EndCapStyle` | `EndCapStyle` | `Round` | 线端形状：Round / Flat / Square |
| `JoinStyle` | `JoinStyle` | `Round` | 折角填充：Round / Mitre / Bevel |
| `MitreLimit` | `double` | `5.0` | Mitre 模式最大尖角比，超限降级 Bevel |
| `IsSingleSided` | `bool` | `false` | 单边缓冲（正=左，负=右） |
| `SimplifyFactor` | `double` | `0.01` | 结果简化容差（占 distance 比例） |

### 修复几何：三种方式

| 方式 | 语义 | 推荐度 |
| --- | --- | --- |
| `GeometryFixer.Fix(g)` | 按问题分类修复，保留顶点 | **首选**（NTS 2.x） |
| `g.Buffer(0)` | 整体重算，合并重叠 | 简单场景、老版本兼容 |
| 手动检查 `IsValid` 后处理 | 自定义 | 仅在特殊需求时 |

## 下一步

- [凸包与简化](./convex-simplify.md)：与缓冲配合的形态运算
- [叠加分析](./overlay.md)：缓冲结果与其它几何做 Union / Difference / Intersection
- [空间谓词](../03-spatial-relations/relationships.md)：用缓冲做距离判断的反模式、正确姿势
- [预构建几何 PreparedGeometry](../06-performance/prepared-geometry.md)：批量 `Covers` / `Intersects` 加速
- [API 速查表](../appendix/cheatsheet.md)：所有几何运算一览
