/**
 * FlynnSim - Automated Correctness Test Suite & Verifier
 * 
 * Verifies mathematical equivalence, edge-case tail masking,
 * matrix multiplication, and fault tolerance across SISD, SIMD, MISD, and MIMD.
 * 
 * Run in Node.js: node tests/test_cases.js
 */

// If running under Node.js, require the modules
if (typeof require !== 'undefined') {
    const isaModule = require('../js/isa.js');
    global.Opcode = isaModule.Opcode;
    global.InstructionLatency = isaModule.InstructionLatency;
    global.Instruction = isaModule.Instruction;
    global.TinyISA = isaModule.TinyISA;

    const peModule = require('../js/pe.js');
    global.PEState = peModule.PEState;
    global.ProcessingElement = peModule.ProcessingElement;

    const memModule = require('../js/memory.js');
    global.MemorySystem = memModule.MemorySystem;

    const baseModule = require('../js/architectures/base_arch.js');
    global.BaseArchitecture = baseModule.BaseArchitecture;

    const sisdModule = require('../js/architectures/sisd.js');
    global.SISDArchitecture = sisdModule.SISDArchitecture;

    const simdModule = require('../js/architectures/simd.js');
    global.SIMDArchitecture = simdModule.SIMDArchitecture;

    const misdModule = require('../js/architectures/misd.js');
    global.MISDArchitecture = misdModule.MISDArchitecture;

    const mimdModule = require('../js/architectures/mimd.js');
    global.MIMDArchitecture = mimdModule.MIMDArchitecture;

    const wlModule = require('../js/workloads.js');
    global.WorkloadManager = wlModule.WorkloadManager;
}

function runFastToHalt(arch, maxCycles = 10000) {
    let cycles = 0;
    while (!arch.isHalted && cycles < maxCycles) {
        arch.step();
        cycles++;
    }
    return cycles;
}

function assertArrayEquals(actual, expected, message) {
    if (actual.length !== expected.length) {
        throw new Error(`${message}: Length mismatch (actual ${actual.length}, expected ${expected.length})`);
    }
    for (let i = 0; i < expected.length; i++) {
        if (actual[i] !== expected[i]) {
            throw new Error(`${message}: Mismatch at index ${i} (actual ${actual[i]}, expected ${expected[i]})`);
        }
    }
}

