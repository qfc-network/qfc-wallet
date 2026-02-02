import { useWalletStore, walletActions } from '../store';
import { formatAddress } from '../../utils/validation';
import { AlertTriangle, Globe, FileText, Send } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { TransactionRequest, SignRequest, ConnectRequest } from '../../types/transaction';

export default function ApprovalDialog() {
  const { pendingApproval, currentAddress } = useWalletStore();
  const t = useTranslation();

  if (!pendingApproval) return null;

  const handleApprove = () => {
    walletActions.approveRequest(true);
  };

  const handleReject = () => {
    walletActions.approveRequest(false);
  };

  const getHostname = (origin: string) => {
    try {
      return new URL(origin).hostname;
    } catch {
      return origin;
    }
  };

  const renderContent = () => {
    switch (pendingApproval.type) {
      case 'connect':
        return <ConnectApproval origin={pendingApproval.origin} data={pendingApproval.data as ConnectRequest} t={t} />;
      case 'transaction':
        return <TransactionApproval origin={pendingApproval.origin} data={pendingApproval.data as TransactionRequest} address={currentAddress || ''} t={t} />;
      case 'sign':
        return <SignApproval origin={pendingApproval.origin} data={pendingApproval.data as SignRequest} t={t} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <Globe size={20} className="text-gray-600" />
          </div>
          <div>
            <div className="font-semibold">{getHostname(pendingApproval.origin)}</div>
            <div className="text-xs text-gray-500">{pendingApproval.origin}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>

      {/* Actions */}
      <div className="p-4 bg-white border-t space-y-3">
        <button
          onClick={handleApprove}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          {pendingApproval.type === 'connect' ? t.approval.approve : t.common.confirm}
        </button>
        <button
          onClick={handleReject}
          className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          {t.approval.reject}
        </button>
      </div>
    </div>
  );
}

function ConnectApproval({ t }: { origin: string; data: ConnectRequest; t: ReturnType<typeof useTranslation> }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-qfc-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Globe size={32} className="text-qfc-600" />
      </div>

      <h2 className="text-xl font-bold text-gray-800 mb-2">{t.approval.connectionRequest}</h2>
      <p className="text-gray-500 mb-6">
        {t.approval.wantsToConnect}
      </p>

      <div className="bg-white rounded-xl p-4 text-left">
        <h3 className="font-medium text-gray-800 mb-2">{t.approval.connectionRequest}:</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            {t.common.address}
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            {t.common.balance}
          </li>
        </ul>
      </div>

      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
        <p className="text-sm text-yellow-800">
          {t.approval.wantsToConnect}
        </p>
      </div>
    </div>
  );
}

function TransactionApproval({
  data,
  address,
  t,
}: {
  origin: string;
  data: TransactionRequest;
  address: string;
  t: ReturnType<typeof useTranslation>;
}) {
  const valueWei = BigInt(data.value || '0');
  const valueEth = Number(valueWei) / 1e18;

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-4">
        <Send size={24} className="text-qfc-600" />
        <h2 className="text-xl font-bold text-gray-800">{t.approval.transactionRequest}</h2>
      </div>

      <div className="bg-white rounded-xl p-4 space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t.approval.from}</span>
          <span className="font-mono">{formatAddress(data.from || address, 8)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t.approval.to}</span>
          <span className="font-mono">{formatAddress(data.to, 8)}</span>
        </div>
        <div className="border-t pt-3">
          <div className="flex justify-between">
            <span className="text-gray-500">{t.approval.value}</span>
            <span className="font-bold text-lg">{valueEth.toFixed(4)} QFC</span>
          </div>
        </div>
        {data.data && data.data !== '0x' && (
          <div className="border-t pt-3">
            <span className="text-gray-500 text-sm">{t.approval.data}</span>
            <div className="bg-gray-50 rounded-lg p-2 mt-1 text-xs font-mono break-all max-h-20 overflow-y-auto">
              {data.data}
            </div>
          </div>
        )}
      </div>

      {valueEth > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">
            {t.approval.requestsTransaction}
          </p>
        </div>
      )}
    </div>
  );
}

function SignApproval({ data, t }: { origin: string; data: SignRequest; t: ReturnType<typeof useTranslation> }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-4">
        <FileText size={24} className="text-qfc-600" />
        <h2 className="text-xl font-bold text-gray-800">{t.approval.signatureRequest}</h2>
      </div>

      <p className="text-gray-500 text-center mb-4">
        {t.approval.requestsSignature}
      </p>

      <div className="bg-white rounded-xl p-4 mb-4">
        <span className="text-gray-500 text-sm">{t.approval.message}</span>
        <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm font-mono break-all max-h-40 overflow-y-auto">
          {data.message}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <p className="text-sm text-blue-800">
          {t.approval.requestsSignature}
        </p>
      </div>
    </div>
  );
}
