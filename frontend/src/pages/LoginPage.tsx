import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Printer, Shield, CheckCircle2, Lock, Activity, Eye, EyeOff, Sun, Moon, HelpCircle, Key, X } from 'lucide-react';
import { getApiBaseUrl } from '../services/api';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedName = localStorage.getItem('saved_username');
    if (savedName) {
      setUsername(savedName);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username.trim());
      formData.append('password', password);

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/login/access-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (Invalid credentials)');
      }

      const data = await res.json();
      login(data.access_token, username.trim(), data.role || 'VIEWER', data.display_name);

      if (rememberMe) {
        localStorage.setItem('saved_username', username.trim());
      } else {
        localStorage.removeItem('saved_username');
      }

      // Smooth navigate to dashboard
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'เข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-[#090d16] p-0 sm:p-4 md:p-6 lg:p-8 font-sans selection:bg-blue-600 selection:text-white transition-colors duration-300 relative">
      {/* Top Floating Controls: Dark/Light Mode Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm hover:shadow-md hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 flex items-center justify-center cursor-pointer"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>
      </div>

      {/* Main Split Container */}
      <div className="w-full max-w-[1100px] min-h-[640px] bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-xl shadow-slate-900/5 dark:shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row transition-all duration-300">
        
        {/* Left Side: Brand & Product Intelligence (Aligned with Dashboard Blue Palette) */}
        <div className="lg:w-1/2 relative p-8 sm:p-12 flex flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 text-white">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3.5 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-600/30 text-white border border-white/20">
                <Printer size={26} strokeWidth={2.3} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight leading-none text-white flex items-center gap-1.5">
                  Enterprise <span className="text-blue-400">PM</span>
                </h1>
                <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                  Printer Monitoring Suite
                </p>
              </div>
            </div>

            {/* Brand Pitch */}
            <div className="space-y-4 max-w-md">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                <Shield size={13} className="text-blue-400" />
                Next-Gen Device Observability
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Enterprise Printer Management &amp; Real-Time Analytics
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                แพลตฟอร์มบริหารจัดการและมอนิเตอร์สถานะเครื่องพิมพ์ทั้งองค์กรแบบเรียลไทม์ ตรวจจับข้อผิดพลาด ควบคุมหมึกพิมพ์ และวิเคราะห์การใช้งานอย่างแม่นยำ
              </p>
            </div>
          </div>

          {/* Brand Features Checklist */}
          <div className="relative z-10 my-8 space-y-3">
            {[
              { title: 'Real-Time Telemetry & SNMP v1/v2c/v3', desc: 'ตรวจจับสถานะหมึก กระดาษ และข้อผิดพลาดระดับวินาที' },
              { title: 'Live Floor Map & Device Positioning', desc: 'ผังระบุตำแหน่งเครื่องพิมพ์บนอาคารและแผนกอัตโนมัติ' },
              { title: 'Enterprise Role-Based Access (RBAC)', desc: 'ควบคุมสิทธิ์การเข้าถึงและการตั้งค่าอย่างปลอดภัย' },
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">{feature.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Security Assurance */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Activity size={14} className="text-emerald-400 animate-pulse" />
              Operational Network Node
            </span>
            <span className="font-mono text-[11px] text-slate-500">v2.5.0-Enterprise</span>
          </div>
        </div>

        {/* Right Side: Sign-In Form Container */}
        <div className="lg:w-1/2 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors">
          <div className="w-full max-w-md mx-auto">
            {/* Header Text */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                กรอกข้อมูลบัญชีเพื่อเข้าสู่ระบบบริหารจัดการเครื่องพิมพ์
              </p>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <Lock size={18} className="shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="username" 
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Employee ID / Username
                </label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="เช่น admin หรือ user"
                    disabled={isLoading}
                    required
                    autoFocus
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="password" 
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer select-none font-medium bg-transparent border-none p-0"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    required
                    className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/30 transition cursor-pointer"
                  />
                  <span>จดจำอุปกรณ์นี้ในระบบ (Remember this device)</span>
                </label>
              </div>

              {/* Submit Button (Aligned with Dashboard Royal Blue) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>กำลังเข้าสู่ระบบ...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Footer Notice */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 text-center text-xs text-slate-400 leading-relaxed">
              <p>
                การเข้าใช้งานระบบอยู่ภายใต้การควบคุมความปลอดภัยขององค์กร
                <br />
                Enterprise Security &amp; Audit Logs are monitored.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Password Reset Modal (Enterprise Helpdesk & Guidance) */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 sm:p-7 space-y-5 relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  กู้คืนรหัสผ่าน (Password Recovery)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enterprise Security &amp; Access Policy
                </p>
              </div>
            </div>

            {/* Content Body */}
            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <HelpCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>ขั้นตอนการรีเซ็ตรหัสผ่าน</span>
                </div>
                <p>
                  เนื่องจากระบบนี้เป็นระบบภายในองค์กรเพื่อความปลอดภัยของข้อมูลเครื่องพิมพ์ หากคุณลืมรหัสผ่าน กรุณาดำเนินการตามข้อใดข้อหนึ่งดังนี้:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-600 dark:text-slate-300">
                  <li>
                    <strong className="text-slate-900 dark:text-white">ติดต่อผู้ดูแลระบบ (IT Admin):</strong> เพื่อทำการรีเซ็ตรหัสผ่านใหม่ให้คุณในหน้าจัดการผู้ใช้ (<code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-mono">/users</code>)
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">บัญชีเริ่มต้นของระบบ:</strong> หากเพิ่งติดตั้งใหม่ บัญชีหลักเริ่มต้นคือ <span className="font-mono font-bold text-blue-600 dark:text-blue-400">admin</span> / <span className="font-mono font-bold text-blue-600 dark:text-blue-400">admin</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-2.5 text-blue-800 dark:text-blue-300">
                <Shield size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  หากต้องการให้ช่างประจำแผนกช่วยเหลือ สามารถติดต่อทีม IT Support ภายในสาขาของท่านได้ทันที
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                เข้าใจแล้ว (ปิดหน้าต่าง)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