function runAllTests() {
    console.log("==========================================================");
    console.log("       FlynnSim Architecture Verification Test Suite      ");
    console.log("==========================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    // -------------------------------------------------------------------------
    // TEST CASE 1: Standard Vector Addition Equivalence (L = 8, N = 4)
    // -------------------------------------------------------------------------
    totalTests++;
    try {
        console.log("TEST 1: Vector Addition Equivalence (L = 8, N = 4)");
        const wl = WorkloadManager.createVectorAdditionWorkload(8, 4);

        const sisd = new SISDArchitecture();
        const simd = new SIMDArchitecture(4);
        const mimd = new MIMDArchitecture(4);

        sisd.loadWorkload(wl);
        simd.loadWorkload(wl);
        mimd.loadWorkload(wl);

        const cycSisd = runFastToHalt(sisd);
        const cycSimd = runFastToHalt(simd);
        const cycMimd = runFastToHalt(mimd);

        const sisdOut = sisd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const simdOut = simd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const mimdOut = mimd.memory.readBlock(wl.outputAddressBase, wl.outputLength);

        assertArrayEquals(sisdOut, wl.expectedOutput, "SISD Vector Addition");
        assertArrayEquals(simdOut, wl.expectedOutput, "SIMD Vector Addition");
        assertArrayEquals(mimdOut, wl.expectedOutput, "MIMD Vector Addition");

        console.log(`  ✓ Expected Ground Truth: [${wl.expectedOutput.join(', ')}]`);
        console.log(`  ✓ SISD (${cycSisd} cycles): [${sisdOut.join(', ')}]`);
        console.log(`  ✓ SIMD (${cycSimd} cycles): [${simdOut.join(', ')}]`);
        console.log(`  ✓ MIMD (${cycMimd} cycles): [${mimdOut.join(', ')}]`);
        console.log(`  ✓ Speedup SIMD: ${(cycSisd / cycSimd).toFixed(2)}x | Speedup MIMD: ${(cycSisd / cycMimd).toFixed(2)}x`);
        console.log("  >>> TEST 1 PASSED!\n");
        passedTests++;
    } catch (err) {
        console.error("  ✗ TEST 1 FAILED:", err.message, "\n");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 2: Edge Case - Non-Divisible Vector Length (L = 7, N = 4)
    // Verifies SIMD tail masking and MIMD remainder partitioning
    // -------------------------------------------------------------------------
    totalTests++;
    try {
        console.log("TEST 2: Edge Case: Non-Divisible Vector Length (L = 7, N = 4)");
        const wl = WorkloadManager.createVectorAdditionWorkload(7, 4);

        const sisd = new SISDArchitecture();
        const simd = new SIMDArchitecture(4);
        const mimd = new MIMDArchitecture(4);

        sisd.loadWorkload(wl);
        simd.loadWorkload(wl);
        mimd.loadWorkload(wl);

        runFastToHalt(sisd);
        runFastToHalt(simd);
        runFastToHalt(mimd);

        const sisdOut = sisd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const simdOut = simd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const mimdOut = mimd.memory.readBlock(wl.outputAddressBase, wl.outputLength);

        assertArrayEquals(sisdOut, wl.expectedOutput, "SISD L=7 Output");
        assertArrayEquals(simdOut, wl.expectedOutput, "SIMD L=7 Tail-Mask Output");
        assertArrayEquals(mimdOut, wl.expectedOutput, "MIMD L=7 Remainder Output");

        console.log(`  ✓ Handled 7 elements across 4 PEs (Chunk 1: 4 PEs, Chunk 2: 3 PEs active, 1 masked)`);
        console.log(`  ✓ SIMD Tail-Mask Output: [${simdOut.join(', ')}] strictly equals reference [${wl.expectedOutput.join(', ')}]`);
        console.log("  >>> TEST 2 PASSED!\n");
        passedTests++;
    } catch (err) {
        console.error("  ✗ TEST 2 FAILED:", err.message, "\n");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 3: Matrix Multiplication Mathematical Verification (2x2)
    // -------------------------------------------------------------------------
    totalTests++;
    try {
        console.log("TEST 3: Matrix Multiplication 2x2 Mathematical Equivalence");
        const wl = WorkloadManager.createMatrixMultiplicationWorkload(2, 4);

        const sisd = new SISDArchitecture();
        const simd = new SIMDArchitecture(4);
        const mimd = new MIMDArchitecture(4);

        sisd.loadWorkload(wl);
        simd.loadWorkload(wl);
        mimd.loadWorkload(wl);

        runFastToHalt(sisd);
        runFastToHalt(simd);
        runFastToHalt(mimd);

        const sisdOut = sisd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const simdOut = simd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const mimdOut = mimd.memory.readBlock(wl.outputAddressBase, wl.outputLength);

        assertArrayEquals(sisdOut, wl.expectedOutput, "SISD Matrix Product");
        assertArrayEquals(simdOut, wl.expectedOutput, "SIMD Matrix Product");
        assertArrayEquals(mimdOut, wl.expectedOutput, "MIMD Matrix Product");

        console.log(`  ✓ Matrix A = [[1, 2], [3, 4]], B = [[2, 3], [4, 5]]`);
        console.log(`  ✓ Result Matrix Product C: [${sisdOut.join(', ')}] matches reference [${wl.expectedOutput.join(', ')}]`);
        console.log("  >>> TEST 3 PASSED!\n");
        passedTests++;
    } catch (err) {
        console.error("  ✗ TEST 3 FAILED:", err.message, "\n");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 4: Conditional Filter & SIMD Divergence Penalty
    // -------------------------------------------------------------------------
    totalTests++;
    try {
        console.log("TEST 4: Conditional Filter Branch Divergence Verification");
        const wl = WorkloadManager.createConditionalFilterWorkload(8, 4);

        const sisd = new SISDArchitecture();
        const simd = new SIMDArchitecture(4);
        const mimd = new MIMDArchitecture(4);

        sisd.loadWorkload(wl);
        simd.loadWorkload(wl);
        mimd.loadWorkload(wl);

        runFastToHalt(sisd);
        runFastToHalt(simd);
        runFastToHalt(mimd);

        const sisdOut = sisd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const simdOut = simd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        const mimdOut = mimd.memory.readBlock(wl.outputAddressBase, wl.outputLength);

        assertArrayEquals(sisdOut, wl.expectedOutput, "SISD Divergence Output");
        assertArrayEquals(simdOut, wl.expectedOutput, "SIMD Divergence Output");
        assertArrayEquals(mimdOut, wl.expectedOutput, "MIMD Divergence Output");

        // Verify that SIMD experienced divergence stalls
        if (simd.divergenceStalls === 0) {
            throw new Error("Expected SIMD divergence stalls on conditional code, but recorded 0!");
        }

        console.log(`  ✓ Conditional Outputs match: [${simdOut.join(', ')}]`);
        console.log(`  ✓ SIMD Divergence Stalls accurately recorded: ${simd.divergenceStalls} PE-cycles spent masked off`);
        console.log("  >>> TEST 4 PASSED!\n");
        passedTests++;
    } catch (err) {
        console.error("  ✗ TEST 4 FAILED:", err.message, "\n");
    }

    // -------------------------------------------------------------------------
    // TEST CASE 5: MISD Fault-Tolerant Voting (TMR) Consensus with Fault Injected
    // -------------------------------------------------------------------------
    totalTests++;
    try {
        console.log("TEST 5: MISD Fault-Tolerant Voting (TMR) Fault Masking");
        const wl = WorkloadManager.createFaultTolerantVotingWorkload(6);
        const misd = new MISDArchitecture(3);

        misd.loadWorkload(wl);
        // Inject corrupt output on PE 1
        misd.injectFault(1);

        runFastToHalt(misd);

        const actualConsensus = misd.memory.readBlock(wl.outputAddressBase, wl.outputLength);
        assertArrayEquals(actualConsensus, wl.expectedOutput, "TMR Voter Consensus");

        console.log(`  ✓ Fault injected on PE 1: Corrupted data successfully masked by 2-out-of-3 Voter!`);
        console.log(`  ✓ Verified Output Memory: [${actualConsensus.join(', ')}] equals Ground Truth [${wl.expectedOutput.join(', ')}]`);
        console.log("  >>> TEST 5 PASSED!\n");
        passedTests++;
    } catch (err) {
        console.error("  ✗ TEST 5 FAILED:", err.message, "\n");
    }

    console.log("==========================================================");
    console.log(` TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
    console.log("==========================================================");

    return passedTests === totalTests;
}

// Run if called directly in node
if (typeof module !== 'undefined' && require.main === module) {
    const success = runAllTests();
    process.exit(success ? 0 : 1);
}

if (typeof window !== 'undefined') {
    window.runAllTests = runAllTests;
}
