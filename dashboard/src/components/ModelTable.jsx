import React from 'react';
import { Clock, CheckCircle, ShieldCheck } from 'lucide-react';

const ModelTable = ({ inventory, title }) => {
    return (
        <div className="card-soft overflow-hidden group">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white z-10 relative">
                <div>
                    <h3 className="text-xl font-bold text-brand-navy">{title}</h3>
                    <p className="text-xs text-text-secondary font-medium mt-1">Full version deployment history</p>
                </div>
                <span className="text-[10px] bg-brand-gray-bg px-4 py-1.5 rounded-pill font-bold tracking-widest text-text-secondary border border-gray-100 uppercase">
                    {inventory.length} Records Detected
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-brand-gray-bg bg-opacity-50 text-text-secondary text-[10px] uppercase tracking-[0.2em] font-black">
                            <th className="px-8 py-5">Version ID</th>
                            <th className="px-8 py-5">Timestamp</th>
                            <th className="px-8 py-5">Performance Metric</th>
                            <th className="px-8 py-5">Validation Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {inventory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-brand-gray-bg transition-all duration-200 group/row">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-brand-lime animate-pulse" />
                                        <span className="font-bold text-brand-navy text-sm group-hover/row:text-brand-lime transition-colors">
                                            {item.version}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-xs font-semibold text-text-secondary">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 opacity-40" />
                                        {new Date(item.training_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-text-secondary uppercase tracking-widest font-black mb-1">
                                            {Object.keys(item.metrics)[0]}
                                        </span>
                                        <span className="font-bold text-brand-navy text-base">
                                            {Object.values(item.metrics)[0].toFixed(4)}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-2 py-1.5 px-3 bg-status-success bg-opacity-5 rounded-pill w-fit border border-status-success border-opacity-10">
                                        <ShieldCheck className="w-4 h-4 text-status-success" />
                                        <span className="text-[10px] font-bold text-status-success uppercase tracking-wider">Production Ready</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ModelTable;
