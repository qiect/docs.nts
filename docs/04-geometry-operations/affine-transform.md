# 仿射变换 (Affine Transformation)

仿射变换是 GIS 中最通用的平面坐标变换工具——它把平移、缩放、旋转、剪切、反射统一进一个矩阵运算，对几何的每个顶点做同样的"线性变换 + 位移"。NTS 的实现位于 `NetTopologySuite.Geometries.Utilities.AffineTransformation`，对应 JTS 的同名类，几乎所有方法都**就地修改变换本身并返回 `this`**，便于链式调用。

关键特性：仿射变换**保持直线性与平行性**——直线变换后仍是直线，平行线变换后仍平行；但角度、长度、面积一般会改变（刚体变换除外）。

```csharp
using NetTopologySuite.Geometries;
using NetTopologySuite.Geometries.Utilities;   // AffineTransformation

// 本页示例共用工厂
var factory = new GeometryFactory();

// 辅助：构造单位正方形（边长 1），便于看坐标变化
Polygon UnitSquare(double ox = 0, double oy = 0) => factory.CreatePolygon(new[]
{
    new Coordinate(ox,     oy),     new Coordinate(ox + 1, oy),
    new Coordinate(ox + 1, oy + 1), new Coordinate(ox,     oy + 1),
    new Coordinate(ox,     oy)
});
```

## 仿射变换概念

**定义**：从 ℝ² 到 ℝ² 的映射 `T: (x, y) ↦ (x', y')`，可写成：

```
x' = m00·x + m01·y + m02
y' = m10·x + m11·y + m12
```

由 6 个矩阵元素唯一决定。常见特例：

| 变换 | 几何效果 | 关键矩阵元素 |
| --- | --- | --- |
| 平移 | 整体移动 | `m02, m12` 为位移 |
| 缩放 | 沿轴拉伸/压缩 | `m00, m11` 为缩放系数 |
| 旋转 | 绕原点转动 | `m00=cosθ, m01=−sinθ, m10=sinθ, m11=cosθ` |
| 剪切 | 沿轴倾斜 | `m01` 或 `m10` 非零 |
| 反射 | 镜像对称 | 行列式为 −1 |

**保持的性质**：直线性、平行性、共线三点的分比。**不保持**：长度（除非刚体）、角度（除非正交变换）、面积（除非 |行列式|=1）。

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <!-- 原几何：L 形（虚线灰） -->
  <polygon points="30,30 90,30 90,60 60,60 60,100 30,100" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="40" y="120" font-family="monospace" font-size="11" fill="#999">原几何</text>
  <!-- 变换后：旋转 + 缩放 + 平移（实线绿） -->
  <polygon points="200,110 260,110 260,80 230,80 230,40 200,40" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="210" y="120" font-family="monospace" font-size="11" fill="#0b6e4f">变换后（旋转+缩放+平移）</text>
  <!-- 箭头 -->
  <line x1="100" y1="65" x2="190" y2="75" stroke="#a86300" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#aff-arr1)"/>
  <defs>
    <marker id="aff-arr1" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <polygon points="0,0 8,4 0,8" fill="#a86300"/>
    </marker>
  </defs>
</svg>
<figcaption>仿射变换：原几何（虚线灰）经旋转、缩放、平移后得到新几何（实线绿），直线与平行性保持不变</figcaption>
</figure>

## AffineTransformation 类

**命名空间**：`NetTopologySuite.Geometries.Utilities`

**核心字段**：6 个 `double` 矩阵元素，对应 3×3 齐次矩阵的上两行：

```
| m00  m01  m02 |     | x |     | m00·x + m01·y + m02 |
| m10  m11  m12 |  ×  | y |  =  | m10·x + m11·y + m12 |
|  0    0    1  |     | 1 |     |          1          |
```

| 元素 | 含义 |
| --- | --- |
| `m00` | x 方向对 x 的缩放/旋转分量 |
| `m01` | y 对 x 的剪切/旋转分量 |
| `m02` | x 方向平移 |
| `m10` | x 对 y 的剪切/旋转分量 |
| `m11` | y 方向对 y 的缩放/旋转分量 |
| `m12` | y 方向平移 |

