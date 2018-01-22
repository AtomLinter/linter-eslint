'use babel'

import { createStore as reduxCreatStore,
  combineReducers,
  applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import rulesReducer from './reducers/rules'

const reducer = combineReducers({
  rules: rulesReducer
})

export const createStore = initialState => reduxCreatStore(
  reducer,
  initialState,
  applyMiddleware(thunk),
)

export default createStore()
