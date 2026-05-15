import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, writeBatch } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDocs, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Camera, Upload, Send, CheckCircle2, ClipboardList, Clock, Sparkles, ChevronRight, X } from 'lucide-react';
import { recognizeHandwriting } from '../../services/ai';
import { cn } from '../../lib/utils';

interface Exam {
  id: string;
  title: string;
  description: string;
}

export default function StudentPortal({ user }: { user: User }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'exams' | 'history'>('exams');
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState<string | null>(null);
  
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    // List all available exams
    const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exams'));

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      const fetchHistory = async () => {
        const allSubs: any[] = [];
        for (const exam of exams) {
          const q = query(
            collection(db, 'exams', exam.id, 'submissions'),
            where('studentId', '==', user.uid)
          );
          const snap = await getDocs(q);
          snap.docs.forEach(d => allSubs.push({ ...d.data(), id: d.id, examTitle: exam.title }));
        }
        setMySubmissions(allSubs.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)));
      };
      fetchHistory();
    }
  }, [activeTab, exams, user.uid]);

  useEffect(() => {
    if (selectedExamId) {
      const fetchQuestions = async () => {
        const qSnap = await getDocs(collection(db, 'exams', selectedExamId, 'questions'));
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      };
      fetchQuestions();
    } else {
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
    }
  }, [selectedExamId]);

  const handleImageUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(qId);
    const mimeType = file.type;
    
    try {
      const reader = new FileReader();
      
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const base64 = await fileDataPromise;
      const text = await recognizeHandwriting(base64, mimeType);
      setAnswers(prev => ({ ...prev, [qId]: text }));
      
      // Clear the input value so the same file can be uploaded again if needed
      if (e.target) e.target.value = '';
      
    } catch (err: any) {
      console.error("處理檔案失敗", err);
      alert(`檔案讀寫或 AI 辨識失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setIsOcrLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedExamId) return;
    if (Object.keys(answers).length < questions.length) {
      if (!confirm('尚有題目未作答，確定要送出嗎？')) return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Submission
      const subRef = await addDoc(collection(db, 'exams', selectedExamId, 'submissions'), {
        examId: selectedExamId,
        studentName: studentName || user.displayName || '學生',
        studentId: user.uid,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });

      // 2. Add Results
      const batch = writeBatch(db);
      questions.forEach(q => {
        const resRef = doc(collection(db, 'exams', selectedExamId, 'submissions', subRef.id, 'results'));
        batch.set(resRef, {
          submissionId: subRef.id,
          questionId: q.id,
          studentAnswer: answers[q.id] || '',
          score: 0,
        });
      });
      await batch.commit();

      setSubmitted(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-sm border border-green-200">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold font-serif">作答已送出！</h1>
        <p className="text-[#5A5A40]">老師將會透過 AI 進行批改，稍後可在首頁查看結果。</p>
        <button 
          onClick={() => { setSelectedExamId(null); setSubmitted(false); }}
          className="px-8 py-3 bg-[#141414] text-white rounded-2xl font-bold hover:bg-black transition-all"
        >
          返回考卷列表
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {!selectedExamId ? (
        <div className="space-y-8">
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold font-serif mb-3">準備好開始作答了嗎？</h1>
              <p className="text-[#5A5A40]">選擇一份考卷，展示你的實力。</p>
            </div>

            <div className="flex bg-white/50 p-1.5 rounded-2xl border border-[#141414]/5 shadow-inner">
              <button 
                onClick={() => setActiveTab('exams')}
                className={cn(
                  "px-8 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'exams' ? "bg-[#141414] text-white shadow-xl" : "text-[#5A5A40] hover:bg-[#E4E3E0]"
                )}
              >
                <ClipboardList className="w-4 h-4" /> 考卷列表
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "px-8 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  activeTab === 'history' ? "bg-[#141414] text-white shadow-xl" : "text-[#5A5A40] hover:bg-[#E4E3E0]"
                )}
              >
                <Clock className="w-4 h-4" /> 我的紀錄
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'exams' ? (
              <motion.div 
                key="exams-grid"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {exams.map(exam => (
                  <motion.button
                    key={exam.id}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedExamId(exam.id)}
                    className="bg-white p-8 rounded-[32px] text-left border border-[#141414]/5 shadow-sm hover:shadow-xl transition-all group"
                  >
                    <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#141414] group-hover:text-white transition-colors">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{exam.title}</h3>
                    <p className="text-sm text-[#5A5A40] line-clamp-2">{exam.description || '無描述'}</p>
                    <div className="mt-8 flex items-center gap-2 text-xs font-bold text-[#141414] group-hover:translate-x-2 transition-transform">
                      進入考場 <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="history-list"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                {mySubmissions.length === 0 ? (
                  <div className="text-center py-20 bg-white/40 rounded-[32px] border-2 border-dashed border-[#141414]/10">
                    <Clock className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
                    <p className="text-[#5A5A40] italic">您目前還沒有任何作答紀錄</p>
                  </div>
                ) : (
                  mySubmissions.map(sub => (
                    <div key={sub.id} className="relative">
                      <div className="bg-white p-6 rounded-[32px] border border-[#141414]/5 shadow-sm flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#141414]">
                            <CheckCircle2 className={cn("w-6 h-6", sub.status === 'graded' ? "text-green-500" : "text-yellow-500")} />
                          </div>
                          <div>
                            <h4 className="font-bold text-[#141414]">{sub.examTitle}</h4>
                            <p className="text-xs text-[#5A5A40]">
                              送出時間：{sub.submittedAt?.toDate().toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div className="flex flex-col items-end mr-2">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mb-1",
                              sub.status === 'graded' ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                            )}>
                              {sub.status === 'graded' ? '已批改' : '批改中'}
                            </span>
                            {sub.status === 'graded' && (
                              <div className="text-right">
                                <p className="text-[9px] font-black text-[#5A5A40] uppercase tracking-tighter mb-0.5 opacity-60">非選擇題總分</p>
                                <p className="text-2xl font-black text-[#141414] leading-none">
                                  {sub.totalScore} 
                                  <span className="text-xs font-medium text-[#5A5A40] ml-0.5">分</span>
                                </p>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => setExpandedSubId(expandedSubId === sub.id ? null : sub.id)}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              expandedSubId === sub.id ? "bg-[#141414] text-white" : "hover:bg-[#F5F5F0] text-[#5A5A40]"
                            )}
                          >
                            <ChevronRight className={cn("w-5 h-5 transition-transform", expandedSubId === sub.id && "rotate-90")} />
                          </button>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedSubId === sub.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-[#141414]/5 bg-[#F5F5F0]/20 rounded-b-[32px] mt-[-16px] pt-8 pb-6 px-6"
                          >
                            <StudentResultDetail examId={sub.examId} submissionId={sub.id} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between bg-white p-6 rounded-[32px] border border-[#141414]/5 shadow-sm gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold font-serif">{exams.find(e => e.id === selectedExamId)?.title}</h2>
              <p className="text-xs text-[#5A5A40] uppercase tracking-widest mt-1">作答中 (共 {questions.length} 題)</p>
            </div>
            <div className="w-full md:w-64">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] mb-1 block">填寫您的姓名</label>
              <input 
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="例如：王小明"
                className="w-full bg-[#F5F5F0] border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#141414]"
              />
            </div>
            <button 
              onClick={() => setSelectedExamId(null)}
              className="p-2 text-[#5A5A40] hover:text-[#141414] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-12 pb-24">
            {questions.map((q, idx) => (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-8 rounded-[32px] border border-[#141414]/5 shadow-sm relative"
              >
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#141414] text-white rounded-full flex items-center justify-center font-bold font-serif">
                  {idx + 1}
                </div>

                <p className="text-lg font-medium mb-6 leading-relaxed">{q.content}</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">你的回答</label>
                    <div className="flex gap-2">
                       <input 
                         type="file" 
                         accept="image/*,.pdf" 
                         className="hidden" 
                         ref={el => fileInputs.current[q.id] = el}
                         onChange={(e) => handleImageUpload(q.id, e)}
                       />
                       <button 
                         onClick={() => fileInputs.current[q.id]?.click()}
                         className="px-3 py-1.5 bg-[#F5F5F0] text-[#141414] rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-[#E4E3E0] transition-all"
                       >
                         {isOcrLoading === q.id ? <Clock className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                         上傳圖片或 PDF 辨識
                       </button>
                    </div>
                  </div>
                  
                  <textarea 
                    disabled={isOcrLoading === q.id}
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={isOcrLoading === q.id ? "⏳ AI 正在拼命辨識您的答案，請稍候..." : "在此輸入文字答案或使用拍照辨識..."}
                    rows={4}
                    className={`w-full bg-[#F5F5F0] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#141414] transition-all ${isOcrLoading === q.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  
                  {isOcrLoading === q.id && (
                    <div className="flex flex-col gap-2 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-2 text-blue-600 animate-pulse text-xs font-bold">
                         <Sparkles className="w-3.5 h-3.5" /> AI 正在解析您的手寫內容與運算過程...
                      </div>
                      <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: "0%" }}
                          animate={{ width: "95%" }}
                          transition={{ duration: 10, ease: "linear" }}
                          className="bg-blue-500 h-full"
                        />
                      </div>
                      <p className="text-[10px] text-blue-500 font-medium text-center italic">這可能需要幾秒鐘的時間，請勿重新整理</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50">
            <button 
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {isSubmitting ? <Clock className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
              送出考卷
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentResultDetail({ examId, submissionId }: { examId: string, submissionId: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const rSnap = await getDocs(collection(db, 'exams', examId, 'submissions', submissionId, 'results'));
        setResults(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [examId, submissionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Clock className="w-6 h-6 animate-spin text-[#5A5A40]/40" />
        <p className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest">正在讀取批改結果...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border-2 border-[#141414]/5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <h5 className="text-xs font-black text-[#141414] uppercase tracking-widest">批改總結</h5>
        </div>
        <p className="text-sm text-[#5A5A40] italic leading-relaxed">
          AI 已根據評分準則完成批改。以下是您的詳細得分與回饋。
        </p>
      </div>

      {results.map(res => {
        const q = questions.find(q => q.id === res.questionId);
        return (
          <div key={res.id} className="bg-white rounded-2xl border border-[#141414]/5 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#F5F5F0]/50 border-b border-[#141414]/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-[#141414] text-white text-[10px] font-black rounded-lg flex items-center justify-center">
                  {q?.questionNumber}
                </span>
                <span className="text-xs font-black text-[#141414]">題目內容</span>
              </div>
              {res.score !== undefined && (
                <div className="text-xs font-black px-2 py-1 bg-[#F5F5F0] rounded-lg border border-[#141414]/10">
                  <span className={res.score === q?.points ? "text-green-600" : "text-orange-500"}>
                    {res.score}
                  </span>
                  <span className="text-[#5A5A40]/40 mx-1">/</span>
                  <span>{q?.points}</span>
                </div>
              )}
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-[#141414] font-medium leading-relaxed">{q?.content}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-[#5A5A40] tracking-widest block">你的回答</label>
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 min-h-[60px]">
                    <p className="text-sm text-blue-900 font-medium">{res.studentAnswer || '(未填寫)'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-[#5A5A40] tracking-widest block">參考答案</label>
                  <div className="p-3 bg-green-50/50 rounded-xl border border-green-100 min-h-[60px]">
                    <p className="text-sm text-green-900 font-medium">{q?.standardAnswer || '(無參考答案)'}</p>
                  </div>
                </div>
              </div>

              {res.feedback && (
                <div className="pt-4 border-t border-[#141414]/5">
                   <div className="bg-white rounded-xl border-2 border-[#141414]/5 p-4 relative">
                      <div className="absolute top-0 left-6 -mt-2.5 px-2 bg-white flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">AI 智慧分析回饋</span>
                      </div>
                      <p className="text-sm text-[#141414] italic leading-relaxed mt-2 whitespace-pre-wrap">{res.feedback}</p>
                      {res.analysis?.errorsFound?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {res.analysis.errorsFound.map((err: string, i: number) => (
                            <span key={i} className="text-[9px] bg-red-100 text-red-600 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                              {err}
                            </span>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
