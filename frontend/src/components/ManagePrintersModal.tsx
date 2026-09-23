import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import api, { printerService } from '../services/api';
import type { Printer } from '../types';

interface ManagePrintersModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'group' | 'smart-filter';
  entityId: number;
  entityName: string;
  initialPrinterIds: number[];
  onSaved: () => void;
}

export const ManagePrintersModal: React.FC<ManagePrintersModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  initialPrinterIds,
  onSaved
}) => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track selected IDs
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(initialPrinterIds));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(initialPrinterIds));
      fetchPrinters();
    }
  }, [isOpen, initialPrinterIds]);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      const res = await printerService.getPrinters();
      setPrinters(res.data);
    } catch (err) {
      console.error('Failed to fetch printers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (printerId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(printerId)) {
        next.delete(printerId);
      } else {
        next.add(printerId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const initialSet = new Set(initialPrinterIds);
      const toAdd = Array.from(selectedIds).filter(id => !initialSet.has(id));
      const toRemove = initialPrinterIds.filter(id => !selectedIds.has(id));
      
      const endpointBase = entityType === 'group' ? '/groups' : '/smart-filters';
      
      // Execute all adds
      for (const id of toAdd) {
        await api.post(`${endpointBase}/${entityId}/printers/${id}`);
      }
      // Execute all removes
      for (const id of toRemove) {
        await api.delete(`${endpointBase}/${entityId}/printers/${id}`);
      }
      
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save printer assignments', err);
      alert('Failed to save printer assignments');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const filteredPrinters = printers.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const hostname = (p.hostname || '').toLowerCase();
    const ip = (p.ip_address || '').toLowerCase();
    return hostname.includes(query) || ip.includes(query);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-100 dark:border-gray-700">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Manage Printers
            </h2>
            <p className="text-sm text-gray-500">
              {entityType === 'group' ? 'Group' : 'Smart Filter'}: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{entityName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search printers by IP or Hostname..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPrinters.map(printer => (
                <label 
                  key={printer.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(printer.id)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                    checked={selectedIds.has(printer.id)}
                    onChange={() => handleToggle(printer.id)}
                  />
                  <div className="ml-3 flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {printer.ip_address}
                    </span>
                    <span className="text-xs text-gray-500">
                      {printer.hostname || printer.model || 'Unknown Hostname'}
                    </span>
                  </div>
                  {printer.location && (
                    <span className="ml-auto text-xs text-gray-500 truncate max-w-[150px]">
                      {printer.location}
                    </span>
                  )}
                </label>
              ))}
              {filteredPrinters.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No printers found matching "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Selected: <span className="font-bold">{selectedIds.size}</span> printers
          </span>
          <div className="space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
