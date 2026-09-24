<template>
  <el-card class="reading-aid" shadow="never">
    <div class="reading-aid-header">
      <span class="reading-aid-title">
        <el-icon><Reading /></el-icon>
        阅读辅助
      </span>
      <div class="reading-aid-meta">
        <el-tag size="small" type="info" effect="plain">
          <el-icon><Clock /></el-icon>
          {{ readingTimeText }}
        </el-tag>
        <el-tag size="small" type="info" effect="plain">
          {{ stats.charCount }} 字<template v-if="stats.codeLines > 0"> · {{ stats.codeLines }} 行代码</template>
        </el-tag>
      </div>
    </div>

    <div class="reading-progress">
      <div class="reading-progress-label">
        <span>当前阅读进度</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <el-progress
        :percentage="progressPercent"
        :stroke-width="8"
        :show-text="false"
        class="reading-progress-bar"
      />
    </div>

    <div class="reading-overview">
      <div class="reading-overview-title">内容概览</div>
      <template v-if="stats.outline.length > 0">
        <ul class="reading-outline">
          <li
            v-for="(item, index) in stats.outline"
            :key="index"
            class="reading-outline-item"
            :style="{ paddingLeft: `${(item.level - 1) * 14}px` }"
          >
            <span
              class="reading-outline-bullet"
              :class="`level-${Math.min(item.level, 3)}`"
            ></span>
            {{ item.text }}
          </li>
        </ul>
      </template>
      <p v-else-if="stats.excerpt" class="reading-excerpt">{{ stats.excerpt }}</p>
      <p v-else class="reading-empty">暂无可提取的正文内容</p>

      <p v-if="stats.excerpt && stats.outline.length > 0" class="reading-excerpt reading-excerpt-extra">
        {{ stats.excerpt }}
      </p>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { Reading, Clock } from '@element-plus/icons-vue'
import { analyzeMarkdown, estimateReadingMinutes, formatReadingTime } from '../utils/readingStats'

const props = defineProps({
  // Markdown 正文，概览 / 阅读时间完全由它生成
  body: {
    type: String,
    default: ''
  },
  // 0 ~ 100 的阅读进度
  progress: {
    type: Number,
    default: 0
  }
})

const stats = computed(() => analyzeMarkdown(props.body))
const readingTimeText = computed(() =>
  formatReadingTime(estimateReadingMinutes(stats.value))
)
const progressPercent = computed(() => {
  const value = Math.round(props.progress)
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
})
</script>

<style scoped>
.reading-aid {
  margin-bottom: 16px;
  border: 1px solid #e4e7ed;
  background-color: #f8fafc;
}

.reading-aid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.reading-aid-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.reading-aid-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.reading-aid-meta :deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reading-progress {
  margin-bottom: 14px;
}

.reading-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}

.reading-overview {
  border-top: 1px dashed #dcdfe6;
  padding-top: 12px;
}

.reading-overview-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.reading-outline {
  list-style: none;
  padding: 0;
  margin: 0;
}

.reading-outline-item {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  color: #303133;
  line-height: 1.9;
  word-break: break-word;
}

.reading-outline-bullet {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #409eff;
  transform: translateY(-1px);
}

.reading-outline-bullet.level-2 {
  background-color: #79bbff;
}

.reading-outline-bullet.level-3 {
  background-color: #a0cfff;
}

.reading-excerpt {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
  margin: 0;
  word-break: break-word;
}

.reading-excerpt-extra {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
}

.reading-empty {
  font-size: 13px;
  color: #909399;
  margin: 0;
}
</style>
