import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Calendar, ArrowRight, Zap } from 'lucide-react';

const EarningsSimulator = ({ products }) => {
    const [selectedProductId, setSelectedProductId] = useState('');
    const [price, setPrice] = useState(100);
    const [frequency, setFrequency] = useState(5); // times per month
    const [efficiency, setEfficiency] = useState(0.8); // 80% booking rate

    const [calculation, setCalculation] = useState({
        monthly: 0,
        yearly: 0,
        potential: 0
    });

    useEffect(() => {
        if (products.length > 0 && !selectedProductId) {
            setSelectedProductId(products[0].id);
        }
    }, [products]);

    useEffect(() => {
        // Basic Simulation Logic
        const monthly = price * frequency * efficiency;
        const yearly = monthly * 12;
        const potential = monthly * 1.5; // "Boosted" potential

        setCalculation({
            monthly: Math.round(monthly),
            yearly: Math.round(yearly),
            potential: Math.round(potential)
        });
    }, [price, frequency, efficiency, selectedProductId]);

    const selectedProduct = products.find(p => p.id === selectedProductId) || {};

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Controls */}
            <div className="lg:col-span-1 flex flex-col gap-8 card-soft p-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-brand-lime rounded-soft text-white">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-brand-navy">Boost Simulator</h3>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Select Asset</label>
                        <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill text-sm font-bold focus:outline-none"
                        >
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Proposed Price</label>
                            <span className="text-sm font-black text-brand-lime">${price}</span>
                        </div>
                        <input
                            type="range" min="10" max="1000" step="10"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="accent-brand-lime h-1.5 rounded-pill"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Rentals / Month</label>
                            <span className="text-sm font-black text-brand-lime">{frequency}x</span>
                        </div>
                        <input
                            type="range" min="1" max="30"
                            value={frequency}
                            onChange={(e) => setFrequency(Number(e.target.value))}
                            className="accent-brand-navy h-1.5 rounded-pill"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Expected Efficiency</label>
                            <span className="text-sm font-black text-brand-lime">{Math.round(efficiency * 100)}%</span>
                        </div>
                        <input
                            type="range" min="0.1" max="1" step="0.1"
                            value={efficiency}
                            onChange={(e) => setEfficiency(Number(e.target.value))}
                            className="accent-brand-navy h-1.5 rounded-pill"
                        />
                    </div>
                </div>

                <div className="mt-8 p-6 bg-brand-navy rounded-soft-xl text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">SmartAI Insight</p>
                    <p className="text-xs leading-relaxed font-medium">
                        Based on current <span className="text-brand-lime font-bold">{selectedProduct.category}</span> demand,
                        a <span className="text-brand-lime font-bold">{Math.round(efficiency * 100)}%</span> efficiency is highly achievable for the <span className="text-brand-lime font-bold">{selectedProduct.name}</span>.
                    </p>
                </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-10 rounded-soft-xl border border-gray-100 shadow-glow flex flex-col justify-between h-full"
                >
                    <div>
                        <div className="p-3 bg-brand-gray-bg rounded-soft w-fit mb-6">
                            <DollarSign className="w-6 h-6 text-brand-lime" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Monthly Forecast</p>
                        <h4 className="text-5xl font-black text-brand-navy tabular-nums">${calculation.monthly.toLocaleString()}</h4>
                    </div>
                    <div className="mt-10 pt-8 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-text-secondary">Estimated Net Income</span>
                        <div className="px-3 py-1 bg-brand-lime bg-opacity-10 text-brand-lime rounded-pill text-[10px] font-black">STABLE</div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-brand-navy p-10 rounded-soft-xl shadow-glow flex flex-col justify-between h-full text-white overflow-hidden relative"
                >
                    <div className="relative z-10">
                        <div className="p-3 bg-white bg-opacity-10 rounded-soft w-fit mb-6">
                            <Zap className="w-6 h-6 text-brand-lime" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Potential Yearly Boost</p>
                        <h4 className="text-5xl font-black text-white tabular-nums">${calculation.yearly.toLocaleString()}</h4>
                    </div>
                    <div className="relative z-10 mt-10 pt-8 border-t border-white border-opacity-10 flex items-center justify-between">
                        <span className="text-xs font-bold opacity-60">Optimized Performance</span>
                        <div className="px-3 py-1 bg-brand-lime text-brand-navy rounded-pill text-[10px] font-black">+15% AI BOOST</div>
                    </div>
                    {/* Decorative Background Element */}
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-brand-lime opacity-10 rounded-full blur-3xl" />
                </motion.div>

                <div className="md:col-span-2 card-soft p-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <Calendar className="w-5 h-5 text-brand-navy" />
                            <h5 className="text-sm font-black text-brand-navy uppercase tracking-widest">Growth Pathway</h5>
                        </div>
                        <p className="text-sm text-text-secondary font-medium leading-relaxed">
                            By utilizing the <span className="text-brand-navy font-bold">SmartAI Publishing Optimizer</span>,
                            you can increase your booking efficiency by an additional 12-18% annually.
                        </p>
                    </div>
                    <button className="btn-primary flex items-center gap-4 px-10 py-5">
                        <span className="text-xs font-black uppercase tracking-widest">Activate Boost</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EarningsSimulator;
