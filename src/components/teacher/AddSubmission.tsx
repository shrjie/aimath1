import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, writeBatch } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Upload, Send, Clock, Sparkles, Loader2 } from 'lucide-react';
import { recognizeHandwriting } from '../../services/ai';

interface Props {
  user: User;
  examId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function AddSubmission({ user, examId, onCancel, onSuccess }: Props) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `exams/${examId}/questions`);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [examId]);

  const handleImageUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(qId);
    const mimeType = file.type;
    
    try {
      console.log(`Starting OCR for question ${qId}, file: ${file.name}`);
      
      // Step 1: Read the file immediately
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const base64 = await fileDataPromise;
      console.log("File read success, sending to AI...");
      
      // Step 2: OCR with Gemini
      const text = await recognizeHandwriting(base64, mimeType);
      
      if (text.includes('[無法辨識]')) {
        alert('AI 無法清楚辨識圖片中的內容，請嘗試拍攝更清晰的照片。');
      } else {
        setAnswers(prev => ({ ...prev, [qId]: text }));
      }
      
      if (e.target) e.target.value = '';
    } catch (err: any) {
      console.error("處理檔案失敗", err);
      alert(`辨識失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setIsOcrLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!studentName) return alert('請輸入學生姓名');
    
    setIsSubmitting(true);
    try {
      // 1. Create Submission
      const subRef = await addDoc(collection(db, 'exams', examId, 'submissions'), {
        examId,
        studentName,
        studentId: user.uid, // Marked as teacher-created
        status: 'pending',
        submittedAt: serverTimestamp(),
      });

      // 2. Add Results
      const batch = writeBatch(db);
      questions.forEach(q => {
        const resRef = doc(collection(db, 'exams', examId, 'submissions', subRef.id, 'results'));
        batch.set(resRef, {
          submissionId: subRef.id,
          questionId: q.id,
          studentAnswer: answers[q.id] || '',
          score: 0,
        });
      });
      await batch.commit();
      
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></div>;

  return (
    <div className="bg-white rounded-[32px] border border-[#141414]/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="p-6 border-b border-[#141414]/5 flex items-center justify-between bg-white sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold font-serif">代上傳學生作答</h2>
          <p className="text-[10px] text-[#5A5A40] uppercase tracking-widest mt-1">手動輸入或使用 AI 辨識照片</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
          <X className="w-5 h-5 text-[#5A5A40]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">
        {/* Student Info */}
        <div className="bg-[#F5F5F0] p-6 rounded-2xl">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] mb-2 block">學生姓名 *</label>
          <input 
            autoFocus
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            placeholder="例如：王小明"
            className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#141414] shadow-sm"
          />
        </div>

        {/* Question Inputs */}
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={q.id} className="relative bg-white border border-[#141414]/5 p-6 rounded-2xl shadow-sm hover:border-[#141414]/10 transition-all">
              <span className="absolute -top-3 -left-3 w-8 h-8 bg-[#141414] text-white rounded-full flex items-center justify-center text-xs font-bold font-serif shadow-lg">
                {idx + 1}
              </span>
              
              <div className="mb-4 pr-16">
                <p className="text-sm font-medium text-[#141414]">{q.content}</p>
                <span className="text-[10px] text-[#5A5A40] opacity-50">（滿分 {q.points} 分）</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">學生回答內容</label>
                  <div className="flex gap-2">
                    <input 
                       type="file" 
                       accept="image/*,.pdf" 
                       className="hidden" 
                       ref={el => fileInputs.current[q.id] = el}
                       onChange={(e) => handleImageUpload(q.id, e)}
                    />
                    <button 
                       disabled={isOcrLoading !== null}
                       onClick={() => fileInputs.current[q.id]?.click()}
                       className={`px-3 py-1.5 bg-[#F5F5F0] text-[#141414] rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-[#E4E3E0] transition-all disabled:opacity-50 ${isOcrLoading === q.id ? 'bg-blue-100 text-blue-600' : ''}`}
                    >
                       {isOcrLoading === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                       {isOcrLoading === q.id ? '辨識中...' : '拍照/選圖辨識'}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea 
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="請在此輸入學生答案內容..."
                    className={`w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-3 text-sm min-h-[80px] focus:ring-2 focus:ring-[#141414] transition-all ${isOcrLoading === q.id ? 'bg-blue-50 animate-pulse' : ''}`}
                  />
                  
                  {isOcrLoading === q.id && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50/80 rounded-xl backdrop-blur-[1px] z-10"
                    >
                      <Sparkles className="w-5 h-5 text-blue-600 animate-bounce mb-2" />
                      <p className="text-[10px] font-bold text-blue-600">AI 正拼命努力讀取中...</p>
                      <div className="w-24 bg-blue-200 h-1 rounded-full mt-2 overflow-hidden">
                        <motion.div 
                          initial={{ x: "-100%" }}
                          animate={{ x: "100%" }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          className="w-1/2 h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-[#F5F5F0] flex items-center justify-end gap-3 sticky bottom-0 z-10 border-t border-[#141414]/5">
        <button 
          onClick={onCancel}
          className="px-6 py-2.5 text-sm font-bold text-[#5A5A40] hover:text-[#141414] transition-colors"
        >
          取消
        </button>
        <button 
          disabled={isSubmitting || isOcrLoading !== null}
          onClick={handleSubmit}
          className="bg-[#141414] text-white px-8 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black shadow-lg disabled:opacity-50 transition-all"
        >
          {isSubmitting ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          儲存作答
        </button>
      </div>
    </div>
  );
}
