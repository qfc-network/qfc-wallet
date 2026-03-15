import { useState, useEffect } from 'react';
import { parseWCUri, type WCSession } from '../../utils/walletconnect';

type Tab = 'connect' | 'sessions';

export default function WalletConnectPage({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('connect');
  const [uri, setUri] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<WCSession[]>([]);

  // Load active sessions
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    // In production: get from WalletConnectManager.getActiveSessions()
    const stored = await chrome.storage.local.get('qfc_wc_sessions');
    setSessions(stored.qfc_wc_sessions || []);
  };

  const handlePair = async () => {
    if (!uri.trim()) return;

    const { valid, version } = parseWCUri(uri);
    if (!valid) {
      setError('Invalid WalletConnect URI');
      return;
    }
    if (version < 2) {
      setError('WalletConnect v1 is not supported. Please use v2.');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      // Send to background to initiate pairing
      await chrome.runtime.sendMessage({
        type: 'wallet_wcPair',
        data: { uri: uri.trim() },
      });

      // Wait for session proposal (will come via message)
      setConnecting(false);
      setUri('');
      setTab('sessions');
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async (topic: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'wallet_wcDisconnect',
        data: { topic },
      });
      setSessions(sessions.filter(s => s.topic !== topic));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'connect', label: 'Connect' },
    { key: 'sessions', label: `Sessions (${sessions.length})` },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">WalletConnect</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 rounded-lg bg-gray-800/60 p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                tab === key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connect Tab */}
        {tab === 'connect' && (
          <>
            <p className="text-sm text-gray-400">
              Paste a WalletConnect URI to connect with a DApp.
            </p>

            {/* URI Input */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">WalletConnect URI</label>
              <textarea
                value={uri}
                onChange={(e) => { setUri(e.target.value); setError(''); }}
                placeholder="wc:abc123...@2?relay-protocol=irn&symKey=..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-mono text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
                rows={3}
              />
            </div>

            {/* Paste from clipboard */}
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text.startsWith('wc:')) {
                    setUri(text);
                    setError('');
                  } else {
                    setError('Clipboard does not contain a WalletConnect URI');
                  }
                } catch {
                  setError('Could not read clipboard');
                }
              }}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 text-xs text-gray-400 hover:text-white hover:border-gray-600 transition"
            >
              📋 Paste from clipboard
            </button>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handlePair}
              disabled={!uri.trim() || connecting}
              className="w-full rounded-lg bg-cyan-500 py-3 text-sm font-medium text-white hover:bg-cyan-400 disabled:opacity-50"
            >
              {connecting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Connecting...
                </span>
              ) : 'Connect'}
            </button>

            {/* How it works */}
            <div className="rounded-lg bg-gray-800/50 p-3 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-400">How to connect:</p>
              <p>1. Open a DApp and click "Connect Wallet"</p>
              <p>2. Select "WalletConnect" option</p>
              <p>3. Copy the connection URI</p>
              <p>4. Paste it above and click Connect</p>
            </div>
          </>
        )}

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          <>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <p className="text-3xl mb-2">🔗</p>
                <p className="text-sm">No active sessions</p>
                <p className="text-xs mt-1">Connect a DApp to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.topic}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* DApp icon */}
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                        {session.peer?.metadata?.icons?.[0] ? (
                          <img
                            src={session.peer.metadata.icons[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">🌐</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {session.peer?.metadata?.name || 'Unknown DApp'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {session.peer?.metadata?.url || ''}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">
                          Expires: {new Date(session.expiry * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Chains & Methods */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {Object.entries(session.namespaces || {}).map(([_ns, data]) =>
                        (data as any).chains?.map((chain: string) => (
                          <span key={chain} className="rounded bg-gray-800 px-2 py-0.5 text-[10px] text-cyan-400">
                            {chain}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Disconnect */}
                    <button
                      onClick={() => handleDisconnect(session.topic)}
                      className="mt-3 w-full rounded-lg border border-red-500/30 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