**常用构造**：

```csharp
// 1. 默认构造：单位变换（恒等），不改变任何坐标
var id = new AffineTransformation();
Console.WriteLine(id.IsIdentity);   // True

// 2. 由 6 个矩阵元素构造
var t = new AffineTransformation(1, 0, 0, 1, 5, 3);   // 平移 (5, 3)

// 3. 由 6 元素数组构造，顺序为 [m00, m01, m10, m11, m02, m12]
double[] m = { 1, 0, 0, 1, 5, 3 };
var t2 = new AffineTransformation(m);

// 4. 复制另一个变换
var t3 = new AffineTransformation(t);
```

::: warning 矩阵元素顺序不是行优先
数组构造与 `SetTransformation` 的参数顺序是 `m00, m01, m10, m11, m02, m12`——**不是** 行优先的 `m00, m01, m02, m10, m11, m12`。这是 JTS/NTS 的历史约定，把"线性部分 (2×2)"放在前 4 位、"平移部分"放后 2 位。传错顺序会产生诡异结果。
:::

## Translate(dx, dy)

**签名**：`public AffineTransformation Translate(double x, double y)`

**语义**：在当前变换上叠加一次平移——每个点 `(x, y)` 整体移动 `(dx, dy)`。等价于把 `m02 += dx`、`m12 += dy`，并返回 `this`。

```csharp
var square = UnitSquare();                  // (0,0)-(1,1)
var trans = new AffineTransformation().Translate(2, 1);
var moved = trans.Transform(square);

// 移动后顶点：(2,1) (3,1) (3,2) (2,2)
foreach (var c in moved.Coordinates)
    Console.WriteLine($"{c.X}, {c.Y}");
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <!-- 原正方形（虚线灰） -->
  <rect x="30" y="30" width="50" height="50" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="35" y="95" font-family="monospace" font-size="10" fill="#999">(0,0)-(1,1)</text>
  <!-- 平移箭头 -->
  <line x1="55" y1="55" x2="225" y2="95" stroke="#a86300" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#aff-arr-tr)"/>
  <text x="120" y="60" font-family="monospace" font-size="11" fill="#a86300">Translate(2, 1)</text>
  <!-- 平移后正方形（实线绿） -->
  <rect x="200" y="70" width="50" height="50" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="205" y="135" font-family="monospace" font-size="10" fill="#0b6e4f">(2,1)-(3,2)</text>
  <defs>
    <marker id="aff-arr-tr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <polygon points="0,0 8,4 0,8" fill="#a86300"/>
    </marker>
  </defs>
</svg>
<figcaption>Translate(2, 1)：整体平移，形状、大小、方向都不变</figcaption>
</figure>

::: tip Translate 是"叠加"，不是"设为"
`Translate` 在当前变换基础上**叠加**平移，不重置矩阵。若想要一个"纯粹"的平移变换，用静态 `AffineTransformation.TranslationInstance(dx, dy)`，或先 `SetToTranslation(dx, dy)`。
:::

## Scale(xFactor, yFactor)

**签名**：`public AffineTransformation Scale(double xFactor, double yFactor)`

**语义**：以原点为中心缩放——x 坐标乘 `xFactor`，y 坐标乘 `yFactor`。`xFactor > 1` 放大，`0 < xFactor < 1` 缩小，负值则同时反射。

```csharp
var square = UnitSquare();                  // (0,0)-(1,1)
var trans = new AffineTransformation().Scale(2, 3);
var scaled = trans.Transform(square);

// 缩放后顶点：(0,0) (2,0) (2,3) (0,3)
foreach (var c in scaled.Coordinates)
    Console.WriteLine($"{c.X}, {c.Y}");
