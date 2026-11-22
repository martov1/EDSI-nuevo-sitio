document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector("#slider-track");
  const previousButton = document.querySelector("#prev-slide");
  const nextButton = document.querySelector("#next-slide");

  if (!track || !previousButton || !nextButton || track.children.length < 2) {
    return;
  }

  const totalSlides = track.children.length;
  let currentSlide = 0;

  const updateSliderPosition = () => {
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
  };

  const goToNextSlide = () => {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateSliderPosition();
  };

  const goToPreviousSlide = () => {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateSliderPosition();
  };

  let autoPlayInterval = window.setInterval(goToNextSlide, 3500);
  const resetAutoPlay = () => {
    window.clearInterval(autoPlayInterval);
    autoPlayInterval = window.setInterval(goToNextSlide, 3500);
  };

  nextButton.addEventListener("click", () => {
    goToNextSlide();
    resetAutoPlay();
  });

  previousButton.addEventListener("click", () => {
    goToPreviousSlide();
    resetAutoPlay();
  });
});
