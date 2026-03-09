import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Brain, Send } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { useTranslation } from '../../i18n';
import { formatAddress } from '../../utils/validation';
import { ethers } from 'ethers';

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

type SupportedModel = {
  id: string;
  name: string;
};

export default function Inference({ onBack }: { onBack: () => void }) {
  const { network, currentAddress } = useWalletStore();
  const t = useTranslation();

  // Lookup state
  const [taskId, setTaskId] = useState('');
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Submit state
  const [models, setModels] = useState<SupportedModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [inputText, setInputText] = useState('');
  const [maxFee, setMaxFee] = useState('0.1');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ taskId?: string; error?: string } | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    if (showSubmit && models.length === 0) {
      loadModels();
    }
  }, [showSubmit]);

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const res = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'qfc_getSupportedModels',
          params: [],
        }),
      });
      const json = await res.json();
      if (json.result && Array.isArray(json.result)) {
        setModels(json.result);
        if (json.result.length > 0) {
          setSelectedModel(json.result[0].id);
        }
      }
    } catch {
      // Models unavailable
    } finally {
      setModelsLoading(false);
    }
  };

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

  const handleSubmit = async () => {
    if (!selectedModel || !inputText.trim() || !currentAddress) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const feeWei = ethers.parseEther(maxFee).toString();
      const payload = JSON.stringify({
        submitter: currentAddress,
        modelId: selectedModel,
        input: inputText.trim(),
        maxFee: feeWei,
        timestamp: Date.now(),
      });

      const signature = await sendMessage<string>('wallet_signMessage', [payload]);

      const res = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'qfc_submitPublicTask',
          params: [{ payload, signature }],
        }),
      });
      const json = await res.json();
      if (json.error) {
        setSubmitResult({ error: json.error.message || t.inference.submitError });
      } else if (json.result?.taskId) {
        setSubmitResult({ taskId: json.result.taskId });
        setInputText('');
      } else {
        setSubmitResult({ error: t.inference.submitError });
      }
    } catch (err) {
      setSubmitResult({ error: err instanceof Error ? err.message : t.inference.submitError });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (ts: number): string => {
    // Timestamps are in milliseconds; if value looks like seconds (before year 2001), convert
    const ms = ts < 1e12 ? ts * 1000 : ts;
    return new Date(ms).toLocaleString();
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

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {/* Tab toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowSubmit(false)}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
              !showSubmit ? 'bg-qfc-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Search size={14} className="inline mr-1" />
            {t.inference.taskLookup}
          </button>
          <button
            onClick={() => setShowSubmit(true)}
            className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
              showSubmit ? 'bg-qfc-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Send size={14} className="inline mr-1" />
            {t.inference.submitTask}
          </button>
        </div>

        {!showSubmit ? (
          <>
            {/* Search */}
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

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Task Details */}
            {task && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
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
                    value={formatTimestamp(task.createdAt)}
                  />
                  <DetailRow
                    label={t.inference.deadline}
                    value={formatTimestamp(task.deadline)}
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
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center text-gray-400">
                  <Brain size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t.inference.taskLookup}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Submit Task */
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            {/* Model selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.inference.selectModel}
              </label>
              {modelsLoading ? (
                <p className="text-sm text-gray-400">{t.inference.loadingModels}</p>
              ) : models.length === 0 ? (
                <p className="text-sm text-gray-400">{t.inference.noModels}</p>
              ) : (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.id}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Input text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Input
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t.inference.inputPlaceholder}
                rows={4}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400 resize-none"
              />
            </div>

            {/* Max fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.inference.maxFeeLabel}
              </label>
              <input
                type="number"
                value={maxFee}
                onChange={(e) => setMaxFee(e.target.value)}
                step="0.01"
                min="0"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
              />
            </div>

            {/* Submit result */}
            {submitResult?.taskId && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                {t.inference.submitSuccess} {formatAddress(submitResult.taskId, 8)}
              </div>
            )}
            {submitResult?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {submitResult.error}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedModel || !inputText.trim() || !currentAddress}
              className="w-full py-3 bg-qfc-500 text-white rounded-xl text-sm font-medium hover:bg-qfc-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? t.inference.submitting : t.inference.submit}
            </button>
          </div>
        )}
      </div>
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
