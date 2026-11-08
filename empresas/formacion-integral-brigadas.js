document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector("#brigade-gallery-track");
  const previousButton = document.querySelector("[data-gallery-previous]");
  const nextButton = document.querySelector("[data-gallery-next]");
  const currentCount = document.querySelector("[data-gallery-current]");

  if (!track || !previousButton || !nextButton || !currentCount) return;

  const updateControls = () => {
    previousButton.disabled = track.scrollLeft <= 1;
    nextButton.disabled =
      track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
    const slides = track.querySelectorAll(".brigade-gallery-slide");
    const slide = slides[0];
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = (slide?.getBoundingClientRect().width || 1) + gap;
    const activeSlide = Math.min(
      slides.length,
      Math.round(track.scrollLeft / step) + 1,
    );
    const activeSlideElement = slides[activeSlide - 1];
    if (activeSlideElement) {
      track.style.height = `${activeSlideElement.getBoundingClientRect().height + 18}px`;
    }
    currentCount.textContent = String(activeSlide).padStart(2, "0");
  };

  const scrollBySlide = (direction) => {
    const slide = track.querySelector(".brigade-gallery-slide");
    if (!slide) return;

    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (slide.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  previousButton.addEventListener("click", () => scrollBySlide(-1));
  nextButton.addEventListener("click", () => scrollBySlide(1));
  track.querySelectorAll("img").forEach((image) => {
    image.addEventListener("load", updateControls);
  });
  track.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls);
  updateControls();
});
