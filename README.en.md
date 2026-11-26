# YQSPay Split Calculator / 有钱收分账计算器

A free, MIT-licensed split-payment rule simulator by **YQSPay (有钱收)**. Estimate platform commissions, supplier proceeds, store revenue and fee allocation. No accounts, upload endpoints, tracking scripts or runtime dependencies.

[Live tool](https://liuhuanxi-oss.github.io/yqspay-split-calculator/) · [中文](README.md) · [YQSPay](https://www.yqspay.com) · [Reconciliation tool](https://github.com/liuhuanxi-oss/yqspay-reconcile)

Requires Node.js 22+. Clone the repository, run `npm run dev`, and open http://127.0.0.1:4319. Core usage needs no installation.

```sh
node bin/split.mjs --input examples/platform.json --out reports/result.json
node bin/split.mjs --input examples/platform.json --csv --out reports/result.csv
npm test
npm run build
```

Supports percentage allocations, fixed amounts and exactly one remainder recipient. Percentage rules always apply to the entire distributable base, not the balance after fixed allocations. Fees are calculated on the original order, rounded half-up once, then increased by a fixed fee. Choose fee-first allocation, a designated fee payer, or proportional fee sharing.

The example uses a CNY 1,000.00 order, a **demonstration-only** 0.38% fee, and fee-first allocation. The CNY 996.20 base yields CNY 49.81 to the platform (5%), CNY 298.86 to the supplier (30%) and CNY 647.53 to the store. This rate is not a service quote.

Amounts and rates accept at most two decimal places. All multiplication uses BigInt; returned monetary fields are safe integer cents. Percentage payouts are rounded as a group, with largest fractional remainders receiving the extra cents; ties follow input order. Proportional fees use the same deterministic rule. Over-allocation and insufficient payer proceeds are rejected.

JSON exports contain a normalized `config` that can be re-imported. CSV exports neutralize formula-like text. Existing CLI output files are never overwritten. Browser imports are limited to 256 KB and 50 recipients.

This tool does **not** initiate payments, transfers or settlement, certify payouts, assess eligibility, calculate taxes or simulate refunds. Provider rules may differ. Use synthetic data in public reports. See [calculation rules](docs/calculation.md) and [contribution guidance](CONTRIBUTING.md).