Console.WriteLine(scaled.Area);             // 6（原面积 1 × 2 × 3）
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 150" width="360" height="150">
  <!-- 原点标记 -->
  <circle cx="30" cy="120" r="2.5" fill="#444"/>
  <text x="15" y="135" font-family="monospace" font-size="9" fill="#444">O</text>
  <!-- 原正方形（虚线灰），贴原点 -->
  <rect x="30" y="80" width="30" height="40" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="32" y="135" font-family="monospace" font-size="9" fill="#999">1×1</text>
  <!-- 缩放后（实线绿），2×3 -->
  <rect x="30" y="40" width="80" height="80" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="120" y="80" font-family="monospace" font-size="11" fill="#0b6e4f">Scale(2, 3)</text>
  <text x="120" y="96" font-family="monospace" font-size="10" fill="#0b6e4f">→ 2×3</text>
</svg>
<figcaption>Scale(2, 3)：以原点为中心，x 拉伸 2 倍、y 拉伸 3 倍</figcaption>
</figure>

::: warning Scale 绕原点，不是绕几何中心
`Scale(xFactor, yFactor)` 恒以**坐标原点 (0,0)** 为缩放中心。若几何远离原点，会被"甩"到很远的位置并放大位移。要绕指定点缩放，用下一节的 `ScaleInstance`，或手动组合：`Translate(−cx, −cy).Scale(sx, sy).Translate(cx, cy)`。
:::

## ScaleInstance(xFactor, yFactor, x, y)

**签名**：
```csharp
public static AffineTransformation ScaleInstance(double xFactor, double yFactor);
public static AffineTransformation ScaleInstance(double xFactor, double yFactor, double x, double y);
```

**语义**：静态工厂，返回一个**独立**的缩放变换。带 `(x, y)` 的重载以 `(x, y)` 为缩放中心——等价于"平移到原点 → 缩放 → 平移回去"。

```csharp
var square = UnitSquare(4, 4);              // (4,4)-(5,5)，中心 (4.5, 4.5)

// 绕几何中心 (4.5, 4.5) 放大 2 倍
var trans = AffineTransformation.ScaleInstance(2, 2, 4.5, 4.5);
var scaled = trans.Transform(square);

// 缩放后顶点：(3.5,3.5) (5.5,3.5) (5.5,5.5) (3.5,5.5) —— 中心 (4.5,4.5) 不动，边长从 1 变 2
foreach (var c in scaled.Coordinates)
    Console.WriteLine($"{c.X}, {c.Y}");
```

::: tip 绕点缩放 = 平移 · 缩放 · 平移
`ScaleInstance(sx, sy, x, y)` 的本质是"把中心 `(x, y)` 搬到原点 → 缩放 → 搬回去"，矩阵形式为：

```
T(x, y) · S(sx, sy) · T(−x, −y)
```

对一个点的作用顺序是：先 `T(−x,−y)`（中心移到原点），再 `S(sx,sy)`（缩放），最后 `T(x,y)`（移回原位）。理解这个"三明治"结构是掌握所有"绕点变换"的关键——`RotationInstance(theta, x, y)` 同理：`T(x,y) · R(θ) · T(−x,−y)`。
:::

## Rotate(theta) / RotateInstance(theta, x, y)

**签名**：
```csharp
public AffineTransformation Rotate(double theta);
public AffineTransformation Rotate(double sinAngle, double cosAngle);
public static AffineTransformation RotationInstance(double theta);
public static AffineTransformation RotationInstance(double theta, double x, double y);
public static AffineTransformation RotationInstance(double sinAngle, double cosAngle);
public static AffineTransformation RotationInstance(double sinAngle, double cosAngle, double x, double y);
```

**语义**：旋转。`theta` 单位为**弧度**，正方向为数学约定（从 +x 轴转向 +y 轴，即逆时针）。`Rotate(theta)` 绕原点；`RotationInstance(theta, x, y)` 绕指定点 `(x, y)`。带 `sinAngle, cosAngle` 的重载可避免重复三角运算或精确控制角度。

