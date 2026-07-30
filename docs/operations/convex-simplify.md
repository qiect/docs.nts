# 凸包与简化

凸包 (Convex Hull) 和简化 (Simplification) 是两类"形状变换"操作：前者把任意点集包裹成最小的凸多边形；后者减少顶点数，让几何更轻、显示更快。

## 凸包 ConvexHull

凸包是包含输入几何所有顶点的 **最小凸多边形**。想象把钉子按在板上，用一根橡皮筋围住所有钉子——松开后橡皮筋的形状就是凸包。

```csharp
using NetTopologySuite.Algorithm;

var points = new[]
{
    new Coordinate(0, 0),
    new Coordinate(1, 0),
    new Coordinate(2, 1),
    new Coordinate(1, 2),
    new Coordinate(0, 2),
    new Coordinate(0.5, 1)   // 内部点，会被忽略
};

var hull = ConvexHull.Create(points);
// hull: POLYGON ((0 0, 1 0, 2 1, 1 2, 0 2, 0 0))
```

<figure class="nts-diagram">
<svg viewBox="0 0 200 140" width="200" height="140">
  <polygon points="20,110 60,110 90,80 60,30 20,30 20,110" fill="rgba(11,110,79,0.15)" stroke="#0b6e4f" stroke-width="1.5"/>
  <g fill="#a00">
    <circle cx="20" cy="110" r="3"/>
    <circle cx="60" cy="110" r="3"/>
    <circle cx="90" cy="80" r="3"/>
    <circle cx="60" cy="30" r="3"/>
    <circle cx="20" cy="30" r="3"/>
    <circle cx="40" cy="80" r="3"/>
    <circle cx="55" cy="70" r="3"/>
  </g>
</svg>
<figcaption>红点为输入点集，绿线为凸包</figcaption>
</figure>

### 任何几何都能求凸包

`Geometry.ConvexHull()` 适用于任何几何类型：

```csharp
var line = factory.CreateLineString(...);
var poly = factory.CreatePolygon(...);
var mp   = factory.CreateMultiPoint(...);

var hull1 = line.ConvexHull();
var hull2 = poly.ConvexHull();
var hull3 = mp.ConvexHull();
```

### 静态算法 API

```csharp
using NetTopologySuite.Algorithm;

// 推荐的静态方法（NTS 2.x）
var hull = ConvexHull.Create(geometry);

// 也可以传入坐标数组
var hull2 = ConvexHull.Create(coordinates, factory);
```

NTS 内部用 Graham 扫描或 Andrew's monotone chain，复杂度 O(n log n)。

## 何时用凸包

- **快速碰撞检测**：两个凸包不相交，则原几何必然不相交。
- **形状近似**：地理要素的"外轮廓"。
- **空间索引辅助**：有些场景用凸包代替原始几何做粗过滤。
- **轨迹范围**：把一条 GPS 轨迹的所有点取凸包，得到大致活动区域。

## 简化 Simplify

简化通过减少顶点来降低几何复杂度。NTS 提供两种主流算法：

| 算法 | 类 | 是否保证拓扑 | 速度 |
| --- | --- | --- | --- |
| Douglas-Peucker | `DouglasPeuckerSimplifier` | ❌ 不保证 | 快 |
| Topology-Preserving | `TopologyPreservingSimplifier` | ✅ 保证 | 较慢 |

### Douglas-Peucker 简化

经典"分而治之"算法：保留两端点，递归删除距离弦小于阈值的中间点。

```csharp
using NetTopologySuite.Simplify;

var line = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(1, 0.1), new Coordinate(2, -0.1),
    new Coordinate(3, 5),  new Coordinate(4, 0.1), new Coordinate(5, 0),
    new Coordinate(6, 0)
});

var simplified = DouglasPeuckerSimplifier.Simplify(line, 0.5);
// distanceTolerance = 0.5 表示：与弦距离 < 0.5 的点会被删除
```

