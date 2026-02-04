#!/usr/bin/env node

const axios = require('axios');

async function testPolymarketAPI() {
  console.log('🔍 Testing actual Polymarket API...\n');

  const endpoints = [
    'https://gamma-api.polymarket.com/markets',
    'https://gamma-api.polymarket.com/events', 
    'https://polymarket.com/api/markets',
    'https://api.polymarket.com/markets'
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint}`);
    
    try {
      const response = await axios.get(endpoint, {
        timeout: 10000,
        params: { limit: 3 },
        headers: {
          'User-Agent': 'PolymarketAnalyticsBot/1.0'
        }
      });

      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Response type: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);
      
      if (Array.isArray(response.data)) {
        console.log(`📈 Items: ${response.data.length}`);
        if (response.data.length > 0) {
          const first = response.data[0];
          console.log(`🔍 Sample fields:`, Object.keys(first).slice(0, 8).join(', '));
          
          // Check for expected fields
          const expectedFields = ['question', 'id', 'volume', 'outcomes'];
          const foundFields = expectedFields.filter(field => field in first);
          console.log(`✅ Expected fields found: ${foundFields.join(', ')}`);
          
          if (foundFields.length >= 2) {
            console.log('🎉 API structure looks compatible!\n');
            
            // Save sample for reference
            console.log('📋 Sample market data:');
            console.log(JSON.stringify(first, null, 2).slice(0, 500) + '...');
          }
        }
      } else {
        console.log(`📋 Response keys:`, Object.keys(response.data).slice(0, 8).join(', '));
      }
      
      console.log(''); // spacing
      break; // Stop on first successful endpoint
      
    } catch (error) {
      console.log(`❌ Failed: ${error.response?.status || error.code || error.message}`);
      console.log('');
    }
  }
  
  // Test with a different approach - check their documentation/public APIs
  console.log('🌐 Testing alternative endpoints...\n');
  
  const alternatives = [
    'https://strapi-matic.poly.market/markets',
    'https://polymarket.com/api/public/markets'
  ];
  
  for (const alt of alternatives) {
    console.log(`Testing: ${alt}`);
    
    try {
      const response = await axios.get(alt, {
        timeout: 10000,
        headers: {
          'User-Agent': 'PolymarketAnalyticsBot/1.0'
        }
      });

      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Response type: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Failed: ${error.response?.status || error.code || error.message}`);
      console.log('');
    }
  }
}

if (require.main === module) {
  testPolymarketAPI().catch(console.error);
}

module.exports = testPolymarketAPI;