```csharp
var square = UnitSquare();                  // (0,0)-(1,1)

// 绕原点逆时针旋转 90°（π/2）
var trans = new AffineTransformation().Rotate(Math.PI / 2);
var rotated = trans.Transform(square);

// 旋转后顶点：(0,0) (0,1) (-1,1) (-1,0)
foreach (var c in rotated.Coordinates)
    Console.WriteLine($"{c.X}, {c.Y}");

// 绕几何中心 (0.5, 0.5) 旋转 45°
var trans2 = AffineTransformation.RotationInstance(Math.PI / 4, 0.5, 0.5);
var rotated2 = trans2.Transform(square);
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 160" width="360" height="160">
  <!-- 原点标记 -->
  <circle cx="60" cy="120" r="2.5" fill="#444"/>
  <text x="44" y="118" font-family="monospace" font-size="9" fill="#444">O</text>
  <!-- 坐标轴 -->
  <line x1="20" y1="120" x2="160" y2="120" stroke="#ddd" stroke-width="1"/>
  <line x1="60" y1="150" x2="60" y2="40" stroke="#ddd" stroke-width="1"/>
  <!-- 原矩形（虚线灰） -->
  <rect x="60" y="80" width="70" height="40" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="80" y="135" font-family="monospace" font-size="9" fill="#999">原矩形</text>
  <!-- 旋转后的矩形（实线绿）：绕 O 顺时针 30°（视觉），用 transform -->
  <g transform="rotate(30 60 120)">
    <rect x="60" y="80" width="70" height="40" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  </g>
  <!-- 旋转弧 -->
  <path d="M 110,120 A 50,50 0 0,0 95,75" fill="none" stroke="#a86300" stroke-width="1.5" stroke-dasharray="3 2"/>
  <text x="105" y="100" font-family="monospace" font-size="11" fill="#a86300">θ</text>
  <text x="200" y="70" font-family="monospace" font-size="11" fill="#0b6e4f">Rotate(θ)</text>
  <text x="200" y="86" font-family="monospace" font-size="10" fill="#666">绕原点逆时针旋转 θ 弧度</text>
</svg>
<figcaption>Rotate(theta)：绕原点旋转。注意 SVG 中 y 轴向下，视觉方向与数学习惯相反</figcaption>
</figure>

::: warning 单位是弧度，不是度
`theta` 是弧度。`Math.PI` 对应 180°。常见错误是直接传 `90` 想旋转 90°——实际旋转了约 5156°（90 弧度）。换算：`弧度 = 角度 × Math.PI / 180`。

另一个易错点：屏幕/SVG 坐标系 y 轴向下，"逆时针"在视觉上呈现为顺时针。但 NTS 几何的坐标值遵循数学约定（y 向上为正），变换本身与渲染无关。
:::

## Reflect()

**签名**：
```csharp
public AffineTransformation Reflect(double x, double y, double x2, double y2);
public AffineTransformation SetToReflection(double x, double y, double x2, double y2);
public AffineTransformation SetToReflectionBasic(double x, double y, double x2, double y2);
```

**语义**：反射（镜像）。以过两点 `(x, y)` 与 `(x2, y2)` 的直线为对称轴，把几何翻转到另一侧。`SetToReflection` 系列把当前变换**重置为**纯反射；`Reflect` 在当前变换基础上叠加。

常见对称轴：

| 对称轴 | 参数取法 |
| --- | --- |
| x 轴 | `(0,0)` 与 `(1,0)`，等价 `Scale(1, −1)` |
| y 轴 | `(0,0)` 与 `(0,1)`，等价 `Scale(−1, 1)` |
| y = x | `(0,0)` 与 `(1,1)` |
| 任意直线 | 给出直线上两点 |

```csharp
var square = UnitSquare();                  // (0,0)-(1,1)

// 以 y 轴为对称轴反射
var trans = new AffineTransformation().Reflect(0, 0, 0, 1);
var mirrored = trans.Transform(square);

// 反射后顶点：(0,0) (-1,0) (-1,1) (0,1) —— x 取反
foreach (var c in mirrored.Coordinates)
    Console.WriteLine($"{c.X}, {c.Y}");

