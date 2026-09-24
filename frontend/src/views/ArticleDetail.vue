<template>
  <div class="article-detail" v-loading="loading">
    <div
      v-if="article"
      class="reading-progress-bar"
      :style="{ width: readingProgress + '%' }"
    ></div>

    <template v-if="article">
      <el-card class="assist-card" shadow="never">
        <template #header>
          <div class="assist-header">
            <span class="assist-title">阅读辅助</span>
            <span class="assist-reading-time">预计阅读约 {{ readingTime }} 分钟</span>
          </div>
        </template>

        <div class="assist-block">
          <div class="assist-label">内容概览</div>
          <template v-if="outlineItems.length">
            <ul class="assist-outline">
              <li
                v-for="(item, index) in outlineItems"
                :key="index"
                :style="{ paddingLeft: (Math.min(item.level, 6) - 1) * 14 + 'px' }"
              >
                {{ item.text }}
              </li>
            </ul>
            <div v-if="outlineTotal > outlineItems.length" class="assist-more">
              … 共 {{ outlineTotal }} 个章节
            </div>
          </template>
          <div v-else-if="excerpt" class="assist-excerpt">{{ excerpt }}</div>
          <div v-else class="assist-empty">本文暂无正文内容</div>
        </div>

        <div class="assist-block">
          <div class="assist-label">当前阅读进度</div>
          <el-progress :percentage="readingProgress" :stroke-width="10" />
        </div>
      </el-card>

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

        <div class="article-content" v-html="renderedContent"></div>
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
import { extractOutline, buildExcerpt, estimateReadingTime } from '../utils/readingAssist'

const route = useRoute()
const router = useRouter()

const article = ref(null)
const loading = ref(false)
const readingProgress = ref(0)

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true
})

const renderedContent = computed(() => {
  if (!article.value) return ''
  return marked(article.value.body || '')
})

const articleBody = computed(() => (article.value && article.value.body) || '')

const outline = computed(() => extractOutline(articleBody.value))
const outlineItems = computed(() => outline.value.items)
const outlineTotal = computed(() => outline.value.total)
const excerpt = computed(() => buildExcerpt(articleBody.value))
const readingTime = computed(() => estimateReadingTime(articleBody.value))

onMounted(() => {
  fetchArticle()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', handleScroll)
})

// 同一路由组件切换文章（/article/:id 参数变化）时重新加载，
// 保证概览与进度始终对应当前文章
watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchArticle()
  }
})

async function fetchArticle() {
  loading.value = true
  article.value = null
  readingProgress.value = 0
  window.scrollTo({ top: 0 })
  try {
    const { id } = route.params
    const response = await api.get(`/articles/${id}`)
    article.value = response.data
    await nextTick()
    updateProgress()
  } catch (error) {
    console.error('Failed to fetch article:', error)
  } finally {
    loading.value = false
  }
}

let scrollTicking = false
function handleScroll() {
  if (scrollTicking) return
  scrollTicking = true
  window.requestAnimationFrame(() => {
    updateProgress()
    scrollTicking = false
  })
}

function updateProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  if (scrollable <= 0) {
    // 内容不足一屏时视为已读完全部
    readingProgress.value = 100
    return
  }
  const percent = Math.round((scrollTop / scrollable) * 100)
  readingProgress.value = Math.min(100, Math.max(0, percent))
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

.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background-color: #409eff;
  z-index: 1000;
  transition: width 0.1s linear;
}

.assist-card {
  margin-bottom: 20px;
}

.assist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.assist-title {
  font-weight: bold;
  color: #303133;
}

.assist-reading-time {
  color: #909399;
  font-size: 14px;
}

.assist-block + .assist-block {
  margin-top: 16px;
}

.assist-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.assist-outline {
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
}

.assist-outline li {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.assist-more {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.assist-excerpt {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.assist-empty {
  font-size: 14px;
  color: #909399;
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
