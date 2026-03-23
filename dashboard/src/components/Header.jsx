import React from 'react';
import { Sparkles, Bell, User } from 'lucide-react';

const Header = () => {
    return (
        <header className="flex items-center justify-between px-10 py-8 bg-white border-b border-gray-100">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-brand-lime rounded-soft shadow-soft transform rotate-3">
                    <Sparkles className="text-white w-7 h-7" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-brand-navy tracking-tight leading-none">SmartAI</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-text-secondary mt-1">Intelligence Platform</p>
                </div>
            </div>

            <div className="flex items-center gap-6 text-text-secondary">
                <button className="p-2.5 hover:bg-brand-gray-bg rounded-full transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-status-error rounded-full pointer-events-none" />
                </button>
                <button className="flex items-center gap-3 pl-4 border-l border-gray-100 group">
                    <div className="text-right">
                        <p className="text-xs font-bold text-text-primary group-hover:text-brand-lime transition-colors">Adem Youssfi</p>
                        <p className="text-[10px] text-text-secondary">Administrator</p>
                    </div>
                    <div className="p-2 bg-brand-navy rounded-full text-white">
                        <User className="w-5 h-5" />
                    </div>
                </button>
            </div>
        </header>
    );
};

export default Header;