// 以 y = x 为对称轴反射：x、y 互换
var trans2 = new AffineTransformation().Reflect(0, 0, 1, 1);
var swapped = trans2.Transform(square);     // (0,0) (0,1) (1,1) (1,0)
```

<figure class="nts-diagram">
<svg viewBox="0 0 360 160" width="360" height="160">
  <!-- 对称轴（虚线橙） -->
  <line x1="40" y1="140" x2="320" y2="20" stroke="#a86300" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="270" y="40" font-family="monospace" font-size="10" fill="#a86300">镜面（对称轴）</text>
  <!-- 原三角形（虚线灰） -->
  <polygon points="60,60 110,60 110,110" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="65" y="55" font-family="monospace" font-size="10" fill="#999">原</text>
  <!-- 反射三角形（实线绿）：以对角线为镜面 -->
  <polygon points="140,140 140,90 190,90" fill="rgba(11,110,79,0.2)" stroke="#0b6e4f" stroke-width="2"/>
  <text x="175" y="135" font-family="monospace" font-size="10" fill="#0b6e4f">反射后</text>
</svg>
<figcaption>Reflect：以直线为对称轴翻转。反射改变方向（行列式为 −1），多边形环方向也会反转</figcaption>
</figure>

::: warning 反射会让多边形环方向反转
反射矩阵行列式为 −1，会把外壳的 CCW（逆时针）变成 CW（顺时针），孔洞反之。若下游代码依赖环方向（如某些渲染、面积符号约定），反射后可能需要 `Normalize()` 重新规范化方向。

另外 `SetToReflectionBasic` 公式简单，在镜面接近垂直时数值稳定性差；生产场景优先 `SetToReflection`。
:::

## Shear(xFactor, yFactor)

**签名**：`public AffineTransformation Shear(double xFactor, double yFactor)`

**语义**：剪切（错切）。`x` 方向剪切使原本垂直的边倾斜：`x' = x + xFactor·y`；`y` 方向类似：`y' = y + yFactor·x`。正方形会变成平行四边形。

```csharp
var square = UnitSquare();                  // (0,0)-(1,1)
var trans = new AffineTransformation().Shear(2, 0);   // 仅 x 方向剪切
var sheared = trans.Transform(square);

// 剪切后顶点：(0,0) (1,0) (3,1) (2,1) —— 顶边向右偏移 2
foreach (var c in sheared.Coordinates)
    Console.WriteLine($"{c.X}, {c.Y}");
```

| 参数 | 效果 |
| --- | --- |
| `Shear(k, 0)` | x 方向剪切，矩形 → 平行四边形（顶边偏移） |
| `Shear(0, k)` | y 方向剪切，矩形 → 平行四边形（右边偏移） |
| `Shear(kx, ky)` | 双向剪切，矩形 → 一般平行四边形 |

::: tip 剪切保面积
剪切矩阵行列式恒为 1，因此**面积不变**。常用于把平行四边形"拉直"成矩形，或反过来模拟倾斜投影。
:::

## Compose / ComposeBefore / ComposeAfter

**签名**：
```csharp
public AffineTransformation Compose(AffineTransformation trans);
public AffineTransformation ComposeBefore(AffineTransformation trans);
public AffineTransformation ComposeAfter(AffineTransformation trans);
```

**语义**：把两个变换组合成一个。三者的区别在于"作用顺序"——按列向量约定 `p' = M·p`：

| 方法 | 矩阵运算 | 对点的作用顺序 |
| --- | --- | --- |
| `Compose(trans)` | `this = this · trans` | 先 `trans`，再 `this` |
| `ComposeAfter(trans)` | `this = this · trans` | 先 `trans`，再 `this`（等同 `Compose`） |
| `ComposeBefore(trans)` | `this = trans · this` | 先 `this`，再 `trans` |

记忆口诀：`ComposeBefore/After` 描述的是"**当前 this 相对于参数 trans 的作用时机**"——`Before` 表示 this 在前，`After` 表示 this 在后。

