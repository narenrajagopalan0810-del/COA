/**
 * FlynnSim - Workload Generator & Verification Engine
 * 
 * Generates cycle-accurate instruction streams and verified input/output datasets for:
 * 1. Vector Addition (configurable array size L, handles non-multiples of N)
 * 2. Matrix Multiplication (2x2, 3x3, 4x4)
 * 3. Conditional Filter (demonstrates SIMD branch divergence & masking overhead)
 * 4. Multi-Stage Stream Pipeline (MISD systolic stream & TMR voting)
 * 5. Custom Assembly
 */

class WorkloadManager {
    /**
     * Generate Vector Addition Workload: C[i] = A[i] + B[i]
     * Memory Layout:
     * A: Base 10..10+L-1
     * B: Base 50..50+L-1
     * C: Base 90..90+L-1
     * 
     * @param {number} length - Number of vector elements (e.g. 4, 8, 12, 16, 20)
     * @param {number} peCount - Number of PEs in SIMD/MIMD
     */
    static createVectorAdditionWorkload(length = 8, peCount = 4) {
        const initialMemory = new Array(256).fill(0);
        const expectedOutput = [];

        // Fill test data: A[i] = (i+1)*3, B[i] = (i+1)*5
        for (let i = 0; i < length; i++) {
            const aVal = (i + 1) * 3;
            const bVal = (i + 1) * 5;
            initialMemory[10 + i] = aVal;
            initialMemory[50 + i] = bVal;
            expectedOutput.push(aVal + bVal);
        }

        // --- 1. SISD Program ---
        // Sequential execution over each element
        let sisdAsm = `; Vector Addition (SISD)\n`;
        for (let i = 0; i < length; i++) {
            sisdAsm += `LOAD R0, [${10 + i}]\n`;
            sisdAsm += `LOAD R1, [${50 + i}]\n`;
            sisdAsm += `ADD R2, R0, R1\n`;
            sisdAsm += `STORE [${90 + i}], R2\n`;
        }
        sisdAsm += `HALT\n`;
        const sisdProgram = TinyISA.assemble(sisdAsm);

        // --- 2. SIMD Program ---
        // Lockstep execution chunked by peCount, with tail masking for remainders!
        let simdAsm = `; Vector Addition (SIMD)\n`;
        const numChunks = Math.ceil(length / peCount);

        for (let c = 0; c < numChunks; c++) {
            const baseIdx = c * peCount;
            const remaining = length - baseIdx;

            if (remaining < peCount) {
                // Tail mask: only PEs with id < remaining execute
                simdAsm += `MASK_EVAL PE_LT #${remaining}\n`;
            } else {
                simdAsm += `MASK_RESET\n`;
            }

            simdAsm += `LOAD R0, [${10 + baseIdx} + PE_ID]\n`;
            simdAsm += `LOAD R1, [${50 + baseIdx} + PE_ID]\n`;
            simdAsm += `ADD R2, R0, R1\n`;
            simdAsm += `STORE [${90 + baseIdx} + PE_ID], R2\n`;
        }
        simdAsm += `MASK_RESET\n`;
        simdAsm += `HALT\n`;
        const simdProgram = TinyISA.assemble(simdAsm);

        // --- 3. MIMD Programs (One independent program per PE) ---
        // Chunk partitioning across PEs
        const mimdPrograms = [];
        const baseChunk = Math.floor(length / peCount);
        const remainder = length % peCount;

        for (let p = 0; p < peCount; p++) {
            // Distribute remainders evenly among first few PEs
            const pStart = p * baseChunk + Math.min(p, remainder);
            const pCountThisPE = baseChunk + (p < remainder ? 1 : 0);
            const pEnd = pStart + pCountThisPE;

            let coreAsm = `; MIMD Core ${p}: elements ${pStart} to ${pEnd - 1}\n`;
            for (let i = pStart; i < pEnd; i++) {
                coreAsm += `LOAD R0, [${10 + i}]\n`;
                coreAsm += `LOAD R1, [${50 + i}]\n`;
                coreAsm += `ADD R2, R0, R1\n`;
                coreAsm += `STORE [${90 + i}], R2\n`;
            }
            coreAsm += `HALT\n`;
            mimdPrograms.push(TinyISA.assemble(coreAsm).instructions);
        }

        return {
            id: 'vector_addition',
            name: `Vector Addition (L = ${length})`,
            category: 'Data-Parallel',
            length,
            peCount,
            initialMemory,
            expectedOutput,
            outputAddressBase: 90,
            outputLength: length,
            sisdProgram,
            simdProgram,
            mimdPrograms,
            description: `Adds two vectors A and B of length ${length}. Demonstrates linear scaling in SIMD/MIMD, lockstep vector loads, and tail masking when length is not divisible by PE count.`
        };
    }

