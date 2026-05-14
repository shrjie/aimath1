import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, writeBatch } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { Plus, Trash2, X, Check, Save, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Rubric {
  desc: string;
  points: number;
}

interface Question {
  content: string;
  points: number;
  rubrics: Rubric[];
  standardAnswer: string;
  commonErrors: string[];
}

interface ExamData {
  id: string;
  title: string;
  description: string;
  questions: (Question & { id?: string })[];
}

export default function ExamEditor({ 
  user, 
  onCancel, 
  initialData 
}: { 
  user: User, 
  onCancel: () => void, 
  initialData?: ExamData 
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [questions, setQuestions] = useState<Question[]>(
    initialData?.questions.map(({ id, ...q }) => q) || [
      { content: '', points: 10, rubrics: [{ desc: '答案正確', points: 10 }], standardAnswer: '', commonErrors: [] }
    ]
  );
  const [isSaving, setIsSaving] = useState(false);

  const addQuestion = () => {
    setQuestions([...questions, { content: '', points: 10, rubrics: [{ desc: '答案正確', points: 10 }], standardAnswer: '', commonErrors: [] }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, data: Partial<Question>) => {
    const newQuestions = [...questions];
    newQuestions[idx] = { ...newQuestions[idx], ...data };
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!title) return alert('請輸入考卷名稱');
    if (questions.some(q => !q.content)) return alert('請填寫所有題目內容');
    if (questions.some(q => isNaN(q.points) || q.points < 0)) return alert('分數必須為正數');
    
    setIsSaving(true);
    try {
      if (initialData?.id) {
        // 1. Update existing Exam
        await updateDoc(doc(db, 'exams', initialData.id), {
          title,
          description,
          updatedAt: serverTimestamp(),
        });

        // 2. Refresh Questions (Subcollection)
        // For simplicity in this demo, we'll delete old ones and add new ones
        // In production, we'd sync them by ID to avoid data loss on related collections if any
        const oldQsQuery = await getDocs(collection(db, 'exams', initialData.id, 'questions'));
        const batch = writeBatch(db);
        oldQsQuery.docs.forEach(d => batch.delete(d.ref));
        
        questions.forEach((q, idx) => {
          const qRef = doc(collection(db, 'exams', initialData.id, 'questions'));
          batch.set(qRef, {
            ...q,
            examId: initialData.id,
            questionNumber: idx + 1
          });
        });
        await batch.commit();
      } else {
        // 1. Create New Exam
        const examData = {
          title,
          description,
          teacherId: user.uid,
          createdAt: serverTimestamp(),
        };
        const examRef = await addDoc(collection(db, 'exams'), examData);

        // 2. Create Questions
        const batch = writeBatch(db);
        questions.forEach((q, idx) => {
          const qRef = doc(collection(db, 'exams', examRef.id, 'questions'));
          batch.set(qRef, {
            ...q,
            examId: examRef.id,
            questionNumber: idx + 1
          });
        });
        await batch.commit();
      }

      onCancel();
    } catch (err: any) {
      console.error("Save exam failed:", err);
      if (err.code === 'permission-denied') {
        alert('存檔失敗：您的權限不足或資料不符規範。');
      } else {
        alert(`存檔失敗：${err.message || '未知錯誤'}`);
      }
      handleFirestoreError(err, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, 'exams');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-[#141414]/10 border border-[#141414]/5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-6">
        <div>
          <h2 className="text-3xl font-black text-[#141414] tracking-tight">
            {initialData?.id ? '編輯考卷內容' : '建立新考卷'}
          </h2>
          <p className="text-[#5A5A40] text-sm font-medium mt-1 uppercase tracking-widest opacity-60">
            {initialData?.id ? 'Edit Assessment' : 'Create Assessment'}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={onCancel} 
            className="flex-1 sm:flex-none px-6 py-3 text-sm font-black text-[#5A5A40] hover:text-[#141414] hover:bg-[#F5F5F0] transition-all rounded-2xl border-2 border-transparent active:scale-95"
          >
            取消
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="flex-1 sm:flex-none px-8 py-3 bg-[#141414] text-white rounded-2xl text-sm font-black hover:bg-black active:scale-95 transition-all shadow-xl shadow-[#141414]/20 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSaving ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            儲存所有題目
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-[#F5F5F0]/30 rounded-3xl border-2 border-[#141414]/5">
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-[#141414]">考卷名稱</label>
            <input 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：第一次期中考 - 數學"
              className="w-full bg-white border-2 border-transparent rounded-2xl px-5 py-4 placeholder:text-[#5A5A40]/30 focus:border-[#141414] focus:ring-0 transition-all font-medium text-lg"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-[#141414]">描述 (選填)</label>
            <input 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="例如：範圍 1-1 ~ 1-3"
              className="w-full bg-white border-2 border-transparent rounded-2xl px-5 py-4 placeholder:text-[#5A5A40]/30 focus:border-[#141414] focus:ring-0 transition-all font-medium text-lg"
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-12">
          {questions.map((q, qIdx) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={qIdx} 
              className="relative p-6 sm:p-10 rounded-[3rem] border-2 border-[#141414]/5 bg-white shadow-xl shadow-[#141414]/5"
            >
              <div className="absolute -top-6 -left-2 sm:-left-6 w-16 h-16 bg-[#141414] text-white rounded-[1.5rem] flex items-center justify-center text-3xl font-black shadow-2xl shadow-[#141414]/30 rotate-[-5deg]">
                {qIdx + 1}
              </div>
              
              <button 
                onClick={() => removeQuestion(qIdx)}
                className="absolute top-6 right-6 p-3 text-[#5A5A40]/20 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                title="刪除此題"
              >
                <Trash2 className="w-6 h-6" />
              </button>

              <div className="space-y-8 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div className="lg:col-span-3 space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5A5A40]">題目內容</label>
                    <textarea 
                      value={q.content}
                      onChange={e => updateQuestion(qIdx, { content: e.target.value })}
                      placeholder="請輸入題目敘述..."
                      rows={3}
                      className="w-full bg-[#F5F5F0]/50 border-2 border-transparent rounded-2xl px-6 py-5 focus:border-[#141414] focus:bg-white focus:ring-0 transition-all resize-none text-base font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5A5A40]">滿分分數</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={q.points}
                        onChange={e => updateQuestion(qIdx, { points: Number(e.target.value) })}
                        className="w-full bg-[#F5F5F0]/50 border-2 border-transparent rounded-2xl px-6 py-5 focus:border-[#141414] focus:bg-white focus:ring-0 transition-all text-2xl font-black text-center"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#5A5A40]/40 uppercase tracking-widest pointer-events-none">PTS</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5A5A40] flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-600" />
                    標準解答 (AI 批改參考)
                  </label>
                  <textarea 
                    value={q.standardAnswer}
                    onChange={e => updateQuestion(qIdx, { standardAnswer: e.target.value })}
                    placeholder="請輸入標準解答內容或邏輯..."
                    rows={2}
                    className="w-full bg-green-50/20 border-2 border-dashed border-green-200 rounded-2xl px-6 py-5 focus:border-green-600 focus:bg-white focus:ring-0 transition-all resize-none italic font-medium"
                  />
                </div>

                {/* Rubrics Editor */}
                <div className="space-y-5 p-6 bg-[#F5F5F0]/20 rounded-[2rem] border-2 border-[#141414]/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5A5A40]">評分準則 (Rubrics)</label>
                    <button 
                      onClick={() => {
                        const newRubrics = [...q.rubrics, { desc: '', points: 0 }];
                        updateQuestion(qIdx, { rubrics: newRubrics });
                      }}
                      className="text-[10px] font-black flex items-center gap-2 bg-white px-4 py-2 rounded-xl text-[#141414] border-2 border-[#141414]/5 hover:border-[#141414] transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> 新增準則
                    </button>
                  </div>
                  <div className="space-y-3">
                    {q.rubrics.map((r, rIdx) => (
                      <div key={rIdx} className="flex flex-col sm:flex-row gap-3">
                        <input 
                          value={r.desc}
                          onChange={e => {
                            const newRubrics = [...q.rubrics];
                            newRubrics[rIdx].desc = e.target.value;
                            updateQuestion(qIdx, { rubrics: newRubrics });
                          }}
                          placeholder="例如：列出方程式"
                          className="flex-1 bg-white border-2 border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#141414] focus:ring-0 transition-all"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            value={r.points}
                            onChange={e => {
                              const newRubrics = [...q.rubrics];
                              newRubrics[rIdx].points = Number(e.target.value);
                              updateQuestion(qIdx, { rubrics: newRubrics });
                            }}
                            className="w-full sm:w-24 bg-white border-2 border-transparent rounded-xl px-4 py-3 text-sm font-black text-center focus:border-[#141414] focus:ring-0 transition-all"
                          />
                          <button 
                            onClick={() => {
                              const newRubrics = q.rubrics.filter((_, i) => i !== rIdx);
                              updateQuestion(qIdx, { rubrics: newRubrics });
                            }}
                            className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <button 
          onClick={addQuestion}
          className="w-full py-12 rounded-[3rem] border-4 border-dashed border-[#141414]/5 text-[#5A5A40] hover:bg-[#141414]/5 hover:border-[#141414]/10 transition-all flex flex-col items-center justify-center gap-4 group"
        >
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-transparent group-hover:border-[#141414]/5 transition-all">
            <Plus className="w-8 h-8 opacity-20 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-300" />
          </div>
          <span className="text-sm font-black uppercase tracking-widest opacity-60">新增題目項目</span>
        </button>
      </div>
    </div>
  );
}
