import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, BookOpen, Trash2, ChevronRight, FileText, BarChart3, Users, LayoutDashboard, Settings } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import ExamEditor from './ExamEditor';
import SubmissionList from './SubmissionList';
import StatisticsReport from '../report/StatisticsReport';
import GroqSettings from './GroqSettings';

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
  const [activeTab, setActiveTab] = useState<'exams' | 'submissions' | 'report'>('exams');
  const [showSettings, setShowSettings] = useState(false);

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
    if (confirm('確定要刪除這份考卷嗎？此動作無法復原。')) {
      try {
        await deleteDoc(doc(db, 'exams', id));
        if (selectedExamId === id) setSelectedExamId(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `exams/${id}`);
      }
    }
  };

  const selectedExam = exams.find(e => e.id === selectedExamId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar - Exam List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-serif">我的考卷</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 bg-white text-[#141414] border-2 border-[#141414] rounded-lg hover:bg-gray-50 transition-colors"
              title="Groq API 設定"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="p-2 bg-[#141414] text-white rounded-lg hover:bg-black transition-colors"
              title="建立新考卷"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {exams.length === 0 ? (
            <div className="text-center py-12 bg-white/50 rounded-3xl border-2 border-dashed border-[#141414]/10">
              <BookOpen className="w-8 h-8 text-[#5A5A40]/30 mx-auto mb-2" />
              <p className="text-xs text-[#5A5A40]">尚未建立考卷</p>
            </div>
          ) : (
            exams.map(exam => (
              <button
                key={exam.id}
                onClick={() => { setSelectedExamId(exam.id); setActiveTab('submissions'); }}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group ${
                  selectedExamId === exam.id 
                    ? "bg-white border-[#141414] shadow-md ring-1 ring-[#141414]" 
                    : "bg-white/40 border-transparent hover:bg-white hover:border-[#141414]/20"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-[#141414] line-clamp-1">{exam.title}</h3>
                  <Trash2 
                    onClick={(e) => handleDelete(exam.id, e)}
                    className="w-4 h-4 text-[#5A5A40]/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                  />
                </div>
                <p className="text-[10px] text-[#5A5A40] uppercase tracking-wider">{formatDate(exam.createdAt)}</p>
              </button>
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
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <ExamEditor user={user} onCancel={() => setIsCreating(false)} />
            </motion.div>
          ) : selectedExam ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Exam Detail Header */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#141414]/5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-3xl font-bold font-serif mb-2">{selectedExam.title}</h1>
                    <p className="text-[#5A5A40] text-sm max-w-2xl">{selectedExam.description}</p>
                  </div>
                  <div className="flex bg-[#E4E3E0] p-1 rounded-xl">
                    <button 
                      onClick={() => setActiveTab('submissions')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'submissions' ? 'bg-white text-[#141414] shadow-sm' : 'text-[#5A5A40]'}`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      學生作答
                    </button>
                    <button 
                      onClick={() => setActiveTab('report')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'report' ? 'bg-white text-[#141414] shadow-sm' : 'text-[#5A5A40]'}`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      分析報告
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#141414]/5 pt-6">
                  {activeTab === 'submissions' ? (
                    <SubmissionList examId={selectedExam.id} teacherView user={user} />
                  ) : (
                    <StatisticsReport examId={selectedExam.id} />
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center text-[#5A5A40]">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-[#141414]/5">
                <LayoutDashboard className="w-10 h-10 opacity-20" />
              </div>
              <p className="font-serif text-lg opacity-60">請從左側選擇一份考卷<br/>或建立新題目</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSettings && (
          <GroqSettings onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
