import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { Award, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function StatisticsReport({ examId }: { examId: string }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const sSnap = await getDocs(collection(db, 'exams', examId, 'submissions'));
        const data = sSnap.docs.map(d => d.data());
        setSubmissions(data.filter(s => s.status === 'graded'));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `exams/${examId}/submissions`);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [examId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#141414]"></div>
    </div>
  );

  if (submissions.length === 0) return (
    <div className="text-center py-20 bg-[#F5F5F0] rounded-[32px] border-2 border-dashed border-[#141414]/10">
      <TrendingUp className="w-12 h-12 text-[#5A5A40]/30 mx-auto mb-4" />
      <p className="text-[#5A5A40] font-serif">尚無足夠的已批改數據來產出報告</p>
    </div>
  );

  const totalPossible = submissions[0]?.maxScore || 100;
  const averageScore = Math.round(submissions.reduce((acc, s) => acc + s.totalScore, 0) / submissions.length);
  const maxScore = Math.max(...submissions.map(s => s.totalScore));
  const minScore = Math.min(...submissions.map(s => s.totalScore));

  // Distribution
  const dist = [
    { name: '90-100', value: submissions.filter(s => s.totalScore >= 90).length, color: '#141414' },
    { name: '80-89', value: submissions.filter(s => s.totalScore >= 80 && s.totalScore < 90).length, color: '#2A2A2A' },
    { name: '70-79', value: submissions.filter(s => s.totalScore >= 70 && s.totalScore < 80).length, color: '#404040' },
    { name: '60-69', value: submissions.filter(s => s.totalScore >= 60 && s.totalScore < 70).length, color: '#5A5A40' },
    { name: '< 60', value: submissions.filter(s => s.totalScore < 60).length, color: '#8E8E8E' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '平均分數', value: averageScore, icon: TrendingUp, color: 'text-blue-600' },
          { label: '最高分數', value: maxScore, icon: Award, color: 'text-orange-600' },
          { label: '及格人數', value: submissions.filter(s => s.totalScore >= 60).length, icon: CheckCircle2, color: 'text-green-600' },
          { label: '待開導人數', value: submissions.filter(s => s.totalScore < 60).length, icon: AlertTriangle, color: 'text-red-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#F5F5F0]/50 p-6 rounded-2xl border border-[#141414]/5">
            <stat.icon className={`w-5 h-5 mb-2 ${stat.color}`} />
            <p className="text-[10px] uppercase font-bold text-[#5A5A40] tracking-widest">{stat.label}</p>
            <p className="text-2xl font-bold font-serif">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Score Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-[#141414]/5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40] mb-6">全班分數分布圖</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: '#5A5A40' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} tick={{ fill: '#5A5A40' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#F5F5F0' }}
                  contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {dist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pass/Fail Pie */}
        <div className="bg-white p-6 rounded-3xl border border-[#141414]/5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40] mb-6">及格率統計</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: '及格', value: submissions.filter(s => s.totalScore >= 60).length },
                    { name: '不及格', value: submissions.filter(s => s.totalScore < 60).length },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#141414" />
                  <Cell fill="#E4E3E0" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-[#141414]" />
               <span className="text-[10px] font-bold text-[#5A5A40] uppercase">及格</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full bg-[#E4E3E0]" />
               <span className="text-[10px] font-bold text-[#5A5A40] uppercase">不及格</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
