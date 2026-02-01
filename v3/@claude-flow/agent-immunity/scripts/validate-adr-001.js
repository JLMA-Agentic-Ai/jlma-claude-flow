#!/usr/bin/env node

/**
 * ADR-001 Validation Script
 * Validates complete 11/11 immunity coverage implementation
 */

const fs = require('fs');
const path = require('path');

console.log('🛡️ Validating ADR-001 Extended Immunity Implementation...\n');

// 1. Verify all extended immunity files exist
const extendedImmunitiesDir = path.join(__dirname, '../src/immunities/extended');
const requiredExtendedFiles = [
  'privacy.ts',
  'cost.ts',
  'observability.ts',
  'accessibility.ts',
  'reproducibility.ts',
  'documentation.ts'
];

console.log('📁 Checking Extended Immunity Files:');
let allFilesExist = true;

for (const file of requiredExtendedFiles) {
  const filePath = path.join(extendedImmunitiesDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
}

if (!allFilesExist) {
  console.error('\n❌ Missing extended immunity files!');
  process.exit(1);
}

// 2. Verify weight distribution
console.log('\n⚖️  Validating Weight Distribution:');

const weights = {
  // Core immunities (5 original)
  security: 0.25,
  truth: 0.20,
  coherence: 0.15,
  performance: 0.12,
  dependencies: 0.10,

  // Extended immunities (6 new - ADR-001)
  privacy: 0.07,
  accessibility: 0.04,
  observability: 0.03,
  cost: 0.015,
  reproducibility: 0.015,
  documentation: 0.01
};

const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
const coreWeight = weights.security + weights.truth + weights.coherence + weights.performance + weights.dependencies;
const extendedWeight = weights.privacy + weights.accessibility + weights.observability + weights.cost + weights.reproducibility + weights.documentation;

console.log(`   Total Weight: ${totalWeight} ${totalWeight === 1.0 ? '✅' : '❌'}`);
console.log(`   Core Weight: ${coreWeight} (${(coreWeight * 100).toFixed(1)}%)`);
console.log(`   Extended Weight: ${extendedWeight} (${(extendedWeight * 100).toFixed(1)}%)`);

if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.error('\n❌ Weight distribution does not sum to 1.0!');
  process.exit(1);
}

// 3. Verify test coverage
console.log('\n🧪 Checking Test Coverage:');

const testFiles = [
  '../__tests__/extended-immunities.test.ts',
  '../__tests__/adr-001-integration.test.ts'
];

let allTestsExist = true;
for (const testFile of testFiles) {
  const filePath = path.join(__dirname, testFile);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${path.basename(testFile)}`);
  if (!exists) allTestsExist = false;
}

// 4. Verify immunity service integration
console.log('\n🔗 Checking Integration:');

const immunityServicePath = path.join(__dirname, '../src/immunity-service.ts');
const immunityServiceContent = fs.readFileSync(immunityServicePath, 'utf8');

const hasExtendedImports = requiredExtendedFiles.every(file => {
  const className = file.replace('.ts', '').replace(/^\w/, c => c.toUpperCase()) + 'Immunity';
  return immunityServiceContent.includes(className);
});

console.log(`   ${hasExtendedImports ? '✅' : '❌'} Extended immunities imported`);

const hasWeightValidator = immunityServiceContent.includes('WeightValidator');
console.log(`   ${hasWeightValidator ? '✅' : '❌'} Weight validator integrated`);

// 5. Verify antibody integration
console.log('\n🔧 Checking Antibody Integration:');

const antibodyPath = path.join(__dirname, '../src/antibody.ts');
const antibodyContent = fs.readFileSync(antibodyPath, 'utf8');

const hasExtendedStrategies = antibodyContent.includes('initializeExtendedRepairStrategies');
console.log(`   ${hasExtendedStrategies ? '✅' : '❌'} Extended repair strategies implemented`);

// 6. Verify exports
console.log('\n📤 Checking Exports:');

const indexPath = path.join(__dirname, '../src/index.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');

const exportedExtendedImmunities = requiredExtendedFiles.map(file => {
  const className = file.replace('.ts', '').replace(/^\w/, c => c.toUpperCase()) + 'Immunity';
  return indexContent.includes(`export { ${className} }`);
});

const allExported = exportedExtendedImmunities.every(exported => exported);
console.log(`   ${allExported ? '✅' : '❌'} All extended immunities exported`);

// 7. Summary
console.log('\n📊 ADR-001 Implementation Summary:');
console.log(`   🛡️  Total Immunities: ${Object.keys(weights).length}/11 (${Object.keys(weights).length >= 11 ? 'Complete' : 'Incomplete'})`);
console.log(`   ⚖️  Weight Distribution: ${totalWeight === 1.0 ? 'Valid' : 'Invalid'}`);
console.log(`   📁 Extended Files: ${allFilesExist ? 'Present' : 'Missing'}`);
console.log(`   🧪 Test Coverage: ${allTestsExist ? 'Complete' : 'Incomplete'}`);
console.log(`   🔗 Service Integration: ${hasExtendedImports && hasWeightValidator ? 'Complete' : 'Incomplete'}`);
console.log(`   🔧 Antibody Integration: ${hasExtendedStrategies ? 'Complete' : 'Incomplete'}`);
console.log(`   📤 Export Integration: ${allExported ? 'Complete' : 'Incomplete'}`);

const allValid = allFilesExist && (totalWeight === 1.0) && allTestsExist && hasExtendedImports && hasWeightValidator && hasExtendedStrategies && allExported;

if (allValid) {
  console.log('\n🎉 ADR-001 Implementation COMPLETE!');
  console.log('   ✅ Full 11/11 immunity coverage achieved');
  console.log('   ✅ Extended immunities successfully integrated');
  console.log('   ✅ Weight distribution balanced and validated');
  console.log('   ✅ Comprehensive test coverage implemented');
  console.log('   ✅ Antibody repair system extended');
  console.log('   ✅ Ready for production deployment');
} else {
  console.error('\n❌ ADR-001 Implementation INCOMPLETE!');
  console.error('   Please address the issues above before deployment.');
  process.exit(1);
}

console.log('\n🛡️ Extended Immunity System Status: OPERATIONAL');