    /**
     * Generate Matrix Multiplication Workload: C = A * B
     * Dimensions: M x M (e.g. 2x2, 3x3, 4x4)
     * Memory Layout:
     * A: Base 10..10 + M*M - 1
     * B: Base 30..30 + M*M - 1
     * C: Base 60..60 + M*M - 1
     */
    static createMatrixMultiplicationWorkload(dim = 2, peCount = 4) {
        const initialMemory = new Array(256).fill(0);
        const totalElements = dim * dim;

        // Initialize simple matrices: A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]]
        const matA = [];
        const matB = [];
        for (let r = 0; r < dim; r++) {
            matA[r] = [];
            matB[r] = [];
            for (let c = 0; c < dim; c++) {
                const aVal = (r * dim + c + 1);
                const bVal = (r * dim + c + 2);
                matA[r][c] = aVal;
                matB[r][c] = bVal;
                initialMemory[10 + r * dim + c] = aVal;
                initialMemory[30 + r * dim + c] = bVal;
            }
        }

        // Compute expected reference C = A * B
        const expectedOutput = [];
        for (let r = 0; r < dim; r++) {
            for (let c = 0; c < dim; c++) {
                let sum = 0;
                for (let k = 0; k < dim; k++) {
                    sum += matA[r][k] * matB[k][c];
                }
                expectedOutput.push(sum);
                // expected in memory at 60 + r*dim + c
            }
        }

        // --- 1. SISD Program (Sequential dot product calculation) ---
        let sisdAsm = `; Matrix Multiplication ${dim}x${dim} (SISD)\n`;
        for (let r = 0; r < dim; r++) {
            for (let c = 0; c < dim; c++) {
                sisdAsm += `LOAD R3, #0 ; accumulator\n`;
                for (let k = 0; k < dim; k++) {
                    const aAddr = 10 + r * dim + k;
                    const bAddr = 30 + k * dim + c;
                    sisdAsm += `LOAD R0, [${aAddr}]\n`;
                    sisdAsm += `LOAD R1, [${bAddr}]\n`;
                    sisdAsm += `MUL R2, R0, R1\n`;
                    sisdAsm += `ADD R3, R3, R2\n`;
                }
                const cAddr = 60 + r * dim + c;
                sisdAsm += `STORE [${cAddr}], R3\n`;
            }
        }
        sisdAsm += `HALT\n`;
        const sisdProgram = TinyISA.assemble(sisdAsm);

        // --- 2. SIMD Program ---
        // Parallel dot products across cells
        let simdAsm = `; Matrix Multiplication (SIMD)\n`;
        const chunks = Math.ceil(totalElements / peCount);
        for (let ch = 0; ch < chunks; ch++) {
            const baseCell = ch * peCount;
            const remaining = totalElements - baseCell;
            if (remaining < peCount) {
                simdAsm += `MASK_EVAL PE_LT #${remaining}\n`;
            } else {
                simdAsm += `MASK_RESET\n`;
            }

            // In SIMD, each cell is mapped to PE_ID
            // For general demonstration of vector matrix dot-product:
            for (let p = 0; p < Math.min(peCount, remaining); p++) {
                const cellIdx = baseCell + p;
                const r = Math.floor(cellIdx / dim);
                const c = cellIdx % dim;
                // Accumulate dot product
                simdAsm += `LOAD R3, #0\n`;
                for (let k = 0; k < dim; k++) {
                    const aAddr = 10 + r * dim + k;
                    const bAddr = 30 + k * dim + c;
                    simdAsm += `LOAD R0, [${aAddr}]\n`;
                    simdAsm += `LOAD R1, [${bAddr}]\n`;
                    simdAsm += `MUL R2, R0, R1\n`;
                    simdAsm += `ADD R3, R3, R2\n`;
                }
                const cAddr = 60 + cellIdx;
                simdAsm += `STORE [${cAddr}], R3\n`;
            }
        }
        simdAsm += `MASK_RESET\n`;
        simdAsm += `HALT\n`;
        const simdProgram = TinyISA.assemble(simdAsm);

        // --- 3. MIMD Programs ---
        // Partition matrix rows/cells across independent cores
        const mimdPrograms = [];
        for (let p = 0; p < peCount; p++) {
            let coreAsm = `; MIMD Core ${p}: Matrix Cells\n`;
            for (let cellIdx = 0; cellIdx < totalElements; cellIdx++) {
                if (cellIdx % peCount === p) {
                    const r = Math.floor(cellIdx / dim);
                    const c = cellIdx % dim;
                    coreAsm += `LOAD R3, #0\n`;
                    for (let k = 0; k < dim; k++) {
                        const aAddr = 10 + r * dim + k;
                        const bAddr = 30 + k * dim + c;
                        coreAsm += `LOAD R0, [${aAddr}]\n`;
                        coreAsm += `LOAD R1, [${bAddr}]\n`;
                        coreAsm += `MUL R2, R0, R1\n`;
                        coreAsm += `ADD R3, R3, R2\n`;
                    }
                    const cAddr = 60 + cellIdx;
                    coreAsm += `STORE [${cAddr}], R3\n`;
                }
            }
            coreAsm += `HALT\n`;
            mimdPrograms.push(TinyISA.assemble(coreAsm).instructions);
        }

        return {
            id: 'matrix_mult',
            name: `Matrix Multiplication (${dim}x${dim})`,
            category: 'Compute-Intensive',
            dim,
            peCount,
            initialMemory,
            expectedOutput,
            outputAddressBase: 60,
            outputLength: totalElements,
            sisdProgram,
            simdProgram,
            mimdPrograms,
            description: `Computes product C = A * B for ${dim}x${dim} matrices with nested dot products. Demonstrates ALU multiplier utilization and parallel cell computation.`
        };
    }

