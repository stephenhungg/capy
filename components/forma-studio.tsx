"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);

const revealEase = CustomEase.create("forma-reveal", "0.23,0.83,0.56,1");
const wordsEase = CustomEase.create("forma-words", "0.44,0,0.13,0.96");
const hoverEase = CustomEase.create("forma-hover", "1,0.06,0.37,0.82");
const counterEase = CustomEase.create("forma-counter", "0,0,0.2,1");

const navItems = [
  ["Home", "#hero"],
  ["About", "#about"],
  ["Loop", "#projects"],
  ["Network", "#service"],
  ["Contact", "#contact"],
] as const;

const projects = [
  { name: "Failure Detected", alt: "Specific miss, inspectable evidence", image: "/kawaii/scenes/failure-detected.png", className: "project-horizon" },
  { name: "Targeted Collection", alt: "The right experience, on request", image: "/kawaii/scenes/targeted-collection.png", className: "project-linear" },
  { name: "Policy Training", alt: "Traceable data and model lineage", image: "/kawaii/scenes/policy-training.png", className: "project-studio" },
  { name: "Capability Receipt", alt: "Held-out improvement, verified", image: "/kawaii/scenes/capability-receipt.png", className: "project-concrete" },
  { name: "Contributor Payout", alt: "Useful experience gets rewarded", image: "/kawaii/scenes/contributor-payout.png", className: "project-axis" },
] as const;

const services = [
  { number: "/01", title: "Failure requests", body: "Turn a specific robot miss into a precise capability request with the evidence needed to reproduce it.", details: "Failure evidence · Capability spec · Evaluation protocol", image: "/kawaii/poses/mascot-inspect-tablet.png" },
  { number: "/02", title: "Targeted experience", body: "Collect only the human, robot, or simulated experience the current policy is missing.", details: "Teleoperation · Robot logs · Simulation", image: "/kawaii/poses/mascot-carry-data.png" },
  { number: "/03", title: "Held-out evaluation", body: "Test the candidate on unseen tasks in simulation and on real hardware before calling it progress.", details: "Sim breadth · Real ground truth · Capability gain", image: "/kawaii/scenes/heldout-evaluation.png" },
  { number: "/04", title: "Verified settlement", body: "Connect useful data to the resulting improvement and reconcile the contributor payout.", details: "Capability receipt · Contribution · Solana USDC", image: "/kawaii/stickers/contributor-token.png" },
] as const;

const processSteps = [
  { number: "/01", title: "Detect", body: "Localize the failure and preserve the supporting evidence.", image: "/kawaii/stickers/failure-signal.png" },
  { number: "/02", title: "Collect", body: "Request targeted experience from the network.", image: "/kawaii/stickers/data-capsule.png" },
  { number: "/03", title: "Evaluate", body: "Measure the candidate in held-out simulation and reality.", image: "/kawaii/stickers/simulation-cube.png" },
  { number: "/04", title: "Receipt", body: "Record the gain, lineage, rights, and contributor payout.", image: "/kawaii/stickers/capability-receipt.png" },
] as const;

const testimonials = [
  { name: "Failure first", role: "Network principle", image: "/kawaii/app-icon.png", quote: '"The failure is not noise. It is the most specific description of the experience the robot needs next."' },
  { name: "Proof over volume", role: "Network principle", image: "/kawaii/app-icon.png", quote: '"More episodes do not matter unless the held-out policy gets better at the capability that failed."' },
  { name: "Reward the signal", role: "Network principle", image: "/kawaii/app-icon.png", quote: '"Contributors should be paid for verified capability gain, not for dumping undifferentiated data."' },
] as const;

const faqs = [
  ["What is capy?", "Capy is an experience network for physical intelligence. It connects robot failures to targeted collection, evaluation, and contributor payout."],
  ["What is a capability receipt?", "It is an inspectable record linking failure evidence, requested capability, data cohorts, model lineage, held-out results, and settlement proof."],
  ["Where does the experience come from?", "Depending on the request, it can come from human teleoperation, another robot embodiment, simulation, or a deliberate mix of all three."],
  ["How is improvement verified?", "A candidate policy is evaluated against a protocol defined before collection, using held-out simulation and real-hardware ground truth."],
  ["What stage is capy at?", "Capy is a research and closed-loop prototype. The immediate milestone is one complete, inspectable loop from failure to reconciled payout."],
] as const;

