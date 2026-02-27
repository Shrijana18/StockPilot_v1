const fetchGoogleImages = async (query) => {
  // Other Google API key (Custom Search, Maps, etc.) – not Gemini
  const apiKey = typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_API_KEY
    ? import.meta.env.VITE_GOOGLE_API_KEY
    : "AIzaSyBPkkXZWll0VifG5kb0DDSsoV5UB-n5pFE";
  const cseId = typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_CSE_CX
    ? import.meta.env.VITE_GOOGLE_CSE_CX
    : "82ccaaa87aa2e40a6";

  const generateQueries = (query) => {
    let terms = [];
    if (typeof query === "object" && query !== null) {
      const { brand = "", name = "", unit = "" } = query;
      terms = [
        `${brand} ${name} ${unit} product packaging`,
        `${brand} ${name} ${unit}`,
        `${brand} ${name}`,
        `${name} ${unit}`,
        `${brand} ${unit}`,
        `${brand} product`,
        `${name} product`,
        `${brand} ${name} pack photo`,
      ];
    } else {
      terms = [
        `${query} product packaging`,
        `${query} product`,
        `${query} pack photo`,
        `${query} retail image`,
        `${query} ecommerce packaging`,
      ];
    }

    return terms.map(
      (term) =>
        `${term} product packaging image`
    );
  };

  const queries = generateQueries(query);

  for (const smartQuery of queries) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
          smartQuery
        )}&searchType=image&key=${apiKey}&cx=${cseId}&num=6`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          return data.items
            .filter((item) => item.link && item.link.startsWith("http"))
            .map((item) => item.link);
        }
      }
    } catch (error) {
      console.error("Google Image Fetch Error:", error.message);
    }
  }

  console.warn("❌ No image results found for:", query);
  return [];
};

export default fetchGoogleImages;