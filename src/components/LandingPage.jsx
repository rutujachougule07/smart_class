import React from 'react';
import {
  School,
  Award,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import sgmBg from '../assets/sgmcollage.jpg';

export default function LandingPage({ onOpenLogin, schoolProfile, isLoggedIn }) {
  const collegeName = schoolProfile?.schoolName || 'SGM College, Karad';

  return (
    <div className="h-screen w-screen overflow-hidden relative flex flex-col justify-between select-none font-sans text-white bg-[#030611]">
      
      {/* Styles for glassmorphism and glowing login button */}
      <style>{`
        .glass-header {
          background: linear-gradient(180deg, rgba(3, 7, 18, 0.85) 0%, rgba(3, 7, 18, 0.3) 100%);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .admin-login-button {
          background: linear-gradient(135deg, #3b82f6 0%, #4f46e5 50%, #6366f1 100%);
          box-shadow: 0 0 35px rgba(79, 70, 229, 0.5), 0 10px 25px -5px rgba(0, 0, 0, 0.6);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-login-button:hover {
          background: linear-gradient(135deg, #60a5fa 0%, #6366f1 50%, #4f46e5 100%);
          box-shadow: 0 0 50px rgba(99, 102, 241, 0.75), 0 15px 35px -5px rgba(0, 0, 0, 0.7);
          transform: translateY(-2px) scale(1.03);
        }
      `}</style>

      {/* FULLSCREEN SGM COLLEGE BACKGROUND - CENTERED & COMPLETELY UNOBSTRUCTED */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={sgmBg}
          alt="SGM College Campus"
          className="w-full h-full object-cover"
          style={{
            objectPosition: '60% 42%'
          }}
        />
        {/* Subtle, soft gradient: keeps building sharp and clear while providing header & footer contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030611]/70 via-transparent to-[#030611]/80" />
      </div>

      {/* TOP HEADER */}
      <header className="relative z-20 w-full glass-header px-6 sm:px-12 py-4 flex items-center justify-between shadow-lg">
        
        {/* Left: College Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-white/20">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white drop-shadow">
                {collegeName}
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AUTONOMOUS
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Sadguru Gadge Maharaj College · Attendance & Examination Portal
            </p>
          </div>
        </div>

        {/* Right: Accreditation */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.08] border border-white/10 backdrop-blur-md">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-200">
            NAAC 'A++' Accredited
          </span>
        </div>

      </header>

      {/* CENTER: COMPLETELY OPEN & CLEAR TO SHOWCASE THE COLLEGE CAMPUS */}
      <main className="relative z-10 flex-1 pointer-events-none" />

      {/* BOTTOM: ATTRACTIVE "LOG IN AS ADMIN" BUTTON */}
      <footer className="relative z-20 pb-10 sm:pb-12 flex flex-col items-center justify-center px-4">
        
        <button
          onClick={onOpenLogin}
          className="admin-login-button group inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-4 rounded-2xl font-black text-base sm:text-lg text-white border border-white/20 cursor-pointer active:scale-95"
        >
          <ShieldCheck className="w-5 h-5 text-blue-100 transition-transform duration-300 group-hover:scale-110" />
          <span>{isLoggedIn ? 'Enter Admin Dashboard' : 'Log In as Admin'}</span>
          <ArrowRight className="w-5 h-5 text-blue-100 transition-transform duration-300 group-hover:translate-x-1" />
        </button>

        <p className="text-[11px] font-medium text-slate-400 mt-3 tracking-wider">
          SmartClass Academic Portal &bull; Attendance &bull; Examination &bull; Reporting
        </p>

      </footer>

    </div>
  );
}
