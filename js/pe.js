/**
 * FlynnSim - Processing Element (PE) Model
 * 
 * Represents an individual computing core / ALU / register file in Flynn's taxonomy.
 * Features discrete cycle advancement, state machine tracking, and SIMD mask awareness.
 */

const PEState = {
    IDLE: 'IDLE',
    FETCH: 'FETCH',
    DECODE: 'DECODE',
    EXECUTE: 'EXECUTE',
    MEMORY: 'MEMORY',
    STALLED_MASK: 'STALLED_MASK',   // Divergence stall in SIMD (PE masked off)
    STALLED_BUS: 'STALLED_BUS',     // Contention stall in MIMD shared memory bus
    HALTED: 'HALTED'
};

class ProcessingElement {
    /**
     * @param {number} id - Unique core ID (0, 1, 2, ...)
     * @param {string} architecture - 'SISD' | 'SIMD' | 'MISD' | 'MIMD'
     */
    constructor(id, architecture = 'SISD') {
        this.id = id;
        this.architecture = architecture;

        // General-purpose registers
        this.registers = {
            R0: 0,
            R1: 0,
            R2: 0,
            R3: 0
        };

        // Status / control registers
        this.PC = 0;
        this.ZF = 0;   // Zero flag
        this.LT = 0;   // Less Than flag
        this.GT = 0;   // Greater Than flag
        
        // SIMD Predicate Mask (true = active & executing, false = masked off / idle)
        this.mask = true;

        // State machine
        this.state = PEState.IDLE;
        this.currentInstruction = null;
        this.cyclesRemaining = 0;
        this.lastOpDescription = 'Idle';

        // Telemetry & metrics
        this.activeCycles = 0;
        this.stalledCycles = 0;
        this.idleCycles = 0;
        this.instructionsExecuted = 0;
        
        // Memory bus interaction log for the current cycle
        this.memoryAccessRequest = null; // { type: 'READ'|'WRITE', address: number, value?: number }
    }

    /**
     * Resets PE registers, state, and metrics to pristine state
     */
    reset() {
        this.registers = { R0: 0, R1: 0, R2: 0, R3: 0 };
        this.PC = 0;
        this.ZF = 0;
        this.LT = 0;
        this.GT = 0;
        this.mask = true;
        this.state = PEState.IDLE;
        this.currentInstruction = null;
        this.cyclesRemaining = 0;
        this.lastOpDescription = 'Reset';
        this.activeCycles = 0;
        this.stalledCycles = 0;
        this.idleCycles = 0;
        this.instructionsExecuted = 0;
        this.memoryAccessRequest = null;
    }

    getRegister(name) {
        const reg = name.toUpperCase();
        if (this.registers.hasOwnProperty(reg)) {
            return this.registers[reg];
        }
        throw new Error(`PE ${this.id}: Invalid register ${name}`);
    }

    setRegister(name, value) {
        const reg = name.toUpperCase();
        if (this.registers.hasOwnProperty(reg)) {
            this.registers[reg] = Math.floor(value); // Integer values for ALU
        } else {
            throw new Error(`PE ${this.id}: Invalid register ${name}`);
        }
    }

    /**
     * Sets flags based on an arithmetic or comparison result
     */
    updateFlags(val1, val2) {
        const diff = val1 - val2;
        this.ZF = diff === 0 ? 1 : 0;
        this.LT = diff < 0 ? 1 : 0;
        this.GT = diff > 0 ? 1 : 0;
    }

    /**
     * Assigns a new instruction for execution (called by Control Unit)
     */
    assignInstruction(instruction) {
        this.currentInstruction = instruction;
        this.cyclesRemaining = instruction.latency;
        this.state = PEState.EXECUTE;
        this.memoryAccessRequest = null;
    }

    /**
     * Set SIMD predication mask
     */
    setMask(active) {
        this.mask = Boolean(active);
        if (!this.mask && this.state !== PEState.HALTED) {
            this.state = PEState.STALLED_MASK;
        }
    }

    /**
     * Computes the utilization percentage of this PE
     */
    getUtilization(totalElapsedCycles) {
        if (!totalElapsedCycles || totalElapsedCycles === 0) return 0;
        return ((this.activeCycles / totalElapsedCycles) * 100).toFixed(1);
    }
}

// Export for module/global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PEState, ProcessingElement };
}
