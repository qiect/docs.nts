import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    lang: 'zh-CN',
    base: '/docs.nts/',
    title: 'NetTopologySuite 教程',
    description: '面向 .NET 开发者的全面、深入的 NetTopologySuite (NTS) 空间数据处理指南',
    lastUpdated: true,
    cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#0b6e4f' }],
    ['meta', { name: 'author', content: 'NTS Tutorial' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
  ],

  themeConfig: {
    siteTitle: 'NetTopologySuite 教程',

    logo: '/favicon.svg',

    nav: [
      { text: '首页', link: '/' },
      {
        text: '入门',
        link: '/01-getting-started/introduction'
      },
      {
        text: '几何基础',
        link: '/02-geometry-fundamentals/geometry-hierarchy'
      },
      {
        text: '核心能力',
        items: [
          { text: '空间关系', link: '/03-spatial-relations/relationships' },
          { text: '几何运算', link: '/04-geometry-operations/overlay' },
          { text: '空间测量', link: '/05-spatial-measurement/measurement' }
        ]
      },
      {
        text: '进阶',
        items: [
          { text: '性能优化', link: '/06-performance/prepared-geometry' },
          { text: '高级主题', link: '/07-advanced-topics/triangulation' },
          { text: '生态集成', link: '/08-ecosystem/ef-core' }
        ]
      },
      {
        text: '附录',
        items: [
          { text: 'API 速查表', link: '/appendix/cheatsheet' },
          { text: '常见问题', link: '/appendix/faq' },
          { text: '官方资料', link: '/appendix/resources' }
        ]
      }
    ],

    sidebar: {
      '/01-getting-started/': [
        {
          text: '第一阶段：入门之旅',
          collapsed: false,
          items: [
            { text: '认识 NetTopologySuite', link: '/01-getting-started/introduction' },
            { text: '快速开始', link: '/01-getting-started/quickstart' },
            { text: '第一个几何对象', link: '/01-getting-started/first-geometry' }
          ]
        }
      ],
      '/02-geometry-fundamentals/': [
        {
          text: '第二阶段：几何基础',
          collapsed: false,
          items: [
            { text: '坐标与坐标序列', link: '/02-geometry-fundamentals/coordinate-system' },
            { text: '几何类型层级', link: '/02-geometry-fundamentals/geometry-hierarchy' },
            { text: '几何属性', link: '/02-geometry-fundamentals/geometry-properties' },
            { text: '几何工厂 GeometryFactory', link: '/02-geometry-fundamentals/geometry-factory' },
            { text: '精度模型 PrecisionModel', link: '/02-geometry-fundamentals/precision-model' },
            { text: 'WKT 与 WKB', link: '/02-geometry-fundamentals/wkt-wkb' },
            { text: '几何遍历与提取', link: '/02-geometry-fundamentals/geometry-iteration' }
          ]
        }
      ],
      '/03-spatial-relations/': [
        {
          text: '第三阶段：空间关系',
          collapsed: false,
          items: [
            { text: '空间关系与谓词', link: '/03-spatial-relations/relationships' },
            { text: 'DE-9IM 模型', link: '/03-spatial-relations/de9im' }
          ]
        }
      ],
      '/04-geometry-operations/': [
        {
          text: '第四阶段：几何运算',
          collapsed: false,
          items: [
            { text: '叠加分析 (Overlay)', link: '/04-geometry-operations/overlay' },
            { text: '批量合并', link: '/04-geometry-operations/batch-union' },
            { text: '缓冲区 Buffer', link: '/04-geometry-operations/buffer' },
            { text: '凸包与简化', link: '/04-geometry-operations/convex-simplify' },
            { text: '仿射变换', link: '/04-geometry-operations/affine-transform' }
          ]
        }
      ],
      '/05-spatial-measurement/': [
        {
          text: '第五阶段：空间测量',
          collapsed: false,
          items: [
            { text: '测量与距离', link: '/05-spatial-measurement/measurement' },
            { text: '最近点与投影', link: '/05-spatial-measurement/nearest-points' },
            { text: '线性参考', link: '/05-spatial-measurement/linear-referencing' }
          ]
        }
      ],
      '/06-performance/': [
        {
          text: '第六阶段：性能优化',
          collapsed: false,
          items: [
            { text: 'PreparedGeometry 性能优化', link: '/06-performance/prepared-geometry' },
            { text: '空间索引 STRtree', link: '/06-performance/spatial-index' }
          ]
        }
      ],
      '/07-advanced-topics/': [
        {
          text: '第七阶段：高级主题',
          collapsed: false,
          items: [
            { text: '三角剖分与曲面', link: '/07-advanced-topics/triangulation' },
            { text: '自定义操作与扩展', link: '/07-advanced-topics/extending' }
          ]
        }
      ],
      '/08-ecosystem/': [
        {
          text: '第八阶段：生态集成',
          collapsed: false,
          items: [
            { text: 'EF Core 集成', link: '/08-ecosystem/ef-core' },
            { text: '数据库与 PostGIS', link: '/08-ecosystem/databases' }
          ]
        }
      ],
      '/appendix/': [
        {
          text: '附录',
          collapsed: false,
          items: [
            { text: 'API 速查表', link: '/appendix/cheatsheet' },
            { text: '常见问题 FAQ', link: '/appendix/faq' },
            { text: '官方资料与链接', link: '/appendix/resources' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/NetTopologySuite/NetTopologySuite' }
    ],

    outline: {
      level: [2, 3],
      label: '本页导航'
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    lastUpdatedText: '最后更新',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换'
            }
          }
        }
      }
    },

    editLink: {
      pattern: 'https://github.com/NetTopologySuite/NetTopologySuite/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },

    footer: {
      message: '本教程为社区学习资料，NetTopologySuite 是基于 BSD 协议开源的 .NET 项目。',
      copyright: 'Copyright © 2019 - present NetTopologySuite Community'
    }
  },

  markdown: {
    lineNumbers: true,
    theme: { light: 'github-light', dark: 'github-dark' }
  }
  }),
  {
    mermaid: {
      theme: 'default'
    }
  }
)