function Logo({ light = false }: { light?: boolean }) {
  return <a href="#hero" className={`logo ${light ? "logo-light" : ""}`}>capy<sup>®</sup></a>;
}

function RollLink({ label, href = "#contact", className = "" }: { label: string; href?: string; className?: string }) {
  return <a className={`roll-link ${className}`} href={href}><span className="roll-track"><span>{label}</span><span aria-hidden="true">{label}</span></span></a>;
}

function ActionLink({ children, href = "#contact", className = "" }: { children: string; href?: string; className?: string }) {
  return (
    <a href={href} className={`action-link ${className}`}>
      <span>{children}</span>
      <span className="arrow-window" aria-hidden="true"><span className="arrow-track"><span>↗</span><span>↗</span></span></span>
      <span className="underline-window" aria-hidden="true"><span className="underline-track" /></span>
    </a>
  );
}

function SectionLabel({ children, dark = false }: { children: string; dark?: boolean }) {
  return <div className={`section-label ${dark ? "section-label-dark" : ""}`}><span className="pulse-dot" />{children}</div>;
}

function MenuToggle({ open, onClick, light = false }: { open: boolean; onClick: () => void; light?: boolean }) {
  return (
    <button className={`menu-toggle ${open ? "is-open" : ""} ${light ? "is-light" : ""}`} onClick={onClick} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
      <span /><span />
    </button>
  );
}

function Odometer({ value, suffix }: { value: string; suffix: string }) {
  return (
    <span className="odometer" aria-label={`${value}${suffix}`}>
      {value.split("").map((digit, index) => {
        const step = digit === "0" ? 10 : Number(digit);
        return (
          <span className="odometer-window" key={`${digit}-${index}`}>
            <span className="odometer-stack" data-step={step}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => <span key={i}>{n}</span>)}
            </span>
          </span>
        );
      })}
      <span className="odometer-suffix">{suffix}</span>
    </span>
  );
}

function ProjectCard({ project }: { project: (typeof projects)[number] }) {
  return (
    <a href="#contact" className={`project-card reveal-card ${project.className}`}>
      <span className="project-image"><Image src={project.image} alt="" fill sizes="(max-width: 809px) 92vw, 60vw" /></span>
      <span className="project-meta-window"><span className="project-meta-track">
        <span className="project-meta"><span>{project.name}</span><span>2026</span></span>
        <span className="project-meta project-meta-alt"><span>{project.alt}</span><span>2026</span></span>
      </span></span>
    </a>
  );
}

function FAQItem({ question, answer, open, onClick }: { question: string; answer: string; open: boolean; onClick: () => void }) {
  const answerRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!answerRef.current) return;
    gsap.to(answerRef.current, { height: open ? "auto" : 0, duration: 0.7, ease: "power3.inOut", overwrite: true });
  }, { dependencies: [open], scope: answerRef });
  return (
    <div className={`faq-item ${open ? "is-open" : ""}`}>
      <button onClick={onClick} aria-expanded={open}><span>{question}</span><span className="faq-icon" aria-hidden="true"><i /><i /></span></button>
      <div ref={answerRef} className="faq-answer"><p>{answer}</p></div>
    </div>
  );
}

