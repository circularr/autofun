import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { fetchWithProxy } from "./proxy";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Direct API URL (will be proxied client-side to avoid CORS)
const API_URL = "https://api.auto.fun/api/tokens";

// Utility functions
function formatNumber(num) {
  if (num === null || num === undefined) return "-";
  if (typeof num === "string") num = Number(num);
  if (isNaN(num)) return "-";
  if (num > 1e6) return Math.round(num / 1e6) + "M";
  if (num > 1e3) return Math.round(num / 1e3) + "K";
  return Math.round(num).toLocaleString();
}

// Format relative time (e.g., "2 hours ago")
function timeAgo(dateString) {
  if (!dateString) return "-";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 30) {
    return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) !== 1 ? 's' : ''} ago`;
  }
  if (diffDay > 0) {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  }
  if (diffHour > 0) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  }
  if (diffMin > 0) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  }
  
  return 'just now';
}

// Shorter timeAgo for mobile
function shortTimeAgo(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay > 0) return `${diffDay}D`;
  if (diffHour > 0) return `${diffHour}hr`;
  if (diffMin > 0) return `${diffMin}min`;
  return 'Now';
}

// Mobile market cap formatter (e.g. 31.1K, 2.5M)
function formatMarketCapMobile(num) {
  if (num === null || num === undefined) return "-";
  if (typeof num === "string") num = Number(num);
  if (isNaN(num)) return "-";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toLocaleString();
}

// Desktop market cap formatter (no decimals)
function formatMarketCapDesktop(num) {
  if (num === null || num === undefined) return "-";
  if (typeof num === "string") num = Number(num);
  if (isNaN(num)) return "-";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(0) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(0) + "K";
  return Math.floor(num).toLocaleString();
}

// Utility to detect mobile
function isMobile() {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 769;
  }
  return false;
}

// Minimal Y-axis number formatter for chart
function formatChartAxis(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") value = Number(value);
  if (isNaN(value)) return "-";
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(0) + "M";
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(0) + "k";
  return value.toString();
}

function App() {
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartTab, setChartTab] = useState('tokens');  // 'tokens', 'volume', 'buyers'
  const [cursorVisible, setCursorVisible] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: 'marketCapUSD',
    direction: 'desc'
  });
  const [showAddressPopup, setShowAddressPopup] = useState(false);
  const [activeAddress, setActiveAddress] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [chartData, setChartData] = useState({
    labels: [],
    data: [],
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
    yAxisFormat: (value) => value
  });
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [infoContent, setInfoContent] = useState('');
  const popupRef = useRef(null);
  const [chartMode, setChartMode] = useState('hourly');

  // Function to handle clicking outside popup
  useEffect(() => {
    function handleClickOutside(event) {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setShowAddressPopup(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popupRef]);

  // Reset copy success message after 2 seconds
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  // Function to fetch all tokens at once
  const fetchAllTokens = () => {
    setLoading(true);
    setError(null);

    // Request all active tokens at once (based on the API response, there are ~383 tokens total)
    const url = `${API_URL}?limit=1000&page=1&sortBy=createdAt&sortOrder=asc&hideImported=1`;

    console.log("Fetching all tokens from:", url);

    // Use the proxy utility to handle CORS issues
    fetchWithProxy(url)
      .then((data) => {
        const allTokens = data.tokens || [];
        // Filter for active tokens only
        const activeTokens = allTokens.filter(token => token.status === "active");
        setTokens(activeTokens);
        setLoading(false);
        updateTokensCreatedChart(activeTokens, chartMode);
      })
      .catch((err) => {
        console.error("API fetch error:", err);
        setError(`Failed to fetch token data: ${err.message}`);
        setLoading(false);
      });
  };

  // Update chart data based on the selected tab
  const updateChartData = (tokensList, tab, mode) => {
    switch (tab) {
      case 'tokens':
        updateTokensCreatedChart(tokensList, mode);
        break;
      case 'volume':
        updateVolumeChart(tokensList, mode);
        break;
      case 'buyers':
        updateBuyersChart(tokensList, mode);
        break;
      default:
        updateTokensCreatedChart(tokensList, mode);
    }
  };

  // Fix: Ensure chart updates when chartTab changes
  useEffect(() => {
    if (tokens.length > 0) {
      updateChartData(tokens, chartTab, chartMode);
    }
    // eslint-disable-next-line
  }, [chartTab, chartMode]);

  // Common function to generate continuous timeline labels for last 24 hours
  const generateTimelineLabels = () => {
    const now = new Date();
    const labels = [];
    const timestamps = [];
    
    // Generate 24 hour points, from 24 hours ago to now
    for (let i = 23; i >= 0; i--) {
      const hourAgo = new Date(now);
      hourAgo.setHours(now.getHours() - i);
      
      // Format hour labels with AM/PM
      const hour = hourAgo.getHours();
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      
      labels.push(`${hour12}${ampm}`);
      timestamps.push(hourAgo.getTime());
    }
    
    return { labels, timestamps };
  };

  // Chart 1: Tokens created over time (last 24 hours)
  const updateTokensCreatedChart = (tokensList, mode = 'hourly') => {
    const { labels, timestamps } = generateTimelineLabels();
    let hourData = Array(24).fill(0);
    
    // Filter tokens by creation time (last 24 hours)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    
    const relevantTokens = tokensList.filter(token => {
      if (!token.createdAt) return false;
      
      const tokenDate = new Date(token.createdAt);
      return tokenDate >= twentyFourHoursAgo && tokenDate <= now;
    });
    
    // Count tokens per hour slot in our timeline
    relevantTokens.forEach(token => {
      const tokenTime = new Date(token.createdAt).getTime();
      
      // Find which hour slot this token belongs to
      for (let i = 0; i < timestamps.length - 1; i++) {
        if (tokenTime >= timestamps[i] && tokenTime < timestamps[i + 1]) {
          hourData[i]++;
          break;
        }
      }
      
      // Check the last hour slot separately
      if (tokenTime >= timestamps[timestamps.length - 1] && tokenTime <= now.getTime()) {
        hourData[timestamps.length - 1]++;
      }
    });
    
    if (mode === 'cumulative') {
      // Convert to cumulative sum
      hourData = hourData.reduce((acc, val, idx) => {
        acc.push((acc[idx - 1] || 0) + val);
        return acc;
      }, []);
    }
    
    setChartData({
      labels,
      data: hourData,
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => value.toLocaleString()
    });
  };

  // Chart 3: Total volume over time (last 24 hours) - hourly, not cumulative
  const updateVolumeChart = (tokensList, mode = 'hourly') => {
    const { labels, timestamps } = generateTimelineLabels();
    let hourData = Array(24).fill(0);
    for (let i = 0; i < timestamps.length; i++) {
      const currentHourStart = timestamps[i];
      const currentHourEnd = i < timestamps.length - 1 
        ? timestamps[i + 1] 
        : new Date().getTime();
      tokensList.forEach(token => {
        // Only count tokens that existed during this hour
        if (token.createdAt) {
          const tokenCreationTime = new Date(token.createdAt).getTime();
          // If token has volume data and was created before this hour ends
          if (tokenCreationTime <= currentHourEnd && (token.volume24h !== undefined || token.volume !== undefined)) {
            // If token has a per-hour volume array, use it; otherwise, try to estimate as flat per hour
            if (Array.isArray(token.hourlyVolume) && token.hourlyVolume.length === 24) {
              hourData[i] += parseFloat(token.hourlyVolume[i]) || 0;
            } else {
              // Spread 24h volume evenly for now (fallback)
              const vol = parseFloat(token.volume24h || token.volume || 0);
              hourData[i] += vol / 24;
            }
          }
        }
      });
    }
    if (mode === 'cumulative') {
      hourData = hourData.reduce((acc, val, idx) => {
        acc.push((acc[idx - 1] || 0) + val);
        return acc;
      }, []);
    }
    setChartData({
      labels,
      data: hourData,
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => '$' + formatNumber(value)
    });
  };

  // Chart 5: Total buyers over time (last 24 hours)
  const updateBuyersChart = (tokensList, mode = 'hourly') => {
    const { labels, timestamps } = generateTimelineLabels();
    let hourData = Array(24).fill(0);
    
    // Get tokens with buyers data
    const tokensWithBuyers = tokensList.filter(token => 
      token.createdAt && (token.holders !== undefined || token.holderCount !== undefined)
    );
    
    // For each hour slot in our timeline, calculate cumulative buyers
    for (let i = 0; i < timestamps.length; i++) {
      const hourTimestamp = timestamps[i];
      
      // Get tokens that existed at this specific hour
      const tokensAtThisHour = tokensWithBuyers.filter(token => {
        const tokenCreationTime = new Date(token.createdAt).getTime();
        return tokenCreationTime <= hourTimestamp;
      });
      
      // Sum up buyers for this hour
      hourData[i] = tokensAtThisHour.reduce((sum, token) => {
        // Try both possible property names for buyers
        const buyerCount = token.holders || token.holderCount || 0;
        return sum + parseInt(buyerCount);
      }, 0);
    }
    if (mode === 'cumulative') {
      hourData = hourData.reduce((acc, val, idx) => {
        acc.push((acc[idx - 1] || 0) + val);
        return acc;
      }, []);
    }
    setChartData({
      labels,
      data: hourData,
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => formatNumber(value)
    });
  };

  // Initial fetch - now get all tokens at once
  useEffect(() => {
    fetchAllTokens();
  }, []);
  
  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 600); // Toggle every 600ms
    
    return () => clearInterval(cursorInterval);
  }, []);

  // Apply sorting whenever tokens are updated or chart tab changes
  useEffect(() => {
    let sorted = [...tokens];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        if (sortConfig.key === 'liquidityPercent') {
          // Calculate fallback for tokens without liquidityPercent
          aValue = a.liquidityPercent !== undefined && a.liquidityPercent !== null
            ? parseFloat(a.liquidityPercent)
            : (a.liquidity !== undefined && a.liquidity !== null && a.marketCapUSD && a.marketCapUSD > 0)
              ? (parseFloat(a.liquidity) / parseFloat(a.marketCapUSD)) * 100
              : null;
          bValue = b.liquidityPercent !== undefined && b.liquidityPercent !== null
            ? parseFloat(b.liquidityPercent)
            : (b.liquidity !== undefined && b.liquidity !== null && b.marketCapUSD && b.marketCapUSD > 0)
              ? (parseFloat(b.liquidity) / parseFloat(b.marketCapUSD)) * 100
              : null;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
        }
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortConfig.direction === 'asc'
            ? aValue - bValue
            : bValue - aValue;
        }
      });
    }
    setFilteredTokens(sorted);
  }, [tokens, sortConfig]);

  const handleSortClick = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key 
        ? prevConfig.direction === 'asc' ? 'desc' : 'asc' 
        : 'desc'
    }));
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };
  
  const changeChartTab = (tab) => {
    setChartTab(tab);
  };

  const handleCopyAddress = (address) => {
    if (!address) return;
    
    setActiveAddress(address);
    setShowAddressPopup(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(activeAddress);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // Function to show info tooltip with explanation of chart data
  const showChartInfo = (chartType, mode) => {
    let content = '';
    switch(chartType) {
      case 'tokens':
        content = mode === 'cumulative'
          ? 'Cumulative: Running total of tokens created up to each hour.'
          : 'Hourly: Number of tokens created in each hour.';
        break;
      case 'volume':
        content = mode === 'cumulative'
          ? 'Cumulative: Running total of all trading volume up to each hour.'
          : 'Hourly: Total trading volume for all tokens in each hour.';
        break;
      case 'buyers':
        content = mode === 'cumulative'
          ? 'Cumulative: Running total of buyers for all tokens up to each hour.'
          : 'Hourly: Total buyers for all tokens in each hour.';
        break;
      default:
        content = 'Shows token metrics for the last 24 hours.';
    }
    setInfoContent(content);
    setShowInfoTooltip(true);
  };

  // Chart configuration
  const chartConfig = {
    labels: chartData.labels,
    datasets: [
      {
        label: 'Count',
        data: chartData.data,
        fill: false,
        backgroundColor: chartData.backgroundColor,
        borderColor: '#00FF00',
        borderWidth: 2,
        tension: 0, // Use 0 for angular lines (not curved)
        pointBackgroundColor: '#00FF00',
        pointBorderColor: '#000',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#00FF00',
        bodyColor: '#00FF00',
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            let label = '';
            
            switch (chartTab) {
              case 'tokens':
                label = `${value.toLocaleString()} token${value !== 1 ? 's' : ''}`;
                break;
              case 'volume':
                label = `$${formatNumber(value)}`;
                break;
              case 'buyers':
                label = `${formatNumber(value)} buyer${value !== 1 ? 's' : ''}`;
                break;
              default:
                label = value.toLocaleString();
            }
            
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grace: '5%',
        ticks: {
          callback: function(value) {
            return chartData.yAxisFormat(value);
          },
          font: {
            size: 11
          },
          color: '#00FF00',
          maxTicksLimit: 5,
          padding: 10
        },
        grid: {
          color: 'rgba(0,255,0,0.07)'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: isMobile() ? 10 : 13,
            weight: isMobile() ? '400' : '500',
          },
          color: '#00FF00',
          maxTicksLimit: isMobile() ? 6 : 12,
          padding: isMobile() ? 4 : 6
        }
      }
    }
  };

  return (
    <div className="container">
      <h1>
        <a href="https://auto.fun" target="_blank" rel="noopener noreferrer" style={{ color: '#00FF00', textDecoration: 'none', fontWeight: 800, letterSpacing: '1px', fontSize: 'inherit' }}>auto.fun</a>
      </h1>
      
      <div className="chart-container" style={{ paddingBottom: '20px' }}>
        <div className="chart-tabs">
          <button 
            className={`chart-tab ${chartTab === 'tokens' ? 'active' : ''}`}
            onClick={() => changeChartTab('tokens')}
          >
            {isMobile() ? 'Tokens' : <span style={{color:'#fff'}}>Tokens Created</span>}
          </button>
          <button 
            className={`chart-tab ${chartTab === 'volume' ? 'active' : ''}`}
            onClick={() => changeChartTab('volume')}
          >
            {isMobile() ? 'Volume' : 'Volume'}
          </button>
          <button 
            className={`chart-tab ${chartTab === 'buyers' ? 'active' : ''}`}
            onClick={() => changeChartTab('buyers')}
          >
            {isMobile() ? 'Buyers' : 'Buyers'}
          </button>
        </div>
        
        <div className="chart-header">
          <div className="chart-mode-toggle-group">
            <button
              className={`krug-toggle-small${chartMode === 'hourly' ? ' active' : ''}`}
              onClick={() => setChartMode('hourly')}
              aria-label="Show hourly chart"
            >
              Hourly
            </button>
            <button
              className={`krug-toggle-small${chartMode === 'cumulative' ? ' active' : ''}`}
              onClick={() => setChartMode('cumulative')}
              aria-label="Show cumulative chart"
            >
              Cumulative
            </button>
          </div>
          <button 
            className="info-button" 
            onClick={() => showChartInfo(chartTab, chartMode)}
            aria-label="Chart information"
          >
            i
          </button>
        </div>
        
        {showInfoTooltip && (
          <div className="info-tooltip">
            <div className="info-tooltip-content">
              {infoContent}
            </div>
            <button 
              className="info-close" 
              onClick={() => setShowInfoTooltip(false)}
            >
              ×
            </button>
          </div>
        )}
        
        <Line data={chartConfig} options={{
          ...chartOptions,
          plugins: {
            ...chartOptions.plugins,
            legend: { display: false },
            title: { display: false },
          },
          layout: {
            padding: {
              left: isMobile() ? 8 : 18,
              right: isMobile() ? 8 : 18,
              top: isMobile() ? 15 : 20,
              bottom: isMobile() ? 15 : 20,
            }
          },
          scales: {
            ...chartOptions.scales,
            y: {
              ...chartOptions.scales.y,
              beginAtZero: true,
              grace: '5%', // Add some space above/below the line
              min: undefined,
              max: undefined,
              ticks: {
                ...chartOptions.scales.y.ticks,
                callback: function(value) {
                  return formatChartAxis(value);
                },
                font: { size: isMobile() ? 10 : 11 },
                color: '#00FF00',
                maxTicksLimit: 5,
                padding: isMobile() ? 4 : 10
              },
              grid: {
                ...chartOptions.scales.y.grid,
                color: 'rgba(0,255,0,0.07)'
              }
            },
            x: {
              ...chartOptions.scales.x,
              ticks: {
                ...chartOptions.scales.x.ticks,
                font: { size: isMobile() ? 9 : 13, weight: isMobile() ? '400' : '500' },
                color: '#00FF00',
                maxTicksLimit: isMobile() ? 6 : 12,
                padding: isMobile() ? 4 : 6
              },
              grid: {
                ...chartOptions.scales.x.grid,
                display: false
              }
            }
          },
          responsive: true,
          maintainAspectRatio: false
        }} height={isMobile() ? 170 : 260} style={{ maxHeight: isMobile() ? 190 : 280 }} />
      </div>
      
      <div className="controls">
        <div className="status-indicator">
          Listing all active tokens<span className={`cursor ${cursorVisible ? 'visible' : ''}`}>_</span>
        </div>
        <div className="filter-info">
          {filteredTokens.length} tokens • Sorted by {sortConfig.key} ({sortConfig.direction === 'asc' ? 'ascending' : 'descending'})
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}
      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {!isMobile() && (
                  <th onClick={() => handleSortClick('name')}>Token{getSortIndicator('name')}</th>
                )}
                <th onClick={() => handleSortClick('ticker')} style={isMobile() ? {maxWidth:'48px',width:'48px',padding:'0 2px'} : {}}>{isMobile() ? 'Tick.' : 'Ticker'}{getSortIndicator('ticker')}</th>
                <th onClick={() => handleSortClick('volume24h')}>{isMobile() ? 'Vol.' : 'Volume'}{getSortIndicator('volume24h')}</th>
                <th onClick={() => handleSortClick('marketCapUSD')}>{isMobile() ? 'M.Cap' : 'Market Cap'}{getSortIndicator('marketCapUSD')}</th>
                <th onClick={() => handleSortClick('holderCount')}>{isMobile() ? "Buyers" : 'Buyers'}{getSortIndicator('holderCount')}</th>
                <th onClick={() => handleSortClick('liquidityPercent')} className={isMobile() ? 'liq-col' : ''}>{isMobile() ? 'Liq.%' : 'Liquidity %'}{getSortIndicator('liquidityPercent')}</th>
                <th onClick={() => handleSortClick('createdAt')} className={isMobile() ? 'since-col' : ''}>{isMobile() ? 'Since' : 'Created'}{getSortIndicator('createdAt')}</th>
                {!isMobile() && <th>{'Contract'}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTokens.length === 0 && (
                <tr><td colSpan={isMobile() ? 7 : 8}>No tokens match the current filters.</td></tr>
              )}
              {filteredTokens.map((t) => {
                // Calculate liquidity percent (rounded for mobile)
                let liqNum = t.liquidityPercent !== undefined && t.liquidityPercent !== null
                  ? parseFloat(t.liquidityPercent)
                  : (t.liquidity !== undefined && t.liquidity !== null && t.marketCapUSD && t.marketCapUSD > 0)
                    ? (parseFloat(t.liquidity) / parseFloat(t.marketCapUSD)) * 100
                    : null;
                let liqDisplay = '-';
                if (liqNum !== null && !isNaN(liqNum)) {
                  liqDisplay = isMobile() 
                    ? Math.round(liqNum) 
                    : Math.round(liqNum) + '%';
                }
                // Format volume (mobile: round down, no dp)
                let volDisplay = '-';
                if (t.volume24h !== undefined && t.volume24h !== null && !isNaN(t.volume24h)) {
                  volDisplay = isMobile() ? Math.floor(t.volume24h).toLocaleString() : formatNumber(t.volume24h);
                }
                // Format market cap (mobile: 1dp, K/M style; desktop: no dp)
                let mcapDisplay = '-';
                if (t.marketCapUSD !== undefined && t.marketCapUSD !== null && !isNaN(t.marketCapUSD)) {
                  mcapDisplay = isMobile() ? formatMarketCapMobile(t.marketCapUSD) : formatMarketCapDesktop(t.marketCapUSD);
                }
                return (
                  <tr key={t.id} 
                    className="token-row"
                    onClick={() => handleCopyAddress(t.mint || t.contractAddress || t.id)}
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    {!isMobile() && (
                      <td className="token-name-cell">
                        {t.image ? (
                          <img src={t.image} alt={t.name} className="token-img" />
                        ) : (
                          <div className="token-placeholder"></div>
                        )}
                        <span>{t.name}</span>
                      </td>
                    )}
                    <td style={isMobile() ? {maxWidth:'48px',width:'48px',padding:'0 2px',overflow:'hidden',textOverflow:'ellipsis'} : {}}>{t.ticker}</td>
                    <td>${volDisplay}</td>
                    <td>${mcapDisplay}</td>
                    <td>{formatNumber(t.holderCount)}</td>
                    <td>{liqDisplay}</td>
                    <td className={isMobile() ? 'since-col' : ''}>{isMobile() ? shortTimeAgo(t.createdAt) : timeAgo(t.createdAt)}</td>
                    {!isMobile() && <td>
                      <button 
                        className="copy-address-btn"
                        onClick={e => { e.stopPropagation(); handleCopyAddress(t.mint || t.contractAddress || t.id); }}
                        aria-label="Copy contract address"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {loading && <div className="loader">Loading tokens...</div>}
      
      {/* Address Popup */}
      {showAddressPopup && (
        <div className="address-popup-overlay">
          <div className="address-popup" ref={popupRef}>
            <div className="address-popup-header" style={{ justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 0, paddingBottom: 0, borderBottom: 'none' }}>
              {/* Token image and name if present */}
              {isMobile() && filteredTokens && (() => {
                const t = filteredTokens.find(tok => (tok.mint || tok.contractAddress || tok.id) === activeAddress);
                if (!t) return null;
                return (
                  <>
                    {t.image && <img src={t.image} alt={t.name} style={{ width: 48, height: 48, border: '1.5px solid #00FF00', background: '#111', marginBottom: 8, marginTop: 4, objectFit: 'cover', display: 'block' }} />}
                    <span style={{ color: '#00FF00', fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{t.name}</span>
                    <span style={{ color: '#fff', fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{t.ticker}</span>
                  </>
                );
              })()}
              <span style={{ color: '#00FF00', fontWeight: 600, fontSize: 15, marginBottom: 3 }}>Contract Address</span>
              <button 
                className="address-popup-close" 
                onClick={() => setShowAddressPopup(false)}
                style={{ position: 'absolute', right: 12, top: 8 }}
              >
                ×
              </button>
            </div>
            <div className="address-popup-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 0 }}>
              <div className="address-display" style={{ width: '100%', textAlign: 'center', marginBottom: 10, fontSize: 13 }}>
                {activeAddress}
              </div>
              <button 
                className="address-copy-btn"
                onClick={copyToClipboard}
                style={{ marginBottom: 10, width: '80%', maxWidth: 320 }}
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={`https://auto.fun/token/${activeAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#00FF00',
                  color: '#000',
                  fontWeight: 600,
                  textAlign: 'center',
                  textDecoration: 'none',
                  padding: '10px 0',
                  width: '80%',
                  maxWidth: 320,
                  border: 'none',
                  marginBottom: 10,
                  letterSpacing: 1,
                  fontSize: 15
                }}
              >Go</a>
              {/* Show missing info on mobile */}
              {isMobile() && filteredTokens && (() => {
                const t = filteredTokens.find(tok => (tok.mint || tok.contractAddress || tok.id) === activeAddress);
                if (!t) return null;
                return (
                  <div style={{ marginTop: 10, width: '100%', maxWidth: 340, textAlign: 'left', background: 'rgba(0,255,0,0.03)', border: '1px solid rgba(0,255,0,0.10)', padding: 12, borderRadius: 0, boxSizing: 'border-box' }}>
                    <div style={{ color: '#00FF00', fontWeight: 600, marginBottom: 7, fontSize: 14 }}>Token Details</div>
                    <div style={{ color: '#fff', marginBottom: 4 }}><b>Volume:</b> ${formatNumber(t.volume24h)}</div>
                    <div style={{ color: '#fff', marginBottom: 4 }}><b>Market Cap:</b> ${formatNumber(t.marketCapUSD)}</div>
                    <div style={{ color: '#fff', marginBottom: 4 }}><b>Buyers:</b> {formatNumber(t.holderCount)}</div>
                    <div style={{ color: '#fff', marginBottom: 4 }}><b>Since:</b> {timeAgo(t.createdAt)}</div>
                    <div style={{ color: '#fff', marginBottom: 4 }}><b>Liq%:</b> {
                      t.liquidityPercent !== undefined && t.liquidityPercent !== null
                        ? `${Math.round(parseFloat(t.liquidityPercent))}%`
                        : (t.liquidity !== undefined && t.liquidity !== null && t.marketCapUSD && t.marketCapUSD > 0)
                          ? `${Math.round((parseFloat(t.liquidity) / parseFloat(t.marketCapUSD)) * 100)}%`
                          : '-'
                    }</div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      
      <footer className="sticky">
        <span>
          Built by <a href="https://github.com/circularr/autofun" target="_blank" rel="noopener noreferrer">@circularr</a> 3; Powered by <a href="https://auto.fun" target="_blank" rel="noopener noreferrer">auto.fun</a>
        </span>
        <span>
          <a href="https://github.com/circularr/autofun" target="_blank" rel="noopener noreferrer">GitHub</a>
        </span>
      </footer>
    </div>
  );
}

export default App;
