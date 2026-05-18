import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Settings, RefreshCw, Loader2, Sparkles, ChevronRight, Key, Cpu } from 'lucide-react';
import { getApiKeys, setApiKey, testConnection, getProvider, setProvider, AIProvider } from '../../services/ai';
import { cn } from '../../lib/utils';

interface AISettingsProps {
  onClose: () => void;
}

export default function AISettings({ onClose }: AISettingsProps) {
  const keys = getApiKeys();
  const [geminiKeys, setGeminiKeys] = useState<string[]>(
    keys.geminiAll.length > 0 ? [...keys.geminiAll, ...Array(Math.max(0, 5 - keys.geminiAll.length)).fill('')].slice(0, 5) : ['', '', '', '', '']
  );
  const [groqKey, setGroqKey] = useState(keys.groq);
  const [provider, setLocalProvider] = useState<AIProvider>(getProvider());
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = () => {
    setApiKey(geminiKeys.filter(k => k.trim() !== ''), 'gemini');
    setApiKey(groqKey, 'groq');
    setProvider(provider);
    setTestResult({ success: true, message: "設定已儲存" });
  };

  const handleTest = async () => {
    // Save first to ensure we test current input
    setApiKey(geminiKeys.filter(k => k.trim() !== ''), 'gemini');
    setApiKey(groqKey, 'groq');
    setProvider(provider);
    
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(provider);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '測試失敗' });
    } finally {
      setIsTesting(false);
    }
  };

  const updateGeminiKey = (index: number, value: string) => {
    const nextKeys = [...geminiKeys];
    nextKeys[index] = value;
    setGeminiKeys(nextKeys);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-2 border-[#141414]"
      >
        <div className="bg-[#141414] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold">AI 服務狀態與替代方案</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
             <label className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
               <Cpu className="w-3.5 h-3.5" /> 指定主要批改引擎
             </label>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setLocalProvider('groq')}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-xs font-bold flex flex-col items-center gap-1",
                    provider === 'groq' 
                      ? "bg-[#141414] text-white border-[#141414] shadow-lg" 
                      : "bg-white border-[#141414]/10 text-[#5A5A40] hover:border-[#141414]/30"
                  )}
                >
                  <span>Groq (Llama 3)</span>
                  <span className="text-[8px] opacity-70">速度極快 專注批改</span>
                </button>
                <button 
                  onClick={() => setLocalProvider('gemini')}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-xs font-bold flex flex-col items-center gap-1",
                    provider === 'gemini' 
                      ? "bg-[#141414] text-white border-[#141414] shadow-lg" 
                      : "bg-white border-[#141414]/10 text-[#5A5A40] hover:border-[#141414]/30"
                  )}
                >
                  <span>Gemini (Google)</span>
                  <span className="text-[8px] opacity-70">支援 OCR 與 批改</span>
                </button>
             </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-[#5A5A40] mb-2 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                Groq API Key (主要批改方案)
              </label>
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="輸入您的 Groq API Key..."
                className="w-full h-10 px-4 bg-[#F5F5F0] border-2 border-[#141414]/20 rounded-xl focus:border-[#141414] focus:ring-0 focus:outline-none transition-all font-mono text-xs"
              />
              <p className="mt-1 text-[9px] text-blue-500 italic">
                Groq 的 Llama 3 速度極快且有免費額度，現在作為系統預設批改引擎。
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#5A5A40] mb-2 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-blue-500" />
                  Gemini API Keys (最多 5 組，自動輪用)
                </span>
                <span className="text-[8px] text-gray-400 font-normal">當達到配額限制時會自動切換</span>
              </label>
              <div className="space-y-2">
                {geminiKeys.map((key, index) => (
                  <div key={index} className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-bold text-gray-400 group-focus-within:text-blue-500 transition-colors">
                      #{index + 1}
                    </span>
                    <input
                      type="password"
                      value={key}
                      onChange={(e) => updateGeminiKey(index, e.target.value)}
                      placeholder={index === 0 ? "主要 API Key..." : `備用 Key ${index + 1}...`}
                      className="w-full h-9 pl-8 pr-4 bg-[#F5F5F0] border-2 border-[#141414]/10 rounded-xl focus:border-[#141414] focus:ring-0 focus:outline-none transition-all font-mono text-[10px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isTesting}
                className="flex-1 h-11 bg-[#141414] text-white font-bold rounded-xl hover:bg-black active:scale-95 transition-all text-xs shadow-md"
              >
                儲存設定
              </button>
              <button
                onClick={handleTest}
                disabled={isTesting || (provider === 'gemini' ? geminiKeys.filter(k => k.trim()).length === 0 : !groqKey)}
                className="flex-1 h-11 bg-white text-[#141414] font-bold rounded-xl border-2 border-[#141414] hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-sm"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                測試 {provider.toUpperCase()} 連線
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "p-3 rounded-xl border flex gap-3 items-start",
                  testResult.success 
                    ? "bg-green-50 border-green-200 text-green-700" 
                    : "bg-red-50 border-red-200 text-red-700"
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <div className="text-[11px] font-bold uppercase tracking-tight">
                  {testResult.message}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-[#F5F5F0] p-6 border-t-2 border-[#141414]/5 space-y-4">
          <div>
             <h3 className="text-[10px] font-black text-[#141414] uppercase tracking-widest mb-1.5 flex items-center gap-2">
               <ChevronRight className="w-3 h-3" /> 如何取得 API Keys？
             </h3>
             <ul className="text-[10px] text-[#5A5A40] space-y-1.5 list-disc pl-4">
               <li>
                 <a href="https://console.groq.com/keys" target="_blank" rel="referrer" className="text-orange-600 font-bold hover:underline">Groq Console</a>: (推薦) 提供快速且免費的批改服務。
               </li>
               <li>
                 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="referrer" className="text-blue-600 font-bold hover:underline">Google AI Studio</a>: 提供 Gemini 模型，作為備用 OCR 辨識。
               </li>
             </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