    /**
     * Generate Conditional Filter / Divergence Workload:
     * for i in 0..L-1:
     *   if A[i] > 10:
     *      Out[i] = A[i] * 2   (Branch THEN)
     *   else:
     *      Out[i] = A[i] + 5   (Branch ELSE)
     * 
     * Clearly shows SIMD Branch Divergence cost: PEs must serialize both paths using masks!
     */
    static createConditionalFilterWorkload(length = 8, peCount = 4) {
        const initialMemory = new Array(256).fill(0);
        const expectedOutput = [];

        // Mixed test input: some values > 10, some <= 10
        const sampleInputs = [4, 15, 8, 22, 11, 3, 18, 9, 14, 2, 25, 7];
        for (let i = 0; i < length; i++) {
            const val = sampleInputs[i % sampleInputs.length];
            initialMemory[10 + i] = val;
            const res = (val > 10) ? (val * 2) : (val + 5);
            expectedOutput.push(res);
        }

        // --- 1. SISD Program ---
        let sisdAsm = `; Conditional Filter (SISD)\n`;
        for (let i = 0; i < length; i++) {
            sisdAsm += `LOAD R0, [${10 + i}]\n`;
            sisdAsm += `CMP R0, #10\n`;
            sisdAsm += `BGT THEN_${i}\n`;
            // ELSE path
            sisdAsm += `ADD R1, R0, #5\n`;
            sisdAsm += `STORE [${50 + i}], R1\n`;
            sisdAsm += `JMP END_${i}\n`;
            // THEN path
            sisdAsm += `THEN_${i}: MUL R1, R0, #2\n`;
            sisdAsm += `STORE [${50 + i}], R1\n`;
            sisdAsm += `END_${i}: NOP\n`;
        }
        sisdAsm += `HALT\n`;
        const sisdProgram = TinyISA.assemble(sisdAsm);

        // --- 2. SIMD Program (Branch Divergence Demonstration) ---
        let simdAsm = `; Conditional Filter (SIMD Divergence Demo)\n`;
        const chunks = Math.ceil(length / peCount);

        for (let c = 0; c < chunks; c++) {
            const baseIdx = c * peCount;
            const remaining = length - baseIdx;

            if (remaining < peCount) {
                simdAsm += `MASK_EVAL PE_LT #${remaining}\n`;
            } else {
                simdAsm += `MASK_RESET\n`;
            }

            // Load data
            simdAsm += `LOAD R0, [${10 + baseIdx} + PE_ID]\n`;
            simdAsm += `CMP R0, #10\n`;

            // Step 1: THEN clause (Active where R0 > 10)
            simdAsm += `MASK_EVAL GT\n`;
            simdAsm += `MUL R1, R0, #2\n`;
            simdAsm += `STORE [${50 + baseIdx} + PE_ID], R1\n`;

            // Step 2: ELSE clause (Invert mask: Active where R0 <= 10)
            simdAsm += `MASK_INVERT\n`;
            simdAsm += `ADD R1, R0, #5\n`;
            simdAsm += `STORE [${50 + baseIdx} + PE_ID], R1\n`;

            // Step 3: Restore all masks
            simdAsm += `MASK_RESET\n`;
        }
        simdAsm += `HALT\n`;
        const simdProgram = TinyISA.assemble(simdAsm);

        // --- 3. MIMD Programs (Asynchronous, no divergence stalls) ---
        const mimdPrograms = [];
        const baseChunk = Math.floor(length / peCount);
        const rem = length % peCount;

        for (let p = 0; p < peCount; p++) {
            const pStart = p * baseChunk + Math.min(p, rem);
            const pCountThisPE = baseChunk + (p < rem ? 1 : 0);
            const pEnd = pStart + pCountThisPE;

            let coreAsm = `; MIMD Core ${p}: Independent Branching\n`;
            for (let i = pStart; i < pEnd; i++) {
                coreAsm += `LOAD R0, [${10 + i}]\n`;
                coreAsm += `CMP R0, #10\n`;
                coreAsm += `BGT THEN_CORE_${p}_${i}\n`;
                coreAsm += `ADD R1, R0, #5\n`;
                coreAsm += `STORE [${50 + i}], R1\n`;
                coreAsm += `JMP END_CORE_${p}_${i}\n`;
                coreAsm += `THEN_CORE_${p}_${i}: MUL R1, R0, #2\n`;
                coreAsm += `STORE [${50 + i}], R1\n`;
                coreAsm += `END_CORE_${p}_${i}: NOP\n`;
            }
            coreAsm += `HALT\n`;
            mimdPrograms.push(TinyISA.assemble(coreAsm).instructions);
        }

        return {
            id: 'conditional_filter',
            name: `Conditional Filter (Divergence Demo, L = ${length})`,
            category: 'Control-Flow Divergence',
            length,
            peCount,
            initialMemory,
            expectedOutput,
            outputAddressBase: 50,
            outputLength: length,
            sisdProgram,
            simdProgram,
            mimdPrograms,
            description: `Evaluates if (A[i] > 10) A[i]*2 else A[i]+5. In SIMD, both branches must be broadcast with predication masks, causing 50% idle divergence stall. In MIMD, cores branch independently without stalling each other.`
        };
    }

