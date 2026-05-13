import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, writeBatch } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
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

export default function ExamEditor({ user, onCancel }: { user: User, onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { content: '', points: 10, rubrics: [{ desc: '答案正確', points: 10 }], standardAnswer: '', commonErrors: [] }
  ]);
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
      // 1. Create Exam
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

      onCancel();
    } catch (err: any) {
      console.error("Save exam failed:", err);
      // Detailed error for debugging
      if (err.code === 'permission-denied') {
        alert('存檔失敗：您的權限不足或資料不符規範。請確認是否登入並填寫正確格式。');
      } else {
        alert(`存檔失敗：${err.message || '未知錯誤'}`);
      }
      handleFirestoreError(err, OperationType.CREATE, 'exams');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-[#141414]/5">
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#141414]/5">
        <h2 className="text-2xl font-bold font-serif">建立新考卷</h2>
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-5 py-2.5 text-xs font-bold text-[#5A5A40] hover:text-[#141414] transition-colors rounded-xl">
            取消
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#141414] text-white rounded-xl text-xs font-bold hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存所有題目
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">考卷名稱</label>
            <input 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：第一次期中考 - 數學"
              className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 placeholder:text-[#5A5A40]/40 focus:ring-2 focus:ring-[#141414] transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">描述 (選填)</label>
            <input 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="例如：範圍 1-1 ~ 1-3"
              className="w-full bg-[#F5F5F0] border-none rounded-2xl px-4 py-3 placeholder:text-[#5A5A40]/40 focus:ring-2 focus:ring-[#141414] transition-all"
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-12">
          {questions.map((q, qIdx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={qIdx} 
              className="relative p-6 rounded-3xl border border-[#141414]/10 bg-[#F5F5F0]/30"
            >
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#141414] text-white rounded-full flex items-center justify-center font-bold font-serif shadow-md">
                {qIdx + 1}
              </div>
              
              <button 
                onClick={() => removeQuestion(qIdx)}
                className="absolute top-4 right-4 p-2 text-[#5A5A40]/40 hover:text-red-500 transition-colors"
                title="刪除此題"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">題目內容</label>
                    <textarea 
                      value={q.content}
                      onChange={e => updateQuestion(qIdx, { content: e.target.value })}
                      placeholder="請輸入題目敘述..."
                      rows={2}
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">滿分分數</label>
                    <input 
                      type="number"
                      value={q.points}
                      onChange={e => updateQuestion(qIdx, { points: Number(e.target.value) })}
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">標準解答 (AI 批改參考)</label>
                  <textarea 
                    value={q.standardAnswer}
                    onChange={e => updateQuestion(qIdx, { standardAnswer: e.target.value })}
                    placeholder="請輸入標準解答內容或邏輯..."
                    rows={2}
                    className="w-full bg-white border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#141414] transition-all resize-none italic"
                  />
                </div>

                {/* Rubrics Editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">評分準則 (Rubrics)</label>
                    <button 
                      onClick={() => {
                        const newRubrics = [...q.rubrics, { desc: '', points: 0 }];
                        updateQuestion(qIdx, { rubrics: newRubrics });
                      }}
                      className="text-xs font-bold flex items-center gap-1 text-[#141414] hover:underline"
                    >
                      <Plus className="w-3 h-3" /> 新增項目
                    </button>
                  </div>
                  <div className="space-y-3">
                    {q.rubrics.map((r, rIdx) => (
                      <div key={rIdx} className="flex gap-3">
                        <input 
                          value={r.desc}
                          onChange={e => {
                            const newRubrics = [...q.rubrics];
                            newRubrics[rIdx].desc = e.target.value;
                            updateQuestion(qIdx, { rubrics: newRubrics });
                          }}
                          placeholder="例如：列出方程式"
                          className="flex-1 bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#141414]"
                        />
                        <input 
                          type="number"
                          value={r.points}
                          onChange={e => {
                            const newRubrics = [...q.rubrics];
                            newRubrics[rIdx].points = Number(e.target.value);
                            updateQuestion(qIdx, { rubrics: newRubrics });
                          }}
                          className="w-20 bg-white border-none rounded-xl px-4 py-2 text-sm text-center focus:ring-2 focus:ring-[#141414]"
                        />
                        <button 
                          onClick={() => {
                            const newRubrics = q.rubrics.filter((_, i) => i !== rIdx);
                            updateQuestion(qIdx, { rubrics: newRubrics });
                          }}
                          className="p-2 text-red-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
          className="w-full py-6 rounded-3xl border-2 border-dashed border-[#141414]/10 text-[#5A5A40] hover:bg-[#141414]/5 hover:border-[#141414]/30 transition-all flex flex-col items-center justify-center gap-2"
        >
          <Plus className="w-8 h-8 opacity-20" />
          <span className="text-sm font-bold opacity-60">新增題目</span>
        </button>
      </div>
    </div>
  );
}
