'use babel'

import Rules from './rules'

const rules = new Rules()

const getRulesInstance = () => rules

export default getRulesInstance

export const { toIgnored } = rules
export { Rules }
export { default as fromCliEngine } from './cli-engine'
