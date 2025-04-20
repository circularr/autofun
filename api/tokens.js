// Vercel serverless function to proxy token API and avoid CORS issues
export default async function handler(req, res) {
  // Build target URL with same query params
  const { limit, page, sortBy, sortOrder, hideImported } = req.query;
  const query = new URLSearchParams({ limit, page, sortBy, sortOrder, hideImported });
  const targetUrl = `https://api.auto.fun/api/tokens?${query.toString()}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    // Allow CORS from our domain
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy fetch error:', err);
    res.status(500).json({ error: err.message });
  }
}
