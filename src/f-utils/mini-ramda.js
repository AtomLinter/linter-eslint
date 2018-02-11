'use babel'

/** ***************************************************
  * Curated list of ramda functions actually in use. *
  **************************************************** */

// From standpoint of category theory, compose is preferable construct
// over pipe. But the top-down flow of pipe may reduce learning curve
// for contributors less familiar with compositional style.
//
import pipe from 'ramda/src/pipe'

import addIndex from 'ramda/src/addIndex'
import apply from 'ramda/src/apply'
import clone from 'ramda/src/clone'
import curry from 'ramda/src/curry'
import filter from 'ramda/src/filter'
import flip from 'ramda/src/flip'
import fromPairs from 'ramda/src/fromPairs'
import identity from 'ramda/src/identity'
import isNil from 'ramda/src/isNil'
import map from 'ramda/src/map'
import not from 'ramda/src/not'
import path from 'ramda/src/path'
import pluck from 'ramda/src/pluck'
import prop from 'ramda/src/prop'
import reverse from 'ramda/src/reverse'
import reduce from 'ramda/src/reduce'
import toPairs from 'ramda/src/toPairs'

export default {
  addIndex,
  apply,
  clone,
  curry,
  filter,
  flip,
  fromPairs,
  identity,
  isNil,
  map,
  not,
  path,
  pipe,
  pluck,
  prop,
  reverse,
  reduce,
  toPairs,
}
