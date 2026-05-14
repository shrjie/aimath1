import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, writeBatch } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle, Sparkles, User, FileText, Trash2, PlusCircle, Users } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { gradeAnswer, QuestionData } from '../../services/ai';
import AddSubmission from './AddSubmission';

interface Submission {
  id: string;
  studentName: string;
  studentId: string;
  status: 'pending' | 'graded';
  totalScore: number;
  maxScore: number;
  submittedAt: any;
  gradedAt?: any;
  feedback?: string;
}

export default function SubmissionList({ examId, teacherView, user }: { examId: string, teacherView?: boolean, user?: any }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'exams', examId, 'submissions'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `exams/${examId}/submissions`));

    return unsubscribe;
  }, [examId]);

  const handleDeleteSubmission = async (subId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('確定要刪除這筆學生的作答嗎？此動作無法復原。')) return;
    try {
      // Also delete subcollection results for cleanliness
      const rSnap = await getDocs(collection(db, 'exams', examId, 'submissions', subId, 'results'));
      const batchInstance = writeBatch(db);
      rSnap.docs.forEach(d => batchInstance.delete(d.ref));
      batchInstance.delete(doc(db, 'exams', examId, 'submissions', subId));
      await batchInstance.commit();
    } catch (err: any) {
      alert(`刪除失敗：${err.message || '請確認權限'}`);
      handleFirestoreError(err, OperationType.DELETE, `exams/${examId}/submissions/${subId}`);
    }
  };

  const handleClearAll = async () => {
    if (submissions.length === 0) return;
    if (!confirm(`確定要刪除考卷下「所有」(${submissions.length}筆) 學生的作答嗎？此動作無法復原。`)) return;
    
    try {
      setGradingId('all'); // Show a generic loading state
      
      // Deleting subcollections in bulk is hard in client, so we do it per submission
      // To avoid "batch is not defined" or other scope issues, we'll be very explicit
      for (const sub of submissions) {
        const subId = sub.id;
        // Delete results first
        const resultsRef = collection(db, 'exams', examId, 'submissions', subId, 'results');
        const rSnap = await getDocs(resultsRef);
        
        const batchInstance = writeBatch(db);
        rSnap.docs.forEach(d => batchInstance.delete(d.ref));
        
        // Delete submission itself
        batchInstance.delete(doc(db, 'exams', examId, 'submissions', subId));
        await batchInstance.commit();
      }
      
      alert('已成功清空所有作答。');
    } catch (err: any) {
      console.error("Clear all failed", err);
      alert(`清空失敗：${err.message || '請確認權限'}`);
      handleFirestoreError(err, OperationType.DELETE, `exams/${examId}/submissions`);
    } finally {
      setGradingId(null);
    }
  };

  const handleGradeAll = async () => {
    const pending = submissions.filter(s => s.status === 'pending');
    if (pending.length === 0) return alert('沒有待批改的作答');
    
    if (!confirm(`將對 ${pending.length} 份作答進行 AI 智慧批改，是否繼續？`)) return;
    
    setGradingId('all');
    try {
      for (const sub of pending) {
        await autoGradeSubmission(sub);
      }
      alert('所有待批改作答已處理完成。');
    } catch (err: any) {
      alert(`批改過程發生錯誤：${err.message}`);
    } finally {
      setGradingId(null);
    }
  };

  const autoGradeSubmission = async (submission: Submission) => {
    setGradingId(submission.id);
    try {
      // 1. Get all questions for this exam
      const qSnapshot = await getDocs(collection(db, 'exams', examId, 'questions'));
      const questions = qSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // 2. Get student results (answers)
      const rSnapshot = await getDocs(collection(db, 'exams', examId, 'submissions', submission.id, 'results'));
      const results = rSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let totalScore = 0;
      let totalPlanned = 0;

      for (const res of results) {
        const question = questions.find((q: any) => q.id === res.questionId);
        if (!question) continue;

        // Perform AI Grading
        const analysis = await gradeAnswer(question, res.studentAnswer);
        
        // Update Result doc
        await updateDoc(doc(db, 'exams', examId, 'submissions', submission.id, 'results', res.id), {
          score: analysis.totalScore,
          feedback: analysis.genericFeedback,
          analysis: {
            pointsByRubric: analysis.items.map(i => i.score),
            errorsFound: analysis.errorTypes
          }
        });

        totalScore += analysis.totalScore;
        totalPlanned += (question.points || 0);
      }

      // 3. Finalize Submission
      await updateDoc(doc(db, 'exams', examId, 'submissions', submission.id), {
        status: 'graded',
        totalScore,
        maxScore: totalPlanned,
        gradedAt: serverTimestamp(),
        feedback: "AI 批改完成。請確認結果。"
      });

    } catch (err: any) {
      console.error("Grading sub failed", err);
      // Don't alert here to not break the loop in handleGradeAll, but log and maybe set error status?
      throw err; // Re-throw so handleGradeAll knows
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F5F5F0] rounded-lg flex items-center justify-center border-2 border-[#141414]/5">
            <Users className="w-4 h-4 text-[#141414]" />
          </div>
          <h3 className="text-sm font-black text-[#141414] uppercase tracking-widest">作答列表 ({submissions.length})</h3>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {teacherView && (
            <button 
              onClick={() => setIsAdding(true)}
              className="flex-grow sm:flex-grow-0 text-[10px] sm:text-xs font-black bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 代上傳作答
            </button>
          )}
          {teacherView && submissions.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="text-[10px] sm:text-xs font-black text-red-500 hover:bg-red-50 px-3 py-2.5 rounded-xl transition-all border-2 border-transparent hover:border-red-100"
            >
              清空
            </button>
          )}
          {teacherView && submissions.some(s => s.status === 'pending') && (
            <button 
              onClick={handleGradeAll}
              className={`flex-grow sm:flex-grow-0 text-[10px] sm:text-xs font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg ${
                gradingId === 'all' 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-[#141414] text-white hover:bg-black active:scale-95'
              }`}
              disabled={gradingId === 'all'}
            >
              {gradingId === 'all' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              一鍵 AI 批改
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {submissions.length === 0 ? (
          <div className="text-center py-16 bg-[#F5F5F0]/30 rounded-[2rem] border-2 border-dashed border-[#141414]/5">
            <FileText className="w-12 h-12 text-[#5A5A40]/20 mx-auto mb-4" />
            <p className="text-sm text-[#5A5A40] font-medium">目前尚無作答資料</p>
          </div>
        ) : (
          submissions.map(sub => (
            <div key={sub.id} className={`group bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden ${
              expandedId === sub.id 
                ? "border-[#141414] shadow-xl" 
                : "border-[#141414]/5 hover:border-[#141414]/20 hover:shadow-md"
            }`}>
              <div 
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                className="p-4 sm:p-5 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center border-2 border-[#141414]/5 group-hover:bg-white transition-colors">
                    <User className="w-6 h-6 text-[#141414]/40" />
                  </div>
                  <div>
                    <h4 className="font-black text-[#141414] text-lg leading-tight">{sub.studentName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                       <Clock className="w-3 h-3 text-[#5A5A40]/40" />
                       <p className="text-[10px] text-[#5A5A40] font-bold uppercase tracking-widest">{formatDate(sub.submittedAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6">
                  {teacherView && (
                    <button 
                      onClick={(e) => handleDeleteSubmission(sub.id, e)}
                      className="hidden sm:block p-2.5 text-[#5A5A40]/30 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="刪除作答"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex flex-col items-end min-w-[80px]">
                    {sub.status === 'graded' ? (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm font-black border border-green-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{sub.totalScore} / {sub.maxScore}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-500 rounded-full text-[10px] font-black border border-orange-100 uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          <span>待批改</span>
                        </div>
                        {gradingId === sub.id && <span className="text-[10px] text-blue-500 animate-pulse font-bold mt-1">AI 批改中...</span>}
                      </div>
                    )}
                  </div>
                  <div className={`p-1 rounded-lg transition-transform duration-300 ${expandedId === sub.id ? 'rotate-180 bg-[#141414] text-white' : 'text-[#5A5A40]'}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === sub.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-6 border-t-2 border-[#141414]/5 pt-6 bg-[#F5F5F0]/30">
                      <div className="space-y-6">
                         <ResultDetail examId={examId} submissionId={sub.id} />
                         
                         {teacherView && sub.status === 'pending' && (
                           <button 
                            disabled={gradingId === sub.id}
                            onClick={() => autoGradeSubmission(sub)}
                            className="w-full bg-[#141414] text-white py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 hover:bg-black active:scale-[0.98] transition-all shadow-xl shadow-[#141414]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             {gradingId === sub.id ? <Clock className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                             啟動 AI 智慧批改引擎
                           </button>
                         )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResultDetail({ examId, submissionId }: { examId: string, submissionId: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    const fetchResults = async () => {
      const qSnap = await getDocs(collection(db, 'exams', examId, 'questions'));
      setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const rSnap = await getDocs(collection(db, 'exams', examId, 'submissions', submissionId, 'results'));
      setResults(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchResults();
  }, [examId, submissionId]);

  return (
    <div className="space-y-4">
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
                <div className="text-xs font-black px-2 py-1 bg-white rounded-lg border border-[#141414]/10">
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
                  <label className="text-[10px] uppercase font-black text-[#5A5A40] tracking-widest block">學生回答</label>
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 min-h-[60px]">
                    <p className="text-sm text-blue-900 font-medium">{res.studentAnswer}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-[#5A5A40] tracking-widest block">參考答案</label>
                  <div className="p-3 bg-green-50/50 rounded-xl border border-green-100 min-h-[60px]">
                    <p className="text-sm text-green-900 font-medium">{q?.answer}</p>
                  </div>
                </div>
              </div>

              {res.feedback && (
                <div className="pt-4 border-t border-[#141414]/5">
                   <div className="bg-white rounded-xl border-2 border-[#141414]/5 p-4 relative">
                      <div className="absolute top-0 left-6 -mt-2.5 px-2 bg-white flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">AI 智慧分析</span>
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
