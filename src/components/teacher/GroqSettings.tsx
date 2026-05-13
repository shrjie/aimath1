import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Key, CheckCircle2, AlertCircle, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { getApiKey, setApiKey, testConnection } from '../../services/ai';
import { cn } from '../../lib/utils';

interface GroqSettingsProps {
  onClose: () => void;
}

export default function GroqSettings({ onClose }: GroqSettingsProps) {
  const [apiKey, setKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setKey(getApiKey());
  }, []);

  const handleSave = () => {
    setApiKey(apiKey);
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '測試失敗' });
    } finally {
      setIsTesting(false);
    }
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
            <h2 className="font-bold">Groq API 設定</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#141414] mb-2 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-500" />
                GROQ_API_KEY
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full h-12 px-4 bg-[#F5F5F0] border-2 border-[#141414] rounded-xl focus:ring-0 focus:outline-none focus:bg-white transition-all font-mono"
                />
              </div>
              <p className="mt-2 text-[10px] text-[#5A5A40]">
                API Key 會儲存在瀏覽器的 Local Storage 中。如果環境變數有設定，優先使用環境變數。
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleSave}
                disabled={isTesting}
                className="flex-1 h-12 bg-[#D1D1B8] text-[#141414] font-bold rounded-xl border-2 border-[#141414] hover:bg-[#C4C4A8] active:translate-y-0.5 transition-all"
              >
                儲存設定
              </button>
              <button
                onClick={handleTest}
                disabled={isTesting || !apiKey}
                className="flex-1 h-12 bg-white text-[#141414] font-bold rounded-xl border-2 border-[#141414] hover:bg-gray-50 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTesting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                測試連線
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
                  "p-4 rounded-xl border-2 flex gap-3 items-start",
                  testResult.success 
                    ? "bg-green-50 border-green-200 text-green-700" 
                    : "bg-red-50 border-red-200 text-red-700"
                )}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <div className="text-sm font-medium">
                  {testResult.message}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-[#F5F5F0] p-6 border-t-2 border-[#141414]/10">
          <h3 className="text-sm font-bold text-[#141414] mb-2">如何取得 API Key？</h3>
          <p className="text-xs text-[#5A5A40] leading-relaxed">
            請前往 <a href="https://console.groq.com/keys" target="_blank" rel="referrer" className="text-blue-600 font-bold hover:underline">Groq Cloud Console</a> 建立帳號並產生 API Key。
            Groq 目前提供非常快速且免費的 Llama 3 系列模型額度。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
