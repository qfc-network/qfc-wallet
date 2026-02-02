import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Edit2, Copy, Check, User } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { contactStorage } from '../../utils/storage';
import { isValidAddress, formatAddress } from '../../utils/validation';
import type { Contact } from '../../types/contact';

interface AddressBookProps {
  onBack: () => void;
  onSelectAddress?: (address: string) => void;
}

export default function AddressBook({ onBack, onSelectAddress }: AddressBookProps) {
  const t = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setIsLoading(true);
    const loadedContacts = await contactStorage.getContacts();
    setContacts(loadedContacts.sort((a, b) => a.name.localeCompare(b.name)));
    setIsLoading(false);
  };

  const handleDelete = async (contact: Contact) => {
    if (confirm(t.addressBook.confirmDelete)) {
      await contactStorage.removeContact(contact.id);
      setContacts(contacts.filter((c) => c.id !== contact.id));
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleCopy = async (contact: Contact) => {
    await navigator.clipboard.writeText(contact.address);
    setCopiedId(contact.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelect = (contact: Contact) => {
    if (onSelectAddress) {
      onSelectAddress(contact.address);
      onBack();
    }
  };

  const handleSave = async (contact: Contact) => {
    if (editingContact) {
      await contactStorage.updateContact(editingContact.id, contact);
    } else {
      await contactStorage.addContact(contact);
    }
    await loadContacts();
    setShowForm(false);
    setEditingContact(null);
  };

  if (showForm) {
    return (
      <ContactForm
        contact={editingContact}
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false);
          setEditingContact(null);
        }}
        t={t}
      />
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">{t.addressBook.title}</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="p-2 bg-qfc-500 text-white rounded-lg hover:bg-qfc-600 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">{t.common.loading}</div>
        ) : contacts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <User size={48} className="mx-auto mb-4 opacity-50" />
            <p>{t.addressBook.noContacts}</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 text-qfc-600 hover:underline"
            >
              {t.addressBook.addContact}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="bg-white rounded-xl p-4 flex items-center justify-between"
              >
                <div
                  className={`flex-1 ${onSelectAddress ? 'cursor-pointer' : ''}`}
                  onClick={() => onSelectAddress && handleSelect(contact)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-qfc-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-qfc-600" />
                    </div>
                    <div>
                      <div className="font-semibold">{contact.name}</div>
                      <div className="text-sm text-gray-500 font-mono">
                        {formatAddress(contact.address, 8)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(contact)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={t.common.copy}
                  >
                    {copiedId === contact.id ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} className="text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(contact)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={t.addressBook.editContact}
                  >
                    <Edit2 size={16} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title={t.addressBook.deleteContact}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactForm({
  contact,
  onSave,
  onCancel,
  t,
}: {
  contact: Contact | null;
  onSave: (contact: Contact) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>;
}) {
  const [name, setName] = useState(contact?.name || '');
  const [address, setAddress] = useState(contact?.address || '');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');

    if (!name.trim()) {
      setError(t.addressBook.namePlaceholder);
      return;
    }

    if (!isValidAddress(address)) {
      setError(t.send.invalidAddress);
      return;
    }

    const now = Date.now();
    onSave({
      id: contact?.id || `contact_${now}`,
      name: name.trim(),
      address: address.trim(),
      createdAt: contact?.createdAt || now,
      updatedAt: now,
    });
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button onClick={onCancel} className="p-2 hover:bg-white/50 rounded-lg">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">
          {contact ? t.addressBook.editContact : t.addressBook.addContact}
        </h1>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-4">
        <div className="bg-white rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.addressBook.name}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.addressBook.namePlaceholder}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.addressBook.address}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.addressBook.addressPlaceholder}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-3">
        <button
          onClick={handleSubmit}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          {t.addressBook.save}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          {t.common.cancel}
        </button>
      </div>
    </div>
  );
}
