// This module provides a proxy function that works in the browser
// to bypass CORS issues when the API endpoint doesn't allow cross-origin requests

export async function fetchWithProxy(url) {
  // List of public CORS proxies to try (add more as needed)
  const proxies = [
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url='
  ];
  
  // Try each proxy in order until one works
  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Proxy ${proxy} failed:`, error);
      // Continue to next proxy if this one failed
    }
  }
  
  // If all proxies fail, try the direct URL as last resort
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("All proxy attempts failed:", error);
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}
