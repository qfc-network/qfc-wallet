import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, Brain, Send, ChevronDown } from 'lucide-react';
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

type Tab = 'lookup' | 'submit';

type DeadlineOption = {
  label: string;
  minutes: number;
};

export default function Inference({ onBack }: { onBack: () => void }) {
  const { network } = useWalletStore();
  const t = useTranslation();

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('lookup');

  // Lookup state
  const [taskId, setTaskId] = useState('');
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Submit state
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [deadlineMinutes, setDeadlineMinutes] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const deadlineOptions: DeadlineOption[] = [
    { label: t.inference.deadline5min, minutes: 5 },
    { label: t.inference.deadline15min, minutes: 15 },
    { label: t.inference.deadline30min, minutes: 30 },
    { label: t.inference.deadline1h, minutes: 60 },
  ];

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const res = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'qfc_getInferenceStats',
          params: [],
        }),
      });
      const json = await res.json();
      if (json.error) {
        setModelsError(t.inference.failedToLoadModels);
      } else if (json.result?.models) {
        setModels(json.result.models);
        if (json.result.models.length > 0 && !selectedModel) {
          setSelectedModel(json.result.models[0]);
        }
      } else {
        setModels([]);
      }
    } catch {
      setModelsError(t.inference.failedToLoadModels);
    } finally {
      setModelsLoading(false);
    }
  }, [network.rpcUrl, t.inference.failedToLoadModels, selectedModel]);

  useEffect(() => {
    if (activeTab === 'submit' && models.length === 0 && !modelsLoading) {
      fetchModels();
    }
  }, [activeTab, models.length, modelsLoading, fetchModels]);

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
    setSubmitError('');
    setSubmitSuccess('');

    if (!selectedModel) {
      setSubmitError(t.inference.modelRequired);
      return;
    }
    if (!prompt.trim()) {
      setSubmitError(t.inference.promptRequired);
      return;
    }
    if (!maxFee || isNaN(Number(maxFee)) || Number(maxFee) <= 0) {
      setSubmitError(t.inference.feeRequired);
      return;
    }

    setSubmitting(true);

    try {
      // Convert QFC to wei (hex)
      const feeWei = BigInt(Math.floor(Number(maxFee) * 1e18));
      const feeHex = '0x' + feeWei.toString(16);

      // Calculate deadline as unix timestamp
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      const res = await fetch(network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'qfc_submitInferenceTask',
          params: [{
            modelId: selectedModel,
            prompt: prompt.trim(),
            maxFee: feeHex,
            deadline: deadlineTimestamp,
          }],
        }),
      });

      const json = await res.json();
      if (json.error) {
        setSubmitError(json.error.message || t.inference.submitError);
      } else if (json.result?.taskId) {
        const newTaskId = json.result.taskId;
        setSubmitSuccess(t.inference.taskSubmitted);

        // Reset form
        setPrompt('');
        setMaxFee('');

        // Auto-switch to lookup tab with task ID pre-filled
        setTimeout(() => {
          setTaskId(newTaskId);
          setActiveTab('lookup');
          setSubmitSuccess('');
          setTask(null);
          setError('');
        }, 1500);
      } else {
        setSubmitError(t.inference.submitError);
      }
    } catch {
      setSubmitError(t.inference.submitError);
    } finally {
      setSubmitting(false);
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

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('lookup')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'lookup'
                ? 'bg-qfc-500 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search size={14} />
            {t.inference.tabLookup}
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'submit'
                ? 'bg-qfc-500 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send size={14} />
            {t.inference.tabSubmit}
          </button>
        </div>
      </div>

      {/* Lookup Tab */}
      {activeTab === 'lookup' && (
        <>
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
        </>
      )}

      {/* Submit Tab */}
      {activeTab === 'submit' && (
        <div className="flex-1 px-4 overflow-y-auto pb-4">
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            {/* Model Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.inference.model}
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={modelsLoading}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400 appearance-none pr-8"
                >
                  {modelsLoading && (
                    <option value="">{t.inference.loadingModels}</option>
                  )}
                  {!modelsLoading && models.length === 0 && (
                    <option value="">{modelsError || t.inference.noModelsAvailable}</option>
                  )}
                  {!modelsLoading && models.length > 0 && !selectedModel && (
                    <option value="">{t.inference.selectModel}</option>
                  )}
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.inference.prompt}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.inference.promptPlaceholder}
                rows={4}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400 resize-none"
              />
            </div>

            {/* Max Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.inference.maxFeeLabel}
              </label>
              <input
                type="number"
                value={maxFee}
                onChange={(e) => setMaxFee(e.target.value)}
                placeholder={t.inference.maxFeePlaceholder}
                step="0.001"
                min="0"
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-qfc-400"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t.inference.deadlineLabel}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {deadlineOptions.map((opt) => (
                  <button
                    key={opt.minutes}
                    onClick={() => setDeadlineMinutes(opt.minutes)}
                    className={`px-2 py-2 rounded-xl text-xs font-medium transition-colors ${
                      deadlineMinutes === opt.minutes
                        ? 'bg-qfc-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {submitError}
              </div>
            )}

            {/* Submit Success */}
            {submitSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">
                {submitSuccess}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedModel || !prompt.trim() || !maxFee}
              className="w-full py-3 bg-qfc-500 text-white rounded-xl text-sm font-medium hover:bg-qfc-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <span className="animate-pulse">{t.inference.submitting}</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send size={14} />
                  {t.inference.submitButton}
                </span>
              )}
            </button>
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
