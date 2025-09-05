const { spawn } = require('child_process');
const path = require('path');

class MasterTestRunner {
  constructor() {
    this.testResults = {
      phase1: { status: 'PENDING', score: 0, details: '' },
      phase2: { status: 'PENDING', score: 0, details: '' },
      phase3: { status: 'PENDING', score: 0, details: '' }
    };
    this.overallScore = 0;
    this.startTime = Date.now();
  }

  async runAllPhases() {
    console.log('\n🚀 MASTER TEST RUNNER - ALL PHASES\n');
    console.log('=' .repeat(60));
    console.log('🧪 Testing Complete Tag-Based SKU System');
    console.log('📊 Phases: Foundation → Core System → Production');
    console.log('=' .repeat(60));

    try {
      // Phase 1: Database Foundation
      console.log('\n📋 PHASE 1: DATABASE FOUNDATION TESTING');
      console.log('🏗️ Testing tables, constraints, indexes, triggers...');
      await this.runPhaseTest('phase1-database-foundation.test.js', 'phase1');

      // Phase 2: Core System
      console.log('\n📋 PHASE 2: CORE SYSTEM TESTING');
      console.log('⚡ Testing SKU parsing, tag management, device detection...');
      await this.runPhaseTest('phase2-core-system.test.js', 'phase2');

      // Phase 3: Integration & Production
      console.log('\n📋 PHASE 3: INTEGRATION & PRODUCTION TESTING');
      console.log('🔗 Testing end-to-end workflow, load testing, production readiness...');
      await this.runPhaseTest('phase3-integration-production.test.js', 'phase3');

      // Generate final report
      await this.generateFinalReport();

    } catch (error) {
      console.error('\n❌ MASTER TEST RUNNER FAILED:', error.message);
      process.exit(1);
    }
  }

  async runPhaseTest(testFile, phaseKey) {
    return new Promise((resolve, reject) => {
      const testPath = path.join(__dirname, testFile);
      console.log(`\n🔍 Running: ${testFile}`);
      
      const testProcess = spawn('node', [testPath], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        const outputStr = data.toString();
        output += outputStr;
        process.stdout.write(outputStr);
      });

      testProcess.stderr.on('data', (data) => {
        const errorStr = data.toString();
        errorOutput += errorStr;
        process.stderr.write(errorStr);
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          this.testResults[phaseKey].status = 'PASSED';
          this.testResults[phaseKey].score = this.extractScore(output);
          this.testResults[phaseKey].details = this.extractDetails(output);
          console.log(`\n✅ ${phaseKey.toUpperCase()} COMPLETED SUCCESSFULLY`);
        } else {
          this.testResults[phaseKey].status = 'FAILED';
          this.testResults[phaseKey].score = 0;
          this.testResults[phaseKey].details = errorOutput || 'Test execution failed';
          console.log(`\n❌ ${phaseKey.toUpperCase()} FAILED (Exit code: ${code})`);
        }
        resolve();
      });

      testProcess.on('error', (error) => {
        this.testResults[phaseKey].status = 'ERROR';
        this.testResults[phaseKey].score = 0;
        this.testResults[phaseKey].details = error.message;
        console.log(`\n💥 ${phaseKey.toUpperCase()} ERROR: ${error.message}`);
        reject(error);
      });
    });
  }

  extractScore(output) {
    // Look for overall score in the output
    const scoreMatch = output.match(/🎯 OVERALL SCORE: (\d+)%/);
    if (scoreMatch) {
      return parseInt(scoreMatch[1]);
    }
    
    // Fallback: look for percentage patterns
    const percentageMatch = output.match(/(\d+)%/);
    if (percentageMatch) {
      return parseInt(percentageMatch[1]);
    }
    
    return 0;
  }

  extractDetails(output) {
    // Extract key details from test output
    const lines = output.split('\n');
    const details = [];
    
    for (const line of lines) {
      if (line.includes('✅') || line.includes('❌') || line.includes('⚠️')) {
        details.push(line.trim());
      }
    }
    
    return details.slice(-5).join(' | '); // Last 5 significant lines
  }

  calculateOverallScore() {
    const phases = Object.values(this.testResults);
    const completedPhases = phases.filter(p => p.status === 'PASSED');
    
    if (completedPhases.length === 0) return 0;
    
    const totalScore = completedPhases.reduce((sum, phase) => sum + phase.score, 0);
    return Math.round(totalScore / completedPhases.length);
  }

  async generateFinalReport() {
    const totalTime = Date.now() - this.startTime;
    const overallScore = this.calculateOverallScore();
    
    console.log('\n' + '=' .repeat(80));
    console.log('🏆 MASTER TEST RUNNER - FINAL REPORT');
    console.log('=' .repeat(80));

    // Phase Results Summary
    console.log('\n📊 PHASE RESULTS SUMMARY:');
    console.log('─'.repeat(80));
    
    Object.entries(this.testResults).forEach(([phase, result]) => {
      const statusIcon = result.status === 'PASSED' ? '✅' : 
                        result.status === 'FAILED' ? '❌' : 
                        result.status === 'ERROR' ? '💥' : '⏳';
      
      console.log(`${phase.toUpperCase().padEnd(20)}: ${statusIcon} ${result.status.padEnd(10)} Score: ${result.score.toString().padStart(3)}%`);
      
      if (result.details) {
        console.log(`  ${' '.repeat(20)}  Details: ${result.details}`);
      }
    });

    // Overall Assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    console.log('─'.repeat(80));
    console.log(`Overall Score: ${overallScore}%`);
    console.log(`Total Test Time: ${Math.round(totalTime / 1000)}s`);
    console.log(`Phases Completed: ${Object.values(this.testResults).filter(p => p.status === 'PASSED').length}/3`);

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(80));
    
    if (overallScore >= 90) {
      console.log('🏆 EXCELLENT - System is production-ready with high confidence');
      console.log('   • All phases passed with high scores');
      console.log('   • System meets production requirements');
      console.log('   • Ready for deployment');
    } else if (overallScore >= 80) {
      console.log('✅ GOOD - System is production-ready with minor considerations');
      console.log('   • Most phases passed with good scores');
      console.log('   • Minor issues may need attention');
      console.log('   • Suitable for production deployment');
    } else if (overallScore >= 70) {
      console.log('⚠️ ACCEPTABLE - System needs attention before production');
      console.log('   • Some phases have issues');
      console.log('   • Review failed tests and resolve issues');
      console.log('   • Consider re-running tests after fixes');
    } else {
      console.log('❌ FAILED - Critical issues must be resolved');
      console.log('   • Multiple phases failed');
      console.log('   • System not ready for production');
      console.log('   • Focus on fixing critical issues first');
    }

    // Next Steps
    console.log('\n🚀 NEXT STEPS:');
    console.log('─'.repeat(80));
    
    const failedPhases = Object.entries(this.testResults).filter(([_, result]) => result.status !== 'PASSED');
    
    if (failedPhases.length === 0) {
      console.log('🎉 All phases completed successfully!');
      console.log('   • System is ready for production use');
      console.log('   • Consider running performance benchmarks');
      console.log('   • Monitor system in production environment');
    } else {
      console.log('🔧 Some phases need attention:');
      failedPhases.forEach(([phase, result]) => {
        console.log(`   • ${phase.toUpperCase()}: ${result.status} - ${result.details}`);
      });
      console.log('\n   Recommended actions:');
      console.log('   1. Review failed test details');
      console.log('   2. Fix identified issues');
      console.log('   3. Re-run specific phase tests');
      console.log('   4. Re-run master test suite');
    }

    // Performance Summary
    console.log('\n📈 PERFORMANCE SUMMARY:');
    console.log('─'.repeat(80));
    console.log(`Test Execution Time: ${Math.round(totalTime / 1000)}s`);
    console.log(`Average Phase Time: ${Math.round(totalTime / 3000)}s per phase`);
    console.log(`Success Rate: ${((Object.values(this.testResults).filter(p => p.status === 'PASSED').length / 3) * 100).toFixed(1)}%`);

    console.log('\n' + '=' .repeat(80));
    
    // Exit with appropriate code
    const allPhasesPassed = Object.values(this.testResults).every(p => p.status === 'PASSED');
    process.exit(allPhasesPassed ? 0 : 1);
  }
}

