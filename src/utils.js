// js/utils.js

export const closeModal = () => {
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) {
    modalContainer.innerHTML = '';
    modalContainer.classList.add('hidden');
    modalContainer.style.display = 'none'; // ✅ ensure it's fully hidden
  }

  // Optionally also remove any modal-related body blur or overflow classes if used
  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.classList.remove('blur-sm');
  }

  // ✅ Trigger a small reflow to fix registration state sync issues
  setTimeout(() => {
    document.body.offsetHeight;
  }, 50);
};

export const fetchAndInjectHTML = async (filePath, targetElement) => {
  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`Could not fetch ${filePath}`);
    targetElement.innerHTML = await res.text();
    console.log(`✅ Loaded ${filePath}`);
  } catch (error) {
    console.error("HTML Injection Error:", error);
    targetElement.innerHTML = `<p class="p-8 text-red-400">Error loading ${filePath}</p>`;
  }
};
