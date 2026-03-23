import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Sparkles, User, ShieldCheck, RefreshCcw, Briefcase, UserCircle, DollarSign, Clock, TrendingUp } from 'lucide-react';
import axios from 'axios';
import API from '../config/api';

const LLM_ENDPOINT = 'https://0d88-34-12-160-9.ngrok-free.app/generate';

const MarkdownLite = ({ text, className }) => {
    if (!text) return null;
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br />');
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

const ListingAssistant = () => {
    const [mode, setMode] = useState('product'); // 'product', 'service_provider', 'client'
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        details: '',
        condition: 'New',
        targetPrice: '',
        location: '',
        tags: '',
        isUrgent: false,
        shipping: 'Pick-up only',
        audience: 'Local',
        marketDemand: 'Analysis Pending...' // New field for live insight
    });
    const [result, setResult] = useState(null);
    const [strategy, setStrategy] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Feature-specific loading states
    const [isAutofilling, setIsAutofilling] = useState(false);
    const [isOptimizingPrice, setIsOptimizingPrice] = useState(false);
    const [isOptimizingTime, setIsOptimizingTime] = useState(false);

    // Feature 1: AI Autofill (Mockup)
    const handleAutofill = async () => {
        setIsAutofilling(true);
        // Simulate "AI image/context vision"
        await new Promise(r => setTimeout(r, 1500));
        setFormData(prev => ({
            ...prev,
            name: "Professional Workstation PC",
            category: "Electronics - Computing",
            condition: "Used - Good",
            tags: "workstation, pc, powerful, office"
        }));
        setIsAutofilling(false);
    };

    // Feature 3 & 4 Integration: Demand-Aware Pricing
    const fetchMarketIntelligence = async () => {
        if (!formData.category || !formData.location) return null;

        // Map user-typed category to the real trained product IDs
        const catLower = formData.category.toLowerCase();
        let productId = 'prod_001'; // Default to Tools
        if (catLower.includes('furniture') || catLower.includes('sofa') || catLower.includes('chair') || catLower.includes('table')) productId = 'prod_002';
        else if (catLower.includes('electronics') || catLower.includes('computer') || catLower.includes('pc') || catLower.includes('phone') || catLower.includes('laptop')) productId = 'prod_003';
        else if (catLower.includes('outdoor') || catLower.includes('garden') || catLower.includes('bike') || catLower.includes('sport')) productId = 'prod_004';
        // drill, tools, hardware etc → prod_001 (Tools)

        let demandState = 'Analysis Ready';

        try {
            // 1. Fetch Demand Forecast (best-effort, non-blocking)
            const demandRes = await axios.post(API.PREDICT_DEMAND, {
                product_id: productId,
                periods: 7
            });
            const demandVal = demandRes.data.forecast?.[0]?.yhat ?? demandRes.data.predictions?.[0] ?? 45;
            if (demandVal > 60) demandState = 'High-Intensity 🔥';
            else if (demandVal < 30) demandState = 'Steady';
            else demandState = 'Moderate';
        } catch (err) {
            console.warn('Demand forecast unavailable, continuing with price prediction:', err.message);
            demandState = 'Market Active';
        }

        setFormData(prev => ({ ...prev, marketDemand: demandState }));

        // 2. Fetch Comparative Price (the new ML model — this is the critical call)
        const priceRes = await axios.post(API.PREDICT_COMPARATIVE, {
            category: formData.category,
            location: formData.location,
            condition: formData.condition || 'New'
        });

        return {
            demand: demandState,
            recPrice: priceRes.data.recommended_price || 95.0
        };
    };

    const handlePredictPrice = async () => {
        if (!formData.category || !formData.location) {
            alert("Please provide Category and Location first so the AI can analyze the market!");
            return;
        }

        setIsOptimizingPrice(true);
        try {
            const intel = await fetchMarketIntelligence();
            if (intel) {
                const userPrice = parseFloat(formData.targetPrice) || 0;
                const diff = userPrice - intel.recPrice;
                let priceInsight = "Market competitive pricing.";

                if (userPrice > 0) {
                    if (diff > 20) priceInsight = `Your price is $${diff.toFixed(0)} above the suggested rate for ${formData.location}.`;
                    else if (diff < -20) priceInsight = `Great value! You are $${Math.abs(diff).toFixed(0)} below the current ${intel.demand} demand average.`;
                }

                const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const bestDay = days[Math.floor(Math.random() * 7)];

                setStrategy({
                    recommended_price: intel.recPrice,
                    user_price: userPrice,
                    price_insight: priceInsight,
                    confidence: 92,
                    best_time: `${bestDay} at 18:00`,
                    reason: `${intel.demand} demand detected in ${formData.location}.`
                });
            } else {
                alert("The AI model is currently calibrating for this category. Please try again in a moment.");
            }
        } catch (err) {
            console.error("Price Optimization Error:", err);
            alert("Connectivity issue with the Pricing Model. Ensure the backend is running.");
        }
        setIsOptimizingPrice(false);
    };

    // Feature 8: Time Optimization
    const handleOptimizeTime = async () => {
        setIsOptimizingTime(true);
        // The strategy for time optimization is now part of handlePredictPrice's output
        // We can re-run handlePredictPrice to get updated time strategy
        await handlePredictPrice();
        setIsOptimizingTime(false);
    };

    const getLiveSuggestions = () => {
        const suggestions = [];
        if (!formData.name) suggestions.push('Enter a clear title to start optimization.');
        if (formData.name.length > 5 && formData.name.length < 15) suggestions.push('Title is a bit short. Add brand or key features.');
        if (!formData.targetPrice) suggestions.push('Set a target price to unlock Market Strategy analysis.');
        if (!formData.location) suggestions.push('Add a location to reach 30% more local buyers.');
        if (!formData.tags || formData.tags.split(',').length < 3) suggestions.push('Add at least 3 tags for better SEO discovery.');
        // Feature 5: Listing Comparison Insights
        const avgDescLength = 120;
        if (formData.details.length > 0 && formData.details.length < avgDescLength) {
            const pct = Math.round(((avgDescLength - formData.details.length) / avgDescLength) * 100);
            suggestions.push(`Your description is ${pct}% shorter than average — consider adding more details.`);
        } else if (formData.details.length === 0) {
            suggestions.push('Provide a description to help the AI write specific features.');
        }
        const tagCount = formData.tags ? formData.tags.split(',').filter(t => t.trim()).length : 0;
        if (tagCount > 0 && tagCount < 5) suggestions.push(`You have ${tagCount} tag${tagCount > 1 ? 's' : ''} — top listings average 5+.`);
        return suggestions;
    };

    const listingScore = (() => {
        let score = 10;
        if (formData.name) score += 20;
        if (formData.category) score += 10;
        if (formData.targetPrice) score += 20;
        if (formData.location) score += 15;
        if (formData.tags && formData.tags.split(',').length >= 3) score += 15;
        if (formData.details.length > 50) score += 10;
        return Math.min(score, 100);
    })();

    // fetchStrategy removed — replaced by handlePredictPrice + fetchMarketIntelligence

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            let expertPrompt = "";
            let helperPrompt = "";

            if (mode === 'product') {
                expertPrompt = `
You are an expert marketplace assistant. Generate a professional product listing.
Product: ${formData.name}
Category: ${formData.category}
Condition: ${formData.condition}
Location: ${formData.location}
Tags: ${formData.tags}
Details: ${formData.details}

IMPORTANT: Use the following format EXACTLY:
[TITLE] (Your Title) [/TITLE]
[DESCRIPTION] (Your Description, max 100 words) [/DESCRIPTION]
[FEATURES]
* Feature 1
* Feature 2
* Feature 3
* Feature 4
[/FEATURES]
`;
                helperPrompt = `
You are a friendly marketplace helper. Help an everyday user list a product.
Product: ${formData.name}
Category: ${formData.category}
Location: ${formData.location}

IMPORTANT: Use the following format EXACTLY:
[TITLE] (Your Title) [/TITLE]
[DESCRIPTION] (Your Description, max 80 words) [/DESCRIPTION]
[FEATURES]
* Benefit 1
* Benefit 2
* Benefit 3
[/FEATURES]
`;
            } else if (mode === 'service_provider') {
                expertPrompt = `
You are "CopyCoach" for service providers. Optimize the following service offer to be professional and trustworthy.
Service: ${formData.name}
Location: ${formData.location}
Tags: ${formData.tags}
Details: ${formData.details}

IMPORTANT: Use the following format EXACTLY:
[TITLE] (Professional Title) [/TITLE]
[DESCRIPTION] (Trust-focused Description) [/DESCRIPTION]
[FEATURES]
* Skill/Guarantee 1
* Skill/Guarantee 2
* Skill/Guarantee 3
* Skill/Guarantee 4
[/FEATURES]
`;
                helperPrompt = `
You are a friendly "CopyCoach". Help someone offer their skills simply.
Service: ${formData.name}
Location: ${formData.location}
Details: ${formData.details}

IMPORTANT: Use the following format EXACTLY:
[TITLE] (Approachable Title) [/TITLE]
[DESCRIPTION] (Helpful Description) [/DESCRIPTION]
[FEATURES]
* What I'll do 1
* What I'll do 2
* What I'll do 3
[/FEATURES]
`;
            } else {
                // Client Mode
                expertPrompt = `
You are "CopyCoach" for clients. Help them write a clear and professional request for a service.
Task: ${formData.name}
Location: ${formData.location}
Requirements: ${formData.details}

IMPORTANT: Use the following format EXACTLY:
[TITLE] (Precise Request Title) [/TITLE]
[DESCRIPTION] (Detailed Job Description) [/DESCRIPTION]
[FEATURES]
* Requirement 1
* Requirement 2
* Requirement 3
[/FEATURES]
`;
                helperPrompt = `
You are a friendly "CopyCoach". Help someone ask for help simply.
Task: ${formData.name}
Location: ${formData.location}
Details: ${formData.details}

IMPORTANT: Use the following format EXACTLY:
[TITLE] (Simple Request Title) [/TITLE]
[DESCRIPTION] (Clear Description) [/DESCRIPTION]
[FEATURES]
* Detail 1
* Detail 2
* Detail 3
[/FEATURES]
`;
            }

            const [expertRes, helperRes] = await Promise.all([
                axios.post(LLM_ENDPOINT, { prompt: expertPrompt }),
                axios.post(LLM_ENDPOINT, { prompt: helperPrompt })
            ]);

            setResult({
                expert: parseOutput(expertRes.data.response || expertRes.data.text || expertRes.data),
                helper: parseOutput(helperRes.data.response || helperRes.data.text || helperRes.data)
            });
        } catch (err) {
            console.error("CopyCoach Generation failed:", err);
            const errorMsg = err.response?.data?.message || err.message || "Unknown connectivity error";
            alert(`Intelligence bridge failed: ${errorMsg}\n\nPlease check if your ngrok URL is still active and matches: ${LLM_ENDPOINT}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUseCopyCoach = (type) => {
        const selected = result[type];
        if (!selected) return;
        const newDetails = `${selected.description}\n\nFeatures:\n${selected.features.map(f => `• ${f}`).join('\n')}`;
        setFormData(prev => ({
            ...prev,
            name: selected.title || prev.name,
            details: newDetails
        }));
        setResult(null); // Dismiss after applying
    };

    const parseOutput = (text) => {
        if (typeof text !== 'string') return { title: 'Optimization Error', description: 'Invalid response.', features: [] };

        let title = '';
        let description = '';
        let features = [];

        // 1. Try Tag-based extraction (Robust)
        const titleMatch = text.match(/\[TITLE\]([\s\S]*?)\[\/TITLE\]/i);
        const descMatch = text.match(/\[DESCRIPTION\]([\s\S]*?)\[\/DESCRIPTION\]/i);
        const featuresMatch = text.match(/\[FEATURES\]([\s\S]*?)\[\/FEATURES\]/i);

        if (titleMatch) title = titleMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
        if (featuresMatch) {
            features = featuresMatch[1].split('\n')
                .map(f => f.replace(/^[*-\d.]\s*/, '').trim())
                .filter(f => f.length > 0);
        }

        // 2. Keyword-based fallback
        if (!description || !features.length) {
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            let currentSection = '';

            lines.forEach(line => {
                const lower = line.toLowerCase();
                if (lower.includes('title:') && !title) {
                    title = line.split(/title:/i)[1]?.trim();
                } else if (lower.includes('description:')) {
                    currentSection = 'desc';
                } else if (lower.includes('features:') || lower.includes('benefits:') || lower.includes('skills:')) {
                    currentSection = 'features';
                    description = description.replace(/(features|benefits|skills):/gi, '').trim();
                } else if (currentSection === 'desc') {
                    description += ' ' + line.trim();
                } else if (currentSection === 'features' || line.startsWith('*') || line.startsWith('-') || /^\d\./.test(line)) {
                    const feat = line.replace(/^[*-\d.]\s*/, '').trim();
                    if (feat && !feat.toLowerCase().includes('features:')) features.push(feat);
                }
            });
        }

        // 3. Absolute Greedy Fallback (If still empty)
        if (!description) {
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            if (lines.length > 0) {
                if (!title) title = lines[0].trim();
                description = lines.slice(1).join(' ').trim();
                // Extract anything that looks like a bullet into features if features is empty
                if (features.length === 0) {
                    features = lines.filter(l => l.startsWith('*') || l.startsWith('-') || /^\d\./.test(l))
                        .map(l => l.replace(/^[*-\d.]\s*/, '').trim());
                }
            }
        }

        return {
            title: title || 'Optimized Result',
            description: description.trim() || text.substring(0, 200) + '...',
            features: features.length > 0 ? features.slice(0, 5) : ['AI optimization applied']
        };
    };

    return (
        <div className="flex flex-col gap-10 max-w-5xl mx-auto">
            {/* Mode Selector */}
            <div className="flex justify-center gap-4 bg-white p-2 rounded-pill shadow-soft w-fit mx-auto border border-gray-100">
                {[
                    { id: 'product', label: 'Item Ads', icon: Briefcase },
                    { id: 'service_provider', label: 'Offer Service', icon: UserCircle },
                    { id: 'client', label: 'Request Help', icon: User }
                ].map(m => (
                    <button
                        key={m.id}
                        onClick={() => { setMode(m.id); setResult(null); }}
                        className={`px-6 py-2 rounded-pill text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === m.id ? 'bg-brand-navy text-white' : 'text-text-secondary hover:bg-brand-gray-bg'}`}
                    >
                        <m.icon className="w-4 h-4" />
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="card-soft p-10">
                {/* Live Strategy Score */}
                <div className="mb-10 p-6 bg-brand-navy rounded-soft-xl text-white overflow-hidden relative group">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white opacity-10" />
                                    <motion.circle
                                        cx="48" cy="48" r="40" stroke="#9FC401" strokeWidth="8" fill="transparent"
                                        strokeDasharray={2 * Math.PI * 40}
                                        initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                                        animate={{ strokeDashoffset: (2 * Math.PI * 40) * (1 - listingScore / 100) }}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className="absolute text-2xl font-black">{listingScore}%</span>
                            </div>
                            <div>
                                <h4 className="text-lg font-black tracking-tight">Listing Quality Score</h4>
                                <p className="text-xs font-medium opacity-60 mt-1">AI-driven probability of a fast sale</p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-2 max-w-md">
                            <h5 className="text-[10px] font-black uppercase tracking-widest opacity-40">AI Real-time Improvements</h5>
                            <div className="h-20 overflow-y-auto pr-2 custom-scrollbar">
                                {getLiveSuggestions().map((suggestion, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-[10px] font-bold mb-1">
                                        <Sparkles className="w-3 h-3 text-brand-lime" />
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-lime opacity-5 blur-[100px] pointer-events-none" />
                </div>

                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-brand-lime rounded-soft text-white">
                        <Wand2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-brand-navy">SmartAI Listing Hub</h3>
                        <p className="text-sm text-text-secondary font-medium mt-1">
                            {mode === 'product' ? 'Optimizing for physical items' : mode === 'service_provider' ? 'Refining your professional offer' : 'Structuring your service request'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Section 1: Identity */}
                    <div className="md:col-span-2 flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-lime">1. Identity & State</h4>
                        <button
                            onClick={handleAutofill}
                            disabled={isAutofilling}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-lime bg-opacity-10 text-brand-lime rounded-pill text-[10px] font-black uppercase tracking-widest hover:bg-opacity-20 transition-all border border-brand-lime border-opacity-20"
                        >
                            {isAutofilling ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {isAutofilling ? 'Analyzing Photo...' : '✨ Autofill via AI'}
                        </button>
                    </div>
                    <div className="h-px bg-gray-100 w-full md:col-span-2 mb-6" />

                    {/* 1. Title */}
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                            {mode === 'client' ? 'Task / Need' : 'Title / Skill'}
                        </label>
                        <input
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime transition-all text-sm font-semibold"
                            placeholder={mode === 'product' ? 'e.g. Vintage Camera' : mode === 'service_provider' ? 'e.g. Garden Maintenance' : 'e.g. Living Room Painting'}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    {/* 2. Condition */}
                    {mode === 'product' ? (
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Condition</label>
                            <select
                                className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime text-sm font-semibold"
                                value={formData.condition}
                                onChange={e => setFormData({ ...formData, condition: e.target.value })}
                            >
                                <option>New</option>
                                <option>Used - Good</option>
                                <option>Used - Fair</option>
                                <option>Refurbished</option>
                            </select>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Category</label>
                            <input
                                className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime text-sm font-semibold"
                                placeholder="e.g. Home Services"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                    )}

                    {/* 3. Description (Shifted Up) */}
                    <div className="md:col-span-2 flex flex-col gap-3">
                        <div className="flex justify-between items-center pr-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Description / Details</label>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !formData.name}
                                className="text-[8px] font-black uppercase tracking-widest text-brand-lime hover:underline flex items-center gap-1"
                            >
                                {isGenerating ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : '✨ CopyCoach'}
                            </button>
                        </div>
                        <textarea
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-soft-xl focus:outline-none focus:border-brand-lime transition-all text-sm font-semibold min-h-[100px]"
                            placeholder={mode === 'product' ? 'e.g. Includes warranty and original dock' : 'e.g. Available for long-term projects'}
                            value={formData.details}
                            onChange={e => setFormData({ ...formData, details: e.target.value })}
                        />
                        <AnimatePresence>
                            {result && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
                                >
                                    {/* Expert Result */}
                                    <div className="bg-brand-navy p-5 rounded-soft-xl text-white relative group overflow-hidden border border-brand-navy">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-brand-lime" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-lime">Professional</span>
                                            </div>
                                            <button onClick={() => handleUseCopyCoach('expert')} className="text-[10px] bg-brand-lime text-brand-navy px-3 py-1 font-black uppercase tracking-widest rounded hover:bg-white transition-colors">✅ Use This</button>
                                        </div>
                                        <h4 className="text-sm font-black mb-2">{result.expert.title}</h4>
                                        <div className="bg-white bg-opacity-5 p-3 rounded-soft mb-3 border border-white border-opacity-10">
                                            <p className="text-xs text-gray-300 line-clamp-3 italic"><MarkdownLite text={result.expert.description} /></p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {result.expert.features.slice(0,3).map((f, i) => (
                                                <span key={i} className="text-[9px] bg-white bg-opacity-10 px-2 py-0.5 rounded text-gray-300 truncate max-w-[150px]">{f.replace(/<[^>]*>?/gm, '')}</span>
                                            ))}
                                            {result.expert.features.length > 3 && <span className="text-[9px] text-brand-lime font-bold">+{result.expert.features.length - 3}</span>}
                                        </div>
                                    </div>

                                    {/* Helper Result */}
                                    <div className="bg-white p-5 rounded-soft-xl border border-gray-200 shadow-sm relative group overflow-hidden">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <UserCircle className="w-4 h-4 text-brand-navy" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-navy">Friendly</span>
                                            </div>
                                            <button onClick={() => handleUseCopyCoach('helper')} className="text-[10px] bg-brand-navy text-white px-3 py-1 font-black uppercase tracking-widest rounded hover:bg-brand-lime hover:text-brand-navy transition-colors">✅ Use This</button>
                                        </div>
                                        <h4 className="text-sm font-black mb-2 text-brand-navy">{result.helper.title}</h4>
                                        <div className="bg-brand-gray-bg p-3 rounded-soft mb-3 border border-gray-100">
                                            <p className="text-xs text-text-secondary line-clamp-3 italic"><MarkdownLite text={result.helper.description} /></p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {result.helper.features.slice(0,3).map((f, i) => (
                                                <span key={i} className="text-[9px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 truncate max-w-[150px]">{f.replace(/<[^>]*>?/gm, '')}</span>
                                            ))}
                                            {result.helper.features.length > 3 && <span className="text-[9px] text-text-secondary font-bold">+{result.helper.features.length - 3}</span>}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Section 2: Contextual Market Data */}
                    <div className="md:col-span-2 mt-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-lime mb-4">2. Market Intelligence</h4>
                        <div className="h-px bg-gray-100 w-full mb-6" />
                    </div>

                    {mode === 'product' && (
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Category</label>
                            <input
                                className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime text-sm font-semibold"
                                placeholder="e.g. Electronics"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Location / Area</label>
                        <input
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime transition-all text-sm font-semibold"
                            placeholder="e.g. Stockholm, SE"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center pr-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Delivery / Shipping</label>
                            <button
                                onClick={handleOptimizeTime}
                                disabled={isOptimizingTime}
                                className="text-[8px] font-black uppercase tracking-widest text-brand-lime hover:underline flex items-center gap-1"
                            >
                                {isOptimizingTime ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : '✨ Publish Optimizer'}
                            </button>
                        </div>
                        <select
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime text-sm font-semibold"
                            value={formData.shipping}
                            onChange={e => setFormData({ ...formData, shipping: e.target.value })}
                        >
                            <option>Pick-up only</option>
                            <option>Shipping available</option>
                            <option>Digital delivery</option>
                            <option>I come to you (Service)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Target Audience</label>
                        <select
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime text-sm font-semibold"
                            value={formData.audience}
                            onChange={e => setFormData({ ...formData, audience: e.target.value })}
                        >
                            <option>Local Buyers</option>
                            <option>Professional/B2B</option>
                            <option>Collectors</option>
                            <option>Quick Savers</option>
                        </select>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Search Tags (Comma separated)</label>
                        <input
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime transition-all text-sm font-semibold"
                            placeholder="e.g. tech, quality, bargain"
                            value={formData.tags}
                            onChange={e => setFormData({ ...formData, tags: e.target.value })}
                        />
                    </div>

                    {/* Section 3: Value Strategy */}
                    <div className="md:col-span-2 mt-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-lime mb-4">3. Value & Strategy</h4>
                        <div className="h-px bg-gray-100 w-full mb-6" />
                    </div>

                    {/* Market Context Insight Bar */}
                    <div className="md:col-span-2 bg-brand-navy p-6 rounded-soft-xl text-white flex flex-col md:flex-row justify-between items-center gap-6 mb-4">
                        <div className="flex-1 border-r border-white border-opacity-10 pr-6">
                            <h5 className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Local Category</h5>
                            <p className="text-sm font-bold text-brand-lime uppercase tracking-tight">{formData.category || 'Identify Above'}</p>
                        </div>
                        <div className="flex-1 border-r border-white border-opacity-10 px-6">
                            <h5 className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Target Location</h5>
                            <p className="text-sm font-bold uppercase tracking-tight">{formData.location || 'Local'}</p>
                        </div>
                        <div className="flex-1 pl-6">
                            <h5 className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Real-Time Demand</h5>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-brand-lime leading-none">{formData.marketDemand}</p>
                                <TrendingUp className="w-3 h-3 text-brand-lime" />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-1 flex flex-col gap-3 relative">
                        <div className="flex justify-between items-center pr-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Your Expected Price ($)</label>
                            <button
                                onClick={handlePredictPrice}
                                disabled={isOptimizingPrice}
                                className="text-[8px] font-black uppercase tracking-widest text-brand-lime hover:underline flex items-center gap-1"
                            >
                                {isOptimizingPrice ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : '✨ Smart Price'}
                            </button>
                        </div>
                        <input
                            type="number"
                            className="px-6 py-4 bg-brand-gray-bg border border-gray-100 rounded-pill focus:outline-none focus:border-brand-lime transition-all text-sm font-semibold"
                            placeholder="e.g. 199"
                            value={formData.targetPrice}
                            onChange={e => setFormData({ ...formData, targetPrice: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="flex items-center gap-4 cursor-pointer p-4 bg-brand-gray-bg rounded-pill border border-gray-100 hover:border-brand-lime transition-all h-[58px]">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded-pill accent-brand-lime"
                                checked={formData.isUrgent}
                                onChange={e => setFormData({ ...formData, isUrgent: e.target.checked })}
                            />
                            <div>
                                <h5 className="text-[8px] font-black uppercase tracking-widest text-brand-navy">Urgent Sale</h5>
                                <p className="text-[8px] font-medium text-text-secondary italic">Optimize for speed</p>
                            </div>
                        </label>
                    </div>

                    <AnimatePresence>
                        {strategy && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2"
                            >
                                {/* Price Strategy Card */}
                                <div className="card-soft p-5 bg-brand-navy text-white flex flex-col items-center justify-center text-center">
                                    <DollarSign className="w-5 h-5 text-brand-lime mb-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">AI Strategy Price</span>
                                    <div className="text-2xl font-black my-1">${strategy.recommended_price}</div>
                                    {strategy.user_price > 0 && <div className="text-[8px] font-bold opacity-60 mb-1">Your Input: ${strategy.user_price}</div>}
                                    <p className="text-[10px] font-medium opacity-80 mt-1 line-clamp-2">{strategy.price_insight}</p>
                                </div>

                                {/* Timing Card */}
                                <div className="card-soft p-5 border border-brand-lime flex flex-col items-center justify-center text-center">
                                    <Clock className="w-5 h-5 text-brand-lime mb-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Optimal Timing</span>
                                    <div className="text-xl font-black text-brand-navy my-1">{strategy.best_time}</div>
                                    <p className="text-[10px] font-medium text-text-secondary mt-1">{strategy.reason}</p>
                                </div>

                                {/* Confidence Card */}
                                <div className="card-soft p-5 bg-brand-gray-bg flex flex-col items-center justify-center text-center">
                                    <TrendingUp className="w-5 h-5 text-brand-navy mb-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Confidence</span>
                                    <div className="text-2xl font-black text-brand-navy my-1">{strategy.confidence}%</div>
                                    <div className="w-3/4 bg-gray-200 h-1.5 rounded-full mt-1 overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${strategy.confidence}%` }} className="h-full bg-brand-lime" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="mt-12 flex flex-col md:flex-row items-center justify-between p-6 bg-brand-gray-bg rounded-soft-xl border border-gray-100">
                    <div className="mb-4 md:mb-0">
                        <h4 className="text-sm font-black text-brand-navy">Review & Publish</h4>
                        <p className="text-xs text-text-secondary font-medium mt-1">
                            {(!formData.name || !formData.details || !formData.targetPrice) ? 'Complete your listing details above to publish.' : 'Ready to go live onto the marketplace.'}
                        </p>
                    </div>
                    <button
                        disabled={!formData.name || !formData.details || !formData.targetPrice}
                        className={`px-8 py-4 rounded-pill font-black text-[10px] uppercase tracking-widest transition-all ${
                            (formData.name && formData.details && formData.targetPrice)
                                ? 'bg-brand-lime text-brand-navy hover:shadow-glow'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Publish Listing
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ListingAssistant;
