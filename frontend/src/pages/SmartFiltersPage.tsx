import React, { useState, useEffect } from 'react';
import { Filter, Plus, Edit2, Trash2, Printer as PrinterIcon } from 'lucide-react';
import api from '../services/api';
import { ManagePrintersModal } from '../components/ManagePrintersModal';

interface SmartFilter {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  printers?: { id: number }[];
}

export const SmartFiltersPage = () => {
  const [filters, setFilters] = useState<SmartFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SmartFilter | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [managingPrintersFilter, setManagingPrintersFilter] = useState<SmartFilter | null>(null);

  const fetchFilters = async () => {
    try {
      setLoading(true);
      const res = await api.get('/smart-filters');
      setFilters(res.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch smart filters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFilter) {
        await api.put(`/smart-filters/${editingFilter.id}`, formData);
      } else {
        await api.post('/smart-filters', formData);
      }
      setShowModal(false);
      setEditingFilter(null);
      setFormData({ name: '', description: '' });
      fetchFilters();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save smart filter');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this smart filter? Printers assigned to this filter will lose their association.')) return;
    try {
      await api.delete(`/smart-filters/${id}`);
      fetchFilters();
    } catch (err) {
      setError('Failed to delete smart filter');
    }
  };

  const openModal = (filter?: SmartFilter) => {
    if (filter) {
      setEditingFilter(filter);
      setFormData({
        name: filter.name,
        description: filter.description || ''
      });
    } else {
      setEditingFilter(null);
      setFormData({ name: '', description: '' });
    }
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Smart Filters Management
          </h1>
          <p className="text-gray-500 mt-1">Manage custom smart filters (e.g., Brands, Models).</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>Add Smart Filter</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg"></div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-500">Name</th>
                <th className="px-6 py-4 font-medium text-gray-500">Description</th>
                <th className="px-6 py-4 font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filters.map(filter => (
                <tr key={filter.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Filter size={16} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span>{filter.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{filter.description || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setManagingPrintersFilter(filter)} className="p-2 text-gray-400 hover:text-indigo-500 transition-colors" title="Manage Printers">
                        <PrinterIcon size={18} />
                      </button>
                      <button onClick={() => openModal(filter)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors" title="Edit Filter">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(filter.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete Filter">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filters.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No smart filters created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-md w-full max-w-md p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">{editingFilter ? 'Edit Smart Filter' : 'Add Smart Filter'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Filter Name (e.g. Brand/Model)</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. HP, Brother, Apeos..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Description..."
                  rows={3}
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {editingFilter ? 'Save Changes' : 'Create Filter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {managingPrintersFilter && (
        <ManagePrintersModal
          isOpen={true}
          onClose={() => setManagingPrintersFilter(null)}
          entityType="smart-filter"
          entityId={managingPrintersFilter.id}
          entityName={managingPrintersFilter.name}
          initialPrinterIds={managingPrintersFilter.printers?.map(p => p.id) || []}
          onSaved={() => {
            fetchFilters();
          }}
        />
      )}
    </div>
  );
};
