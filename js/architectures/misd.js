/**
 * FlynnSim - MISD Architecture (Multiple Instruction, Single Data)
 * 
 * Historical / Specialized Architectural Model:
 * - Single Data Stream passing through or broadcast to N PEs
 * - Multiple Instruction Streams: each PE executes its own independent instruction stream / program
 * 
 * Educational Note: Pure MISD is exceedingly rare in general-purpose commercial computing.
 * Its most prominent real-world applications are:
 * 1. Pipelined / Systolic Stream Processors (data stream transformed through stages)
 * 2. Fault-Tolerant Voting (Triple Modular Redundancy in Space Shuttle / Avionics / Nuclear safety)
 */

const MISDMode = {
    PIPELINE: 'PIPELINE',
    FAULT_TOLERANT_VOTING: 'FAULT_TOLERANT_VOTING'
};

class MISDArchitecture extends BaseArchitecture {
    /**
     * @param {number} peCount - Typically 3 or 4 PEs
     */
    constructor(peCount = 3) {
        super('MISD', peCount);
        this.mode = MISDMode.PIPELINE;
        this.programs = []; // Array of instruction arrays, one per PE
        this.inputStream = [];
        this.streamPointer = 0;
        this.pipelineBuffers = []; // Intermediate registers between stages
        this.votingResults = [];
        this.faultInjectedPE = -1; // -1 = no fault; 0..N = inject corrupt output on PE
    }

    reset() {
        super.reset();
        this.streamPointer = 0;
        this.pipelineBuffers = new Array(this.peCount).fill(null);
        this.votingResults = [];
    }

    setMode(mode) {
        this.mode = mode;
        this.reset();
    }

    injectFault(peId) {
        this.faultInjectedPE = peId;
    }

    loadWorkload(workload) {
        this.reset();
        this.workloadMeta = workload;
        this.mode = workload.misdMode || MISDMode.PIPELINE;
        this.programs = workload.misdPrograms || [];
        this.inputStream = workload.inputStream ? [...workload.inputStream] : [10, 20, 30, 40, 50, 60];
        this.pipelineBuffers = new Array(this.peCount).fill(null);
        if (workload.initialMemory) {
            this.memory.loadBlock(0, workload.initialMemory);
        }
    }

    step() {
        if (this.isHalted) return false;

        this.clockCycle++;

        if (this.mode === MISDMode.PIPELINE) {
            return this.stepPipelineMode();
        } else {
            return this.stepVotingMode();
        }
    }

    /**
     * Pipelined Stream Execution:
     * Single data stream flows sequentially through PE 0 -> PE 1 -> PE 2 -> PE 3.
     * Each PE applies its own instruction stream to the data token.
     */
    stepPipelineMode() {
        // Stages execute from right to left (back to front) to allow data to advance cleanly
        let activeCount = 0;
        const newBuffers = [...this.pipelineBuffers];

        for (let i = this.peCount - 1; i >= 0; i--) {
            const pe = this.pes[i];
            const prog = this.programs[i] || [];

            // Stage 0 pulls from input stream; subsequent stages pull from previous buffer
            let inputToken = null;
            if (i === 0) {
                if (this.streamPointer < this.inputStream.length) {
                    inputToken = this.inputStream[this.streamPointer];
                }
            } else {
                inputToken = this.pipelineBuffers[i - 1];
            }

            if (inputToken !== null) {
                pe.state = PEState.EXECUTE;
                pe.activeCycles++;
                pe.instructionsExecuted++;
                activeCount++;

                // Execute the stage's specialized operation
                const instr = prog[pe.PC % (prog.length || 1)] || new Instruction(Opcode.NOP);
                pe.assignInstruction(instr);

                let outputToken = inputToken;
                // Stage 0: Offset subtraction (e.g. input - 5)
                if (i === 0) {
                    outputToken = inputToken - 5;
                    pe.lastOpDescription = `Stage 0 (Offset): In=${inputToken} -> Out=${outputToken}`;
                    this.streamPointer++;
                }
                // Stage 1: Gain multiplier (e.g. input * 3)
                else if (i === 1) {
                    outputToken = inputToken * 3;
                    pe.lastOpDescription = `Stage 1 (Gain): In=${inputToken} -> Out=${outputToken}`;
                }
                // Stage 2: Clamping / Limiting (clamp to [0, 100])
                else if (i === 2) {
                    outputToken = Math.min(Math.max(inputToken, 0), 100);
                    pe.lastOpDescription = `Stage 2 (Clamp): In=${inputToken} -> Out=${outputToken}`;
                    // Final stage writes result to output memory
                    const outIdx = this.memory.read(200) || 0; // memory location 200 holds count
                    this.memory.write(201 + outIdx, outputToken);
                    this.memory.write(200, outIdx + 1);
                }

                newBuffers[i] = outputToken;
                pe.PC++;
            } else {
                pe.state = PEState.IDLE;
                pe.idleCycles++;
                pe.lastOpDescription = 'Starved / Waiting for token';
                newBuffers[i] = null;
            }
        }

        this.pipelineBuffers = newBuffers;

        // Check if stream is fully drained
        const isDrained = (this.streamPointer >= this.inputStream.length) &&
                          this.pipelineBuffers.every(buf => buf === null);

        if (isDrained) {
            for (const pe of this.pes) {
                pe.state = PEState.HALTED;
            }
            this.isHalted = true;
            this.currentTrace = `Cycle ${this.clockCycle}: MISD Stream Pipeline completely drained. All tokens processed.`;
            this.traceHistory.push(this.currentTrace);
            return false;
        }

        this.currentTrace = `Cycle ${this.clockCycle}: MISD Pipeline active. Tokens flowing across ${activeCount}/${this.peCount} stages. Stream progress: ${this.streamPointer}/${this.inputStream.length}.`;
        this.traceHistory.push(this.currentTrace);
        return true;
    }

