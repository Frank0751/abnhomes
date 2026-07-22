"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, RefreshCw, TrendingUp, Calendar, Percent } from "lucide-react";

type Currency = "USD" | "GHS";

const RATE_USD_TO_GHS = 15.2; // approximate, Jan 2026

export function MortgageCalculator({
  defaultPriceUsd = 220_000,
}: {
  defaultPriceUsd?: number;
}) {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [priceUsd, setPriceUsd] = useState(defaultPriceUsd);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [termYears, setTermYears] = useState(20);
  const [interestRate, setInterestRate] = useState(18.5); // typical Ghana mortgage rate

  const displayPrice = currency === "USD" ? priceUsd : Math.round(priceUsd * RATE_USD_TO_GHS);
  const displaySymbol = currency === "USD" ? "$" : "GH₵";

  const { monthlyPayment, totalInterest, totalPayment, principal, downPaymentAmount } = useMemo(() => {
    const principal = priceUsd * (1 - downPaymentPct / 100);
    const downPaymentAmount = priceUsd * (downPaymentPct / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = termYears * 12;

    if (monthlyRate === 0) {
      const monthlyPayment = principal / numPayments;
      return {
        monthlyPayment,
        totalInterest: 0,
        totalPayment: principal,
        principal,
        downPaymentAmount,
      };
    }

    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    const totalPayment = monthlyPayment * numPayments;
    const totalInterest = totalPayment - principal;

    return { monthlyPayment, totalInterest, totalPayment, principal, downPaymentAmount };
  }, [priceUsd, downPaymentPct, termYears, interestRate]);

  const convert = (usd: number) =>
    currency === "USD" ? usd : Math.round(usd * RATE_USD_TO_GHS);
  const fmt = (usd: number) =>
    `${displaySymbol}${convert(usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const principalPct = Math.round((principal / totalPayment) * 100);
  const interestPct = 100 - principalPct;

  return (
    <div className="bg-[#0a0e1a] text-white p-6 lg:p-8 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 border border-[#0d9488]/40 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-[#0d9488]" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-serif text-xl">Mortgage Estimator</h3>
            <p className="text-xs text-white/50 tracking-wide">Indicative only. Confirm with your bank.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 border border-white/15">
          {(["USD", "GHS"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                currency === c ? "bg-[#0d9488] text-[#0a0e1a]" : "text-white/60 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-6 mb-8">
        <Slider
          label="Property Price"
          value={displayPrice}
          display={fmt(priceUsd)}
          min={currency === "USD" ? 50_000 : 750_000}
          max={currency === "USD" ? 1_500_000 : 22_000_000}
          step={currency === "USD" ? 5_000 : 75_000}
          onChange={(v) => setPriceUsd(currency === "USD" ? v : Math.round(v / RATE_USD_TO_GHS))}
          icon={TrendingUp}
        />
        <Slider
          label="Down Payment"
          value={downPaymentPct}
          display={`${downPaymentPct}%  (${fmt(downPaymentAmount)})`}
          min={0}
          max={50}
          step={1}
          onChange={setDownPaymentPct}
          icon={Percent}
        />
        <Slider
          label="Loan Term"
          value={termYears}
          display={`${termYears} years`}
          min={5}
          max={30}
          step={1}
          onChange={setTermYears}
          icon={Calendar}
        />
        <Slider
          label="Interest Rate"
          value={interestRate}
          display={`${interestRate.toFixed(1)}% p.a.`}
          min={5}
          max={30}
          step={0.1}
          onChange={setInterestRate}
          icon={Percent}
        />
      </div>

      {/* Result */}
      <div className="grid sm:grid-cols-2 gap-px bg-white/10 border border-white/10 mb-6">
        <div className="bg-[#0a0e1a] p-5">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488] mb-1">
            Monthly Payment
          </div>
          <div className="font-serif text-3xl text-white">{fmt(monthlyPayment)}</div>
          <div className="text-xs text-white/50 mt-1">over {termYears} years</div>
        </div>
        <div className="bg-[#0a0e1a] p-5">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488] mb-1">
            Total Interest
          </div>
          <div className="font-serif text-3xl text-white">{fmt(totalInterest)}</div>
          <div className="text-xs text-white/50 mt-1">over the loan term</div>
        </div>
      </div>

      {/* Breakdown bar */}
      <div className="mb-5">
        <div className="flex justify-between text-[10px] tracking-[0.25em] uppercase text-white/50 mb-2">
          <span>Principal {principalPct}%</span>
          <span>Interest {interestPct}%</span>
        </div>
        <div className="h-2 bg-white/10 flex overflow-hidden">
          <motion.div
            className="bg-[#0d9488]"
            initial={{ width: 0 }}
            animate={{ width: `${principalPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.div
            className="bg-white/30"
            initial={{ width: 0 }}
            animate={{ width: `${interestPct}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>
        <div className="text-xs text-white/60 mt-3 leading-relaxed">
          You would pay a total of <span className="text-[#0d9488] font-medium">{fmt(totalPayment)}</span> over {termYears} years, on a principal of {fmt(principal)} after a {downPaymentPct}% down payment.
        </div>
      </div>

      <button
        onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
        className="group w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0d9488] hover:bg-[#14b8a6] text-[#0a0e1a] font-semibold tracking-[0.2em] uppercase text-xs transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Talk to an ABN Advisor
      </button>

      <p className="text-[10px] text-white/40 mt-4 leading-relaxed text-center">
        Estimates use Ghana benchmark mortgage rates and a static FX rate of 1 USD = GH₵{RATE_USD_TO_GHS}. Final terms vary by lender, applicant profile and prevailing rates.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  icon: React.ElementType;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-white/60">
          <Icon className="h-3.5 w-3.5 text-[#0d9488]" strokeWidth={1.5} />
          {label}
        </div>
        <div className="font-serif text-sm text-[#0d9488]">{display}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 appearance-none cursor-pointer bg-white/15 accent-[#0d9488]"
        style={{
          background: `linear-gradient(to right, #0d9488 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
        }}
      />
    </div>
  );
}