```csharp
var p = factory.CreatePoint(new Coordinate(1, 0));
var T = AffineTransformation.TranslationInstance(5, 0);     // 平移 (5,0)
var R = AffineTransformation.RotationInstance(Math.PI / 2); // 旋转 90°

// 目标：先 R 后 T —— p(1,0) --R--> (0,1) --T--> (5,1)
// 列向量约定 p' = M·p，"后作用的变换在左"，故期望矩阵 = T · R
var rt = new AffineTransformation(R);   // 从 R 起步：this = R
rt.ComposeBefore(T);                     // this = T · this = T · R → 先 R 后 T
Console.WriteLine(rt.Transform(p));      // (5, 1)
```

::: warning 变换组合不可交换
`先旋转 90° 再平移 (5,0)` 与 `先平移 (5,0) 再旋转 90°` 结果完全不同——旋转会改变平移向量的方向。所以"绕原点旋转后再平移"和"平移后再绕原点旋转"是两回事。**永远先想清楚作用顺序，再选择 `Compose` / `ComposeBefore`**，下一节用具体数值验证。

矩阵乘法不交换（`A·B ≠ B·A`），但满足结合律（`(A·B)·C = A·(B·C)`），所以多个变换链式组合时无需担心结合顺序，只需关心作用顺序。
:::

```mermaid
flowchart LR
    P["点 p"] -->|trans 先| Q["中间结果"]
    Q -->|this 后| R["最终 p'"]
    P -.->|this · trans · p| R
    style P fill:#fff,stroke:#0b6e4f
    style R fill:rgba(11,110,79,0.2),stroke:#0b6e4f
    style Q fill:#fff,stroke:#a86300,stroke-dasharray:4 3
```

## Apply 方法：对几何应用变换

**签名**：
```csharp
public Geometry Transform(Geometry g);          // 返回新几何，不改原几何
// 同时实现 ICoordinateSequenceFilter，可用于 g.Apply(filter)
```

**语义**：把仿射变换作用到几何上。`Transform` 返回变换后的**新几何**（深拷贝顶点后变换）；`AffineTransformation` 还实现了 `ICoordinateSequenceFilter`，可通过 `g.Apply(filter)` **就地**修改几何顶点。

```csharp
var square = UnitSquare();

// 方式 1：Transform 返回新几何（推荐，不改原几何）
var trans = AffineTransformation.TranslationInstance(2, 3);
var moved = trans.Transform(square);
Console.WriteLine(moved.Coordinates[0]);   // (2, 3)
Console.WriteLine(square.Coordinates[0]);  // (0, 0) —— 原几何不变

// 方式 2：通过 Apply 就地修改（注意会改动原几何）
var g = UnitSquare();
g.Apply(trans);                            // 就地变换坐标序列
Console.WriteLine(g.Coordinates[0]);       // (2, 3) —— 原几何已被改
```

`Transform` 对所有几何类型递归生效：`Point` / `LineString` / `Polygon` / `Multi*` / `GeometryCollection` 的每个顶点都被变换。几何结构与拓扑关系保持，仅坐标改变。

::: warning Apply 是就地修改，Transform 返回新对象
`g.Apply(filter)` 会直接改写 `g` 的 `CoordinateSequence`，原几何被破坏。若需保留原几何，先 `g.Copy()` 再 `Apply`，或直接用 `Transform(g)`——后者内部就是"复制 + 变换"。

另一个细节：`Transform` 对空几何返回空几何，不会抛异常。
:::

## 矩阵表示：手动设置矩阵元素

**签名**：
```csharp
public AffineTransformation SetTransformation(double m00, double m01, double m10, double m11, double m02, double m12);
public AffineTransformation SetTransformation(AffineTransformation trans);
public AffineTransformation SetToIdentity();
```

**语义**：直接写入 6 个矩阵元素，构造任意仿射变换。`SetTransformation` 把当前变换**重置**为给定矩阵；`SetToIdentity` 重置为单位变换。

```csharp
// 手动构造"绕原点旋转 90°"：m00=0, m01=-1, m10=1, m11=0, m02=0, m12=0
var rot90 = new AffineTransformation().SetTransformation(0, -1, 1, 0, 0, 0);
var p = factory.CreatePoint(new Coordinate(1, 0));
var q = rot90.Transform(p);
Console.WriteLine($"{q.X}, {q.Y}");         // (0, 1)

// 行列式可判断变换类型
Console.WriteLine(rot90.Determinant);       // 1（刚体旋转，保面积保方向）
```

