import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header';
import ModelCard from './components/ModelCard';
import AccuracyChart from './components/AccuracyChart';
import ModelTable from './components/ModelTable';
import ListingAssistant from './components/ListingAssistant';
import EarningsSimulator from './components/EarningsSimulator';
import { RefreshCcw, LayoutDashboard, Database, Shield, Zap, Sparkles, ChevronDown, DollarSign, Clock, ShieldCheck, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API from './config/api';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [inventory, setInventory] = useState({});
  const [forecast, setForecast] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchInitialData = async () => {
    try {
      const [prodRes, summaryRes, invRes] = await Promise.all([
        axios.get(API.PRODUCTS),
        axios.get(API.ANALYTICS),
        axios.get(API.MODELS_INVENTORY)
      ]);
      setProducts(prodRes.data);
      setSummary(summaryRes.data);
      setInventory(invRes.data);
      if (prodRes.data.length > 0) {
        setSelectedProductId(prodRes.data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductData = async (pId) => {
    if (!pId) return;
    try {
      const forecastRes = await axios.post(API.PREDICT_DEMAND, {
        product_id: pId,
        periods: 30
      });
      setForecast(forecastRes.data.forecast);
    } catch (err) {
      console.error(`Failed to fetch data for product ${pId}:`, err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchProductData(selectedProductId);
    }
  }, [selectedProductId]);

  const triggerRetrain = async (type) => {
    try {
      await axios.post(`${API.TRIGGER_RETRAIN}?product_id=${selectedProductId}&model_type=${type}`);
      alert(`Retraining triggered for ${selectedProductId} (${type})`);
    } catch (err) {
      alert("Failed to trigger retraining.");
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId) || {};
  const productModels = inventory[selectedProductId] || { demand: [], price: [] };
  const latestDemand = productModels.demand[productModels.demand.length - 1] || {};
  const latestPrice = productModels.price[productModels.price.length - 1] || {};

  return (
    <div className="min-h-screen bg-brand-gray-bg font-sans selection:bg-brand-lime selection:text-white">
      <Header />

      <main className="max-w-7xl mx-auto px-10 py-12">
        {/* Navigation & Product Selector */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8 mb-12">
          <div className="flex flex-wrap justify-center gap-4 bg-white p-2 rounded-pill shadow-soft border border-gray-100">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-2.5 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-brand-navy text-white' : 'text-text-secondary hover:bg-brand-gray-bg'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('assistant')}
              className={`px-6 py-2.5 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'assistant' ? 'bg-brand-lime text-white' : 'text-text-secondary hover:bg-brand-gray-bg'}`}
            >
              <Sparkles className="w-4 h-4" />
              Listing Hub
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-6 py-2.5 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'simulator' ? 'bg-brand-navy text-white' : 'text-text-secondary hover:bg-brand-gray-bg'}`}
            >
              <DollarSign className="w-4 h-4" />
              Simulator
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="relative group">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="appearance-none bg-white border border-gray-100 px-10 py-3.5 rounded-pill shadow-soft text-sm font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-lime pr-16"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Dashboard Title & Summary */}
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-4xl font-extrabold text-brand-navy tracking-tight">{selectedProduct.name}</h2>
                  <p className="text-text-secondary font-medium mt-2">Intelligence monitoring for {selectedProduct.category}</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white px-6 py-3 rounded-soft border border-gray-100 shadow-soft flex items-center gap-3">
                    <Clock className="w-4 h-4 text-brand-lime" />
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">Best Publishing Time</p>
                      <p className="text-xs font-bold text-brand-navy">Tuesday, 18:00 (Peak Demand)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => fetchInitialData()}
                    className="btn-outline flex items-center gap-3 bg-white border-0 shadow-soft"
                  >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Sync All
                  </button>
                </div>
              </div>

              {/* Top Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                {[
                  { label: 'Platform Sales', value: summary.total_sales?.toLocaleString() || '0', icon: Zap, color: 'text-brand-lime' },
                  { label: 'Avg Market Price', value: `$${summary.avg_price?.toFixed(2) || '0'}`, icon: LayoutDashboard, color: 'text-brand-navy' },
                  { label: 'Data Points', value: summary.total_records || '0', icon: Database, color: 'text-brand-navy' },
                  { label: 'System Status', value: 'Live', icon: Shield, color: 'text-status-success' },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-8 rounded-soft-xl border border-gray-100 shadow-glow flex flex-col gap-4 relative overflow-hidden group"
                  >
                    <div className="p-3 bg-brand-gray-bg rounded-soft w-fit">
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] font-black">{stat.label}</p>
                      <p className="text-2xl font-black text-brand-navy mt-1 tabular-nums">{stat.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Market Performance Grid (Admin View) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12 mb-12">
                {[
                  { label: "Active Listings", value: `${products.length}`, trend: "Live", icon: ShieldCheck, color: "text-brand-lime" },
                  { label: "Avg. Market Price", value: `$${summary.avg_price?.toFixed(0) || '0'}`, trend: summary.avg_price > 100 ? 'Premium' : 'Budget', icon: DollarSign, color: "text-brand-navy" },
                  { label: "Categories", value: `${[...new Set(products.map(p => p.category))].length}`, trend: "Diversified", icon: TrendingUp, color: "text-brand-lime" },
                  { label: "Total Data Points", value: `${summary.total_records || 0}`, trend: "Growing", icon: Sparkles, color: "text-brand-navy" }
                ].map((stat, i) => (
                  <div key={i} className="card-soft p-6 bg-white border border-gray-100 shadow-soft">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 rounded-soft bg-opacity-10 ${stat.color.replace('text', 'bg')}`}>
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${stat.trend.startsWith('+') || stat.trend.includes('Top') ? 'text-brand-lime' : 'text-text-secondary'}`}>
                        {stat.trend}
                      </span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">{stat.label}</p>
                    <p className="text-xl font-black text-brand-navy">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Model Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
                <div className="lg:col-span-1 flex flex-col gap-8">
                  <ModelCard
                    name="Demand Predictor"
                    type="demand"
                    version={latestDemand.version}
                    metric="MAPE"
                    score={latestDemand.metrics?.mape}
                    status={latestDemand.version ? "success" : "warning"}
                    onTrigger={() => triggerRetrain('demand')}
                  />
                  <ModelCard
                    name="Price Elasticity"
                    type="price"
                    version={latestPrice.version}
                    metric="MAE"
                    score={latestPrice.metrics?.mae}
                    status={latestPrice.version ? "success" : "warning"}
                    onTrigger={() => triggerRetrain('price')}
                  />
                </div>

                <div className="lg:col-span-2">
                  <AccuracyChart
                    title="Demand Trends"
                    data={forecast}
                  />
                </div>
              </div>

              {/* History Table */}
              <div className="grid grid-cols-1 gap-12">
                <ModelTable
                  title="Version History"
                  inventory={[...productModels.demand, ...productModels.price].reverse()}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'assistant' && (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ListingAssistant />
            </motion.div>
          )}

          {activeTab === 'simulator' && (
            <motion.div
              key="simulator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <EarningsSimulator products={products} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 py-12 text-center border-t border-gray-100 bg-white">
        <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.5em]">Powered by SmartAI Intelligence Platform</p>
      </footer>
    </div>
  );
}

export default App;