    /**
     * Generate Multi-Stage Stream Pipeline & Fault-Tolerant Voting Workload (MISD)
     */
    static createStreamPipelineWorkload(streamLength = 8) {
        const inputStream = [];
        const expectedPipelineOutput = [];
        const initialMemory = new Array(256).fill(0);

        for (let i = 0; i < streamLength; i++) {
            const val = (i + 1) * 12; // 12, 24, 36, ...
            inputStream.push(val);
            // Pipeline stages:
            // S0: val - 5
            // S1: (val - 5) * 3
            // S2: clamp(..., 0, 100)
            const s0 = val - 5;
            const s1 = s0 * 3;
            const s2 = Math.min(Math.max(s1, 0), 100);
            expectedPipelineOutput.push(s2);
        }

        // MISD Stage Programs (3 PEs)
        const misdPrograms = [
            TinyISA.assemble(`SUB R0, R0, #5\nHALT`).instructions, // Stage 0
            TinyISA.assemble(`MUL R0, R0, #3\nHALT`).instructions, // Stage 1
            TinyISA.assemble(`STORE [200], R0\nHALT`).instructions // Stage 2
        ];

        // SISD equivalent (sequential processing of stream)
        let sisdAsm = `; Stream Pipeline Equivalent (SISD)\n`;
        for (let i = 0; i < streamLength; i++) {
            sisdAsm += `LOAD R0, #${inputStream[i]}\n`;
            sisdAsm += `SUB R0, R0, #5\n`;
            sisdAsm += `MUL R0, R0, #3\n`;
            sisdAsm += `CMP R0, #100\n`;
            sisdAsm += `BLT NO_CLAMP_${i}\n`;
            sisdAsm += `LOAD R0, #100\n`;
            sisdAsm += `NO_CLAMP_${i}: STORE [201 + ${i}], R0\n`;
        }
        sisdAsm += `HALT\n`;

        return {
            id: 'stream_pipeline',
            name: `Multi-Stage Stream Pipeline (MISD, N = ${streamLength})`,
            category: 'Stream & Systolic',
            misdMode: 'PIPELINE',
            inputStream,
            expectedOutput: expectedPipelineOutput,
            outputAddressBase: 201,
            outputLength: streamLength,
            initialMemory,
            misdPrograms,
            sisdProgram: TinyISA.assemble(sisdAsm),
            description: `A stream of data tokens flows sequentially through 3 specialized stages (PE0: Offset subtraction, PE1: Gain multiplier, PE2: Clamping limiter). Demonstrates pipeline parallelism over a single data stream.`
        };
    }

