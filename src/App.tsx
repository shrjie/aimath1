/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, signInAnonymously, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock,
  ClipboardCheck,
  AlertCircle
} from 'lucide-react';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import StudentPortal from './components/student/StudentPortal';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'teacher' | 'student'>('teacher');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous login failed", error);
          setLoading(false);
        }
      } else {
        setUser(u);
        setLoading(false);
      }
    }, (error) => {
      console.error("Auth state change error", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Clock className="w-8 h-8 text-[#5A5A40]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[32px] shadow-sm border border-[#5A5A40]/10 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">啟動失敗</h2>
          <p className="text-sm text-[#5A5A40] mb-6">
            無法連接到您的 Firebase 服務。請確保已在 Firebase Console 中啟用「匿名登入 (Anonymous)」服務。
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#141414] text-white rounded-xl text-sm font-bold"
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col">
      {/* Navigation Rail */}
      <nav className="sticky top-0 h-16 bg-white/80 backdrop-blur-md border-b border-[#141414]/5 z-50 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center shadow-lg shadow-[#141414]/10">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base sm:text-lg leading-tight">AI智慧批改助手</span>
            <span className="text-[10px] text-[#5A5A40] uppercase tracking-[0.2em]">Intelligent Grading</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-[#F5F5F0] p-1 rounded-xl border border-[#141414]/5">
            <button 
              onClick={() => setView('teacher')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                view === 'teacher' ? "bg-[#141414] text-white shadow-lg" : "text-[#5A5A40] hover:bg-[#E4E3E0]"
              )}
            >
              老師視角
            </button>
            <button 
              onClick={() => setView('student')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                view === 'student' ? "bg-[#141414] text-white shadow-lg" : "text-[#5A5A40] hover:bg-[#E4E3E0]"
              )}
            >
              學生視角
            </button>
          </div>
          <div className="hidden sm:block px-3 py-1 bg-[#E4E3E0] rounded-full text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider">
            {view === 'teacher' ? 'Teacher Mode' : 'Student Mode'}
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-8 pb-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {view === 'teacher' ? (
            <motion.div 
              key="teacher"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <TeacherDashboard user={user} />
            </motion.div>
          ) : (
            <motion.div 
              key="student"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <StudentPortal user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 px-6 border-t border-[#141414]/5 bg-white/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[#5A5A40] text-sm font-medium">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            系統服務正常運行中
          </div>
          <div className="text-[#5A5A40] text-sm">
            程式設計：<span className="font-bold text-[#141414]">黃世杰</span>
          </div>
          <div className="text-[#5A5A40] text-[10px] tracking-widest uppercase opacity-40">
            © 2024 AI Grading Assistant
          </div>
        </div>
      </footer>
    </div>
  );
}
