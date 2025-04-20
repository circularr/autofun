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
  const [chartTab, setChartTab] = useState('tokens');  // 'tokens', 'creators', 'volume', 'marketcap', 'holders'
  const [cursorVisible, setCursorVisible] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc'
  });
  const [showAddressPopup, setShowAddressPopup] = useState(false);
  const [activeAddress, setActiveAddress] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const popupRef = useRef(null);

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
        updateChartData(activeTokens, chartTab);
      })
      .catch((err) => {
        console.error("API fetch error:", err);
        setError(`Failed to fetch token data: ${err.message}`);
        setLoading(false);
      });
  };

  // Update chart data based on the selected tab
  const updateChartData = (tokensList, tab) => {
    switch (tab) {
      case 'tokens':
        updateTokensCreatedChart(tokensList);
        break;
      case 'creators':
        updateUniqueCreatorsChart(tokensList);
        break;
      case 'volume':
        updateVolumeChart(tokensList);
        break;
      case 'marketcap':
        updateMarketCapChart(tokensList);
        break;
      case 'holders':
        updateHoldersChart(tokensList);
        break;
      default:
        updateTokensCreatedChart(tokensList);
    }
  };

  // Fix: Ensure chart updates when chartTab changes
  useEffect(() => {
    if (tokens.length > 0) {
      updateChartData(tokens, chartTab);
    }
    // eslint-disable-next-line
  }, [chartTab]);

  // Chart 1: Tokens created over time (last 24 hours)
  const updateTokensCreatedChart = (tokensList) => {
    // Get current date/time
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    
    // Create empty slots for all 24 hours
    const hourCounts = {};
    for (let i = 0; i < 24; i++) {
      const hourAgo = new Date(now);
      hourAgo.setHours(now.getHours() - i);
      const hourKey = hourAgo.getHours();
      hourCounts[hourKey] = 0;
    }
    
    // Filter tokens by creation time (last 24 hours)
    const relevantTokens = tokensList.filter(token => {
      const createdAt = new Date(token.createdAt);
      return createdAt >= twentyFourHoursAgo && createdAt <= now;
    });
    
    // Group by hour
    relevantTokens.forEach(token => {
      if (token.createdAt) {
        const date = new Date(token.createdAt);
        const hour = date.getHours();
        hourCounts[hour]++;
      }
    });
    
    // Convert to arrays for Chart.js - in chronological order
    const hoursSorted = Object.keys(hourCounts)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Format hour labels with AM/PM
    const hourLabels = hoursSorted.map(hour => {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${hour12}${ampm}`;
    });
    
    const hourData = hoursSorted.map(hour => hourCounts[hour]);
    
    setChartData({
      labels: hourLabels,
      data: hourData,
      title: 'Active Curves',
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => value.toLocaleString()
    });
  };
  
  // Chart 2: Unique creators over time (last 24 hours)
  const updateUniqueCreatorsChart = (tokensList) => {
    // Get current date/time
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    
    // Create empty slots for all 24 hours
    const hourCreators = {};
    for (let i = 0; i < 24; i++) {
      const hourAgo = new Date(now);
      hourAgo.setHours(now.getHours() - i);
      const hourKey = hourAgo.getHours();
      hourCreators[hourKey] = new Set(); // Use a Set to count unique creators
    }
    
    // Filter tokens by creation time (last 24 hours)
    const relevantTokens = tokensList.filter(token => {
      const createdAt = new Date(token.createdAt);
      return createdAt >= twentyFourHoursAgo && createdAt <= now;
    });
    
    // Group by hour and add creators to sets
    relevantTokens.forEach(token => {
      if (token.createdAt && token.creator) {
        const date = new Date(token.createdAt);
        const hour = date.getHours();
        hourCreators[hour].add(token.creator);
      }
    });
    
    // Convert to arrays for Chart.js - in chronological order
    const hoursSorted = Object.keys(hourCreators)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Format hour labels with AM/PM
    const hourLabels = hoursSorted.map(hour => {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${hour12}${ampm}`;
    });
    
    // Convert sets to counts
    const hourData = hoursSorted.map(hour => hourCreators[hour].size);
    
    setChartData({
      labels: hourLabels,
      data: hourData,
      title: 'Active Curves',
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => value.toLocaleString()
    });
  };
  
  // Chart 3: Total volume over time (last 24 hours)
  const updateVolumeChart = (tokensList) => {
    // Get current date/time
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    
    // Create empty slots for all 24 hours
    const hourlyVolume = {};
    for (let i = 0; i < 24; i++) {
      const hourAgo = new Date(now);
      hourAgo.setHours(now.getHours() - i);
      const hourKey = hourAgo.getHours();
      hourlyVolume[hourKey] = 0;
    }
    
    // For each hour, calculate the total volume of all tokens that existed at that time
    for (let i = 0; i < 24; i++) {
      const targetHour = new Date(now);
      targetHour.setHours(now.getHours() - i);
      
      // Get tokens that existed at this hour (created before this hour)
      const tokensAtThisHour = tokensList.filter(token => {
        const createdAt = new Date(token.createdAt);
        return createdAt <= targetHour;
      });
      
      // Sum up volume
      const totalVolume = tokensAtThisHour.reduce((sum, token) => {
        const volume = parseFloat(token.volume24h) || 0;
        return sum + volume;
      }, 0);
      
      hourlyVolume[targetHour.getHours()] = totalVolume;
    }
    
    // Convert to arrays for Chart.js - in chronological order
    const hoursSorted = Object.keys(hourlyVolume)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Format hour labels with AM/PM
    const hourLabels = hoursSorted.map(hour => {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${hour12}${ampm}`;
    });
    
    const hourData = hoursSorted.map(hour => hourlyVolume[hour]);
    
    setChartData({
      labels: hourLabels,
      data: hourData,
      title: 'Active Curves',
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => '$' + formatNumber(value)
    });
  };
  
  // Chart 4: Total market cap over time (last 24 hours)
  const updateMarketCapChart = (tokensList) => {
    // Get current date/time
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    
    // Create empty slots for all 24 hours
    const hourlyMarketCap = {};
    for (let i = 0; i < 24; i++) {
      const hourAgo = new Date(now);
      hourAgo.setHours(now.getHours() - i);
      const hourKey = hourAgo.getHours();
      hourlyMarketCap[hourKey] = 0;
    }
    
    // For each hour, calculate the total market cap of all tokens that existed at that time
    for (let i = 0; i < 24; i++) {
      const targetHour = new Date(now);
      targetHour.setHours(now.getHours() - i);
      
      // Get tokens that existed at this hour (created before this hour)
      const tokensAtThisHour = tokensList.filter(token => {
        const createdAt = new Date(token.createdAt);
        return createdAt <= targetHour;
      });
      
      // Sum up market cap
      const totalMarketCap = tokensAtThisHour.reduce((sum, token) => {
        const marketCap = parseFloat(token.marketCapUSD) || 0;
        return sum + marketCap;
      }, 0);
      
      hourlyMarketCap[targetHour.getHours()] = totalMarketCap;
    }
    
    // Convert to arrays for Chart.js - in chronological order
    const hoursSorted = Object.keys(hourlyMarketCap)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Format hour labels with AM/PM
    const hourLabels = hoursSorted.map(hour => {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${hour12}${ampm}`;
    });
    
    const hourData = hoursSorted.map(hour => hourlyMarketCap[hour]);
    
    setChartData({
      labels: hourLabels,
      data: hourData,
      title: 'Active Curves',
      backgroundColor: '#00FF00',
      borderColor: '#00FF00',
      yAxisFormat: (value) => '$' + formatNumber(value)
    });
  };
  
  // Chart 5: Total holders over time (last 24 hours)
  const updateHoldersChart = (tokensList) => {
    // Get current date/time
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    
    // Create empty slots for all 24 hours
    const hourlyHolders = {};
    for (let i = 0; i < 24; i++) {
      const hourAgo = new Date(now);
      hourAgo.setHours(now.getHours() - i);
      const hourKey = hourAgo.getHours();
      hourlyHolders[hourKey] = 0;
    }
    
    // For each hour, calculate the total holders of all tokens that existed at that time
    for (let i = 0; i < 24; i++) {
      const targetHour = new Date(now);
      targetHour.setHours(now.getHours() - i);
      
      // Get tokens that existed at this hour (created before this hour)
      const tokensAtThisHour = tokensList.filter(token => {
        const createdAt = new Date(token.createdAt);
        return createdAt <= targetHour;
      });
      
      // Sum up holders
      const totalHolders = tokensAtThisHour.reduce((sum, token) => {
        const holders = parseInt(token.holderCount) || 0;
        return sum + holders;
      }, 0);
      
      hourlyHolders[targetHour.getHours()] = totalHolders;
    }
    
    // Convert to arrays for Chart.js - in chronological order
    const hoursSorted = Object.keys(hourlyHolders)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Format hour labels with AM/PM
    const hourLabels = hoursSorted.map(hour => {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12; // Convert 0 to 12 for 12 AM
      return `${hour12}${ampm}`;
    });
    
    const hourData = hoursSorted.map(hour => hourlyHolders[hour]);
    
    setChartData({
      labels: hourLabels,
      data: hourData,
      title: 'Active Curves',
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

  // Chart data state
  const [chartData, setChartData] = useState({
    labels: [],
    data: [],
    title: 'Active Curves',
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
    yAxisFormat: (value) => value.toLocaleString()
  });

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
        display: true,
        text: chartData.title,
        font: {
          size: 14,
          weight: 'bold'
        },
        padding: {
          bottom: 15
        },
        color: '#00FF00'
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
              case 'creators':
                label = `${value.toLocaleString()} creator${value !== 1 ? 's' : ''}`;
                break;
              case 'volume':
                label = `$${formatNumber(value)}`;
                break;
              case 'marketcap':
                label = `$${formatNumber(value)}`;
                break;
              case 'holders':
                label = `${formatNumber(value)} holder${value !== 1 ? 's' : ''}`;
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
          color: '#00FF00'
        },
        grid: {
          color: 'rgba(0, 255, 0, 0.1)'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 10
          },
          color: '#00FF00'
        }
      }
    }
  };

  return (
    <div className="container">
      <h1>
        <a href="https://auto.fun" target="_blank" rel="noopener noreferrer" style={{ color: '#00FF00', textDecoration: 'none', fontWeight: 800, letterSpacing: '1px', fontSize: 'inherit' }}>auto.fun</a>
      </h1>
      
      <div className="chart-container">
        <div className="chart-tabs">
          <button 
            className={`chart-tab ${chartTab === 'tokens' ? 'active' : ''}`}
            onClick={() => changeChartTab('tokens')}
          >
            {isMobile() ? 'Created' : 'Tokens Created'}
          </button>
          <button 
            className={`chart-tab ${chartTab === 'creators' ? 'active' : ''}`}
            onClick={() => changeChartTab('creators')}
          >
            {isMobile() ? 'Creators' : 'Unique Creators'}
          </button>
          <button 
            className={`chart-tab ${chartTab === 'volume' ? 'active' : ''}`}
            onClick={() => changeChartTab('volume')}
          >
            {isMobile() ? 'Vol.' : 'Volume'}
          </button>
          <button 
            className={`chart-tab ${chartTab === 'marketcap' ? 'active' : ''}`}
            onClick={() => changeChartTab('marketcap')}
          >
            {isMobile() ? 'M.Cap' : 'Market Cap'}
          </button>
          <button 
            className={`chart-tab ${chartTab === 'holders' ? 'active' : ''}`}
            onClick={() => changeChartTab('holders')}
          >
            {isMobile() ? "H'der" : 'Holders'}
          </button>
        </div>
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
                font: { size: isMobile() ? 9 : 10 },
                color: '#00FF00',
                maxTicksLimit: isMobile() ? 6 : 12,
                padding: isMobile() ? 4 : 10
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
                <th onClick={() => handleSortClick('holderCount')}>{isMobile() ? "H'der" : 'Holders'}{getSortIndicator('holderCount')}</th>
                <th onClick={() => handleSortClick('liquidityPercent')}>{isMobile() ? 'L%' : 'Liquidity %'}{getSortIndicator('liquidityPercent')}</th>
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
                    <div style={{ color: '#fff', marginBottom: 4 }}><b>Holders:</b> {formatNumber(t.holderCount)}</div>
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
      
      <footer>
        <a href="https://auto.fun" target="_blank" rel="noopener noreferrer">auto.fun</a>
        <div className="token-stats">Total active tokens: {tokens.length}</div>
      </footer>
    </div>
  );
}

export default App;
