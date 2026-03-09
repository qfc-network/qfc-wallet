import { useState, useEffect } from 'react';
import { ArrowLeft, Bot, Plus, Fuel, XCircle, RefreshCw } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { useTranslation } from '../../i18n';
import { formatAddress } from '../../utils/validation';
import { ethers } from 'ethers';

const AGENT_REGISTRY = '0x7791dfa4d489f3d524708cbc0caa8689b76322b3';

const REGISTRY_ABI = [
  'function getAgentsByOwner(address owner) view returns (string[])',
  'function getAgent(string agentId) view returns (tuple(string agentId, address owner, address agentAddress, uint8[] permissions, uint256 dailyLimit, uint256 maxPerTx, uint256 deposit, uint256 spentToday, uint256 lastSpendDay, uint256 registeredAt, bool active))',
  'function registerAgent(string agentId, address agentAddress, uint8[] permissions, uint256 dailyLimit, uint256 maxPerTx) payable returns (string)',
  'function fundAgent(string agentId) payable',
  'function revokeAgent(string agentId)',
];

// Permission enum matching the contract
const PERMISSIONS = [
  { value: 0, label: 'InferenceSubmit' },
  { value: 1, label: 'Transfer' },
  { value: 2, label: 'StakeDelegate' },
] as const;

type AgentInfo = {
  agentId: string;
  agentAddress: string;
  deposit: string;
  dailyLimit: string;
  maxPerTx: string;
  spentToday: string;
  active: boolean;
  permissions: number[];
  registeredAt: number;
};

