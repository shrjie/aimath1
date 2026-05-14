import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Settings, RefreshCw, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { testConnection } from '../../services/ai';
import { cn } from '../../lib/utils';

interface AISettingsProps {
  onClose: () => void;
}

export default function AISettings({ onClose }: AISettingsProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
            <h2 className="font-bold">AI 服務設定</h2>
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
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <h3 className="font-bold text-blue-900 text-sm">已切換至 Gemini AI</h3>
                <p className="text-xs text-blue-700 mt-1">
                  目前的系統已切換至使用 Google Gemini API 進行 OCR 手寫辨識與智慧批改。
                </p>
              </div>
            </div>

            <p className="text-xs text-[#5A5A40]">
              API Key 已由系統管理。您可以點擊下方按鈕測試目前的連線狀態。
            </p>

            <button
              onClick={handleTest}
              disabled={isTesting}
              className="w-full h-12 bg-[#141414] text-white font-bold rounded-xl border-2 border-[#141414] hover:bg-black active:translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              測試 Gemini 連線
            </button>
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
          <h3 className="text-sm font-bold text-[#141414] mb-2">如何設定 API Key？</h3>
          <p className="text-xs text-[#5A5A40] leading-relaxed">
            請點擊右邊選單的 <span className="font-bold flex inline-flex items-center gap-1">Settings <ChevronRight className="w-3 h-3" /> Secrets</span>，在 <b>GEMINI_API_KEY</b> 中輸入您的 API 金鑰。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}


