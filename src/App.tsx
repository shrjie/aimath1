/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, signInAnonymously } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock,
  ClipboardCheck,
  AlertCircle
} from 'lucide-react';
import TeacherDashboard from './components/teacher/TeacherDashboard';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view] = useState<'teacher'>('teacher');

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
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Navigation Rail */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#141414]/5 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-[#141414]" />
          <span className="font-bold text-lg">AI智慧批改助手</span>
        </div>
      </nav>

      <main className="pt-20 pb-12 px-4 sm:px-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div 
            key="teacher"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TeacherDashboard user={user} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