export default function Agents({ onBack }: { onBack: () => void }) {
  const { network, currentAddress } = useWalletStore();
  const t = useTranslation();

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register modal
  const [showRegister, setShowRegister] = useState(false);
  const [regAgentId, setRegAgentId] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPermissions, setRegPermissions] = useState<number[]>([0]);
  const [regDailyLimit, setRegDailyLimit] = useState('10');
  const [regMaxPerTx, setRegMaxPerTx] = useState('1');
  const [regDeposit, setRegDeposit] = useState('1');
  const [registering, setRegistering] = useState(false);

  // Fund modal
  const [fundingAgentId, setFundingAgentId] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('1');
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (currentAddress) loadAgents();
  }, [currentAddress, network]);

  const getProvider = () => new ethers.JsonRpcProvider(network.rpcUrl);

  const getContract = () => new ethers.Contract(AGENT_REGISTRY, REGISTRY_ABI, getProvider());

  const loadAgents = async () => {
    if (!currentAddress) return;
    setLoading(true);
    setError('');
    try {
      const contract = getContract();
      const agentIds: string[] = await contract.getAgentsByOwner(currentAddress);
      const details = await Promise.all(
        agentIds.map(async (id) => {
          const a = await contract.getAgent(id);
          return {
            agentId: a.agentId,
            agentAddress: a.agentAddress,
            deposit: ethers.formatEther(a.deposit),
            dailyLimit: ethers.formatEther(a.dailyLimit),
            maxPerTx: ethers.formatEther(a.maxPerTx),
            spentToday: ethers.formatEther(a.spentToday),
            active: a.active,
            permissions: a.permissions.map((p: bigint) => Number(p)),
            registeredAt: Number(a.registeredAt),
          } as AgentInfo;
        })
      );
      setAgents(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.agents.loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!currentAddress || !regAgentId.trim() || !regAddress.trim()) return;
    setRegistering(true);
    setError('');
    try {
      const iface = new ethers.Interface(REGISTRY_ABI);
      const data = iface.encodeFunctionData('registerAgent', [
        regAgentId.trim(),
        regAddress.trim(),
        regPermissions,
        ethers.parseEther(regDailyLimit),
        ethers.parseEther(regMaxPerTx),
      ]);
      await sendMessage('eth_sendTransaction', [{
        from: currentAddress,
        to: AGENT_REGISTRY,
        data,
        value: '0x' + ethers.parseEther(regDeposit).toString(16),
      }]);
      setShowRegister(false);
      setRegAgentId('');
      setRegAddress('');
      setRegPermissions([0]);
      setRegDailyLimit('10');
      setRegMaxPerTx('1');
      setRegDeposit('1');
      setTimeout(loadAgents, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.agents.registerError);
    } finally {
      setRegistering(false);
    }
  };

  const handleFund = async () => {
    if (!currentAddress || !fundingAgentId) return;
    setFunding(true);
    setError('');
    try {
      const iface = new ethers.Interface(REGISTRY_ABI);
      const data = iface.encodeFunctionData('fundAgent', [fundingAgentId]);
      await sendMessage('eth_sendTransaction', [{
        from: currentAddress,
        to: AGENT_REGISTRY,
        data,
        value: '0x' + ethers.parseEther(fundAmount).toString(16),
      }]);
      setFundingAgentId(null);
      setFundAmount('1');
      setTimeout(loadAgents, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.agents.fundError);
    } finally {
      setFunding(false);
    }
  };

  const handleRevoke = async (agentId: string) => {
    if (!currentAddress || !confirm(t.agents.confirmRevoke)) return;
    setError('');
    try {
      const iface = new ethers.Interface(REGISTRY_ABI);
      const data = iface.encodeFunctionData('revokeAgent', [agentId]);
      await sendMessage('eth_sendTransaction', [{
        from: currentAddress,
        to: AGENT_REGISTRY,
        data,
      }]);
      setTimeout(loadAgents, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.agents.revokeError);
    }
  };

  const togglePermission = (perm: number) => {
    setRegPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const permissionLabel = (p: number) =>
    PERMISSIONS.find((x) => x.value === p)?.label ?? `Perm(${p})`;

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-white/50 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <Bot size={20} className="text-qfc-500" />
          <h1 className="text-lg font-bold">{t.agents.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAgents} className="p-2 hover:bg-white/50 rounded-lg" title={t.common.refresh}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-qfc-500 text-white rounded-xl text-sm font-medium hover:bg-qfc-600 transition-colors"
          >
            <Plus size={14} />
            {t.agents.register}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && agents.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-400">{t.common.loading}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && agents.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center text-gray-400">
              <Bot size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t.agents.noAgents}</p>
            </div>
          </div>
        )}

        {/* Agent list */}
        {agents.map((agent) => (
          <div key={agent.agentId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="font-medium text-sm">{agent.agentId}</div>
                <div className="text-xs text-gray-500 font-mono">{formatAddress(agent.agentAddress, 6)}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                agent.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {agent.active ? t.common.active : t.agents.revoked}
              </span>
            </div>

            <div className="divide-y">
              <DetailRow label={t.agents.deposit} value={`${agent.deposit} QFC`} />
              <DetailRow label={t.agents.dailyLimit} value={`${agent.dailyLimit} QFC`} />
              <DetailRow label={t.agents.maxPerTx} value={`${agent.maxPerTx} QFC`} />
              <DetailRow label={t.agents.spentToday} value={`${agent.spentToday} QFC`} />
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">{t.agents.permissions}</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {agent.permissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                      {permissionLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {agent.active && (
              <div className="flex gap-2 p-3 border-t">
                <button
                  onClick={() => { setFundingAgentId(agent.agentId); setFundAmount('1'); }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-qfc-50 text-qfc-700 rounded-xl text-sm font-medium hover:bg-qfc-100 transition-colors"
                >
                  <Fuel size={14} />
                  {t.agents.fund}
                </button>
                <button
                  onClick={() => handleRevoke(agent.agentId)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <XCircle size={14} />
                  {t.agents.revoke}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Register Modal */}
      {showRegister && (
        <div className="absolute inset-0 bg-black/40 flex items-end z-20">
          <div className="w-full bg-white rounded-t-3xl p-5 space-y-4 max-h-[85%] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t.agents.registerAgent}</h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.agentId}</label>
              <input
                type="text"
                value={regAgentId}
                onChange={(e) => setRegAgentId(e.target.value)}
                placeholder="my-agent-001"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.agentAddress}</label>
              <input
                type="text"
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.permissions}</label>
              <div className="flex flex-wrap gap-2">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.value} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regPermissions.includes(perm.value)}
                      onChange={() => togglePermission(perm.value)}
                      className="accent-qfc-500"
                    />
                    <span className="text-sm">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.dailyLimit} (QFC)</label>
                <input
                  type="number"
                  value={regDailyLimit}
                  onChange={(e) => setRegDailyLimit(e.target.value)}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.maxPerTx} (QFC)</label>
                <input
                  type="number"
                  value={regMaxPerTx}
                  onChange={(e) => setRegMaxPerTx(e.target.value)}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.depositAmount} (QFC)</label>
              <input
                type="number"
                value={regDeposit}
                onChange={(e) => setRegDeposit(e.target.value)}
                min="0"
                step="0.1"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
              />
            </div>

            <button
              onClick={handleRegister}
              disabled={registering || !regAgentId.trim() || !regAddress.trim()}
              className="w-full py-3 bg-qfc-500 text-white rounded-xl text-sm font-medium hover:bg-qfc-600 disabled:opacity-50 transition-colors"
            >
              {registering ? t.agents.registering : t.agents.register}
            </button>
          </div>
        </div>
      )}

      {/* Fund Modal */}
      {fundingAgentId && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 p-4">
          <div className="w-full bg-white rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-bold">{t.agents.fundAgent}</h2>
            <p className="text-sm text-gray-500">{fundingAgentId}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.agents.amount} (QFC)</label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                min="0"
                step="0.1"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFundingAgentId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleFund}
                disabled={funding || !fundAmount || parseFloat(fundAmount) <= 0}
                className="flex-1 py-2.5 bg-qfc-500 text-white rounded-xl text-sm font-medium hover:bg-qfc-600 disabled:opacity-50 transition-colors"
              >
                {funding ? t.common.loading : t.agents.fund}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