| 行列式 | 含义 |
| --- | --- |
| `+1` | 保方向（旋转、平移、剪切） |
| `−1` | 反向（含反射） |
| `> 1` 或 `< −1` | 放大面积 |
| `0 < |det| < 1` | 缩小面积 |
| `0` | 退化（投影到直线，不可逆） |

::: tip 用 SetTo* 系列避免手算矩阵
NTS 提供了 `SetToTranslation` / `SetToScale` / `SetToRotation` / `SetToShear` / `SetToReflection` 等"重置为纯变换"的方法。除非需要自定义复合矩阵，否则优先用这些，避免手算三角函数与符号出错。
:::

## 变换组合的顺序（不可交换）

仿射变换的本质是矩阵乘法，而矩阵乘法**不可交换**。这是最常踩的坑。

```csharp
var p = factory.CreatePoint(new Coordinate(2, 0));
var T = AffineTransformation.TranslationInstance(5, 0);    // 平移 (5,0)
var R = AffineTransformation.RotationInstance(Math.PI / 2); // 旋转 90°

// 组合 A：先 R 后 T —— p(2,0) --R--> (0,2) --T--> (5,2)
var A = new AffineTransformation(R);   // 从"先作用"的 R 起步
A.ComposeBefore(T);                     // this = T · R → 后作用的 T 在左
var pa = A.Transform(p);
Console.WriteLine($"{pa.X}, {pa.Y}");   // (5, 2)

// 组合 B：先 T 后 R —— p(2,0) --T--> (7,0) --R--> (0,7)
var B = new AffineTransformation(T);   // 从"先作用"的 T 起步
B.ComposeBefore(R);                     // this = R · T → 后作用的 R 在左
var pb = B.Transform(p);
Console.WriteLine($"{pb.X}, {pb.Y}");   // (0, 7)

// pa=(5,2) ≠ pb=(0,7)，验证不可交换
```

**实战建议**：与其在 `Compose` / `ComposeBefore` / `ComposeAfter` 的命名里绕弯，不如按"作用顺序"从左到右链式书写，每一步都用 `SetTo*` 重置或用静态 `*Instance` 拼接，思路最清晰。

## 与坐标系 / SRID 的关系

::: warning 仿射变换不改 SRID
`AffineTransformation.Transform(g)` 返回的新几何**保留原几何的 SRID**。变换只改坐标数值，不动空间参考标识。

这意味着：
- 在 WGS84 (EPSG:4326) 上做 `Scale(1000, 1000)` 会得到一个 SRID 仍是 4326、但坐标放大 1000 倍的几何——**语义上是错的**，但 NTS 不会报警。
- 仿射变换**不是投影转换**。把经纬度"乘以一个系数"不会变成米制坐标，只是改了数字。
:::

若需要真正的坐标系转换（重投影），用 ProjNet 库的 `CoordinateTransformationFactory` 或 ProjNet4GeoAPI，它们基于 PROJ 参数做正确的投影运算。

```mermaid
flowchart TD
    A["原始几何<br/>SRID = 4326"] --> B{需要什么？}
    B -->|平移/旋转/缩放几何| C["AffineTransformation<br/>坐标数值变化，SRID 不变"]
    B -->|换坐标系| D["ProjNet 投影转换<br/>如 4326 → 3857，SRID 改变"]
    C --> E["结果 SRID = 4326<br/>（仍是经纬度，仅数值变换）"]
    D --> F["结果 SRID = 3857<br/>（真正的米制坐标）"]
    style C fill:rgba(11,110,79,0.2),stroke:#0b6e4f
    style D fill:rgba(168,99,0,0.2),stroke:#a86300
```

## 实战场景

### 几何对齐

把一个偏离原点的几何"挪到原点并对齐"——平移到质心为原点，旋转使长轴沿 x 方向：

