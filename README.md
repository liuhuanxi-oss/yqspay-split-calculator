# 有钱收分账计算器 · YQSPay Split Calculator

免费开源的分账规则试算工具。计算平台抽佣、供应商货款、门店所得与手续费承担，明确每一分钱的分配方式。适合产品经理、平台开发者与商户核对分账方案。

由 **有钱收 / YQSPay** 提供。[在线使用](https://liuhuanxi-oss.github.io/yqspay-split-calculator/) · [English](README.en.md) · [有钱收智能分账](https://www.yqspay.com/smart-settlement?utm_source=github&utm_medium=open-source&utm_campaign=yqspay-split-calculator) · [有钱收对账助手](https://github.com/liuhuanxi-oss/yqspay-reconcile)

![有钱收分账计算器：比例、手续费与各方净额明细](docs/preview.png)

## 功能

- 比例分配、固定金额、一个剩余金额接收方，支持 1–50 方。
- 手续费支持订单费率加固定费用，先扣后分、指定方承担、按分配额分摊三种模式。
- 精确整数分运算，按最大余数规则补分，结果逐分守恒。
- 本地浏览器计算，JSON 规则导入、JSON / CSV 结果导出。
- 命令行与可复用的 JavaScript 计算库，运行时零第三方依赖。
- 无登录、无账单上传、无追踪脚本，MIT 许可。

这是规则试算工具，不发起支付、分账、转账或资金结算，结果不是到账证明。实际通道规则与签约费率须另行确认。

## 立即运行

需要 Node.js 22+，基本运行和核心测试无需安装依赖：

```sh
git clone https://github.com/liuhuanxi-oss/yqspay-split-calculator.git
cd yqspay-split-calculator
npm run dev
```

打开 **http://127.0.0.1:4319**。Windows 可双击 `start-windows.cmd`；关闭窗口即停止，重启电脑后需重新双击。

## 一个明确的例子

订单 1,000 元，手续费率 **0.38%（仅演示，可修改，不是服务报价）**，先扣后分。基数为 996.20 元：

| 分配方 | 规则 | 预计净额 |
| --- | --- | ---: |
| 平台 | 基数 × 5% | 49.81 元 |
| 供应商 | 基数 × 30% | 298.86 元 |
| 门店 | 接收剩余金额 | 647.53 元 |

手续费 3.80 元 + 各方净额 996.20 元 = 订单金额 1,000.00 元。

若改成按订单原金额分配、平台承担手续费，则分配额分别为 50 / 300 / 650 元，平台净额为 46.20 元。若各方按分配额分摊手续费，则分别承担 0.19 / 1.14 / 2.47 元。

## 计算约定

1. 只支持人民币单笔正金额试算；金额单位元，最多两位小数；比例单位百分数，最多两位小数，范围 0–100。
2. 手续费 = 订单原金额 × 费率（四舍五入到分）+ 固定手续费，无最低费、封顶费、退款返费或阶梯计价。
3. “先扣后分”的基数为扣费后金额；另外两种模式的基数为订单原金额。比例始终基于此基数，**不先扣除固定金额**。
4. 比例分配精确总额整体四舍五入到分。各方先取整分，所需补分按小数余数从大到小分配，同余数按列表顺序；余款归唯一剩余接收方。
5. 分摊手续费时，同样按分配额权重使用最大余数规则，总分摊额等于总手续费。
6. 必须且只能有一个剩余接收方，即使其所得为零。超额规则、手续费大于订单金额、指定方不足承担手续费，均报错，不自动缩减比例或产生负余额。

[完整规则与常见问题](docs/calculation.md)。真实接口可能采用不同规则，本工具不是任何支付机构协议的实现。

## 命令行和作为库使用

```sh
node bin/split.mjs --input examples/platform.json --out reports/result.json
node bin/split.mjs --input examples/platform.json --csv --out reports/result.csv
```

输出已存在时拒绝覆盖。JSON 规则结构见 [examples/platform.json](examples/platform.json)。结果保留标准化 `config`，网页可重新导入完整结果。

```js
import { calculate } from './src/core.js';
const result = calculate({
  total: '1000.00',
  fee: { rate: '0', fixed: '0', mode: 'before', participantId: '' },
  participants: [
    { id: 'platform', name: '平台', kind: 'percent', value: '5' },
    { id: 'store', name: '门店', kind: 'remainder', value: '' }
  ]
});
console.log(result.rows[0].netCents); // 5000，单位分
```

金额整数分最大值为 JavaScript 安全整数 9007199254740991；乘除中间值使用 BigInt。导出金额为整数分字段和格式化元金额，不使用浮点金额参与分配。

## 验证与部署

```sh
npm test
npm run build
```

`dist/` 可发布至 GitHub Pages 或静态服务器。自动工作流测试通过后构建部署。浏览器验收：`npm ci` 安装开发依赖，启动本地服务，再执行 `npm run test:browser`；默认使用本机 Edge，可通过 `BROWSER_CHANNEL=chrome` 或 `TEST_URL` 改变浏览器和验收地址。

## 隐私与使用边界

规则只保留在当前页面内存，刷新会清除，下载文件仍保留在本机。静态托管平台可能记录页面访问日志；本工具不上传规则或调用支付接口。导出 CSV 对公式开头文本加单引号保护。

不支持多级递归、退款回退、跨币种、税额计算、实际分账资格判断。请勿在公开 Issue 上传真实商户资料、密钥或合同。

## 有钱收开源工具

需要核对支付账单，使用[有钱收对账助手](https://liuhuanxi-oss.github.io/yqspay-reconcile/)。需要将规则用于实际交易，可了解[有钱收智能分账服务](https://www.yqspay.com/smart-settlement)。两款开源工具均可独立使用，无需开通有钱收账户。
