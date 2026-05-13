import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, writeBatch } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle, Sparkles, User, FileText, Trash2, PlusCircle } from 'lucide-react';
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-[#5A5A40] uppercase tracking-widest">作答列表 ({submissions.length})</h3>
        <div className="flex gap-2">
          {teacherView && (
            <button 
              onClick={() => setIsAdding(true)}
              className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-all shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" /> 代上傳學生作答
            </button>
          )}
          {teacherView && submissions.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-all"
            >
              清空所有作答
            </button>
          )}
          {teacherView && submissions.some(s => s.status === 'pending') && (
            <button 
              onClick={handleGradeAll}
              className="text-xs font-bold bg-[#141414] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-black transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> 一鍵 AI 批改
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-3xl"
            >
              <AddSubmission 
                user={user} 
                examId={examId} 
                onCancel={() => setIsAdding(false)} 
                onSuccess={() => { setIsAdding(false); alert('已成功新增一筆作答！'); }} 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {submissions.map(sub => (
          <div key={sub.id} className="bg-[#F5F5F0]/50 rounded-2xl border border-[#141414]/5 overflow-hidden">
            <div 
              onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-[#141414]/5 text-[#5A5A40]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#141414]">{sub.studentName}</h4>
                  <p className="text-[10px] text-[#5A5A40] uppercase tracking-wider">{formatDate(sub.submittedAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {teacherView && (
                  <button 
                    onClick={(e) => handleDeleteSubmission(sub.id, e)}
                    className="p-2 text-[#5A5A40]/30 hover:text-red-500 transition-colors"
                    title="刪除作答"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="flex flex-col items-end">
                  {sub.status === 'graded' ? (
                    <>
                      <div className="flex items-center gap-1.5 text-green-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{sub.totalScore} / {sub.maxScore}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-[#5A5A40]/40">已批改</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-orange-500 font-bold">
                        <Clock className="w-4 h-4" />
                        <span>待批改</span>
                      </div>
                      {gradingId === sub.id && <span className="text-[10px] text-blue-500 animate-pulse font-bold">批改中...</span>}
                    </>
                  )}
                </div>
                {expandedId === sub.id ? <ChevronUp className="w-5 h-5 text-[#5A5A40]" /> : <ChevronDown className="w-5 h-5 text-[#5A5A40]" />}
              </div>
            </div>

            <AnimatePresence>
              {expandedId === sub.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 border-t border-[#141414]/5"
                >
                  <div className="py-4 space-y-4">
                     <ResultDetail examId={examId} submissionId={sub.id} />
                     
                     {teacherView && sub.status === 'pending' && (
                       <button 
                        disabled={gradingId === sub.id}
                        onClick={() => autoGradeSubmission(sub)}
                        className="w-full bg-[#141414] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
                       >
                         {gradingId === sub.id ? <Clock className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                         開始 AI 批改
                       </button>
                     )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
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
          <div key={res.id} className="bg-white p-4 rounded-xl border border-[#141414]/5">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5 rounded">第 {q?.questionNumber} 題</span>
              {res.score !== undefined && (
                <span className="text-sm font-bold text-[#141414]">{res.score} / {q?.points} 分</span>
              )}
            </div>
            <p className="text-xs text-[#5A5A40] mb-2 font-medium">{q?.content}</p>
            <div className="bg-[#F5F5F0] p-3 rounded-lg mb-3">
              <p className="text-[10px] uppercase font-bold text-[#5A5A40] mb-1">學生答案：</p>
              <p className="text-sm">{res.studentAnswer}</p>
            </div>
            {res.feedback && (
              <div className="space-y-2 border-t border-[#141414]/5 pt-3">
                 <p className="text-[10px] uppercase font-bold text-blue-600 mb-1 flex items-center gap-1">
                   <Sparkles className="w-3 h-3" /> AI 批改回饋：
                 </p>
                 <p className="text-xs text-[#141414] italic leading-relaxed">"{res.feedback}"</p>
                 {res.analysis?.errorsFound?.length > 0 && (
                   <div className="flex flex-wrap gap-2 mt-2">
                     {res.analysis.errorsFound.map((err: string, i: number) => (
                       <span key={i} className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                         {err}
                       </span>
                     ))}
                   </div>
                 )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
