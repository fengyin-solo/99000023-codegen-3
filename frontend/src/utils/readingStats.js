// 阅读辅助统计：从 Markdown 正文生成内容概览、字数 / 代码量统计与预计阅读时间。
// 全部使用按行的线性扫描（O(n)，无回溯正则），保证正文为空、只有标题或包含
// 超长代码块（上万行）时也能快速、稳定地得到结果。

const MAX_OUTLINE_ITEMS = 12
const MAX_EXCERPT_LENGTH = 140
const MAX_SCAN_CHARS = 200000 // 极端长文兜底，避免无界处理
// 中文阅读速度约 400 字/分钟，英文代码标识符折算后同样适用
const CHARS_PER_MINUTE = 400

function normalizeText(text) {
  return String(text == null ? '' : text)
}

// 去掉行内标记符号，得到纯文本。使用的都是无嵌套量词的线性正则，
// 即使单行极长也不会发生回溯爆炸。
function inlineToPlainText(inline) {
  let result = String(inline)
  // 图片 / 链接：[文字](地址)、![文字](地址)，保留文字
  result = result.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
  // 行内代码：保留代码文本本身
  result = result.replace(/`+([^`]*)`+/g, '$1')
  // 去掉强调、删除线等标记符号
  result = result.replace(/[*_~]+/g, '')
  return result.replace(/\s+/g, ' ').trim()
}

/**
 * 单次线性扫描，解析正文得到：
 * - outline: 标题大纲（层级、文本），最多 MAX_OUTLINE_ITEMS 条
 * - excerpt: 第一段非代码正文（纯文本摘要），最多 MAX_EXCERPT_LENGTH 字
 * - charCount: 正文有效字数（中文按字、代码按字符）
 * - codeLines: 围栏代码块的代码行数
 */
export function analyzeMarkdown(markdown) {
  const source = normalizeText(markdown)
  const text = source.length > MAX_SCAN_CHARS
    ? source.slice(0, MAX_SCAN_CHARS)
    : source
  const lines = text.split('\n')

  const outline = []
  const paragraphs = []
  let paragraphBuffer = []
  let charCount = 0
  let codeLines = 0
  let inFence = false
  let fenceMarker = ''

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      paragraphs.push(paragraphBuffer.join(' '))
      paragraphBuffer = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (inFence) {
      if (line.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = ''
      } else if (line.length > 0) {
        codeLines++
        charCount += line.replace(/\s+/g, '').length
      }
      continue
    }

    // 围栏代码块开始（``` 或 ~~~，支持语言标注）
    const fenceMatch = /^(```+|~~~+)/.exec(line)
    if (fenceMatch) {
      flushParagraph()
      inFence = true
      fenceMarker = fenceMatch[1][0].repeat(3)
      continue
    }

    if (line === '') {
      flushParagraph()
      continue
    }

    // ATX 标题：# ~ ######
    const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (headingMatch) {
      flushParagraph()
      if (outline.length < MAX_OUTLINE_ITEMS) {
        const headingText = inlineToPlainText(headingMatch[2])
        if (headingText) {
          outline.push({ level: headingMatch[1].length, text: headingText })
        }
      }
      continue
    }

    // 跳过分隔线、引用符号、列表符号、表格与 HTML 标签行，正文内容仍参与统计
    const contentLine = line
      .replace(/^>\s?/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .trim()

    if (!contentLine || /^(-{3,}|\*{3,}|_{3,})$/.test(contentLine)) {
      continue
    }

    const plain = inlineToPlainText(contentLine)
    if (plain) {
      paragraphBuffer.push(plain)
      charCount += plain.replace(/\s+/g, '').length
    }
  }

  flushParagraph()

  // 摘要：取第一段不含标题的正文
  const excerpt = (() => {
    for (const paragraph of paragraphs) {
      const candidate = inlineToPlainText(paragraph)
      if (candidate) {
        return candidate.length > MAX_EXCERPT_LENGTH
          ? `${candidate.slice(0, MAX_EXCERPT_LENGTH)}…`
          : candidate
      }
    }
    return ''
  })()

  return { outline, excerpt, charCount, codeLines, truncated: source.length > MAX_SCAN_CHARS }
}

/**
 * 预计阅读时间（分钟）。
 * 无正文内容返回 0，由 UI 展示“不足 1 分钟”。
 */
export function estimateReadingMinutes({ charCount } = {}) {
  if (!charCount || charCount <= 0) return 0
  return Math.max(1, Math.ceil(charCount / CHARS_PER_MINUTE))
}

/**
 * 阅读时间展示文案
 */
export function formatReadingTime(minutes) {
  if (!minutes || minutes <= 0) return '不足 1 分钟'
  if (minutes < 60) return `约 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `约 ${hours} 小时 ${rest} 分钟` : `约 ${hours} 小时`
}
