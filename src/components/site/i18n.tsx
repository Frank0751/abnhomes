"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "fr";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.home": "Home",
  "nav.about": "About",
  "nav.residences": "Residences",
  "nav.amenities": "Amenities",
  "nav.gallery": "Gallery",
  "nav.locations": "Locations",
  "nav.contact": "Contact",
  "cta.bookTour": "Book a Tour",
  "cta.explore": "Explore Residences",
  "cta.schedule": "Schedule a Visit",
  "cta.speakAdvisor": "Speak to an Advisor",
  "cta.send": "Send Message",
  "hero.eyebrow": "ABN Homes Company Limited",
  "hero.tagline": "Where architectural vision becomes the place you call home.",
  "hero.body":
    "Thoughtfully designed luxury apartments and homes across Accra, Ghana. From Tantra Hill to Sakumono and Nii Ayi Mensah, every residence is crafted for those who expect more from where they live.",
  "hero.location": "8 Asiko Street, Tantra Hill, Accra, Ghana",
  "about.eyebrow": "The ABN Story",
  "about.title": "A Ghanaian home, built with a world of intention.",
  "residences.eyebrow": "Our Residences",
  "residences.title": "Three addresses. One uncompromising standard.",
  "residences.subtitle":
    "Each ABN residence is shaped by the neighbourhood it sits in, yet shares the same commitment to space, light and craft.",
  "amenities.eyebrow": "The ABN Standard",
  "amenities.title": "Considered details, included as standard.",
  "gallery.eyebrow": "Visual Tour",
  "gallery.title": "Step inside the ABN way of living.",
  "locations.eyebrow": "Where We Build",
  "locations.title": "Three Accra neighbourhoods, one address you will love.",
  "contact.eyebrow": "Begin the Conversation",
  "contact.title": "Book a tour, ask a question, or simply say hello.",
  "contact.body":
    "Whether you are ready to move this month or just starting to explore Accra, our advisors are here to help.",
  "form.name": "Full name",
  "form.email": "Email",
  "form.phone": "Phone",
  "form.interest": "I am interested in",
  "form.message": "Your message",
  "form.success.title": "Message received.",
  "form.success.body":
    "Thank you for reaching out to ABN Homes. One of our advisors will contact you within two business hours.",
};

const fr: Dict = {
  "nav.home": "Accueil",
  "nav.about": "A propos",
  "nav.residences": "Residences",
  "nav.amenities": "Equipements",
  "nav.gallery": "Galerie",
  "nav.locations": "Quartiers",
  "nav.contact": "Contact",
  "cta.bookTour": "Visiter",
  "cta.explore": "Decouvrir les Residences",
  "cta.schedule": "Planifier une Visite",
  "cta.speakAdvisor": "Parler a un Conseiller",
  "cta.send": "Envoyer le Message",
  "hero.eyebrow": "ABN Homes Company Limited",
  "hero.tagline": "Ou la vision architecturale devient le lieu que vous appelez chez vous.",
  "hero.body":
    "Appartements et maisons de luxe concus avec soin a travers Accra, Ghana. De Tantra Hill a Sakumono et Nii Ayi Mensah, chaque residence est creee pour ceux qui attendent plus de leur lieu de vie.",
  "hero.location": "8 Asiko Street, Tantra Hill, Accra, Ghana",
  "about.eyebrow": "L'Histoire ABN",
  "about.title": "Une maison ghanenne, batie avec un monde d'intention.",
  "residences.eyebrow": "Nos Residences",
  "residences.title": "Trois adresses. Une norme sans compromis.",
  "residences.subtitle":
    "Chaque residence ABN est modellee par le quartier ou elle se trouve, tout en partageant le meme engagement envers l'espace, la lumiere et le savoir-faire.",
  "amenities.eyebrow": "Le Standard ABN",
  "amenities.title": "Details refleuris, inclus en standard.",
  "gallery.eyebrow": "Visite Visuelle",
  "gallery.title": "Entrez dans le mode de vie ABN.",
  "locations.eyebrow": "Ou Nous Construisons",
  "locations.title": "Trois quartiers d'Accra, une adresse que vous aimerez.",
  "contact.eyebrow": "Demarrez la Conversation",
  "contact.title": "Reservez une visite, posez une question, ou dites simplement bonjour.",
  "contact.body":
    "Que vous soyez pret a demenager ce mois-ci ou que vous commenciez a explorer Accra, nos conseillers sont la pour vous aider.",
  "form.name": "Nom complet",
  "form.email": "Email",
  "form.phone": "Telephone",
  "form.interest": "Je suis interesse par",
  "form.message": "Votre message",
  "form.success.title": "Message recu.",
  "form.success.body":
    "Merci d'avoir contacte ABN Homes. Un de nos conseillers vous contactera dans les deux heures ouvrables.",
};

const dictionaries: Record<Language, Dict> = { en, fr };

type I18nContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("abn-lang") : null;
    if (stored === "en" || stored === "fr") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(stored);
    }
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("abn-lang", l);
  };

  const t = (key: string) => dictionaries[lang][key] || dictionaries.en[key] || key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
