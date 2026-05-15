import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, BookOpen, Trash2, ChevronRight, FileText, BarChart3, Users, LayoutDashboard, Settings, ClipboardCheck, Pencil, Loader2 } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import ExamEditor from './ExamEditor';
import SubmissionList from './SubmissionList';
import StatisticsReport from '../report/StatisticsReport';
import AISettings from './AISettings';

interface Exam {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  createdAt: any;
}

export default function TeacherDashboard({ user }: { user: User }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingExamData, setEditingExamData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'exams' | 'submissions' | 'report'>('exams');
  const [showSettings, setShowSettings] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'exams'),
      where('teacherId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exams'));

    return unsubscribe;
  }, [user.uid]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('確定要刪除這份考卷嗎？此動作無法復原。')) {
      try {
        await deleteDoc(doc(db, 'exams', id));
        if (selectedExamId === id) setSelectedExamId(null);
      } catch (err: any) {
        console.error("Delete failed:", err);
        alert("刪除失敗：" + (err.message || "權限不足"));
        handleFirestoreError(err, OperationType.DELETE, `exams/${id}`);
      }
    }
  };

  const handleEdit = async (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingEdit(exam.id);
    try {
      const qSnap = await getDocs(query(collection(db, 'exams', exam.id, 'questions'), orderBy('questionNumber', 'asc')));
      const questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEditingExamData({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        questions
      });
      setIsCreating(true);
    } catch (err) {
      console.error("Fetch questions failed:", err);
      alert("讀取題目失敗");
    } finally {
      setLoadingEdit(null);
    }
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
      {/* Sidebar - Exam List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[#141414]" />
            <h2 className="text-xl font-black tracking-tight">我的考卷</h2>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-white text-[#141414] border-2 border-[#141414] rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
              title="AI 服務狀態"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setEditingExamData(null); setIsCreating(true); }}
              className="p-2.5 bg-[#141414] text-white rounded-xl hover:bg-black active:scale-95 transition-all shadow-[2px_2px_10px_0px_rgba(20,20,20,0.2)]"
              title="建立新考卷"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {exams.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-white/40 rounded-[2rem] border-2 border-dashed border-[#141414]/10">
              < BookOpen className="w-8 h-8 text-[#5A5A40]/30 mx-auto mb-2" />
              <p className="text-xs text-[#5A5A40] font-medium italic">尚未建立任何考卷</p>
            </div>
          ) : (
            exams.map(exam => (
              <div
                key={exam.id}
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedExamId(exam.id); setActiveTab('submissions'); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedExamId(exam.id);
                    setActiveTab('submissions');
                  }
                }}
                className={`cursor-pointer w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 group overflow-hidden relative ${
                  selectedExamId === exam.id 
                    ? "bg-white border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] -translate-x-1 -translate-y-1" 
                    : "bg-white/60 border-transparent hover:bg-white hover:border-[#141414]/20 hover:shadow-lg"
                }`}
              >
                {selectedExamId === exam.id && (
                  <div className="absolute top-0 right-0 w-12 h-12 bg-[#141414] -mr-6 -mt-6 rotate-45" />
                )}
                <div className="flex justify-between items-start mb-1 relative z-10">
                  <h3 className="font-bold text-[#141414] line-clamp-1 pr-4">{exam.title}</h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {exam.teacherId === user.uid && (
                      <>
                        <button 
                          disabled={loadingEdit === exam.id}
                          onClick={(e) => handleEdit(exam, e)}
                          className="p-1 text-[#5A5A40]/40 hover:text-blue-600 transition-colors"
                          title="編輯給分標準"
                        >
                          {loadingEdit === exam.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={(e) => handleDelete(exam.id, e)}
                          className="p-1 text-[#5A5A40]/40 hover:text-red-500 transition-colors"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 relative z-10">
                  <FileText className="w-3 h-3 text-[#5A5A40]/40" />
                  <p className="text-[10px] text-[#5A5A40] font-bold uppercase tracking-wider">{formatDate(exam.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3">
        <AnimatePresence mode="wait">
          {isCreating ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <ExamEditor 
                user={user} 
                onCancel={() => { setIsCreating(false); setEditingExamData(null); }} 
                initialData={editingExamData}
              />
            </motion.div>
          ) : selectedExam ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Exam Detail Header */}
              <div className="bg-white p-5 sm:p-8 rounded-[2.5rem] shadow-xl shadow-[#141414]/5 border border-[#141414]/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <ClipboardCheck className="w-32 h-32 text-[#141414]" />
                </div>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 relative z-10">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#141414] mb-3 leading-tight tracking-tight">{selectedExam.title}</h1>
                    <p className="text-[#5A5A40] text-sm sm:text-base max-w-2xl font-medium leading-relaxed">{selectedExam.description}</p>
                  </div>
                  <div className="flex bg-[#F5F5F0] p-1.5 rounded-2xl border-2 border-[#141414]/5 self-start md:self-auto">
                    <button 
                      onClick={() => setActiveTab('submissions')}
                      className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2.5 ${activeTab === 'submissions' ? 'bg-[#141414] text-white shadow-lg' : 'text-[#5A5A40] hover:bg-[#E4E3E0]'}`}
                    >
                      <Users className="w-4 h-4" />
                      <span>學生作答</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('report')}
                      className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2.5 ${activeTab === 'report' ? 'bg-[#141414] text-white shadow-lg' : 'text-[#5A5A40] hover:bg-[#E4E3E0]'}`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>分析報告</span>
                    </button>
                  </div>
                </div>

                <div className="border-t-2 border-[#141414]/5 pt-8">
                  {activeTab === 'submissions' ? (
                    <SubmissionList examId={selectedExam.id} teacherView user={user} />
                  ) : (
                    <StatisticsReport examId={selectedExam.id} />
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-[#141414]/5 border-2 border-[#141414]/5"
              >
                <ClipboardCheck className="w-12 h-12 text-[#141414]/10" />
              </motion.div>
              <h3 className="text-2xl font-black text-[#141414] mb-3">準備好開始了嗎？</h3>
              <p className="text-[#5A5A40] font-medium max-w-xs mx-auto">請從左側清單選擇考卷，或點擊右上角「<Plus className="inline w-4 h-4" />」建立新的批改任務。</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSettings && (
          <AISettings onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
