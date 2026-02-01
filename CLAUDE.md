# QFC Wallet

QFC Network 的浏览器插件钱包。

## 项目结构

```
qfc-wallet/
├── src/
│   ├── background/           # Service Worker 后台服务
│   │   ├── index.ts         # 入口，消息处理，审批流程
│   │   └── WalletController.ts  # 钱包核心逻辑
│   │
│   ├── content/             # Content Script
│   │   └── inject.ts        # 注入脚本
│   │
│   ├── inpage/              # 页面注入
│   │   └── provider.ts      # window.qfc Provider (EIP-1193)
│   │
│   ├── popup/               # 弹窗 UI
│   │   ├── App.tsx
│   │   ├── store.ts         # Zustand 状态管理
│   │   ├── components/
│   │   │   └── ApprovalDialog.tsx  # DApp 连接/交易审批对话框
│   │   └── pages/
│   │       ├── Home.tsx         # 主页 (余额、资产、交易历史)
│   │       ├── Send.tsx         # 发送 QFC 页面
│   │       ├── SendToken.tsx    # 发送 ERC-20 代币页面
│   │       ├── Receive.tsx      # 接收页面 (QR码)
│   │       ├── Settings.tsx     # 设置页面
│   │       ├── AddToken.tsx     # 添加 ERC-20 代币
│   │       ├── Unlock.tsx       # 解锁页面
│   │       └── CreateWallet.tsx # 创建/导入钱包
│   │
│   ├── utils/               # 工具函数
│   │   ├── constants.ts     # 网络配置
│   │   ├── crypto.ts        # 加密解密
│   │   ├── prices.ts        # 代币价格 (模拟/API)
│   │   ├── storage.ts       # Chrome 存储 (wallet/tx/token/network)
│   │   └── validation.ts    # 验证函数
│   │
│   └── types/               # TypeScript 类型
│       ├── wallet.ts
│       ├── transaction.ts   # 交易记录、审批请求类型
│       ├── token.ts         # ERC-20 代币类型
│       └── network.ts
│
├── public/
│   ├── manifest.json        # Chrome Extension Manifest V3
│   └── icons/               # 扩展图标
│
├── popup.html               # 弹窗入口 HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

## 加载到 Chrome

1. 构建项目: `npm run build`
2. 打开 Chrome，访问 `chrome://extensions/`
3. 启用 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择 `dist` 目录

## 技术栈

- **UI**: React 18 + TypeScript
- **构建**: Vite
- **样式**: TailwindCSS
- **状态管理**: Zustand
- **加密**: ethers.js v6 + crypto-js
- **QR 码**: qrcode.react
- **Extension**: Chrome Manifest V3

## 核心功能

### EIP-1193 Provider 方法
- `eth_requestAccounts` - 请求连接 (需用户审批)
- `eth_accounts` - 获取账户
- `eth_chainId` - 获取链 ID
- `eth_sendTransaction` - 发送交易 (需用户审批)
- `personal_sign` - 签名消息 (需用户审批)
- `eth_signTypedData_v4` - 签名结构化数据

### 内部方法 (wallet_*)

**钱包管理**
- `wallet_createWallet` - 创建钱包
- `wallet_importWallet` - 导入钱包
- `wallet_unlock` - 解锁
- `wallet_lock` - 锁定
- `wallet_getAllAccounts` - 获取所有账户
- `wallet_switchAccount` - 切换账户

**网络**
- `wallet_getNetwork` - 获取当前网络
- `wallet_switchNetwork` - 切换网络 (testnet/mainnet)

**交易历史**
- `wallet_getTransactions` - 获取交易历史

**ERC-20 代币**
- `wallet_getTokens` - 获取代币列表
- `wallet_addToken` - 添加代币
- `wallet_removeToken` - 移除代币
- `wallet_sendToken` - 发送代币转账
- `wallet_refreshTokenBalances` - 刷新代币余额

**DApp 连接**
- `wallet_getConnectedSites` - 获取已连接站点
- `wallet_disconnectSite` - 断开站点连接
- `wallet_getPendingApproval` - 获取待审批请求
- `wallet_resolveApproval` - 处理审批请求

## 功能特性

### 已实现
- [x] 钱包创建/导入 (助记词/私钥)
- [x] 发送/接收 QFC
- [x] QR 码显示地址
- [x] 交易历史持久化
- [x] ERC-20 代币支持
- [x] ERC-20 代币转账
- [x] 代币价格显示 (模拟价格)
- [x] 交易状态更新 (pending → confirmed/failed)
- [x] 网络切换 (本地/测试网/主网)
- [x] DApp 连接审批 UI
- [x] 交易/签名审批 UI
- [x] 已连接站点管理
- [x] 30 分钟自动锁定
- [x] Service Worker 状态持久化

### 待实现
- [ ] 多语言支持 (i18n)
- [ ] 硬件钱包集成 (Ledger/Trezor)
- [ ] 代币价格 API 集成 (CoinGecko)

## 安全特性

- 私钥 AES 加密存储
- 30 分钟无操作自动锁定
- 密码永不持久化存储
- CSP 策略限制脚本来源
- DApp 连接需用户明确授权
- 交易/签名需用户确认

## 网络配置

| 网络 | Chain ID | RPC URL |
|------|----------|---------|
| 本地开发 | 9000 (0x2328) | http://127.0.0.1:8545 |
| 测试网 | 9000 (0x2328) | https://rpc.testnet.qfc.network |
| 主网 | 9001 (0x2329) | https://rpc.qfc.network |

### 本地测试账户

| 私钥 | 地址 | 余额 |
|------|------|------|
| `4242...42` (32字节) | `0x10d7812fbe50096ae82569fdad35f79628bc0084` | 1B QFC |
| `4343...43` (32字节) | `0xfd3dabd401f1b94789d89ce947be9345cfbf44c3` | 1B QFC |
| `4444...44` (32字节) | `0xb6d2be7dc3b62c39e5c5a6b744076e9c4dffb552` | 1B QFC |

## 存储结构

```typescript
// Chrome Storage Keys
qfc_wallets           // 钱包列表 (加密私钥)
qfc_current_address   // 当前地址
qfc_network           // 当前网络 (testnet/mainnet)
qfc_connected_sites   // 已连接站点 { origin: addresses[] }
qfc_tx_history_{addr} // 交易历史
qfc_tokens_{addr}     // 代币列表
```

## 设计文档

参考 `../qfc-design/07-WALLET-DESIGN.md`
