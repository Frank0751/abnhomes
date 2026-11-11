"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Check, Loader2, ArrowRight } from "lucide-react";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, language: "en", source: "website" }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setEmail("");
      setName("");
      setTimeout(() => setStatus("idle"), 5000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  return (
    <section className="relative py-16 lg:py-20 bg-[#0a0e1a] text-white overflow-hidden">

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl leading-[1.05] mb-4">
              New releases, before they go public.
            </h3>
            <p className="text-white/65 leading-relaxed max-w-lg">
              Join the ABN Insider list for early access to new residences, off market opportunities and curated Accra real estate insights. No spam, ever. Unsubscribe in one click.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-8 border border-[#0d9488]/40 bg-[#0d9488]/5 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-[#0d9488] flex items-center justify-center shrink-0">
                    <Check className="h-6 w-6 text-[#0a0e1a]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-serif text-xl mb-1">You are on the list.</div>
                    <div className="text-sm text-white/65">Watch your inbox for the next ABN release.</div>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] uppercase text-white/60 mb-2">
                      Your Name (optional)
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ama Owusu"
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/15 text-white focus:border-[#0d9488] focus:outline-none transition-colors font-sans text-sm placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] uppercase text-white/60 mb-2">
                      Email Address
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="flex-1 px-4 py-3.5 bg-white/5 border border-white/15 text-white focus:border-[#0d9488] focus:outline-none transition-colors font-sans text-sm placeholder:text-white/30"
                      />
                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0d9488] hover:bg-[#14b8a6] disabled:opacity-60 text-[#0a0e1a] font-semibold tracking-[0.2em] uppercase text-xs transition-colors"
                      >
                        {status === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Join
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {status === "error" && (
                    <p className="text-sm text-red-300">Something went wrong. Please try again or call 054 170 4048.</p>
                  )}
                  <p className="text-xs text-white/40">
                    By subscribing you agree to receive emails from ABN Homes. We never share your details.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
