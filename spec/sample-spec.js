'use babel'

/* global test, it, expect */
/*  eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-expressions */


import { expect } from 'chai'

describe('mocha chai', () => {
  it('tastes spicy and sweet', () => {
    const mocha = { sweet: true }
    const chai = { spicy: true }
    const mochaChai = Object.assign({}, mocha, chai)

    expect(mochaChai.sweet).to.equal(true)
    expect(mochaChai.spicy).to.equal(true)
  })
})

describe('atom globals', () => {
  it('exists', () => {
    expect(atom.notifications).to.exist
  })
})


// test('jest', () => {
//   it('is not a purple unicorn', () => {
//     expect('jest').not.toEqual('purple unicorn')
//   })
// })
//
// test('atom globals', () => {
//   it('exists', () => {
//     expect(atom.notifications).toBeDefined()
//   })
// })