```csharp
// 假设 g 是一个倾斜、偏离原点的多边形
var env = g.EnvelopeInternal;
var cx = (env.MinX + env.MaxX) / 2;
var cy = (env.MinY + env.MaxY) / 2;

// 平移到原点
var align = AffineTransformation.TranslationInstance(-cx, -cy);
var centered = align.Transform(g);
```

### 地图配准（仿射配准）

已知一组控制点在"源坐标系"与"目标坐标系"中的对应关系，求最佳仿射变换。NTS 没有直接提供最小二乘配准 API，但可手算 6 参数后用 `SetTransformation` 写入：

```csharp
// 由 3 对以上控制点最小二乘求解 6 个矩阵元素后：
double m00 = /* ... */, m01 = /* ... */, m10 = /* ... */;
double m11 = /* ... */, m02 = /* ... */, m12 = /* ... */;

var georef = new AffineTransformation().SetTransformation(m00, m01, m10, m11, m02, m12);
var rectified = georef.Transform(rawGeometry);
```

::: tip 仿射配准需要至少 3 个不共线的控制点
3 个不共线点恰好确定 6 个仿射参数（每点 2 个方程）。多于 3 点时用最小二乘平差，可吸收控制点误差。若需处理更复杂的畸变（如橡胶拉伸），改用多项式变换或样条变换——NTS 不内置，需自行实现。
:::

## 注意事项

- **平面变换**：NTS 的 `AffineTransformation` 是 2D 平面变换，只作用于 `(x, y)`，忽略 `z` 与 `m`。对 3D 坐标序列，z 值原样保留。
- **不处理投影**：仿射变换不做椭球/投影运算。在经纬度数据上做缩放/旋转只在"把经纬度当平面坐标"的近似下成立，高纬度或大范围会显著失真。
- **数值精度**：多次组合（特别是旋转）会累积浮点误差。若变换链很长，定期用 `SetToIdentity` 重建，或对结果几何做 `GeometryPrecisionReducer` 处理。
- **不可逆性**：行列式为 0 的变换（如 `Scale(0, 1)` 把几何压扁到 x 轴）不可逆，`Transform` 后信息丢失，无法恢复。

## 方法速查表

| 方法 | 签名 | 作用 | 返回 |
| --- | --- | --- | --- |
| `Translate` | `(double x, double y)` | 叠加平移 | `this` |
| `Scale` | `(double xFactor, double yFactor)` | 绕原点缩放 | `this` |
| `ScaleInstance` | `(sx, sy[, x, y])` | 绕点缩放（静态） | 新变换 |
| `Rotate` | `(double theta)` / `(sin, cos)` | 绕原点旋转 | `this` |
| `RotationInstance` | `(theta[, x, y])` | 绕点旋转（静态） | 新变换 |
| `Shear` | `(double xFactor, double yFactor)` | 剪切 | `this` |
| `Reflect` | `(x, y, x2, y2)` | 叠加反射 | `this` |
| `SetToReflection` | `(x, y, x2, y2)` | 重置为反射 | `this` |
| `Compose` | `(trans)` | `this = this · trans` | `this` |
| `ComposeBefore` | `(trans)` | `this = trans · this` | `this` |
| `ComposeAfter` | `(trans)` | `this = this · trans` | `this` |
| `Transform` | `(Geometry g)` | 返回变换后的新几何 | `Geometry` |
| `SetTransformation` | `(m00,m01,m10,m11,m02,m12)` | 重置为指定矩阵 | `this` |
| `SetToIdentity` | `()` | 重置为单位变换 | `this` |
| `IsIdentity` | 属性 | 是否恒等变换 | `bool` |
| `Determinant` | 属性 | 矩阵行列式 | `double` |

## 下一步

- [缓冲区 Buffer](./buffer.md)：在几何外扩/内缩一定距离生成多边形
- [叠加分析 Overlay](./overlay.md)：两个几何的交、并、差、对称差
- [化简与凸包](./convex-simplify.md)：Douglas-Peucker 化简、凸包计算
- [几何属性](../02-geometry-fundamentals/geometry-properties.md)：理解变换前后 `Area`、`Length`、`Centroid` 的变化
