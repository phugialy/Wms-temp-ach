import { EnhancedGoogleSheetsService } from './src/services/EnhancedGoogleSheetsService';
import * as dotenv from 'dotenv';

dotenv.config();

async function testEnhancedSync() {
  try {
    console.log('🧪 Testing Enhanced Google Sheets Service...');
    
    const service = new EnhancedGoogleSheetsService();
    
    // Test getting sheet names
    console.log('📋 Getting sheet names...');
    const sheetNames = await service.getSheetNames();
    console.log(`✅ Found ${sheetNames.length} sheets:`, sheetNames.slice(0, 3), '...');
    
    // Test reading a small sample from first sheet
    if (sheetNames.length > 0) {
      console.log(`📄 Reading sample data from ${sheetNames[0]}...`);
      const sampleData = await service.readSheetData(sheetNames[0]);
      console.log(`✅ Found ${sampleData.length} rows in ${sheetNames[0]}`);
      
      if (sampleData.length > 0) {
        console.log('🔍 Testing SKU parsing with tags...');
        const firstRow = sampleData[0];
        const parsedSku = service.parseSkuWithTags(firstRow.sku_code, firstRow.description, sheetNames[0]);
        console.log('✅ Parsed SKU:', {
          sku_code: parsedSku.sku_code,
          brand: parsedSku.brand,
          model: parsedSku.model,
          capacity: parsedSku.capacity,
          color: parsedSku.color,
          carrier: parsedSku.carrier,
          post_fix: parsedSku.post_fix,
          device_type: parsedSku.device_type,
          tag_count: parsedSku.tag_count,
          sample_tags: parsedSku.sku_tags.slice(0, 5)
        });
      }
    }
    
    console.log('✅ Enhanced Google Sheets Service test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEnhancedSync();
