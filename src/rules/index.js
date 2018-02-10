
const Rules = require('./rules')

const rules = new Rules()

const getRulesInstance = () => rules
const { toIgnored } = rules

module.exports = {
  Rules,
  rules: getRulesInstance,
  toIgnored,
  fromCliEngine: require('./cli-engine'),
  didChange: require('./did-change')
}
