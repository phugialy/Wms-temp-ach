/**
 * Build Configuration
 * Explicitly configures the system to prefer Rust-based builds (SWC)
 */

export const buildConfig = {
  // Prefer Rust build system (SWC) for compilation
  preferRustBuild: process.env.PREFER_RUST_BUILD !== 'false', // Default: true
  
  // Build system information
  compiler: {
    name: 'SWC',
    language: 'Rust',
    description: 'Speedy Web Compiler - Rust-based TypeScript/JSX compiler',
  },
  
  // Bundler information
  bundler: {
    name: 'esbuild',
    language: 'Go',
    description: 'Fast bundler for asset processing (secondary to SWC compilation)',
  },
  
  // Log build system preference
  logPreference() {
    if (this.preferRustBuild) {
      console.log('🔧 Build Configuration: Preferring Rust build (SWC)');
      console.log(`   Compiler: ${this.compiler.name} (${this.compiler.language})`);
      console.log(`   Bundler: ${this.bundler.name} (${this.bundler.language})`);
    } else {
      console.log('⚠️  Build Configuration: Rust build disabled');
    }
  },
};

// Auto-log on import
if (process.env.NODE_ENV !== 'test') {
  buildConfig.logPreference();
}



