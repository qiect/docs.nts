# 坐标与坐标序列

`Coordinate` 是 NTS 中所有几何对象的基石。理解坐标的表示、存储和操作方式，是写出正确空间代码的第一步。

## Coordinate：最小单位

`Coordinate` 是 NTS 中坐标的"原子"。它本身是一个类，包含 `X`、`Y`，以及可选的 `Z`（高程）和 `M`（测量值）。

```csharp
public class Coordinate : IComparable<Coordinate>, IComparable
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }   // 默认 NaN，表示"未设置"
    public double M { get; set; }   // 默认 NaN

    public Coordinate(double x = 0.0, double y = 0.0, double z = double.NaN);
    public Coordinate(Coordinate c); // 拷贝构造
}
```

::: warning Coordinate 是可变的
`Coordinate` 是 NTS 中少数 **可变** 的对象。直接修改它的 `X/Y` 会改变所有引用它的几何！如果你需要"在副本上修改"，请用 `new Coordinate(orig)` 或 `Copy()`。

NTS 还提供了不可变序列 `CoordinateSequence`，库内部优先用它，性能更好且安全。
:::

### 基本用法

```csharp
// 创建坐标
var coord = new Coordinate(1.0, 2.0);
var coord3d = new Coordinate(1.0, 2.0, 3.0);   // 带高程
var coordM = new Coordinate(1.0, 2.0) { M = 100.0 };  // 带测量值

// 拷贝
var copy = coord.Copy();  // 返回新对象
var copy2 = new Coordinate(coord);  // 拷贝构造，等价

// 比较
Console.WriteLine(coord.Equals2D(coord2));  // True：仅比较 X/Y
Console.WriteLine(coord.Equals(coord3d));    // False：比较 X/Y/Z
Console.WriteLine(coord.CompareTo(another));  // 先 X 后 Y，用于排序
```

### 距离计算

```csharp
var a = new Coordinate(0, 0);
var b = new Coordinate(3, 4);

double dist2D = a.Distance(b);        // 5.0：平面距离
double dist3D = a.Distance3D(b);      // 三维距离（含 Z）
```

### CoordinateXY / CoordinateXYZ / CoordinateXYM / CoordinateXYZM

NTS 2.x 引入了类型化的坐标子类，用于减少内存占用并明确语义：

| 类型 | 字段 | 适用场景 |
| --- | --- | --- |
| `CoordinateXY` | X, Y | 平面 2D，最常用 |
| `CoordinateXYZ` | X, Y, Z | 带高程 |
| `CoordinateXYM` | X, Y, M | 带测量值（如里程） |
| `CoordinateXYZM` | X, Y, Z, M | 全维度 |

```csharp
var xy   = new CoordinateXY(1, 2);
var xyz  = new CoordinateXYZ(1, 2, 3);
var xym  = new CoordinateXYM(1, 2, 4);
var xyzm = new CoordinateXYZM(1, 2, 3, 4);
```

::: tip 何时用哪种类型？
- 仅做平面运算（缓冲区、叠加分析）→ `CoordinateXY`，最省内存
- 需要高程（地形分析）→ `CoordinateXYZ`
- 需要沿线测量值（线性参考）→ `CoordinateXYM`
- 全维度 → `CoordinateXYZM`
:::

## CoordinateSequence：高效坐标序列

几何内部的顶点并非以 `Coordinate[]` 存储，而是用 `CoordinateSequence`——一个紧凑的、按列存储的序列接口，可以根据需要选择 `PackedCoordinateSequence`（原始 double 数组）或默认实现。

```csharp
// 默认实现（Coordinate 对象数组）
var seq1 = new CoordinateArraySequence(new[]
{
    new Coordinate(0, 0),
    new Coordinate(1, 1),
    new Coordinate(2, 0)
});

// 紧凑实现（更省内存）
var seq2 = new PackedCoordinateSequenceFactory()
    .Create(new[] { 0.0, 0.0, 1.0, 1.0, 2.0, 0.0 }, 3);  // 一维数组交错存储

// 访问
Coordinate c = seq2.GetCoordinate(0);  // 按索引取
Coordinate[] all = seq2.ToCoordinateArray();  // 转为数组
```

### CoordinateSequence 与内存

`PackedCoordinateSequence` 将坐标存储为单个 `double[]`，比 `Coordinate[]` 对象数组节省大量内存：

| 方式 | 100万个 2D 坐标的内存占用 |
| --- | --- |
| `Coordinate[]` | ~96 MB（每个 Coordinate 是对象，有对象头） |
| `PackedCoordinateSequence` | ~16 MB（仅 2 × 100万个 double） |

NTS 的 `GeometryFactory` 默认使用 `CoordinateArraySequence`，但在大批量数据场景中，切换为 `PackedCoordinateSequenceFactory` 是值得的：

```csharp
var factory = new GeometryFactory(
    new PrecisionModel(),
    4326,
    new PackedCoordinateSequenceFactory()  // 指定紧凑序列工厂
);
```

## CoordinateFilter：遍历坐标

NTS 提供了 `ICoordinateFilter` 接口，可以遍历几何中的所有坐标并修改：

```csharp
public class TranslateFilter : ICoordinateFilter
{
    private readonly double _dx, _dy;
    public TranslateFilter(double dx, double dy) { _dx = dx; _dy = dy; }
    public void Filter(Coordinate coord)
    {
        coord.X += _dx;
        coord.Y += _dy;
    }
}

var geom = reader.Read("POINT(1 2)");
geom.Apply(new TranslateFilter(10, 20));
Console.WriteLine(geom);  // POINT(11 22)
```

::: warning 注意可变性
`ICoordinateFilter.Filter()` 直接修改 `Coordinate` 对象。如果你需要保留原始几何，先用 `geom.Copy()` 创建副本。
:::

## 小结

- `Coordinate` 是可变原子，注意共享引用问题；用 `Copy()` 创建副本
- `CoordinateSequence` 是内部高效存储，`PackedCoordinateSequence` 适合大批量场景
- 类型化坐标子类（`CoordinateXY` 等）减少内存、明确语义
- `ICoordinateFilter` 可用于遍历和修改坐标

## 下一步

- [几何类型层级](./geometry-hierarchy.md)：从 Coordinate 到完整 Geometry 继承树
- [几何工厂 GeometryFactory](./geometry-factory.md)：通过工厂创建几何对象
- [几何遍历与提取](./geometry-iteration.md)：GeometryFilter 与 GeometryComponentFilter