    /**
     * Generate Fault-Tolerant Voting Workload (Triple Modular Redundancy - MISD)
     */
    static createFaultTolerantVotingWorkload(tokenCount = 6) {
        const inputStream = [15, 28, 42, 60, 75, 90];
        const expectedOutput = inputStream.map(x => (x * 2) + 10);

        return {
            id: 'ft_voting',
            name: `Fault-Tolerant Voting / TMR (MISD)`,
            category: 'Reliability & Fault-Tolerance',
            misdMode: 'FAULT_TOLERANT_VOTING',
            inputStream,
            expectedOutput,
            outputAddressBase: 200,
            outputLength: inputStream.length,
            initialMemory: new Array(256).fill(0),
            description: `Single sensor data stream broadcast to 3 diverse PEs. Hardware 2-out-of-3 voter verifies consensus and can mask an injected hardware fault on PE 1. Demonstrates Space Shuttle / flight avionics MISD architecture.`
        };
    }

    /**
     * Verifies simulation outputs against the expected ground truth array
     * @param {BaseArchitecture} arch
     * @param {Object} workload
     * @returns {Object} { passed: boolean, actual: number[], expected: number[], diffs: Array }
     */
    static verifyOutput(arch, workload) {
        if (!workload || !workload.expectedOutput) {
            return { passed: true, message: 'No ground truth specified' };
        }

        const actual = arch.memory.readBlock(workload.outputAddressBase, workload.outputLength);
        const expected = workload.expectedOutput;
        const diffs = [];

        for (let i = 0; i < expected.length; i++) {
            if (actual[i] !== expected[i]) {
                diffs.push({ index: i, address: workload.outputAddressBase + i, expected: expected[i], actual: actual[i] });
            }
        }

        return {
            passed: diffs.length === 0,
            actual,
            expected,
            diffs,
            message: diffs.length === 0 ? 
                `Verified Correct! All ${expected.length} output values match reference ground truth.` :
                `Discrepancy detected at ${diffs.length} memory locations!`
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WorkloadManager };
}
