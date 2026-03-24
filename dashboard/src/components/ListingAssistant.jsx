import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Sparkles, User, ShieldCheck, RefreshCcw, Briefcase, UserCircle, DollarSign, Clock, TrendingUp } from 'lucide-react';
import axios from 'axios';
import API from '../config/api';

const LLM_ENDPOINT = 'https://cb94-35-240-172-91.ngrok-free.app/generate';

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
    const [simulation, setSimulation] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationError, setSimulationError] = useState('');
    const [simulationNeedsRefresh, setSimulationNeedsRefresh] = useState(false);
    const pricingMode = mode === 'product' ? 'item' : mode === 'service_provider' ? 'service' : 'help';
    const priceFieldLabel = pricingMode === 'service'
        ? 'Your Expected Rate ($)'
        : pricingMode === 'help'
            ? 'Your Expected Budget ($)'
            : 'Your Expected Price ($)';
    const marketSignalLabel = pricingMode === 'service'
        ? 'Service Signal'
        : pricingMode === 'help'
            ? 'Budget Signal'
            : 'Real-Time Demand';
    const urgencyTitle = pricingMode === 'service'
        ? 'Urgent Booking'
        : pricingMode === 'help'
            ? 'Urgent Request'
            : 'Urgent Sale';
    const urgencyDescription = pricingMode === 'service'
        ? 'Prioritize fast leads'
        : pricingMode === 'help'
            ? 'Prioritize quick responses'
            : 'Optimize for speed';

    const TAG_STOP_WORDS = new Set([
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'you',
        'are', 'our', 'has', 'have', 'will', 'can', 'all', 'new', 'used', 'good',
        'fair', 'very', 'just', 'more', 'best', 'help', 'need', 'local'
    ]);

    const addTagCandidate = (list, seen, rawTag) => {
        const tag = rawTag
            ?.toLowerCase()
            .replace(/[^a-z0-9+\-\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!tag || tag.length < 2 || seen.has(tag)) return;

        seen.add(tag);
        list.push(tag);
    };

    const sanitizeTagList = (rawTags = '') => {
        const tags = [];
        const seen = new Set();

        rawTags
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
            .forEach(tag => addTagCandidate(tags, seen, tag));

        return tags.slice(0, 6).join(', ');
    };

    const extractKeywordTags = (value = '') => {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9+\-\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !TAG_STOP_WORDS.has(word));
    };

    const buildFallbackTags = ({ title = '', description = '', features = [], tags = '' }) => {
        const suggestions = [];
        const seen = new Set();

        [tags, formData.tags].filter(Boolean).forEach(rawList => {
            rawList.split(',').forEach(tag => addTagCandidate(suggestions, seen, tag));
        });

        [
            title,
            formData.name,
            formData.category,
            formData.location,
            mode === 'product' ? formData.condition : ''
        ].filter(Boolean).forEach(value => {
            addTagCandidate(suggestions, seen, value);
            extractKeywordTags(value).forEach(word => addTagCandidate(suggestions, seen, word));
        });

        [...features, description, formData.details].filter(Boolean).forEach(value => {
            extractKeywordTags(value).forEach(word => addTagCandidate(suggestions, seen, word));
        });

        if (mode === 'service_provider') {
            ['service', 'professional', 'reliable'].forEach(word => addTagCandidate(suggestions, seen, word));
        } else if (mode === 'client') {
            ['request', 'needed', 'urgent'].forEach(word => addTagCandidate(suggestions, seen, word));
        } else {
            ['quality', 'sale', 'pickup'].forEach(word => addTagCandidate(suggestions, seen, word));
        }

        return suggestions.slice(0, 6).join(', ');
    };

    const formatCurrency = (value) => Number(value || 0).toLocaleString([], {
        minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0,
        maximumFractionDigits: 2
    });

    const formatForecastValue = (value) => Number(value || 0).toLocaleString([], {
        minimumFractionDigits: Number(value || 0) % 1 ? 1 : 0,
        maximumFractionDigits: 1
    });

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

        let marketSignal = pricingMode === 'service'
            ? 'Service Market Active'
            : pricingMode === 'help'
                ? 'Budget Planning Active'
                : 'Analysis Ready';

        if (pricingMode === 'item') {
            const catLower = formData.category.toLowerCase();
            let productId = 'prod_001'; // Default to Tools
            if (catLower.includes('furniture') || catLower.includes('sofa') || catLower.includes('chair') || catLower.includes('table')) productId = 'prod_002';
            else if (catLower.includes('electronics') || catLower.includes('computer') || catLower.includes('pc') || catLower.includes('phone') || catLower.includes('laptop')) productId = 'prod_003';
            else if (catLower.includes('outdoor') || catLower.includes('garden') || catLower.includes('bike') || catLower.includes('sport')) productId = 'prod_004';

            try {
                const demandRes = await axios.post(API.PREDICT_DEMAND, {
                    product_id: productId,
                    periods: 7
                });
                const demandVal = demandRes.data.forecast?.[0]?.yhat ?? demandRes.data.predictions?.[0] ?? 45;
                if (demandVal > 60) marketSignal = 'High-Intensity 🔥';
                else if (demandVal < 30) marketSignal = 'Steady';
                else marketSignal = 'Moderate';
            } catch (err) {
                console.warn('Demand forecast unavailable, continuing with price prediction:', err.message);
                marketSignal = 'Market Active';
            }
        }

        const priceRes = await axios.post(API.PREDICT_COMPARATIVE, {
            mode: pricingMode,
            category: formData.category,
            location: formData.location,
            condition: formData.condition || 'New',
            title: formData.name,
            details: formData.details,
            audience: formData.audience,
            shipping: formData.shipping,
            is_urgent: formData.isUrgent,
            target_price: formData.targetPrice ? parseFloat(formData.targetPrice) : null
        });

        marketSignal = priceRes.data.market_signal || marketSignal;
        setFormData(prev => ({ ...prev, marketDemand: marketSignal }));

        return {
            demand: marketSignal,
            recPrice: priceRes.data.recommended_price || 95.0,
            confidence: priceRes.data.confidence ?? 0.6,
            confidenceBasis: priceRes.data.confidence_basis || 'Confidence is based on market evidence.',
            confidenceIsInputIndependent: priceRes.data.confidence_is_input_independent ?? true,
            inputInfluencePct: priceRes.data.input_influence_pct ?? 0,
            inputInfluenceLabel: priceRes.data.input_influence_label || 'None',
            priceLabel: priceRes.data.price_label || 'Suggested price',
            strategyType: priceRes.data.pricing_strategy || 'market_benchmark',
            reason: priceRes.data.explanation || 'Market-aligned recommendation.',
            rangeMin: priceRes.data.suggested_min_price,
            rangeMax: priceRes.data.suggested_max_price,
            referenceScope: priceRes.data.reference_scope,
            sampleSize: priceRes.data.sample_size
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
                const priceNoun = pricingMode === 'service' ? 'rate' : pricingMode === 'help' ? 'budget' : 'price';
                let priceInsight = intel.reason || 'Market competitive pricing.';
                const hasRange = intel.rangeMin != null && intel.rangeMax != null;

                if (userPrice > 0 && hasRange) {
                    if (userPrice > intel.rangeMax) {
                        priceInsight = `Your ${priceNoun} is $${(userPrice - intel.rangeMax).toFixed(0)} above the top of the suggested range for ${formData.location}.`;
                    } else if (userPrice < intel.rangeMin) {
                        priceInsight = `Your ${priceNoun} is $${(intel.rangeMin - userPrice).toFixed(0)} below the bottom of the suggested range for ${formData.location}.`;
                    } else {
                        priceInsight = `Your ${priceNoun} sits inside the suggested range for ${formData.location}.`;
                    }
                } else if (userPrice > 0) {
                    if (diff > 20) priceInsight = `Your ${priceNoun} is $${diff.toFixed(0)} above the suggested ${priceNoun} for ${formData.location}.`;
                    else if (diff < -20) priceInsight = `You are $${Math.abs(diff).toFixed(0)} below the suggested ${priceNoun} for ${formData.location}.`;
                }

                const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const bestDay = days[Math.floor(Math.random() * 7)];
                const confidenceScore = intel.confidence <= 1 ? Math.round(intel.confidence * 100) : Math.round(intel.confidence);
                const bestTime = pricingMode === 'service'
                    ? `${bestDay} at 09:00`
                    : pricingMode === 'help'
                        ? `${bestDay} at 07:30`
                        : `${bestDay} at 18:00`;

                setStrategy({
                    recommended_price: intel.recPrice,
                    suggested_min_price: intel.rangeMin,
                    suggested_max_price: intel.rangeMax,
                    price_label: intel.priceLabel,
                    strategy_type: intel.strategyType,
                    user_price: userPrice,
                    price_insight: priceInsight,
                    confidence: confidenceScore,
                    confidence_basis: intel.confidenceBasis,
                    confidence_is_input_independent: intel.confidenceIsInputIndependent,
                    input_influence_pct: intel.inputInfluencePct,
                    input_influence_label: intel.inputInfluenceLabel,
                    reference_scope: intel.referenceScope,
                    sample_size: intel.sampleSize,
                    best_time: bestTime,
                    reason: intel.reason
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

    const fetchSimulationForecast = async () => {
        const parsedPrice = parseFloat(formData.targetPrice);
        if (mode !== 'product' || !formData.category || !formData.location || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            return null;
        }

        const simulatorRes = await axios.post(API.PREDICT_SIMULATOR, {
            mode: 'item',
            category: formData.category,
            location: formData.location,
            condition: formData.condition || 'New',
            price: parsedPrice
        });

        return simulatorRes.data;
    };

    const handleRunBoostSimulator = async () => {
        if (!simulatorReady) {
            alert('Add a category, location, and target price first so Boost Simulator can use your dashboard inputs.');
            return;
        }

        setIsSimulating(true);
        try {
            const nextSimulation = await fetchSimulationForecast();
            setSimulation(nextSimulation);
            setSimulationError('');
            setSimulationNeedsRefresh(false);
        } catch (err) {
            console.error('Boost Simulator Error:', err);
            setSimulation(null);
            setSimulationError('Boost Simulator is temporarily unavailable. Check that the backend is running.');
            setSimulationNeedsRefresh(false);
        } finally {
            setIsSimulating(false);
        }
    };

    useEffect(() => {
        if (mode !== 'product') {
            setSimulation(null);
            setSimulationError('');
            setIsSimulating(false);
            setSimulationNeedsRefresh(false);
            return undefined;
        }

        const parsedPrice = parseFloat(formData.targetPrice);
        if (!formData.category || !formData.location || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            setSimulation(null);
            setSimulationError('');
            setIsSimulating(false);
            setSimulationNeedsRefresh(false);
            return undefined;
        }

        setSimulationError('');
        setSimulationNeedsRefresh(Boolean(simulation));
        return undefined;
    }, [mode, formData.category, formData.location, formData.condition, formData.targetPrice]);

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

    const parsedTargetPrice = parseFloat(formData.targetPrice);
    const simulatorReady = mode === 'product'
        && formData.category
        && formData.location
        && Number.isFinite(parsedTargetPrice)
        && parsedTargetPrice > 0;
    const simulationConfidencePct = simulation ? Math.round((simulation.confidence ?? 0) * 100) : 0;
    const simulationConfidenceLabel = simulationConfidencePct >= 80
        ? 'Strong forecast'
        : simulationConfidencePct >= 60
            ? 'Usable forecast'
            : 'Early signal';

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
[TAGS] tag1, tag2, tag3, tag4, tag5 [/TAGS]
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
[TAGS] tag1, tag2, tag3, tag4 [/TAGS]
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
[TAGS] skill1, skill2, guarantee1, service1 [/TAGS]
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
[TAGS] help1, help2, local, reliable [/TAGS]
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
[TAGS] need1, need2, required1, task1 [/TAGS]
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
[TAGS] task1, simple, local, help [/TAGS]
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
        const suggestedTags = sanitizeTagList(selected.tags) || buildFallbackTags(selected);

        setFormData(prev => ({
            ...prev,
            name: selected.title || prev.name,
            details: newDetails,
            tags: suggestedTags || prev.tags
        }));
        setResult(null); // Dismiss after applying
    };

    const parseOutput = (text) => {
        if (typeof text !== 'string') return { title: 'Optimization Error', description: 'Invalid response.', features: [], tags: '' };

        let title = '';
        let description = '';
        let features = [];
        let tags = '';

        // 1. Try Tag-based extraction (Robust)
        const titleMatch = text.match(/\[TITLE\]([\s\S]*?)\[\/TITLE\]/i);
        const descMatch = text.match(/\[DESCRIPTION\]([\s\S]*?)\[\/DESCRIPTION\]/i);
        const featuresMatch = text.match(/\[FEATURES\]([\s\S]*?)\[\/FEATURES\]/i);
        const tagsMatch = text.match(/\[TAGS\]([\s\S]*?)\[\/TAGS\]/i);

        if (titleMatch) title = titleMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
        if (featuresMatch) {
            features = featuresMatch[1].split('\n')
                .map(f => f.replace(/^[*-\d.]\s*/, '').trim())
                .filter(f => f.length > 0);
        }
        if (tagsMatch) {
            tags = tagsMatch[1].trim();
        }

        // 2. Keyword-based fallback
        if (!description || !features.length) {
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            let currentSection = '';

            lines.forEach(line => {
                const lower = line.toLowerCase();
                if (lower.includes('title:') && !title) {
                    title = line.split(/title:/i)[1]?.trim();
                } else if (lower.includes('tags:') && !tags) {
                    tags = line.split(/tags:/i)[1]?.trim();
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

        const normalizedTags = sanitizeTagList(tags) || buildFallbackTags({ title, description, features, tags });

        return {
            title: title || 'Optimized Result',
            description: description.trim() || text.substring(0, 200) + '...',
            features: features.length > 0 ? features.slice(0, 5) : ['AI optimization applied'],
            tags: normalizedTags
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
                                        {result.expert.tags && (
                                            <div className="mt-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-lime mb-2">Suggested Tags</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {result.expert.tags.split(',').map((tag, i) => (
                                                        <span key={i} className="text-[9px] bg-brand-lime bg-opacity-10 px-2 py-0.5 rounded text-brand-lime">
                                                            {tag.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                                        {result.helper.tags && (
                                            <div className="mt-3">
                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2">Suggested Tags</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {result.helper.tags.split(',').map((tag, i) => (
                                                        <span key={i} className="text-[9px] bg-brand-lime bg-opacity-10 px-2 py-0.5 rounded text-brand-navy">
                                                            {tag.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
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
                            <h5 className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">{marketSignalLabel}</h5>
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-brand-lime leading-none">{formData.marketDemand}</p>
                                <TrendingUp className="w-3 h-3 text-brand-lime" />
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-1 flex flex-col gap-3 relative">
                        <div className="flex justify-between items-center pr-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary">{priceFieldLabel}</label>
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
                                <h5 className="text-[8px] font-black uppercase tracking-widest text-brand-navy">{urgencyTitle}</h5>
                                <p className="text-[8px] font-medium text-text-secondary italic">{urgencyDescription}</p>
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
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{strategy.price_label || 'AI Strategy Price'}</span>
                                    {strategy.suggested_min_price != null && strategy.suggested_max_price != null ? (
                                        <div className="text-2xl font-black my-1">
                                            ${formatCurrency(strategy.suggested_min_price)} - ${formatCurrency(strategy.suggested_max_price)}
                                        </div>
                                    ) : (
                                        <div className="text-2xl font-black my-1">${formatCurrency(strategy.recommended_price)}</div>
                                    )}
                                    <div className="text-[8px] font-bold opacity-60 mb-1">Center benchmark: ${formatCurrency(strategy.recommended_price)}</div>
                                    {strategy.user_price > 0 && <div className="text-[8px] font-bold opacity-60 mb-1">Your Input: ${formatCurrency(strategy.user_price)}</div>}
                                    {strategy.reference_scope && (
                                        <div className="text-[8px] font-bold opacity-60 mb-1">
                                            Basis: {strategy.reference_scope}{strategy.sample_size ? ` • ${strategy.sample_size} comps` : ''}
                                        </div>
                                    )}
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
                                    {strategy.confidence_is_input_independent && (
                                        <p className="text-[8px] font-bold text-text-secondary mt-3">
                                            Based on market evidence, not your entered value.
                                        </p>
                                    )}
                                    <p className="text-[8px] font-bold text-text-secondary mt-1">
                                        Input influence: {strategy.input_influence_label || 'None'}{typeof strategy.input_influence_pct === 'number' ? ` (${strategy.input_influence_pct}%)` : ''}
                                    </p>
                                    {strategy.confidence_basis && (
                                        <p className="text-[8px] font-medium text-text-secondary mt-2 leading-relaxed">
                                            {strategy.confidence_basis}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>


                    {mode === 'product' && (
                        <div className="md:col-span-2 mt-4">
                            <div className="card-soft p-6 border border-brand-lime border-opacity-30 bg-white">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sparkles className="w-4 h-4 text-brand-lime" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-lime">Boost Simulator</span>
                                        </div>
                                        <h5 className="text-lg font-black text-brand-navy">Expected sales and earnings from your current listing setup</h5>
                                        <p className="text-xs text-text-secondary font-medium mt-1">
                                            Uses the current price, category, location, and condition from this form when you run it.
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-stretch md:items-end gap-2">
                                        <button
                                            onClick={handleRunBoostSimulator}
                                            disabled={!simulatorReady || isSimulating}
                                            className={`px-5 py-3 rounded-pill text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                                                simulatorReady && !isSimulating
                                                    ? 'bg-brand-lime text-brand-navy hover:shadow-glow'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            {isSimulating ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                            {simulation ? 'Rerun Boost Simulator' : 'Run Boost Simulator'}
                                        </button>
                                        <div className={`px-4 py-2 rounded-pill text-[10px] font-black uppercase tracking-widest text-center ${
                                            isSimulating
                                                ? 'bg-brand-navy text-white'
                                                : simulationNeedsRefresh
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : simulation
                                                        ? 'bg-brand-lime bg-opacity-10 text-brand-navy'
                                                        : 'bg-brand-gray-bg text-text-secondary'
                                        }`}>
                                            {isSimulating
                                                ? 'Running forecast'
                                                : simulationNeedsRefresh
                                                    ? 'Inputs changed'
                                                    : simulation
                                                        ? `${simulationConfidenceLabel} • ${simulationConfidencePct}%`
                                                        : 'Ready to run'}
                                        </div>
                                    </div>
                                </div>

                                {!simulatorReady ? (
                                    <div className="p-4 bg-brand-gray-bg rounded-soft-xl border border-gray-100 text-sm text-text-secondary font-medium">
                                        Add a category, location, and target price, then click Run Boost Simulator.
                                    </div>
                                ) : simulationError ? (
                                    <div className="p-4 bg-red-50 rounded-soft-xl border border-red-100 text-sm text-red-700 font-medium">
                                        {simulationError}
                                    </div>
                                ) : simulation ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="card-soft p-5 bg-brand-navy text-white flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <TrendingUp className="w-4 h-4 text-brand-lime" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Monthly Sales</span>
                                                </div>
                                                <div className="text-3xl font-black">{formatForecastValue(simulation.monthly_sales?.expected)}</div>
                                                <p className="text-[10px] font-medium opacity-80 mt-2">
                                                    Range: {formatForecastValue(simulation.monthly_sales?.low)} to {formatForecastValue(simulation.monthly_sales?.high)} / month
                                                </p>
                                            </div>
                                            <div className="mt-5 pt-4 border-t border-white border-opacity-10 text-[10px] font-bold opacity-70">
                                                {formatForecastValue(simulation.yearly_sales)} / year
                                            </div>
                                        </div>

                                        <div className="card-soft p-5 border border-brand-lime flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <DollarSign className="w-4 h-4 text-brand-lime" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Expected Revenue</span>
                                                </div>
                                                <div className="text-3xl font-black text-brand-navy">${formatCurrency(simulation.monthly_revenue)}</div>
                                                <p className="text-[10px] font-medium text-text-secondary mt-2">
                                                    ${formatCurrency(simulation.monthly_revenue_range?.low)} to ${formatCurrency(simulation.monthly_revenue_range?.high)} / month
                                                </p>
                                            </div>
                                            <div className="mt-5 pt-4 border-t border-gray-100 text-[10px] font-bold text-text-secondary">
                                                ${formatCurrency(simulation.yearly_revenue)} / year
                                            </div>
                                        </div>

                                        <div className="card-soft p-5 bg-brand-gray-bg flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Sparkles className="w-4 h-4 text-brand-navy" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Confidence</span>
                                                </div>
                                                <div className="text-3xl font-black text-brand-navy">{simulationConfidencePct}%</div>
                                                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${simulationConfidencePct}%` }} className="h-full bg-brand-lime" />
                                                </div>
                                                <p className="text-[10px] font-medium text-text-secondary mt-3 leading-relaxed">
                                                    {simulation.explanation}
                                                </p>
                                            </div>
                                            <p className="mt-5 pt-4 border-t border-gray-200 text-[9px] font-bold text-text-secondary">
                                                {simulation.confidence_basis}
                                            </p>
                                        </div>

                                        <div className="md:col-span-3 bg-brand-gray-bg p-5 rounded-soft-xl border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Forecast Month</p>
                                                <p className="text-sm font-black text-brand-navy">{simulation.forecast_month}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Price Position</p>
                                                <p className="text-sm font-black text-brand-navy capitalize">{simulation.price_position || 'Unknown'}</p>
                                                {simulation.benchmark_price != null && (
                                                    <p className="text-[10px] font-medium text-text-secondary mt-1">
                                                        Market midpoint: ${formatCurrency(simulation.benchmark_price)}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Comparable Scope</p>
                                                <p className="text-sm font-black text-brand-navy">{simulation.reference_scope}</p>
                                                <p className="text-[10px] font-medium text-text-secondary mt-1">
                                                    {simulation.coverage_size || 0} market records
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Model Version</p>
                                                <p className="text-sm font-black text-brand-navy">{simulation.version}</p>
                                                <p className="text-[10px] font-medium text-text-secondary mt-1">
                                                    {simulation.fallback_used ? 'Fallback evidence included' : 'Direct model forecast'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-brand-gray-bg rounded-soft-xl border border-gray-100 text-sm text-text-secondary font-medium flex items-center gap-3">
                                        <RefreshCcw className="w-4 h-4 animate-spin text-brand-lime" />
                                        Click Run Boost Simulator to forecast this listing with your current dashboard inputs.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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
