<template>
  <div class="article-detail" v-loading="loading">
    <!-- 顶部固定阅读进度条 -->
    <div class="reading-progress-track">
      <div class="reading-progress-thumb" :style="{ width: `${progressPercent}%` }"></div>
    </div>

    <template v-if="article">
      <ReadingAid :body="article.body || ''" :progress="progressPercent" />

      <el-card>
        <template #header>
          <div class="article-header">
            <h1 class="article-title">{{ article.title }}</h1>
            <div class="article-meta">
              <span class="article-date">
                发布于 {{ formatDate(article.created_at) }}
              </span>
              <span v-if="article.updated_at !== article.created_at" class="article-date">
                更新于 {{ formatDate(article.updated_at) }}
              </span>
            </div>
            <div class="article-tags">
              <el-tag v-for="tag in article.tags" :key="tag" size="small">
                {{ tag }}
              </el-tag>
            </div>
          </div>
        </template>

        <div ref="contentRef" class="article-content" v-html="renderedContent"></div>
      </el-card>

      <div class="back-button">
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
      </div>
    </template>

    <el-empty v-if="!loading && !article" description="文章不存在" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { marked } from 'marked'
import api from '../api'
import ReadingAid from '../components/ReadingAid.vue'

const route = useRoute()
const router = useRouter()

const article = ref(null)
const loading = ref(false)
const contentRef = ref(null)
const readingProgress = ref(0)
let rafId = null
let resizeObserver = null
// 每次请求的序号，防止快速切换文章时旧请求覆盖新文章
let fetchToken = 0

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true
})

const renderedContent = computed(() => {
  if (!article.value) return ''
  return marked(article.value.body || '')
})

const progressPercent = computed(() => {
  const value = Math.round(readingProgress.value)
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
})

onMounted(() => {
  fetchArticle()
  window.addEventListener('scroll', scheduleProgressUpdate, { passive: true })
  window.addEventListener('resize', scheduleProgressUpdate)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleProgressUpdate)
  window.removeEventListener('resize', scheduleProgressUpdate)
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

// 同一组件复用时切换文章（/:id 变化），进度与概览必须整体对应新文章
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      fetchArticle()
    }
  }
)

async function fetchArticle() {
  const token = ++fetchToken
  loading.value = true
  resetReadingState()
  try {
    const { id } = route.params
    const response = await api.get(`/articles/${id}`)
    if (token !== fetchToken) return
    article.value = response.data
    await nextTick()
    observeContent()
    scheduleProgressUpdate()
  } catch (error) {
    if (token === fetchToken) {
      console.error('Failed to fetch article:', error)
    }
  } finally {
    if (token === fetchToken) {
      loading.value = false
    }
  }
}

function resetReadingState() {
  article.value = null
  readingProgress.value = 0
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.scrollTo(0, 0)
}

// 正文高度可能因图片加载等原因变化，监听内容区尺寸以保证进度准确
function observeContent() {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (typeof ResizeObserver !== 'undefined' && contentRef.value) {
    resizeObserver = new ResizeObserver(() => updateProgress())
    resizeObserver.observe(contentRef.value)
  }
}

function scheduleProgressUpdate() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    updateProgress()
  })
}

function updateProgress() {
  const el = contentRef.value
  if (!el) {
    readingProgress.value = 0
    return
  }

  const rect = el.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  // 正文顶部进入视口前为 0，正文底部离开视口后为 100
  const scrollableDistance = Math.max(rect.height - viewportHeight, 0)
  const scrolled = Math.min(Math.max(-rect.top, 0), scrollableDistance)

  if (rect.height <= viewportHeight) {
    // 正文不超过一屏：正文进入视口即视为读完
    readingProgress.value = rect.bottom <= viewportHeight && rect.top < viewportHeight ? 100 : 0
  } else if (scrollableDistance === 0) {
    readingProgress.value = 0
  } else {
    readingProgress.value = (scrolled / scrollableDistance) * 100
  }
}

function goBack() {
  router.push('/')
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<style scoped>
.article-detail {
  max-width: 800px;
  margin: 0 auto;
  padding-top: 20px;
}

.reading-progress-track {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 2000;
  background-color: transparent;
  pointer-events: none;
}

.reading-progress-thumb {
  height: 100%;
  background-color: #409eff;
  transition: width 0.1s linear;
}

.article-header {
  margin-bottom: 20px;
}

.article-title {
  font-size: 28px;
  color: #303133;
  margin-bottom: 12px;
}

.article-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.article-date {
  color: #909399;
  font-size: 14px;
}

.article-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.article-content {
  line-height: 1.8;
  font-size: 16px;
}

.article-content :deep(h1) {
  font-size: 24px;
  margin: 24px 0 16px;
  color: #303133;
}

.article-content :deep(h2) {
  font-size: 20px;
  margin: 20px 0 12px;
  color: #303133;
}

.article-content :deep(h3) {
  font-size: 18px;
  margin: 16px 0 8px;
  color: #303133;
}

.article-content :deep(p) {
  margin-bottom: 16px;
}

.article-content :deep(pre) {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.article-content :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 14px;
}

.article-content :deep(ul),
.article-content :deep(ol) {
  margin-bottom: 16px;
  padding-left: 24px;
}

.article-content :deep(li) {
  margin-bottom: 8px;
}

.article-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.article-content :deep(th),
.article-content :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 8px 12px;
  text-align: left;
}

.article-content :deep(th) {
  background-color: #f5f7fa;
}

.back-button {
  margin-top: 20px;
}
</style>