// Run all phases
async function runAllPhases() {
  const runner = new MasterTestRunner();
  await runner.runAllPhases();
}

// Handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\n🧪 MASTER TEST RUNNER - USAGE\n');
    console.log('Usage: node tests/run-all-phases.test.js [options]');
    console.log('\nOptions:');
    console.log('  --help, -h     Show this help message');
    console.log('  --phase1       Run only Phase 1 tests');
    console.log('  --phase2       Run only Phase 2 tests');
    console.log('  --phase3       Run only Phase 3 tests');
    console.log('\nExamples:');
    console.log('  node tests/run-all-phases.test.js              # Run all phases');
    console.log('  node tests/run-all-phases.test.js --phase1     # Run only Phase 1');
    console.log('\nNote: Running all phases is recommended for complete system validation.');
    process.exit(0);
  }
  
  if (args.includes('--phase1')) {
    console.log('🧪 Running Phase 1 only...');
    const { spawn } = require('child_process');
    const testPath = path.join(__dirname, 'phase1-database-foundation.test.js');
    spawn('node', [testPath], { stdio: 'inherit' });
  } else if (args.includes('--phase2')) {
    console.log('🧪 Running Phase 2 only...');
    const { spawn } = require('child_process');
    const testPath = path.join(__dirname, 'phase2-core-system.test.js');
    spawn('node', [testPath], { stdio: 'inherit' });
  } else if (args.includes('--phase3')) {
    console.log('🧪 Running Phase 3 only...');
    const { spawn } = require('child_process');
    const testPath = path.join(__dirname, 'phase3-integration-production.test.js');
    spawn('node', [testPath], { stdio: 'inherit' });
  } else {
    console.log('🧪 Running all phases...');
    runAllPhases();
  }
}

module.exports = { MasterTestRunner, runAllPhases };

