// js/utils.js

export const closeModal = () => {
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
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
