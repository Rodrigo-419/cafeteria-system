/**
 * Prohíbe el uso de style={{...}} en JSX.
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prohibido usar inline styles style={{...}}',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      forbidden: 'No se permiten estilos inline (style={{}}). Usa clases de Tailwind o componentes del sistema de diseño.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== 'style') {
          return
        }
        if (node.value && node.value.type === 'JSXExpressionContainer') {
          context.report({ node, messageId: 'forbidden' })
        }
      },
    }
  },
}
