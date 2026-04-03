const motionSelectors = [
  ".hero-copy",
  ".hero-panel",
  ".section-head",
  ".phone",
  ".desktop-card",
  ".footer-note"
];

const motionItems = [...document.querySelectorAll(motionSelectors.join(","))];

motionItems.forEach((element, index) => {
  element.classList.add("motion-item");
  element.style.setProperty("--motion-delay", `${Math.min(index * 45, 240)}ms`);
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  motionItems.forEach((element) => element.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  motionItems.forEach((element) => observer.observe(element));
}
