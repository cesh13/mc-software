import { Decimal } from 'decimal.js'

// Money is stored as an exact decimal string with two places ('1234.50').
// Never use number arithmetic on amounts.

export type Money = string

export const ZERO: Money = '0.00'

const MONEY_RE = /^-?\d+(\.\d{1,2})?$/

export function isMoney(value: unknown): value is Money {
  return typeof value === 'string' && MONEY_RE.test(value)
}

export function toMoney(value: Decimal.Value): Money {
  return new Decimal(value).toFixed(2, Decimal.ROUND_HALF_UP)
}

export function addMoney(...values: Decimal.Value[]): Money {
  return toMoney(values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)))
}

export function subMoney(a: Decimal.Value, b: Decimal.Value): Money {
  return toMoney(new Decimal(a).minus(b))
}

export function isZeroMoney(value: Decimal.Value): boolean {
  return new Decimal(value).isZero()
}

export function moneyEquals(a: Decimal.Value, b: Decimal.Value): boolean {
  return new Decimal(a).equals(b)
}

export function compareMoney(a: Decimal.Value, b: Decimal.Value): number {
  return new Decimal(a).comparedTo(b)
}
