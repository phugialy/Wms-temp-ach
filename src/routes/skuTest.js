const express = require('express');
const router = express.Router();
const SkuMatchingService = require('../services/skuMatchingService');

// Initialize the SKU matching service
const skuService = new SkuMatchingService();

// GET route to serve the test page
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SKU Matching Test Tool</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .main-container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                padding: 40px;
                width: 100%;
                max-width: 500px;
                text-align: center;
            }
            
            .logo {
                font-size: 48px;
                margin-bottom: 20px;
            }
            
            h1 {
                color: #333;
                margin-bottom: 10px;
                font-size: 28px;
                font-weight: 600;
            }
            
            .subtitle {
                color: #666;
                margin-bottom: 40px;
                font-size: 16px;
            }
            
            .input-group {
                margin-bottom: 30px;
            }
            
            .input-label {
                display: block;
                text-align: left;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
                font-size: 14px;
            }
            
            .imei-input {
                width: 100%;
                padding: 15px;
                border: 2px solid #e1e5e9;
                border-radius: 10px;
                font-size: 16px;
                transition: all 0.3s ease;
                background: #f8f9fa;
            }
            
            .imei-input:focus {
                outline: none;
                border-color: #667eea;
                background: white;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .test-btn {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            }
            
            .test-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            .test-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            
            /* Modal Styles */
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
                backdrop-filter: blur(5px);
            }
            
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 0;
                border-radius: 20px;
                width: 90%;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                animation: modalSlideIn 0.3s ease-out;
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .modal-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 25px 30px;
                border-radius: 20px 20px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-title {
                font-size: 24px;
                font-weight: 600;
            }
            
            .close-btn {
                color: white;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
                background: none;
                border: none;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.3s;
            }
            
            .close-btn:hover {
                background-color: rgba(255,255,255,0.2);
            }
            
            .modal-body {
                padding: 30px;
            }
            
            .result-section {
                margin-bottom: 25px;
            }
            
            .result-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .match-score {
                font-size: 32px;
                font-weight: bold;
                padding: 10px 20px;
                border-radius: 10px;
                display: inline-block;
                margin-left: auto;
            }
            
            .match-score.high {
                background: #d4edda;
                color: #155724;
            }
            
            .match-score.medium {
                background: #fff3cd;
                color: #856404;
            }
            
            .match-score.low {
                background: #f8d7da;
                color: #721c24;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .info-card {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 10px;
                padding: 15px;
                transition: all 0.3s ease;
            }
            
            .info-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            
            .info-label {
                font-weight: 600;
                color: #495057;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 5px;
            }
            
            .info-value {
                color: #212529;
                font-size: 14px;
                font-weight: 500;
            }
            
            .carrier-override {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 10px;
                padding: 15px;
                margin-top: 20px;
            }
            
            .carrier-override strong {
                color: #856404;
            }
            
            .parsed-info {
                background: #e9ecef;
                border-radius: 10px;
                padding: 15px;
                margin-top: 20px;
                font-size: 12px;
                color: #495057;
            }
            
            .no-match {
                text-align: center;
                padding: 40px 20px;
                color: #666;
            }
            
            .no-match h3 {
                font-size: 24px;
                margin-bottom: 10px;
                color: #dc3545;
            }
            
            .loading {
                text-align: center;
                padding: 40px 20px;
                color: #666;
            }
            
            .loading::after {
                content: '';
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-left: 10px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
            }
            
            @media (max-width: 768px) {
                .main-container {
                    padding: 30px 20px;
                }
                
                .modal-content {
                    margin: 10% auto;
                    width: 95%;
                }
                
                .modal-header {
                    padding: 20px;
                }
                
                .modal-body {
                    padding: 20px;
                }
                
                .info-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="main-container">
            <div class="logo">🔍</div>
            <h1>SKU Matching Test Tool</h1>
            <p class="subtitle">Test the improved SKU matching logic with enhanced features</p>
            
            <div class="features">
                <div class="feature-item">✅ Carrier Override Logic</div>
                <div class="feature-item">✅ Post-Fix Filtering</div>
                <div class="feature-item">✅ Product Type Validation</div>
                <div class="feature-item">✅ Model Priority Matching</div>
            </div>
            
            <div class="input-group">
                <label class="input-label" for="imeiInput">IMEI Number</label>
                <input 
                    type="text" 
                    id="imeiInput" 
                    class="imei-input"
                    placeholder="e.g., 350237720639396"
                    maxlength="15"
                />
            </div>
            
            <button onclick="testSkuMatching()" id="testBtn" class="test-btn">
                🔍 Test SKU Matching
            </button>
        </div>

        <!-- Modal -->
        <div id="resultModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-title" id="modalTitle">SKU Matching Results</span>
                    <button class="close-btn" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body" id="modalBody">
                    <!-- Content will be inserted here -->
                </div>
            </div>
        </div>

        <script>
            async function testSkuMatching() {
                const imei = document.getElementById('imeiInput').value.trim();
                const testBtn = document.getElementById('testBtn');
                
                if (!imei) {
                    alert('Please enter an IMEI');
                    return;
                }
                
                // Show loading
                testBtn.disabled = true;
                testBtn.innerHTML = '🔍 Processing...';
                showModal('Processing IMEI and finding best SKU match...', 'loading');
                
                try {
                    const response = await fetch('/api/sku-test/match', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ imei: imei })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        displayResults(result.data);
                    } else {
                        showModal(\`❌ Error: \${result.error}\`, 'error');
                    }
                } catch (error) {
                    showModal(\`❌ Network Error: \${error.message}\`, 'error');
                } finally {
                    testBtn.disabled = false;
                    testBtn.innerHTML = '🔍 Test SKU Matching';
                }
            }
            
            function showModal(content, type = 'content') {
                const modal = document.getElementById('resultModal');
                const modalTitle = document.getElementById('modalTitle');
                const modalBody = document.getElementById('modalBody');
                
                if (type === 'loading') {
                    modalTitle.textContent = 'Processing...';
                    modalBody.innerHTML = \`<div class="loading">\${content}</div>\`;
                } else if (type === 'error') {
                    modalTitle.textContent = 'Error';
                    modalBody.innerHTML = \`<div class="error">\${content}</div>\`;
                } else {
                    modalBody.innerHTML = content;
                }
                
                modal.style.display = 'block';
            }
            
            function closeModal() {
                document.getElementById('resultModal').style.display = 'none';
            }
            
            function displayResults(data) {
                const modalTitle = document.getElementById('modalTitle');
                
                if (!data.match) {
                    modalTitle.textContent = 'No Match Found';
                    const content = \`
                        <div class="no-match">
                            <h3>❌ No SKU Match Found</h3>
                            <p>No matching SKU was found for this IMEI.</p>
                            <div class="info-grid">
                                <div class="info-card">
                                    <div class="info-label">IMEI</div>
                                    <div class="info-value">\${data.imei}</div>
                                </div>
                                <div class="info-card">
                                    <div class="info-label">Original SKU</div>
                                    <div class="info-value">\${data.original_sku || 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    \`;
                    showModal(content);
                    return;
                }
                
                const match = data.match;
                const deviceData = data.device_data;
                const scoreClass = match.match_score >= 0.8 ? 'high' : match.match_score >= 0.6 ? 'medium' : 'low';
                
                modalTitle.textContent = 'SKU Match Found';
                
                let carrierOverrideHtml = '';
                if (match.carrier_override) {
                    carrierOverrideHtml = \`
                        <div class="carrier-override">
                            <strong>🔄 Carrier Override Applied:</strong><br>
                            Original: \${match.carrier_override.original_carrier} → 
                            Effective: \${match.carrier_override.effective_carrier}<br>
                            <small>Notes: \${match.carrier_override.notes || 'N/A'}</small>
                        </div>
                    \`;
                }
                
                const content = \`
                    <div class="result-section">
                        <div class="result-title">
                            ✅ SKU Match Found
                            <div class="match-score \${scoreClass}">\${(match.match_score * 100).toFixed(1)}%</div>
                        </div>
                        
                        <div class="info-grid">
                            <div class="info-card">
                                <div class="info-label">Matched SKU</div>
                                <div class="info-value">\${match.sku_code}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Match Method</div>
                                <div class="info-value">\${match.match_method}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">IMEI</div>
                                <div class="info-value">\${data.imei}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Original SKU</div>
                                <div class="info-value">\${data.original_sku || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="result-section">
                        <div class="result-title">📱 Device Information</div>
                        <div class="info-grid">
                            <div class="info-card">
                                <div class="info-label">Brand</div>
                                <div class="info-value">\${deviceData.brand || 'N/A'}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Model</div>
                                <div class="info-value">\${deviceData.model || 'N/A'}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Capacity</div>
                                <div class="info-value">\${deviceData.capacity || 'N/A'}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Color</div>
                                <div class="info-value">\${deviceData.color || 'N/A'}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Carrier</div>
                                <div class="info-value">\${deviceData.carrier || 'N/A'}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Device Notes</div>
                                <div class="info-value">\${deviceData.device_notes || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    
                    \${carrierOverrideHtml}
                    
                    <div class="parsed-info">
                        <strong>🔍 Parsed SKU Information:</strong><br>
                        Brand: \${match.parsed_info?.brand || 'N/A'} | 
                        Model: \${match.parsed_info?.model || 'N/A'} | 
                        Capacity: \${match.parsed_info?.capacity || 'N/A'} | 
                        Color: \${match.parsed_info?.color || 'N/A'} | 
                        Carrier: \${match.parsed_info?.carrier || 'N/A'}
                    </div>
                \`;
                
                showModal(content);
            }
            
            // Allow Enter key to trigger test
            document.getElementById('imeiInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    testSkuMatching();
                }
            });
            
            // Close modal when clicking outside
            window.onclick = function(event) {
                const modal = document.getElementById('resultModal');
                if (event.target === modal) {
                    closeModal();
                }
            }
            
            // Close modal with Escape key
            document.addEventListener('keydown', function(event) {
                if (event.key === 'Escape') {
                    closeModal();
                }
            });
        </script>
    </body>
    </html>
  `);
});

// POST route to handle SKU matching test
router.post('/match', async (req, res) => {
  try {
    const { imei } = req.body;
    
    if (!imei) {
      return res.json({ success: false, error: 'IMEI is required' });
    }
    
    // Get device data from the database
    const deviceData = await skuService.getDeviceDataForMatching(imei);
    
    if (!deviceData) {
      return res.json({ 
        success: true, 
        data: { 
          imei: imei, 
          match: null,
          device_data: null,
          message: 'Device not found in database'
        } 
      });
    }
    
    // Prepare device data for SKU matching
    const matchingData = {
      brand: deviceData.brand,
      model: deviceData.model,
      capacity: deviceData.capacity,
      color: deviceData.color,
      carrier: deviceData.carrier,
      device_notes: deviceData.device_notes,
      imei: deviceData.imei
    };
    
    // Find best matching SKU
    const match = await skuService.findBestMatchingSku(matchingData);
    
    return res.json({
      success: true,
      data: {
        imei: imei,
        original_sku: deviceData.original_sku,
        match: match,
        device_data: matchingData
      }
    });
    
  } catch (error) {
    console.error('Error in SKU test matching:', error);
    return res.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

module.exports = router;
