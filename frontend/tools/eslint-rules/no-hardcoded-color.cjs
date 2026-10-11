/**
 * Prohíbe colores o tamaños hardcodeados sospechosos.
 * - Hex colors #... en classNames o strings
 * - rgb(a)/hsl(a) inline-ish in strings
 * - valores px arbitrarios en classNames? (heurístico ligero)
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prohibido colores o tamaños hardcodeados (hex/rgb/px arbitrarios). Usa variables/tokens del tema.',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      hex: 'No uses colores hex (#...). Usa clases del tema o variables CSS.',
      rgb: 'No uses colores rgb()/rgba()/hsl(). Usa clases del tema o variables CSS.',
      px: 'Evita usar px arbitrarios en clases. Usa escala de espaciado (p-*, m-*, gap-*, etc.) o tokens del sistema.',
    },
    schema: [],
  },
  create(context) {
    const hex = /#[0-9a-fA-F]{3,8}\b/
    const rgb = /\b(rgb|rgba|hsl|hsla)\s*\(/
    const pxInClass = /(?:^|[\s:])[-]?(?:p|m|gap|top|right|bottom|left|w|h|min-w|min-h|max-w|max-h|text|leading|rounded|border|inset)[^-\s]*-[0-9]+px\b/i

    function checkText(node, text) {
      if (hex.test(text)) {
        context.report({ node, messageId: 'hex' })
        return
      }
      if (rgb.test(text)) {
        context.report({ node, messageId: 'rgb' })
        return
      }
      if (pxInClass.test(text)) {
        context.report({ node, messageId: 'px' })
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          checkText(node, node.value)
        }
      },
      TemplateLiteral(node) {
        for (const q of node.quasis) {
          checkText(q, q.value.cooked ?? q.value.raw)
        }
      },
      JSXAttribute(node) {
        if (!node.value || node.value.type !== 'Literal') return
        if (typeof node.value.value === 'string') {
          checkText(node.value, node.value.value)
        }
      },
    }
  },
}
