import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Wrench, Plus, Package, X, Building2, Edit2, Trash2, Printer as PrinterIcon, History, Layers, AlertTriangle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface Warehouse {
  id: number;
  name: string;
  location: string;
}

interface InventoryItem {
  id: number;
  warehouse_id: number;
  item_code: string;
  name: string;
  lot_number: string;
  page_yield?: number;
  quantity_total: number;
  quantity_used: number;
}

interface Printer {
  id: number;
  ip_address: string;
  hostname?: string;
  model?: string;
  location?: string;
}

interface UsageLog {
  id: number;
  inventory_item_id: number;
  action: string;
  quantity: number;
  printer_id?: number;
  serial_number?: string;
  timestamp: string;
  item_name?: string;
  item_code?: string;
  printer_ip?: string;
}

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'logs'>('stock');
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Modal states
  const [showWhModal, setShowWhModal] = useState(false);
  const [whForm, setWhForm] = useState({ name: '', location: '' });
  
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({ 
    warehouse_id: 0, item_code: '', name: '', lot_number: '', page_yield: '', quantity_total: 1 
  });

  const [showUseModal, setShowUseModal] = useState(false);
  const [useForm, setUseForm] = useState({ item_id: 0, printer_id: 0, serial_number: '', quantity: 1 });

  useEffect(() => {
    fetchData();
    fetchPrinters();
  }, []);
  
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [whRes, itemsRes] = await Promise.all([
        api.get('/inventory/warehouses'),
        api.get('/inventory/items')
      ]);
      setWarehouses(whRes.data);
      setItems(itemsRes.data);
      
      if (whRes.data.length > 0 && itemForm.warehouse_id === 0) {
        setItemForm(prev => ({ ...prev, warehouse_id: whRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
      addToast('error', "Failed to fetch inventory data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await api.get('/printers');
      setPrinters(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/logs');
      setLogs(res.data);
    } catch (err) {
      console.error(err);
      addToast('error', "Failed to fetch usage logs");
    } finally {
      setLoading(false);
    }
  };

  const submitUseItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/inventory/items/${useForm.item_id}/use`, null, { 
        params: { 
          quantity: useForm.quantity,
          printer_id: useForm.printer_id === 0 ? null : useForm.printer_id,
          serial_number: useForm.serial_number || null
        } 
      });
      addToast('success', "Item used successfully");
      setShowUseModal(false);
      setUseForm({ item_id: 0, printer_id: 0, serial_number: '', quantity: 1 });
      fetchData();
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || "Failed to use item");
    }
  };

  const returnItem = async (id: number) => {
    try {
      await api.post(`/inventory/items/${id}/return`, null, { params: { quantity: 1 } });
      addToast('success', "Item returned successfully");
      fetchData();
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || "Failed to return item");
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/warehouses', whForm);
      addToast('success', "Warehouse created successfully");
      setShowWhModal(false);
      setWhForm({ name: '', location: '' });
      fetchData();
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || "Failed to create warehouse");
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...itemForm,
        page_yield: itemForm.page_yield ? parseInt(itemForm.page_yield as string) : null
      };
      
      if (editingItemId) {
        await api.put(`/inventory/items/${editingItemId}`, payload);
        addToast('success', "Stock updated successfully");
      } else {
        await api.post('/inventory/items', payload);
        addToast('success', "Stock added successfully");
      }
      
      setShowItemModal(false);
      setEditingItemId(null);
      setItemForm({ warehouse_id: warehouses[0]?.id || 0, item_code: '', name: '', lot_number: '', page_yield: '', quantity_total: 1 });
      fetchData();
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || "Failed to save stock");
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setItemForm({
      warehouse_id: item.warehouse_id,
      item_code: item.item_code,
      name: item.name,
      lot_number: item.lot_number || '',
      page_yield: item.page_yield ? String(item.page_yield) : '',
      quantity_total: item.quantity_total
    });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      addToast('success', "Item deleted successfully");
      fetchData();
    } catch (err: any) {
      addToast('error', err.response?.data?.detail || "Failed to delete item");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH')}`;
  };

  const summaryByCode = useMemo(() => {
    const summary: Record<string, { name: string; total: number }> = {};
    items.forEach(item => {
      if (!summary[item.item_code]) {
        summary[item.item_code] = { name: item.name, total: 0 };
      }
      summary[item.item_code].total += (item.quantity_total - item.quantity_used);
    });
    return Object.entries(summary).map(([code, data]) => ({
      code,
      name: data.name,
      total: data.total
    })).sort((a, b) => b.total - a.total);
  }, [items]);

  if (loading && activeTab === 'stock' && warehouses.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading inventory...</div>;
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">อะไหล่ (Inventory)</h1>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'stock' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              จัดการสต๊อก
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'logs' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              ประวัติการเบิก
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 min-h-[40px]">
          {activeTab === 'stock' && (
            <>
              <button 
                onClick={() => setShowWhModal(true)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Building2 size={16} />
                <span className="hidden sm:inline">เพิ่มคลังใหม่</span>
              </button>
              <button 
                onClick={() => {
                  if (warehouses.length === 0) {
                    addToast('error', "Please create a warehouse first");
                    return;
                  }
                  setEditingItemId(null);
                  setItemForm({ warehouse_id: warehouses[0]?.id || 0, item_code: '', name: '', lot_number: '', page_yield: '', quantity_total: 1 });
                  setShowItemModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">นำเข้าอะไหล่</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {activeTab === 'stock' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200/60 dark:border-slate-700/60 p-5 flex items-center justify-between transition-all hover:shadow-[0_4px_12px_-2px_rgba(6,81,237,0.12)]">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">รายการอะไหล่ทั้งหมด (Types)</h3>
              <p className="text-3xl font-bold text-slate-800 dark:text-white">{items.length}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-blue-600 dark:text-blue-400">
              <Package size={24} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200/60 dark:border-slate-700/60 p-5 flex items-center justify-between transition-all hover:shadow-[0_4px_12px_-2px_rgba(6,81,237,0.12)]">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">จำนวนอะไหล่คงเหลือ (Pieces)</h3>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {items.reduce((acc, item) => acc + (item.quantity_total - item.quantity_used), 0).toFixed(0)}
              </p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Layers size={24} />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200/60 dark:border-slate-700/60 p-5 flex items-center justify-between transition-all hover:shadow-[0_4px_12px_-2px_rgba(6,81,237,0.12)]">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">อะไหล่ใกล้หมด (&lt; 5 ชิ้น)</h3>
              <p className="text-3xl font-bold text-rose-500 dark:text-rose-400">
                {items.filter(item => (item.quantity_total - item.quantity_used) < 5).length}
              </p>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg text-rose-500 dark:text-rose-400">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stock' && summaryByCode.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden mb-8">
          <div className="px-5 py-3.5 border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/80 flex items-center gap-2">
            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wide">สรุปยอดคงเหลือแยกตามรหัสสินค้า</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {summaryByCode.map(sum => (
              <div key={sum.code} className="flex justify-between items-start p-3.5 rounded-lg border border-slate-200/70 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all bg-white dark:bg-slate-800 group">
                <div className="pr-3">
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 break-words group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">{sum.code}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2 leading-snug">{sum.name}</div>
                </div>
                <div className={`px-2.5 py-1 rounded-md font-bold text-sm shrink-0 flex items-center justify-center min-w-[2.5rem] mt-0.5 ${sum.total < 5 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'}`}>
                  {sum.total.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'stock' ? (
        warehouses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Warehouses Found</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">เริ่มแรกต้องสร้างคลัง (Warehouse) ก่อนถึงจะนำเข้าอะไหล่ได้ครับ</p>
            <button 
              onClick={() => setShowWhModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium transition-colors inline-flex items-center gap-2"
            >
              <Plus size={18} />
              สร้างคลังแห่งแรก
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {warehouses.map(wh => {
              const whItems = items.filter(i => i.warehouse_id === wh.id);
              return (
                <div key={wh.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{wh.name}</h2>
                    {wh.location && <p className="text-sm text-slate-500 dark:text-slate-400">{wh.location}</p>}
                  </div>
                  
                  {whItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">ไม่มีสินค้าในคลังนี้</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {whItems.map(item => (
                        <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="pt-1 hidden sm:block">
                            <Wrench className="w-5 h-5 text-slate-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">{item.item_code}</div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                              {item.name} {item.page_yield ? <span className="text-slate-500">({item.page_yield.toLocaleString()} Pages)</span> : ''}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <button 
                                onClick={() => {
                                  setUseForm({ item_id: item.id, printer_id: 0, serial_number: '', quantity: 1 });
                                  setShowUseModal(true);
                                }}
                                className="text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded transition-colors"
                              >
                                เบิกใช้งาน (Use)
                              </button>
                              {item.quantity_used > 0 && (
                                <button 
                                  onClick={() => returnItem(item.id)}
                                  className="text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded transition-colors"
                                >
                                  ดึงกลับ (Undo)
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="sm:text-right text-xs text-slate-500 dark:text-slate-400 space-y-1 mt-3 sm:mt-0 bg-slate-50 dark:bg-slate-800 p-2 sm:p-0 sm:bg-transparent rounded">
                            <div>Lot: <span className="font-medium text-slate-700 dark:text-slate-300">{item.lot_number || '-'}</span></div>
                            <div>จำนวน (รับเข้า): <span className="font-medium text-slate-700 dark:text-slate-300">{item.quantity_total.toFixed(2)}</span></div>
                            <div>ใช้ไป: <span className="font-medium text-slate-700 dark:text-slate-300">{item.quantity_used.toFixed(2)}</span></div>
                            <div className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">
                              คงเหลือ: <span className="font-bold text-indigo-600 dark:text-indigo-400">{(item.quantity_total - item.quantity_used).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                              <button onClick={() => openEditModal(item)} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors" title="Edit">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Logs Tab */
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History size={18} />
              ประวัติการเบิกใช้งานล่าสุด
            </h2>
          </div>
          {loading && logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">กำลังโหลดประวัติ...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">ยังไม่มีประวัติการเบิก/ดึงกลับ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-4 py-3">วัน/เวลา</th>
                    <th className="px-4 py-3">รหัสสินค้า / อะไหล่</th>
                    <th className="px-4 py-3">สถานะ</th>
                    <th className="px-4 py-3">ปริ้นเตอร์ที่ถูกติดตั้ง</th>
                    <th className="px-4 py-3">Serial Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{log.item_code}</div>
                        <div className="text-xs text-slate-500">{log.item_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        {log.action === 'use' ? (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-xs px-2 py-1 rounded font-medium">
                            เบิกใช้งาน (-{log.quantity})
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-xs px-2 py-1 rounded font-medium">
                            ดึงกลับ (+{log.quantity})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.printer_ip ? (
                          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                            <PrinterIcon size={14} />
                            {log.printer_ip}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">ไม่ระบุเครื่อง</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {log.serial_number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Warehouse Modal */}
      {showWhModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold">เพิ่มคลัง (Add Warehouse)</h3>
              <button onClick={() => setShowWhModal(false)} className="text-slate-400 hover:text-slate-500"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateWarehouse} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อคลัง <span className="text-red-500">*</span></label>
                <input 
                  type="text" required
                  value={whForm.name} onChange={e => setWhForm({...whForm, name: e.target.value})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. คลัง 81 : Paolo เกษตร"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">สถานที่ (Location)</label>
                <input 
                  type="text" 
                  value={whForm.location} onChange={e => setWhForm({...whForm, location: e.target.value})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. สถานที่ 00 : Paolo เกษตร"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowWhModal(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal (Add/Edit) */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold">{editingItemId ? 'แก้ไขสต๊อก (Edit Stock)' : 'เพิ่มสต๊อก (Add Stock)'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-500"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateItem} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">เลือกคลัง <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={itemForm.warehouse_id} 
                  onChange={e => setItemForm({...itemForm, warehouse_id: Number(e.target.value)})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0} disabled>-- เลือกคลัง --</option>
                  {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">รหัสสินค้า / บาร์โค้ด (ถ้ามี) <span className="text-red-500">*</span></label>
                <input 
                  type="text" required
                  value={itemForm.item_code} onChange={e => setItemForm({...itemForm, item_code: e.target.value})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. ST-FTS-CT351436"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อสินค้า (Name) <span className="text-red-500">*</span></label>
                <input 
                  type="text" required
                  value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Drum Fujifilm for Apeos"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Lot Number</label>
                  <input 
                    type="text" 
                    value={itemForm.lot_number} onChange={e => setItemForm({...itemForm, lot_number: e.target.value})}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">อายุการใช้งาน (แผ่น)</label>
                  <input 
                    type="number" min="0" step="1"
                    value={itemForm.page_yield} onChange={e => setItemForm({...itemForm, page_yield: e.target.value})}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 73000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">จำนวนรับเข้า <span className="text-red-500">*</span></label>
                <input 
                  type="number" min="0" step="0.01" required
                  value={itemForm.quantity_total} onChange={e => setItemForm({...itemForm, quantity_total: parseFloat(e.target.value) || 0})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">บันทึกสินค้า</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Use Item Modal (Log SN & Printer) */}
      {showUseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/30">
              <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">เบิกใช้งานอะไหล่ (Use Item)</h3>
              <button onClick={() => setShowUseModal(false)} className="text-emerald-600/50 hover:text-emerald-600"><X size={20}/></button>
            </div>
            <form onSubmit={submitUseItem} className="p-4 space-y-4">
              
              <div>
                <label className="block text-sm font-medium mb-1">นำไปใส่ให้ปริ้นเตอร์เครื่องไหน?</label>
                <select 
                  value={useForm.printer_id} 
                  onChange={e => setUseForm({...useForm, printer_id: Number(e.target.value)})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>-- เก็บไว้เฉยๆ (ยังไม่ระบุเครื่อง) --</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.ip_address} {p.hostname ? `(${p.hostname})` : ''} {p.location ? `- ${p.location}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Serial Number (S/N) ของชิ้นนี้</label>
                <input 
                  type="text" 
                  value={useForm.serial_number} onChange={e => setUseForm({...useForm, serial_number: e.target.value})}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  placeholder="ยิงบาร์โค้ด หรือพิมพ์ S/N"
                />
                <p className="text-xs text-slate-500 mt-1">ช่วยในการติดตามย้อนหลังว่าของชิ้นนี้ถูกเปลี่ยนเข้าเครื่องไหน</p>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setShowUseModal(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600">ยกเลิก</button>
                <button type="submit" className="px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">ยืนยันการเบิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
