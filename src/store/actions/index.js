'use babel'

/* eslint comma-dangle: ["error", "always"] */

// eslint-disable-next-line import/prefer-default-export
export const rules = {
  /**
   * Instantiates or replaces rules list with a new list
   * @prop { Object } rules  a list of eslint rules objects
   */
  REPLACE: Symbol('replace rules'),

  /**
   * Updates existing rules list according to provided diff
   * @prop { Object } changes a list of changes from a
   *                          previous rules list
   */
  UPDATE: Symbol('update rules'),

}
