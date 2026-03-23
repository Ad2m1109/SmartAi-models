import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, ChevronRight, BarChart2 } from 'lucide-react';

const ModelCard = ({ name, type, version, metric, score, status, onTrigger }) => {
    const isDemand = type === 'demand';
    const Icon = isDemand ? TrendingUp : DollarSign;

    const statusColors = {
        success: 'bg-status-success',
        warning: 'bg-status-warning',
        error: 'bg-status-error'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-soft p-8 flex flex-col gap-6 relative overflow-hidden group"
        >
            <div className="flex justify-between items-start z-10">
                <div className="p-4 bg-brand-lime bg-opacity-10 rounded-soft text-brand-lime group-hover:bg-brand-lime group-hover:text-white transition-all duration-300">
                    <Icon className="w-7 h-7" />
                </div>
                <div className={`px-4 py-1.5 rounded-pill text-[10px] font-bold tracking-widest text-white shadow-soft ${statusColors[status]}`}>
                    {status.toUpperCase()}
                </div>
            </div>

            <div className="z-10">
                <h3 className="text-xl font-bold text-brand-navy">{name}</h3>
                <p className="text-xs font-medium text-text-secondary mt-1">Platform Version {version || 'N/A'}</p>
            </div>

            <div className="flex items-end justify-between mt-4 z-10">
                <div>
                    <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] font-bold">{metric}</p>
                    <p className="text-3xl font-black text-brand-navy tabular-nums">{score ? score.toFixed(4) : '—'}</p>
                </div>
                <button
                    onClick={onTrigger}
                    className="btn-primary flex items-center gap-2 group/btn"
                >
                    Retrain
                    <ChevronRight className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>

            {/* Abstract design elements matching Allt i Allo tech feel */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-brand-indigo-glow opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-500">
                <BarChart2 className="w-48 h-48" />
            </div>
        </motion.div>
    );
};

export default ModelCard;
