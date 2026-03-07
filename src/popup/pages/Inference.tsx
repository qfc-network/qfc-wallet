import { useState } from 'react';
import { ArrowLeft, Search, Brain } from 'lucide-react';
import { useWalletStore } from '../store';
import { useTranslation } from '../../i18n';
import { formatAddress } from '../../utils/validation';

type TaskStatus = {
  taskId: string;
  status: string;
  submitter: string;
  taskType: string;
  modelId: string;
  createdAt: number;
  deadline: number;
  maxFee: string;
  result?: string;
  resultSize?: number;
  minerAddress?: string;
  executionTimeMs?: number;
};

export default function Inference({ onBack }: { onBack: () => void }) {
  const { network } = useWalletStore();
  const t = useTranslation();
  const [taskId, setTaskId] = useState('');
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    const id = taskId.trim();
    if (!id) return;

    setLoading(true);
    setError('');
    setTask(null);

    try {
      const res = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'qfc_getPublicTaskStatus',
          params: [id],
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error.message || t.inference.taskNotFound);
      } else if (json.result) {
        setTask(json.result);
      } else {
        setError(t.inference.taskNotFound);
      }
    } catch {
      setError(t.inference.taskNotFound);
    } finally {
      setLoading(false);
    }
  };

  const formatFee = (hex: string) => {
    try {
      const wei = BigInt(hex);
      const qfc = Number(wei) / 1e18;
      return qfc > 0.001 ? `${qfc.toFixed(4)} QFC` : `${wei.toString()} wei`;
    } catch {
      return hex;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Assigned': return 'bg-blue-100 text-blue-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'Expired': return 'bg-gray-100 text-gray-600';
      case 'Failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button onClick={onBack} className="p-1 hover:bg-white/50 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <Brain size={20} className="text-qfc-500" />
        <h1 className="text-lg font-bold">{t.inference.title}</h1>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder={t.inference.taskIdPlaceholder}
            className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
          />
          <button
            onClick={handleLookup}
            disabled={loading || !taskId.trim()}
            className="px-4 py-2.5 bg-qfc-500 text-white rounded-xl text-sm font-medium hover:bg-qfc-600 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="animate-pulse">{t.inference.lookingUp}</span>
            ) : (
              <Search size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Task Details */}
      {task && (
        <div className="flex-1 mx-4 bg-white rounded-2xl shadow-sm overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <span className="text-sm font-medium text-gray-500">
              {formatAddress(task.taskId, 8)}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(task.status)}`}>
              {task.status}
            </span>
          </div>

          <div className="divide-y">
            <DetailRow label={t.inference.taskType} value={task.taskType} />
            <DetailRow label={t.inference.model} value={task.modelId} />
            <DetailRow label={t.inference.maxFee} value={formatFee(task.maxFee)} />
            <DetailRow
              label={t.inference.submitted}
              value={new Date(task.createdAt).toLocaleString()}
            />
            <DetailRow
              label={t.inference.deadline}
              value={new Date(task.deadline).toLocaleString()}
            />
            {task.minerAddress && (
              <DetailRow label={t.inference.miner} value={formatAddress(task.minerAddress, 8)} mono />
            )}
            {task.executionTimeMs != null && (
              <DetailRow label={t.inference.executionTime} value={`${task.executionTimeMs} ms`} />
            )}
            {task.resultSize != null && (
              <DetailRow label={t.inference.resultSize} value={`${task.resultSize} bytes`} />
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!task && !error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Brain size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t.inference.taskLookup}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
