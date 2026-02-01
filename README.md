# QFC Wallet

Secure browser extension wallet for QFC Network.

## Features

- Create and import wallets (mnemonic / private key)
- Send and receive QFC tokens
- EIP-1193 compatible provider for DApp integration
- Auto-lock after 30 minutes of inactivity
- AES encrypted private key storage

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Load Extension in Chrome

1. Run `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` directory

## Network Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Testnet | 9000 (0x2328) | https://rpc.testnet.qfc.network |
| Mainnet | 9001 (0x2329) | https://rpc.qfc.network |

## DApp Integration

The wallet injects `window.qfc` (and `window.ethereum` for compatibility) provider into web pages.

```javascript
// Request account access
const accounts = await window.qfc.request({ method: 'eth_requestAccounts' });

// Send transaction
const txHash = await window.qfc.request({
  method: 'eth_sendTransaction',
  params: [{
    from: accounts[0],
    to: '0x...',
    value: '0x...',
  }],
});
```

## License

MIT
