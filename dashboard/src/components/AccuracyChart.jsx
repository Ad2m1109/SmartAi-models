import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const AccuracyChart = ({ data, title }) => {
    return (
        <div className="card-soft p-10 h-[450px] flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-brand-navy">{title}</h3>
                    <p className="text-xs text-text-secondary font-medium">Predictive projection models</p>
                </div>
                <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-lime" /> Target
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-indigo-glow opacity-30" /> Forecast
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full mt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#9FC401" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#9FC401" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="ds"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }}
                            dy={10}
                            minTickGap={40}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }}
                        />
                        <Tooltip
                            cursor={{ stroke: '#9FC401', strokeWidth: 1, strokeDasharray: '4 4' }}
                            contentStyle={{
                                borderRadius: '16px',
                                border: 'none',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                padding: '12px'
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="yhat"
                            stroke="#9FC401"
                            strokeWidth={4}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0, fill: '#9FC401' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AccuracyChart;
