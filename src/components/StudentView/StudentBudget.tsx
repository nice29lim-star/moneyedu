import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Receipt,
  PieChart,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Coins,
  Shield,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Job, Payslip, Session, Student } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { INITIAL_JOBS } from '../../data/seedData';
import {
  playCoinSound,
  playSelectSound,
  playSuccessSound,
} from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';

interface StudentBudgetProps {
  student: Student;
  session: Session | null;
  onBudgetSaved: (updatedStudent?: Student) => void;
  onGoToStock?: (updatedStudent?: Student) => void;
}

// 4대 보험 및 세금 계산기 함수 (클라이언트 & 오프라인 완벽 지원)
function calculateClientPayslip(job: Job, quizBonus: number = 0): Payslip {
  const gross = job.monthlySalary;
  const nationalPension = Math.round(gross * 0.045);
  const healthInsurance = Math.round(gross * 0.03545);
  const careInsurance = Math.round(healthInsurance * 0.1295);
  const employmentInsurance = Math.round(gross * 0.009);
  const incomeTax = Math.round(gross * 0.03);
  const localIncomeTax = Math.round(incomeTax * 0.1);

  const totalDeductions =
    nationalPension +
    healthInsurance +
    careInsurance +
    employmentInsurance +
    incomeTax +
    localIncomeTax;

  const netSalary = gross - totalDeductions;
  const totalAvailable = netSalary + quizBonus;

  return {
    jobId: job.id,
    jobTitle: job.title,
    grossSalary: gross,
    nationalPension,
    healthInsurance,
    careInsurance,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    totalDeductions,
    netSalary,
    quizBonus,
    totalAvailable,
  };
}

