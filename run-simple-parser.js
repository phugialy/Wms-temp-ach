const SimpleSkuParser = require('./src/services/SimpleSkuParser');

async function runSimpleParser() {
    console.log('🚀 Running Simple SKU Parser on all SKUs...');
    
    try {
        const parser = new SimpleSkuParser();
        await parser.initialize();
        
        console.log('✅ Parser initialized successfully');
        
        // Parse all SKUs
        await parser.parseAllSkus();
        
        await parser.close();
        console.log('\n🎉 Simple SKU parsing completed for all SKUs!');
        
    } catch (error) {
        console.error('❌ Simple parser failed:', error.message);
    }
}

// Run the parser
runSimpleParser();

