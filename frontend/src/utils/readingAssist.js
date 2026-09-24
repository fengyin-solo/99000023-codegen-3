// 阅读辅助区的纯函数工具：内容概览、预计阅读时间。
// 所有函数都容忍空值与异常输入，保证正文为空、只有标题或
// 包含超长代码块时页面依然稳定渲染。

const MAX_OUTLINE_ITEMS = 10
const CHINESE_CHARS_PER_MINUTE = 300
const ENGLISH_WORDS_PER_MINUTE = 200

// 移除围栏代码块（闭合或未闭合）
function stripFencedCodeBlocks(markdown) {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ')
}

// 在移除围栏代码块的基础上，把行内代码还原为文字内容，
// 避免代码内容干扰概览提取和阅读时长估算
export function stripCodeBlocks(markdown) {
  return stripFencedCodeBlocks(markdown)
    .replace(/`([^`\n]*)`/g, '$1')
}

function cleanInlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim()
}

// 从正文中提取 ATX 标题（# ~ ######）作为内容概览。
// 只剥离围栏代码块，在原始行上匹配标题，避免行内代码被误判为标题。
// 返回 { items, total }，items 按 maxItems 截断以保证长文稳定展示
export function extractOutline(markdown, maxItems = MAX_OUTLINE_ITEMS) {
  const source = stripFencedCodeBlocks(markdown)
  const headings = []
  for (const line of source.split('\n')) {
    const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/)
    if (!match) continue
    const text = cleanInlineMarkdown(match[2])
    if (text) {
      headings.push({ level: match[1].length, text })
    }
  }
  return {
    items: headings.slice(0, maxItems),
    total: headings.length
  }
}

// 正文没有标题时的兜底概览：取纯文本摘要
export function buildExcerpt(markdown, maxLength = 120) {
  const source = stripCodeBlocks(markdown)
  const cleaned = source
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned
}

// 预计阅读时间（分钟），中文按字数、英文按词数估算，至少 1 分钟
export function estimateReadingTime(markdown) {
  const source = stripCodeBlocks(markdown)
  if (!source.trim()) return 1
  const chineseChars = (source.match(/[\u4e00-\u9fff]/g) || []).length
  const latinWords = (source.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  const minutes = chineseChars / CHINESE_CHARS_PER_MINUTE + latinWords / ENGLISH_WORDS_PER_MINUTE
  return Math.max(1, Math.round(minutes))
}