export function FormaStudio() {
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(0);
  const [testimonial, setTestimonial] = useState(0);

  useGSAP((_, contextSafe) => {
    if (!root.current) return;
    const mm = gsap.matchMedia();
    const safe = contextSafe ?? ((callback: () => void) => callback);
    const listenerCleanups: Array<() => void> = [];
    const reveal = (element: Element, duration = 1, start = "top 98%") => {
      gsap.fromTo(element, { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration, ease: revealEase, scrollTrigger: { trigger: element, start, once: true } });
    };

    mm.add({ reduce: "(prefers-reduced-motion: reduce)", motion: "(prefers-reduced-motion: no-preference)" }, (media) => {
      if (media.conditions?.reduce) {
        gsap.set(".reveal-up, .reveal-card", { autoAlpha: 1, y: 0 });
        return;
      }
      gsap.timeline({ defaults: { ease: revealEase } })
        .fromTo(".hero-inner", { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration: 1 })
        .fromTo(".hero-word", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.02, ease: wordsEase }, 0.15);
      gsap.set(".sticky-header", { yPercent: -100 });
      ScrollTrigger.create({ trigger: "#about", start: "top top", onEnter: () => gsap.to(".sticky-header", { yPercent: 0, duration: 1, ease: revealEase }), onLeaveBack: () => gsap.to(".sticky-header", { yPercent: -100, duration: 1, ease: revealEase }) });
      gsap.utils.toArray<Element>(".reveal-up").forEach((el) => reveal(el, el.classList.contains("quick-reveal") ? 0.5 : 1));
      gsap.utils.toArray<Element>(".reveal-card").forEach((el) => reveal(el, 1, "top 95%"));
      gsap.utils.toArray<HTMLElement>(".odometer-stack").forEach((stack) => {
        const step = Number(stack.dataset.step ?? 0);
        gsap.fromTo(stack, { y: 0 }, { y: () => -step * (stack.parentElement?.clientHeight ?? 1), duration: 1, ease: counterEase, scrollTrigger: { trigger: stack.closest(".stat"), start: "top 80%", once: true } });
      });
    }, root);

    const wireHover = (selector: string, enter: (el: HTMLElement) => void, leave: (el: HTMLElement) => void) => {
      gsap.utils.toArray<HTMLElement>(selector).forEach((el) => {
        const onEnter = safe(() => enter(el));
        const onLeave = safe(() => leave(el));
        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);
        listenerCleanups.push(() => {
          el.removeEventListener("pointerenter", onEnter);
          el.removeEventListener("pointerleave", onLeave);
        });
      });
    };

    wireHover(".roll-link", (el) => gsap.to(el.querySelector(".roll-track"), { yPercent: -50, duration: 0.4, ease: hoverEase }), (el) => gsap.to(el.querySelector(".roll-track"), { yPercent: 0, duration: 0.4, ease: hoverEase }));
    wireHover(".action-link", (el) => { gsap.to(el.querySelector(".arrow-track"), { xPercent: 50, yPercent: -50, duration: 0.8, ease: hoverEase }); gsap.to(el.querySelector(".underline-track"), { xPercent: 50, duration: 1, ease: hoverEase }); }, (el) => { gsap.to(el.querySelector(".arrow-track"), { xPercent: 0, yPercent: 0, duration: 0.8, ease: hoverEase }); gsap.to(el.querySelector(".underline-track"), { xPercent: 0, duration: 1, ease: hoverEase }); });
    wireHover(".project-card", (el) => gsap.to(el.querySelector(".project-meta-track"), { yPercent: -50, duration: 0.55, ease: "power3.out" }), (el) => gsap.to(el.querySelector(".project-meta-track"), { yPercent: 0, duration: 0.55, ease: "power3.out" }));
    wireHover(".carousel-button", (el) => gsap.to(el, { backgroundColor: "#0f0f0f", color: "#f2f2f2", borderColor: "#0f0f0f", duration: 0.4, ease: "back.out(1.2)" }), (el) => gsap.to(el, { backgroundColor: "transparent", color: "#0f0f0f", borderColor: "#737373", duration: 0.4, ease: "back.out(1.2)" }));

    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh, { once: true });
    return () => {
      window.removeEventListener("load", refresh);
      listenerCleanups.forEach((cleanup) => cleanup());
      mm.revert();
    };
  }, { scope: root });

  useGSAP(() => {
    if (!menu.current) return;
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const timeline = gsap.timeline({ defaults: { ease: revealEase } });
    timeline.to(menu.current, { clipPath: menuOpen ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)", duration: 1 });
    if (menuOpen) timeline.fromTo(".menu-overlay .menu-reveal", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.02, ease: wordsEase }, 0.15);
    return () => { document.body.style.overflow = ""; };
  }, { dependencies: [menuOpen], scope: root });

  useGSAP(() => { gsap.fromTo(".testimonial-current > *", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.02, delay: 0.3, ease: wordsEase }); }, { dependencies: [testimonial], scope: root, revertOnUpdate: true });

  const moveTestimonial = (direction: number) => setTestimonial((current) => (current + direction + testimonials.length) % testimonials.length);

  return (
    <div ref={root} className="site-shell">
      <header className="sticky-header"><Logo /><MenuToggle open={menuOpen} onClick={() => setMenuOpen((value) => !value)} /></header>
      <div ref={menu} className={`menu-overlay ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <div className="menu-top"><Logo light /><MenuToggle open={menuOpen} onClick={() => setMenuOpen(false)} light /></div>
        <p className="menu-intro menu-reveal">We turn specific robot failures into<br />targeted experience, verified capability,<br />and fair contributor payouts.</p>
        <nav className="menu-links">{navItems.map(([label, href]) => <RollLink key={label} label={label} href={href} className="menu-reveal" />)}</nav>
        <div className="menu-bottom menu-reveal"><div><RollLink label="Research" href="#process" /><RollLink label="Network" href="#service" /><RollLink label="Receipts" href="#projects" /></div><div><RollLink label="hello@capy.network" href="mailto:hello@capy.network" /><RollLink label="Enter dashboard" href="/dashboard" /></div></div>
      </div>

      <section id="hero" className="hero">
        <div className="hero-media"><Image className="hero-image" src="/kawaii/hero-network.png" alt="Capy field engineer connecting a robot failure to a verified capability receipt" fill priority sizes="100vw" /></div>
        <div className="hero-shade" />
        <div className="hero-inner">
          <header className="hero-nav"><Logo light /><nav>{navItems.map(([label, href]) => <RollLink key={label} label={label} href={href} />)}</nav><div className="hero-contact"><RollLink label="hello@capy.network" href="mailto:hello@capy.network" /><RollLink label="Enter dashboard" href="/dashboard" /></div><div className="hero-menu"><MenuToggle open={menuOpen} onClick={() => setMenuOpen(true)} light /></div></header>
          <div className="hero-copy"><p><span className="hero-word">Turn robot failures into targeted experience,</span><br /><span className="hero-word">verified capability gain, and fair payouts</span><br /><span className="hero-word">for the contributors who made it happen.</span></p><ActionLink href="/dashboard">Enter dashboard</ActionLink></div>
          <h1 className="hero-title hero-word"><span>capy</span><sup aria-label="registered">R</sup></h1>
        </div>
      </section>

      <section id="about" className="about light-section"><div className="about-inner reveal-up quick-reveal"><SectionLabel>About capy</SectionLabel><div className="about-content"><h2>capy is the experience network for physical intelligence: start with a real failure, collect what the policy lacks, and pay only when capability improves.</h2><div className="stats"><div className="stat"><Odometer value="01" suffix="" /><p>Specific Failure</p></div><div className="stat"><Odometer value="06" suffix="" /><p>Connected Stages</p></div><div className="stat"><Odometer value="01" suffix="" /><p>Capability Receipt</p></div></div></div></div></section>

      <section id="projects" className="projects light-section"><div className="projects-heading reveal-up"><div><SectionLabel>The Loop</SectionLabel><h2>One failure, connected</h2></div><p>Every stage stays inspectable from<br className="desktop-only" /> evidence to settlement.</p></div><div className="project-grid">{projects.map((project) => <ProjectCard key={project.name} project={project} />)}</div><ActionLink className="see-all" href="#process">See the Full Loop</ActionLink></section>

      <section id="service" className="services dark-section"><div className="services-layout"><div className="services-intro reveal-up"><SectionLabel dark>Network</SectionLabel><h2>What capy connects</h2><p>A clear path from the failure signal to the exact experience, measured gain, and verified payout.</p></div><div className="service-stack">{services.map((service, index) => <article className="service-card" style={{ zIndex: index + 1 }} key={service.title}><div className="service-copy reveal-up"><span>{service.number}</span><h3>{service.title}</h3><p>{service.body}</p><p className="service-details">{service.details}</p></div><div className="service-image"><Image src={service.image} alt="" fill sizes="(max-width: 809px) 92vw, 340px" /></div></article>)}</div></div></section>

      <section id="process" className="process dark-section"><div className="process-heading reveal-up"><div><SectionLabel dark>Process</SectionLabel><h2>How the loop works</h2><p>Failure-targeted collection, policy training,<br className="desktop-only" /> held-out evaluation, and one capability receipt.</p></div><ActionLink href="#contact">Build With capy</ActionLink></div><div className="process-grid reveal-up">{processSteps.map((step) => <article className="process-step" key={step.title}><div className="process-copy"><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div><div className="process-image"><Image src={step.image} alt="" fill sizes="(max-width: 809px) 92vw, 25vw" /></div></article>)}</div></section>

      <section className="testimonials light-section reveal-up"><SectionLabel>Principles</SectionLabel><h2>What the network values</h2><div className="testimonial-current" key={testimonial}><div className="client-row"><div className="client"><Image src={testimonials[testimonial].image} alt="" width={40} height={40} /><div><strong>{testimonials[testimonial].name}</strong><span>{testimonials[testimonial].role}</span></div></div><div className="rating"><span>verified&nbsp; <i>★★★★★</i></span><small>Evidence before claims</small></div></div><p className="quote">{testimonials[testimonial].quote}</p></div><div className="carousel-controls"><button className="carousel-button" onClick={() => moveTestimonial(-1)} aria-label="Previous principle">←</button><button className="carousel-button" onClick={() => moveTestimonial(1)} aria-label="Next principle">→</button></div></section>

      <section className="faq light-section reveal-up"><div className="faq-intro"><SectionLabel>FAQ</SectionLabel><h2>The short version</h2><p>Quick answers about the network, capability receipts, and the current research prototype.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <FAQItem key={question} question={question} answer={answer} open={activeFaq === index} onClick={() => setActiveFaq(activeFaq === index ? -1 : index)} />)}</div></section>

      <section id="contact" className="cta"><Image src="/kawaii/network-map.png" alt="capy's experience network" fill sizes="100vw" /><div className="cta-shade" /><div className="cta-content reveal-up quick-reveal"><h2>One failure.<br />One closed loop.</h2><p>Build the first inspectable capability receipt with us.</p><ActionLink href="mailto:hello@capy.network">Build With capy</ActionLink></div></section>

      <footer className="footer dark-section"><div className="footer-content reveal-up"><div className="newsletter"><h3>Research notes &<br />network updates</h3><form onSubmit={(event) => event.preventDefault()}><input type="email" placeholder="Enter Your Email" aria-label="Email address" /><button type="submit"><span>Subscribe</span><span>↗</span></button></form></div><div className="footer-links"><div>{navItems.map(([label, href]) => <RollLink key={label} label={label} href={href} />)}</div><div><RollLink label="VIMA" href="#process" /><RollLink label="i2rt YAM" href="#process" /><RollLink label="LeRobot v3" href="#process" /></div><div><RollLink label="hello@capy.network" href="mailto:hello@capy.network" /><RollLink label="Research prototype" href="#about" /><RollLink label="Physical intelligence" href="#service" /></div></div><div className="footer-legal"><span><RollLink label="Capability receipts" href="#projects" />&nbsp; . &nbsp;<RollLink label="Solana USDC" href="#service" /></span><span>capy · 2026</span></div></div><div className="footer-wordmark"><span>capy</span><sup aria-label="registered">R</sup></div></footer>
    </div>
  );
}
