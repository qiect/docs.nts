<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import { useData, useRoute } from 'vitepress'
import { onMounted, h, nextTick, watch } from 'vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const route = useRoute()

function setupReveal() {
  const els = document.querySelectorAll('.nts-reveal')
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12 }
  )
  els.forEach((el) => io.observe(el))
}

onMounted(() => {
  nextTick(setupReveal)
})

watch(
  () => route.path,
  () => nextTick(setupReveal)
)
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <div class="nts-hero-bg" aria-hidden="true">
        <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
          <g transform="translate(300 300)">
            <path class="nts-contour" d="M -220,0 C -180,-120 -60,-160 0,-160 C 60,-160 180,-120 220,0 C 180,120 60,160 0,160 C -60,160 -180,120 -220,0 Z" />
            <path class="nts-contour" d="M -180,0 C -150,-95 -50,-130 0,-130 C 50,-130 150,-95 180,0 C 150,95 50,130 0,130 C -50,130 -150,95 -180,0 Z" />
            <path class="nts-contour" d="M -140,0 C -115,-70 -40,-100 0,-100 C 40,-100 115,-70 140,0 C 115,70 40,100 0,100 C -40,100 -115,70 -140,0 Z" />
            <path class="nts-contour" d="M -100,0 C -82,-50 -28,-72 0,-72 C 28,-72 82,-50 100,0 C 82,50 28,72 0,72 C -28,72 -82,50 -100,0 Z" />
            <path class="nts-contour" d="M -60,0 C -48,-30 -16,-42 0,-42 C 16,-42 48,-30 60,0 C 48,30 16,42 0,42 C -16,42 -48,30 -60,0 Z" />
            <path class="nts-contour" d="M -24,0 C -18,-12 -6,-16 0,-16 C 6,-16 18,-12 24,0 C 18,12 6,16 0,16 C -6,16 -18,12 -24,0 Z" />
            <circle cx="0" cy="0" r="3" fill="var(--nts-green, #0b6e4f)" />
            <circle cx="0" cy="0" r="40" fill="none" stroke="var(--nts-green, #0b6e4f)" stroke-width="0.8" stroke-dasharray="3 4" opacity="0.4" />
            <circle cx="0" cy="0" r="90" fill="none" stroke="var(--nts-green, #0b6e4f)" stroke-width="0.6" stroke-dasharray="2 6" opacity="0.3" />
          </g>
        </svg>
      </div>
    </template>

    <template #home-features-after>
      <section class="nts-paths">
        <a class="nts-path nts-reveal" href="/guide/getting-started">
          <span class="step">路径 01 · 新手起步</span>
          <h3>从零开始</h3>
          <p>安装 NetTopologySuite，创建你的第一个几何对象，理解坐标系与几何类型层级。15 分钟跑通你的第一段空间代码。</p>
          <span class="arrow">开始学习 <span aria-hidden="true">→</span></span>
        </a>
        <a class="nts-path nts-reveal" href="/operations/overlay">
          <span class="step">路径 02 · 进阶实战</span>
          <h3>掌握空间操作</h3>
          <p>叠加分析、缓冲区、空间谓词、DE-9IM 模型——深入理解 NTS 的几何代数，写出正确且高效的空间代码。</p>
          <span class="arrow">深入操作 <span aria-hidden="true">→</span></span>
        </a>
      </section>

      <section class="nts-stats nts-reveal">
        <div class="nts-stat">
          <div class="num">20+</div>
          <div class="label">详细教程章节</div>
        </div>
        <div class="nts-stat">
          <div class="num">100+</div>
          <div class="label">可运行代码示例</div>
        </div>
        <div class="nts-stat">
          <div class="num">15+</div>
          <div class="label">几何操作图解</div>
        </div>
        <div class="nts-stat">
          <div class="num">OGC</div>
          <div class="label">遵循 SQL 简单要素规范</div>
        </div>
      </section>
    </template>
  </Layout>
</template>