::: warning Douglas-Peucker 的拓扑风险
DP 算法 **不保证** 简化前后拓扑一致。它可能：

- 让一条线穿过原本不相交的另一条线
- 让多边形自相交
- 让孔洞"逃出"外壳

如果几何会参与后续空间运算，**不要用 DP**。仅用于"渲染时的视觉简化"。
:::

### 拓扑安全简化

`TopologyPreservingSimplifier` 在 DP 基础上引入拓扑约束，保证简化后的几何与原几何拓扑等价：

```csharp
using NetTopologySuite.Simplify;

var simplified = TopologyPreservingSimplifier.Simplify(complexPolygon, 2.0);
```

代价是速度更慢，且简化效果略保守（保留的点更多）。

### 选择建议

| 场景 | 推荐 |
| --- | --- |
| 仅用于地图渲染、显示 | Douglas-Peucker |
| 简化后还要参与空间运算 | TopologyPreserving |
| 简化轨迹做可视化 | Douglas-Peucker |
| 简化行政边界存数据库 | TopologyPreserving |

## VWSimplifier：Visvalingam-Whyatt

NTS 还提供 `VWSimplifier`，基于"有效面积"删除顶点，视觉上往往比 DP 更自然：

```csharp
using NetTopologySuite.Simplify;

var result = VWSimplifier.Simplify(geometry, toleranceArea);
// toleranceArea 是"最小有效面积"，单位是坐标系单位的平方
```

VW 的特点：

- 不像 DP 那样受端点约束
- 自然地"吃掉"小毛刺
- 同样不保证拓扑（用于显示）

## 一个真实案例：简化 GPS 轨迹

GPS 轨迹通常每秒一个点，1 小时就是 3600 个点。其中大量冗余：

```csharp
// 原始 3600 个点的轨迹
var rawTrack = LoadTrackFromGpx("morning_run.gpx");
Console.WriteLine($"原始点数: {rawTrack.NumPoints}");

// 用 VW 简化（保留视觉特征）
var visual = VWSimplifier.Simplify(rawTrack, 0.00001);  // 1e-5 平方度
Console.WriteLine($"简化后点数: {visual.NumPoints}");

// 用拓扑安全简化（用于后续运算）
var analytical = TopologyPreservingSimplifier.Simplify(rawTrack, 0.0001);
```

典型效果：3600 点 → 200~500 点，体积减小 90%。

## 多个几何一起简化

`simplifier.Simplify(geometry)` 一次只处理一个几何。如果需要批量简化且保持彼此的拓扑关系（如相邻行政边界不能重叠），用 `GeometryTransformer` 或自己实现级联简化——这是高级主题。

## 简化的反向操作：Densifier

`Densifier` 在每两个相邻顶点之间均匀插入点，是简化的"反操作"：

```csharp
using NetTopologySuite.Densify;

var sparse = factory.CreateLineString(new[]
{
    new Coordinate(0, 0), new Coordinate(10, 0)
});

var dense = Densifier.Densify(sparse, 2.0);
// LINESTRING (0 0, 2 0, 4 0, 6 0, 8 0, 10 0)
```

用途：把简化几何恢复为可用于精确缓冲的形态；让线段更平滑。

## 小结

| 操作 | 方法 | 用途 |
| --- | --- | --- |
| 凸包 | `ConvexHull.Create(g)` 或 `g.ConvexHull()` | 包络、形状近似 |
| DP 简化 | `DouglasPeuckerSimplifier.Simplify` | 视觉简化，不保拓扑 |
| 拓扑简化 | `TopologyPreservingSimplifier.Simplify` | 运算前简化，保拓扑 |
| VW 简化 | `VWSimplifier.Simplify` | 自然视觉简化 |
| 加密 | `Densifier.Densify` | 增加顶点密度 |

## 下一步

- [空间谓词](../predicates/relationships.md)
- [测量与距离](../analysis/measurement.md)
- [PreparedGeometry](../advanced/prepared-geometry.md)
