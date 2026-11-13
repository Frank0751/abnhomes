"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Phone, Mail, MapPin, Clock, Send, MessageCircle, Check, Loader2 } from "lucide-react";
import { useI18n } from "./i18n";

export function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "Tantra Hill",
    message: "",
    honeypot: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Submission failed");
      }
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setForm({ name: "", email: "", phone: "", interest: "Tantra Hill", message: "", honeypot: "" });
      }, 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("form.errorFallback"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[#0d9488]/8 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em] mb-6">
              {t("contact.title")}
            </h2>
            <p className="text-[#3a3530] text-base md:text-lg leading-relaxed">
              {t("contact.intro")}
            </p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="bg-[#0a0e1a] text-white p-8 lg:p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#0d9488]/10 blur-3xl pointer-events-none" />
            <h3 className="font-serif text-3xl mb-2 relative">{t("contact.getInTouch")}</h3>
            <div className="w-12 h-px bg-[#0d9488] mb-8 relative" />

            <div className="space-y-7 relative">
              <ContactItem
                icon={Phone}
                label={t("contact.callUs")}
                value="054 170 4048"
                href="tel:+233541704048"
              />
              <ContactItem
                icon={MessageCircle}
                label={t("contact.whatsapp")}
                value="+233 54 170 4048"
                href="https://wa.me/233541704048"
              />
              <ContactItem
                icon={Mail}
                label={t("contact.email")}
                value="hello@abnhomes.com.gh"
                href="mailto:hello@abnhomes.com.gh"
              />
              <ContactItem
                icon={MapPin}
                label={t("contact.headOffice")}
                value="8 Asiko Street, Tantra Hill, Accra, Ghana"
              />
              <ContactItem
                icon={Clock}
                label={t("contact.officeHours")}
                value={t("contact.officeHoursValue")}
              />
            </div>

            <div className="mt-10 pt-8 border-t border-white/10 relative">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488] mb-3">
                {t("contact.otherOffices")}
              </div>
              <ul className="space-y-1.5 text-sm text-white/65">
                <li>Achimota Petroleum Estate, Accra</li>
                <li>{t("contact.officesNote")}</li>
              </ul>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="bg-white border border-[#e8e3d8] p-8 lg:p-12"
          >
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.6, ease: "backOut" }}
                  className="w-16 h-16 rounded-full bg-[#0d9488] flex items-center justify-center mb-6"
                >
                  <Check className="h-8 w-8 text-[#0a0e1a]" strokeWidth={2.5} />
                </motion.div>
                <h3 className="font-serif text-3xl text-[#0a0e1a] mb-3">
                  {t("form.successTitle")}
                </h3>
                <p className="text-[#6b6253] max-w-md">
                  {t("form.successBody")}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Honeypot field - hidden from users, traps bots */}
                <input
                  type="text"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.honeypot}
                  onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                  className="absolute left-[-9999px] top-[-9999px] h-0 w-0 opacity-0"
                  aria-hidden="true"
                />
                <div className="grid md:grid-cols-2 gap-5">
                  <Field
                    label={t("form.fullName")}
                    type="text"
                    required
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    placeholder="e.g. Ama Owusu"
                  />
                  <Field
                    label={t("form.email")}
                    type="email"
                    required
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    placeholder="you@email.com"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  <Field
                    label={t("form.phone")}
                    type="tel"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="+233 ..."
                  />
                  <div>
                    <label className="block text-[11px] tracking-[0.2em] uppercase text-[#6b6253] mb-2 font-medium">
                      {t("form.interestedIn")}
                    </label>
                    <select
                      value={form.interest}
                      onChange={(e) => setForm({ ...form, interest: e.target.value })}
                      className="w-full px-4 py-3.5 bg-[#faf8f3] border border-[#e8e3d8] text-[#0a0e1a] focus:border-[#0d9488] focus:outline-none transition-colors font-sans text-sm"
                    >
                      <option>Tantra Hill</option>
                      <option>Achimota Petroleum Estate</option>
                      <option>{t("interest.furnished1br")}</option>
                      <option>{t("interest.customBuild")}</option>
                      <option>{t("interest.investment")}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#6b6253] mb-2 font-medium">
                    {t("form.message")}
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder={t("form.messagePlaceholder")}
                    className="w-full px-4 py-3.5 bg-[#faf8f3] border border-[#e8e3d8] text-[#0a0e1a] focus:border-[#0d9488] focus:outline-none transition-colors font-sans text-sm resize-none"
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group w-full inline-flex items-center justify-center gap-3 px-7 py-4 bg-[#0a0e1a] hover:bg-[#1a1f2e] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold tracking-[0.2em] uppercase text-sm transition-all duration-300"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("cta.sending")}
                    </>
                  ) : (
                    <>
                      {t("cta.sendMessage")}
                      <Send className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                <p className="text-xs text-[#6b6253] text-center">
                  {t("form.privacyNote")}
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-4 group">
      <div className="shrink-0 w-11 h-11 border border-[#0d9488]/40 group-hover:border-[#0d9488] group-hover:bg-[#0d9488]/5 flex items-center justify-center transition-all">
        <Icon className="h-5 w-5 text-[#0d9488]" strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488] mb-1">
          {label}
        </div>
        <div className="font-serif text-lg text-white group-hover:text-[#0d9488] transition-colors">
          {value}
        </div>
      </div>
    </div>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] tracking-[0.2em] uppercase text-[#6b6253] mb-2 font-medium">
        {label}{required && <span className="text-[#0d9488]"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3.5 bg-[#faf8f3] border border-[#e8e3d8] text-[#0a0e1a] focus:border-[#0d9488] focus:outline-none transition-colors font-sans text-sm placeholder:text-[#94a3b8]"
      />
    </div>
  );
}