    /**
     * Fault-Tolerant Voting Mode (Triple Modular Redundancy):
     * The single input token is broadcast to N independent PEs.
     * Each PE runs its own algorithm to compute result.
     * A hardware voter counts consensus and detects if any PE has a fault.
     */
    stepVotingMode() {
        if (this.streamPointer >= this.inputStream.length) {
            for (const pe of this.pes) {
                pe.state = PEState.HALTED;
            }
            this.isHalted = true;
            this.currentTrace = `Cycle ${this.clockCycle}: MISD TMR Voting completed for all data items.`;
            this.traceHistory.push(this.currentTrace);
            return false;
        }

        const inputToken = this.inputStream[this.streamPointer];
        const outputs = [];

        for (let i = 0; i < this.peCount; i++) {
            const pe = this.pes[i];
            pe.state = PEState.EXECUTE;
            pe.activeCycles++;
            pe.instructionsExecuted++;

            // PE 0: Direct calculation
            // PE 1: Diverse formula (may have fault injected)
            // PE 2: Redundant cross-check formula
            let res = 0;
            if (i === 0) res = (inputToken * 2) + 10;
            else if (i === 1) {
                res = (inputToken * 2) + 10;
                if (this.faultInjectedPE === 1) {
                    res += 999; // Corrupted output!
                }
            }
            else if (i === 2) res = (inputToken + inputToken) + 10;

            outputs.push(res);
            pe.setRegister('R0', res);
            pe.lastOpDescription = `Alg ${i}: In=${inputToken} -> Out=${res} ${this.faultInjectedPE === i ? '(FAULT INJECTED)' : ''}`;
        }

        // Hardware 2-out-of-3 Voter
        let majorityValue = outputs[0];
        let faultDetected = null;
        if (outputs[0] === outputs[1] || outputs[0] === outputs[2]) {
            majorityValue = outputs[0];
            if (outputs[1] !== outputs[0]) faultDetected = 1;
            if (outputs[2] !== outputs[0]) faultDetected = 2;
        } else if (outputs[1] === outputs[2]) {
            majorityValue = outputs[1];
            faultDetected = 0;
        } else {
            majorityValue = 'NO CONSENSUS';
        }

        this.votingResults.push({
            cycle: this.clockCycle,
            input: inputToken,
            outputs,
            consensus: majorityValue,
            faultyPE: faultDetected
        });

        this.memory.write(200 + this.streamPointer, typeof majorityValue === 'number' ? majorityValue : -1);
        this.streamPointer++;

        this.currentTrace = `Cycle ${this.clockCycle}: TMR Voter evaluated Data[${inputToken}]. Outputs: [${outputs.join(', ')}]. Consensus: ${majorityValue}. ${faultDetected !== null ? `ALERT: Discrepancy on PE ${faultDetected} masked by voter!` : 'Consensus unanimous.'}`;
        this.traceHistory.push(this.currentTrace);

        return true;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MISDMode, MISDArchitecture };
}
