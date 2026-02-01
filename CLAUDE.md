# QFC Wallet

QFC Network 的浏览器插件钱包。

## 项目结构

```
qfc-wallet/
├── src/
│   ├── background/           # Service Worker 后台服务
│   │   ├── index.ts         # 入口，消息处理
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
│   │   └── pages/
│   │       ├── Home.tsx
│   │       ├── Send.tsx
│   │       ├── Receive.tsx
│   │       ├── Unlock.tsx
│   │       └── CreateWallet.tsx
│   │
│   ├── utils/               # 工具函数
│   │   ├── constants.ts     # 网络配置
│   │   ├── crypto.ts        # 加密解密
│   │   ├── storage.ts       # Chrome 存储
│   │   └── validation.ts    # 验证函数
│   │
│   └── types/               # TypeScript 类型
│       ├── wallet.ts
│       ├── transaction.ts
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
- **Extension**: Chrome Manifest V3

## 核心功能

### EIP-1193 Provider 方法
- `eth_requestAccounts` - 请求连接
- `eth_accounts` - 获取账户
- `eth_chainId` - 获取链 ID
- `eth_sendTransaction` - 发送交易
- `personal_sign` - 签名消息
- `eth_signTypedData_v4` - 签名结构化数据

### 内部方法 (wallet_*)
- `wallet_createWallet` - 创建钱包
- `wallet_importWallet` - 导入钱包
- `wallet_unlock` - 解锁
- `wallet_lock` - 锁定
- `wallet_getAllAccounts` - 获取所有账户

## 安全特性

- 私钥 AES 加密存储
- 30 分钟无操作自动锁定
- 密码永不持久化存储
- CSP 策略限制脚本来源

## 网络配置

- **测试网 Chain ID**: 9000 (0x2328)
- **主网 Chain ID**: 9001 (0x2329)
- **测试网 RPC**: https://rpc.testnet.qfc.network

## 设计文档

参考 `../qfc-design/07-WALLET-DESIGN.md`