export const StudentBudget: React.FC<StudentBudgetProps> = ({
  student,
  session,
  onBudgetSaved,
  onGoToStock,
}) => {
  const [step, setStep] = useState<'job' | 'payslip' | 'slider'>(() => {
    if (student?.budget) return 'slider';
    if (student?.selectedJob) return 'slider';
    return 'job';
  });
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [selectedJob, setSelectedJob] = useState<Job | null>(
    student?.selectedJob || INITIAL_JOBS[0]
  );
  const [payslip, setPayslip] = useState<Payslip | null>(() =>
    calculateClientPayslip(student?.selectedJob || INITIAL_JOBS[0], student?.quizBonus || 0)
  );

  // 3 Sliders (Default: 40% Living, 30% Savings, 30% Investment = 100%)
  const [livingPercent, setLivingPercent] = useState(
    student?.budget?.livingPercent ?? 40
  );
  const [savingsPercent, setSavingsPercent] = useState(
    student?.budget?.savingsPercent ?? 30
  );
  const [investPercent, setInvestPercent] = useState(
    student?.budget?.investPercent ?? 30
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(() => Boolean(student?.budget));

  // If teacher already advanced to stock and student has saved budget, auto-advance!
  useEffect(() => {
    if (session?.currentModule === 'stock' && (saveSuccess || student?.budget)) {
      if (onGoToStock) {
        onGoToStock();
      } else {
        onBudgetSaved();
      }
    }
  }, [session?.currentModule, saveSuccess, student?.budget, onGoToStock, onBudgetSaved]);

  // Load jobs from API with fallback
  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.jobs && data.jobs.length > 0) {
          setJobs(data.jobs);
          if (!selectedJob) {
            setSelectedJob(data.jobs[0]);
          }
        }
      })
      .catch(() => {
        // Fallback already set to INITIAL_JOBS
      });
  }, []);

  // Fetch payslip when job changes with fallback
  useEffect(() => {
    if (selectedJob) {
      const fallbackP = calculateClientPayslip(selectedJob, student?.quizBonus || 0);
      setPayslip(fallbackP);

      fetch('/api/payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJob.id }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.payslip) {
            const p = data.payslip;
            const totalAvail = p.netSalary + (student?.quizBonus || 0);
            setPayslip({
              ...p,
              jobId: selectedJob.id,
              jobTitle: selectedJob.title,
              quizBonus: student?.quizBonus || 0,
              totalAvailable: totalAvail,
            });
          }
        })
        .catch(() => {
          // fallback already computed
        });
    }
  }, [selectedJob, student.quizBonus]);

  // Smart 100% Slider Auto-Balancing
  const handleLivingChange = (val: number) => {
    const remaining = 100 - val;
    // distribute remaining proportionally between savings and investment
    const currentSubtotal = savingsPercent + investPercent;
    let newSavings = 0;
    let newInvest = 0;
    if (currentSubtotal === 0) {
      newSavings = Math.floor(remaining / 2);
      newInvest = remaining - newSavings;
    } else {
      newSavings = Math.round((savingsPercent / currentSubtotal) * remaining);
      newInvest = remaining - newSavings;
    }
    setLivingPercent(val);
    setSavingsPercent(Math.max(0, newSavings));
    setInvestPercent(Math.max(0, newInvest));
  };

  const handleSavingsChange = (val: number) => {
    const remaining = 100 - val;
    const currentSubtotal = livingPercent + investPercent;
    let newLiving = 0;
    let newInvest = 0;
    if (currentSubtotal === 0) {
      newLiving = Math.floor(remaining / 2);
      newInvest = remaining - newLiving;
    } else {
      newLiving = Math.round((livingPercent / currentSubtotal) * remaining);
      newInvest = remaining - newLiving;
    }
    setSavingsPercent(val);
    setLivingPercent(Math.max(0, newLiving));
    setInvestPercent(Math.max(0, newInvest));
  };

  const handleInvestChange = (val: number) => {
    const remaining = 100 - val;
    const currentSubtotal = livingPercent + savingsPercent;
    let newLiving = 0;
    let newSavings = 0;
    if (currentSubtotal === 0) {
      newLiving = Math.floor(remaining / 2);
      newSavings = remaining - newLiving;
    } else {
      newLiving = Math.round((livingPercent / currentSubtotal) * remaining);
      newSavings = remaining - newLiving;
    }
    setInvestPercent(val);
    setLivingPercent(Math.max(0, newLiving));
    setSavingsPercent(Math.max(0, newSavings));
  };

  const totalAvailable = payslip?.totalAvailable || 3000000;
  const livingKRW = Math.floor((totalAvailable * livingPercent) / 100);
  const savingsKRW = Math.floor((totalAvailable * savingsPercent) / 100);
  const investKRW = totalAvailable - livingKRW - savingsKRW;

  const handleSaveBudget = async () => {
    if (!selectedJob) return;
    setSaving(true);

    let updatedStudent: Student = {
      ...student,
      selectedJob,
      initialInvestment: investKRW,
      cash: investKRW,
      budget: {
        sessionId: session?.sessionId || student.sessionId,
        studentId: student.studentId,
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        grossSalary: payslip?.grossSalary || selectedJob.monthlySalary,
        netSalary: payslip?.netSalary || Math.floor(selectedJob.monthlySalary * 0.82),
        quizBonus: student.quizBonus || 0,
        totalAvailable,
        livingPercent,
        savingsPercent,
        investPercent,
        livingAmount: livingKRW,
        savingsAmount: savingsKRW,
        investAmount: investKRW,
        savedAt: Date.now(),
      },
    };

    try {
      if (session?.sessionId) {
        await fetch('/api/budget/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.sessionId,
            studentId: student.studentId,
            jobId: selectedJob.id,
            livingPercent,
            savingsPercent,
            investPercent,
          }),
        }).catch(() => {});
      }
    } catch {
      // offline fallback
    } finally {
      if (session?.sessionId) {
        syncManager.saveStudentLocally(session.sessionId, updatedStudent);
      }
      try {
        localStorage.setItem('fc_student', JSON.stringify(updatedStudent));
        // Pre-create student asset if not present so stock view is instant
        const cleanSess = (session?.sessionId || student.sessionId || '').toUpperCase();
        const assetKey = `fc_asset_${cleanSess}_${student.studentId}`;
        const existingAssetStr = localStorage.getItem(assetKey);
        if (!existingAssetStr) {
          const initialAsset = {
            studentId: student.studentId,
            studentName: student.name,
            cash: investKRW,
            initialInvestment: investKRW,
            holdings: {},
            totalStockValuation: 0,
            totalAsset: investKRW,
            profitAmount: 0,
            profitRate: 0,
            tradedThisRound: false,
          };
          localStorage.setItem(assetKey, JSON.stringify(initialAsset));
        }
      } catch {}

      playSuccessSound();
      setSaveSuccess(true);
      setSaving(false);
      onBudgetSaved(updatedStudent);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Step Tabs Navigation */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div>
          <PixelBadge variant="green">2단계 통장배분</PixelBadge>
          <h2 className="text-xl sm:text-2xl font-black text-[#2D3436] mt-1">
            {step === 'job' && '1) 희망 직업 선택 (6종)'}
            {step === 'payslip' && '2) 월급명세서 & 4대보험 공제 확인'}
            {step === 'slider' && '3) 3단 통장 배분 (생활비 / 저축 / 투자)'}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              playSelectSound();
              setStep('job');
            }}
            className={`px-3 py-1.5 rounded-xl font-black border-2 border-black transition-all ${
              step === 'job'
                ? 'bg-[#55E6C1] text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000]'
                : 'text-[#636E72] hover:text-[#2D3436] bg-white'
            }`}
          >
            1. 직업
          </button>
          <button
            type="button"
            disabled={!selectedJob}
            onClick={() => {
              playSelectSound();
              setStep('payslip');
            }}
            className={`px-3 py-1.5 rounded-xl font-black border-2 border-black transition-all ${
              step === 'payslip'
                ? 'bg-[#FFD32D] text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000]'
                : 'text-[#636E72] hover:text-[#2D3436] bg-white disabled:opacity-40'
            }`}
          >
            2. 명세서
          </button>
          <button
            type="button"
            disabled={!selectedJob}
            onClick={() => {
              playSelectSound();
              setStep('slider');
            }}
            className={`px-3 py-1.5 rounded-xl font-black border-2 border-black transition-all ${
              step === 'slider'
                ? 'bg-[#74B9FF] text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000]'
                : 'text-[#636E72] hover:text-[#2D3436] bg-white disabled:opacity-40'
            }`}
          >
            3. 배분
          </button>
        </div>
      </div>

      {/* STEP 1: JOB SELECTION */}
      {step === 'job' && (
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[#636E72] font-bold">
            캠프 기간 동안 활동할 본인의 직업을 1개 선택하세요. 직업마다 세전 기본급이 다르게 책정됩니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => {
                    playSelectSound();
                    setSelectedJob(job);
                  }}
                  className={`p-5 rounded-2xl border-4 border-black cursor-pointer transition-all space-y-3 ${
                    isSelected
                      ? 'bg-[#EBFBF7] shadow-[6px_6px_0px_0px_#000] translate-x-[-2px] translate-y-[-2px]'
                      : 'bg-white hover:bg-[#F8F9FA] shadow-[4px_4px_0px_0px_#000]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{job.icon}</span>
                    <span className="text-xs font-black text-[#636E72] font-mono">
                      {job.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-[#2D3436]">{job.title}</h3>
                    <div className="text-lg font-mono font-black text-[#D63031] mt-0.5">
                      월 {job.monthlySalary.toLocaleString()}원
                    </div>
                  </div>

                  <p className="text-xs text-[#636E72] font-bold leading-relaxed min-h-[36px]">
                    {job.description}
                  </p>

                  <div className="pt-2 border-t-2 border-black flex items-center justify-between text-xs font-black text-[#00B894]">
                    <span>{isSelected ? '✓ 선택됨' : '선택하기'}</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <PixelButton
              variant="success"
              size="lg"
              disabled={!selectedJob}
              onClick={() => {
                playSuccessSound();
                setStep('payslip');
              }}
            >
              <span className="flex items-center gap-2">
                <span>월급명세서 확인하기</span>
                <ArrowRight size={18} />
              </span>
            </PixelButton>
          </div>
        </div>
      )}

      {/* STEP 2: PAYSLIP MODAL / VIEW */}
      {step === 'payslip' && payslip && (
        <PixelCard className="bg-white border-4 border-black p-6 space-y-6 rounded-3xl shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                <Receipt className="text-[#1A1A1A]" size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#2D3436]">
                  {selectedJob?.title} 월급명세서
                </h3>
                <span className="text-xs text-[#636E72] font-bold">
                  근로소득 공제 내역 및 실수령액
                </span>
              </div>
            </div>
            <span className="text-3xl">{selectedJob?.icon}</span>
          </div>

          {/* Deductions Detailed Table */}
          <div className="bg-[#FFFBEB] rounded-2xl p-5 border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000]">
            <div className="flex justify-between items-center text-sm font-black text-[#2D3436] pb-2 border-b-2 border-black">
              <span>① 세전 월 기본급</span>
              <span className="font-mono text-base text-[#2D3436]">
                {payslip.grossSalary.toLocaleString()}원
              </span>
            </div>

            {/* Deductions Breakdown */}
            <div className="space-y-1.5 text-xs font-mono text-[#636E72]">
              <div className="text-[#2D3436] font-sans font-black text-xs pt-1">
                ② 4대 보험 및 제세공제 내역:
              </div>
              <div className="flex justify-between pl-2">
                <span>• 국민연금 (4.5%)</span>
                <span className="text-[#D63031] font-bold">-{payslip.nationalPension.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pl-2">
                <span>• 건강보험 (3.54%)</span>
                <span className="text-[#D63031] font-bold">-{payslip.healthInsurance.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pl-2">
                <span>• 장기요양보험 (건보의 12.81%)</span>
                <span className="text-[#D63031] font-bold">-{payslip.careInsurance.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pl-2">
                <span>• 고용보험 (0.9%)</span>
                <span className="text-[#D63031] font-bold">-{payslip.employmentInsurance.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pl-2">
                <span>• 근로소득세 (~3.2%)</span>
                <span className="text-[#D63031] font-bold">-{payslip.incomeTax.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pt-1 border-t-2 border-black text-[#2D3436] font-black">
                <span>공제액 합계:</span>
                <span className="text-[#D63031]">-{payslip.totalDeductions.toLocaleString()}원</span>
              </div>
            </div>

            {/* Net Salary */}
            <div className="flex justify-between items-center text-sm font-black text-[#00B894] pt-2 border-t-2 border-black">
              <span>③ 실제 통장 입금액 (실수령액)</span>
              <span className="font-mono text-lg text-[#00B894]">
                {payslip.netSalary.toLocaleString()}원
              </span>
            </div>

            {/* Quiz Bonus Add-on */}
            <div className="flex justify-between items-center text-xs font-black text-[#D63031] pt-1">
              <span>④ 1단계 퀴즈 획득 보너스</span>
              <span className="font-mono text-sm">
                +{student.quizBonus.toLocaleString()}원
              </span>
            </div>

            {/* Total Available */}
            <div className="flex justify-between items-center text-base font-black text-[#2D3436] bg-[#FFD32D]/30 p-3.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span>⭐ 최종 총 가용 자산 (③ + ④)</span>
              <span className="font-mono text-xl text-[#D63031]">
                {payslip.totalAvailable.toLocaleString()}원
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <PixelButton variant="secondary" onClick={() => setStep('job')}>
              ◀ 직업 다시 고르기
            </PixelButton>
            <PixelButton
              variant="gold"
              size="lg"
              onClick={() => {
                playSuccessSound();
                setStep('slider');
              }}
            >
              <span className="flex items-center gap-2">
                <span>3단계 통장 배분하기</span>
                <ArrowRight size={18} />
              </span>
            </PixelButton>
          </div>
        </PixelCard>
      )}

      {/* STEP 3: 3-WAY SMART SLIDER ALLOCATION */}
      {step === 'slider' && payslip && (
        <PixelCard className="bg-white border-4 border-black p-6 space-y-6 rounded-3xl shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#74B9FF] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                <PieChart className="text-[#1A1A1A]" size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#2D3436]">
                  3개의 통장 배분 슬라이더 (합계 100% 자동 보정)
                </h3>
                <span className="text-xs text-[#636E72] font-bold">
                  총 가용자금: <span className="text-[#D63031] font-mono font-black">{totalAvailable.toLocaleString()}원</span>
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-[#636E72] font-bold">합계</span>
              <div className="font-mono text-lg font-black text-[#00B894]">
                {livingPercent + savingsPercent + investPercent}%
              </div>
            </div>
          </div>

          {/* Visual Ratio Bar */}
          <div className="w-full h-6 rounded-2xl overflow-hidden flex border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <div
              style={{ width: `${livingPercent}%` }}
              className="bg-[#FF7675] flex items-center justify-center text-xs font-black text-[#1A1A1A]"
              title={`생활비 ${livingPercent}%`}
            >
              {livingPercent > 8 && `${livingPercent}%`}
            </div>
            <div
              style={{ width: `${savingsPercent}%` }}
              className="bg-[#74B9FF] flex items-center justify-center text-xs font-black text-[#1A1A1A]"
              title={`저축 ${savingsPercent}%`}
            >
              {savingsPercent > 8 && `${savingsPercent}%`}
            </div>
            <div
              style={{ width: `${investPercent}%` }}
              className="bg-[#55E6C1] flex items-center justify-center text-xs font-black text-[#1A1A1A]"
              title={`투자 ${investPercent}%`}
            >
              {investPercent > 8 && `${investPercent}%`}
            </div>
          </div>

          {/* 3 Slider Controls */}
          <div className="space-y-4">
            {/* 1. Living Expenses Slider */}
            <div className="bg-[#FFF0F0] p-4 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#FF7675] border border-black" />
                  <span className="font-black text-sm text-[#2D3436]">
                    1. 생활비 통장 (식비/주거/교통/통신비)
                  </span>
                </div>
                <div className="font-mono">
                  <span className="text-[#D63031] font-black text-base">{livingPercent}%</span>
                  <span className="text-[#636E72] text-xs font-bold ml-2">
                    ({livingKRW.toLocaleString()}원)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={livingPercent}
                onChange={(e) => handleLivingChange(Number(e.target.value))}
                className="w-full accent-[#FF7675] h-2.5 bg-white border border-black rounded-lg cursor-pointer"
              />
              <span className="text-[11px] text-[#636E72] font-bold">
                기본 생존과 일상 유지를 위한 필수 지출입니다.
              </span>
            </div>

            {/* 2. Savings Slider */}
            <div className="bg-[#EBF7FF] p-4 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#74B9FF] border border-black" />
                  <span className="font-black text-sm text-[#2D3436]">
                    2. 저축 통장 (비상금/청약/안전예금)
                  </span>
                </div>
                <div className="font-mono">
                  <span className="text-[#0984E3] font-black text-base">{savingsPercent}%</span>
                  <span className="text-[#636E72] text-xs font-bold ml-2">
                    ({savingsKRW.toLocaleString()}원)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={savingsPercent}
                onChange={(e) => handleSavingsChange(Number(e.target.value))}
                className="w-full accent-[#74B9FF] h-2.5 bg-white border border-black rounded-lg cursor-pointer"
              />
              <span className="text-[11px] text-[#636E72] font-bold">
                갑작스러운 비상 상황 대비 및 미래 목돈 마련을 위한 안전 자산입니다.
              </span>
            </div>

            {/* 3. Investment Slider */}
            <div className="bg-[#EBFBF7] p-4 rounded-2xl border-4 border-black space-y-2 shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#55E6C1] border border-black" />
                  <span className="font-black text-sm text-[#00B894] flex items-center gap-1">
                    <span>3. 모의주식 투자 통장 (시드머니)</span>
                    <Sparkles size={14} className="text-[#D63031]" />
                  </span>
                </div>
                <div className="font-mono">
                  <span className="text-[#00B894] font-black text-lg">{investPercent}%</span>
                  <span className="text-[#D63031] font-black text-sm ml-2">
                    ({investKRW.toLocaleString()}원)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={investPercent}
                onChange={(e) => handleInvestChange(Number(e.target.value))}
                className="w-full accent-[#55E6C1] h-2.5 bg-white border border-black rounded-lg cursor-pointer"
              />
              <div className="p-2.5 rounded-xl bg-white text-xs text-[#2D3436] font-bold border-2 border-black shadow-[1px_1px_0px_0px_#000]">
                🚀 이 금액이 3단계 모의주식 계좌의 <span className="font-black text-[#D63031]">초기 투자 현금</span>으로 즉시 충전됩니다!
              </div>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-4 sm:p-5 bg-[#EBFBF7] border-4 border-black text-[#00B894] rounded-2xl text-center space-y-3 shadow-[6px_6px_0px_0px_#000] animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-black">
                <CheckCircle2 size={24} className="text-[#00B894]" />
                <span>🎉 통장 배분이 성공적으로 확정되었습니다!</span>
              </div>
              <p className="text-xs sm:text-sm text-[#2D3436] font-bold">
                모의주식 계좌에 초기 투자금 <span className="text-[#D63031] font-black text-base">{investKRW.toLocaleString()}원</span>이 충전되었습니다.
              </p>
              
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <PixelButton
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto text-sm sm:text-base font-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px]"
                  onClick={() => {
                    playSelectSound();
                    if (onGoToStock) onGoToStock();
                    else onBudgetSaved();
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <TrendingUp size={20} />
                    <span>🚀 3단계 모의주식으로 즉시 넘어가기</span>
                    <ArrowRight size={18} />
                  </span>
                </PixelButton>

                {session?.currentModule !== 'stock' && (
                  <span className="text-[11px] text-[#636E72] font-bold block sm:inline">
                    (버튼을 눌러 바로 모의주식 대기 및 시장 분석을 시작할 수 있습니다)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <PixelButton variant="secondary" onClick={() => setStep('payslip')}>
              ◀ 명세서 다시보기
            </PixelButton>

            <div className="flex items-center gap-2">
              <PixelButton
                variant="gold"
                size="lg"
                disabled={saving}
                onClick={handleSaveBudget}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <span>{saving ? '저장 중...' : saveSuccess ? '통장 배분 다시 저장' : '통장 배분 저장 및 확정하기'}</span>
                </span>
              </PixelButton>

              {saveSuccess && (
                <PixelButton
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    playSelectSound();
                    if (onGoToStock) onGoToStock();
                    else onBudgetSaved();
                  }}
                >
                  <span className="flex items-center gap-1.5 font-black">
                    <span>모의주식 입장</span>
                    <ArrowRight size={16} />
                  </span>
                </PixelButton>
              )}
            </div>
          </div>
        </PixelCard>
      )}
    </div>
  );
};
