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
        link: '/guide/getting-started'
      },
      {
        text: '核心概念',
        items: [
          { text: '坐标与几何层级', link: '/core/geometry-hierarchy' },
          { text: 'WKT 与 WKB', link: '/core/wkt-wkb' },
          { text: '几何工厂 GeometryFactory', link: '/core/geometry-factory' }
        ]
      },
      {
        text: '操作与谓词',
        items: [
          { text: '几何操作', link: '/operations/overlay' },
          { text: '空间谓词', link: '/predicates/relationships' },
          { text: '测量与分析', link: '/analysis/measurement' }
        ]
      },
      {
        text: '进阶',
        items: [
          { text: 'PreparedGeometry', link: '/advanced/prepared-geometry' },
          { text: '三角剖分', link: '/advanced/triangulation' },
          { text: '集成 EF Core', link: '/integration/ef-core' }
        ]
      },
      {
        text: '资源',
        items: [
          { text: '速查表', link: '/cookbook/cheatsheet' },
          { text: '常见问题', link: '/cookbook/faq' },
          { text: '官方资料', link: '/cookbook/resources' }
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          collapsed: false,
          items: [
            { text: '认识 NetTopologySuite', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '第一个几何对象', link: '/guide/first-geometry' }
          ]
        }
      ],
      '/core/': [
        {
          text: '核心概念',
          collapsed: false,
          items: [
            { text: '坐标与几何层级', link: '/core/geometry-hierarchy' },
            { text: '几何属性', link: '/core/geometry-properties' },
            { text: 'WKT 与 WKB', link: '/core/wkt-wkb' },
            { text: '几何工厂 GeometryFactory', link: '/core/geometry-factory' },
            { text: '精度模型 PrecisionModel', link: '/core/precision-model' }
          ]
        }
      ],
      '/operations/': [
        {
          text: '几何操作',
          collapsed: false,
          items: [
            { text: '叠加分析 (Overlay)', link: '/operations/overlay' },
            { text: '缓冲区 Buffer', link: '/operations/buffer' },
            { text: '凸包与简化', link: '/operations/convex-simplify' }
          ]
        }
      ],
      '/predicates/': [
        {
          text: '空间谓词',
          collapsed: false,
          items: [
            { text: '空间关系与谓词', link: '/predicates/relationships' },
            { text: 'DE-9IM 模型', link: '/predicates/de9im' }
          ]
        }
      ],
      '/analysis/': [
        {
          text: '空间分析',
          collapsed: false,
          items: [
            { text: '测量与距离', link: '/analysis/measurement' },
            { text: '最近点与投影', link: '/analysis/nearest-points' }
          ]
        }
      ],
      '/advanced/': [
        {
          text: '进阶主题',
          collapsed: false,
          items: [
            { text: 'PreparedGeometry 性能优化', link: '/advanced/prepared-geometry' },
            { text: '三角剖分与曲面', link: '/advanced/triangulation' },
            { text: '空间索引 STRtree', link: '/advanced/spatial-index' },
            { text: '自定义操作与扩展', link: '/advanced/extending' }
          ]
        }
      ],
      '/integration/': [
        {
          text: '生态集成',
          collapsed: false,
          items: [
            { text: 'EF Core 集成', link: '/integration/ef-core' },
            { text: '数据库与 PostGIS', link: '/integration/databases' }
          ]
        }
      ],
      '/cookbook/': [
        {
          text: '实用资源',
          collapsed: false,
          items: [
            { text: 'API 速查表', link: '/cookbook/cheatsheet' },
            { text: '常见问题 FAQ', link: '/cookbook/faq' },
            { text: '官方资料与链接', link: '/cookbook/resources' }
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
