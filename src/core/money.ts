import Decimal from 'decimal.js';

export const d = (n: number | string | Decimal) => new Decimal(n);
export const toNumber = (x: Decimal) => Number(x.toFixed(2));

export const mul = (a: number, b: number) => d(a).mul(b);
export const add = (a: number, b: number) => d(a).add(b);
export const sub = (a: number, b: number) => d(a).sub(b);

export const sum = (arr: (number | Decimal)[]) =>
	arr.reduce<Decimal>((acc, v) => acc.add(v instanceof Decimal ? v : d(v)), d(0));
