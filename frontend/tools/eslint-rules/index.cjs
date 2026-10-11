const noInlineStyle = require('./no-inline-style.cjs')
const noHardcodedColor = require('./no-hardcoded-color.cjs')
module.exports = {
  rules: {
    'no-inline-style': noInlineStyle,
    'no-hardcoded-color': noHardcodedColor,
  },
}
