/**
 * FlynnSim - Base Architecture Abstract Class
 * 
 * Provides unified interface, clock cycle progression, metric computation,
 * and state telemetry for SISD, SIMD, MISD, and MIMD simulators.
 */

class BaseArchitecture {
    /**
     * @param {string} name - 'SISD' | 'SIMD' | 'MISD' | 'MIMD'
     * @param {number} peCount - Number of Processing Elements
     */
    constructor(name, peCount = 1) {
        this.name = name;
        this.peCount = peCount;
        this.pes = [];
        this.memory = new MemorySystem(256);
        this.clockCycle = 0;
        this.isHalted = false;
        this.currentTrace = '';
        this.traceHistory = []; // Cycle log history
        this.workloadMeta = null;

        this.initPEs();
    }

    initPEs() {
        this.pes = [];
        for (let i = 0; i < this.peCount; i++) {
            this.pes.push(new ProcessingElement(i, this.name));
        }
    }

    setPECount(count) {
        this.peCount = Math.max(1, count);
        this.initPEs();
        this.reset();
    }

    reset() {
        this.clockCycle = 0;
        this.isHalted = false;
        this.currentTrace = 'Simulation reset to Cycle 0';
        this.traceHistory = [];
        this.memory.reset();
        for (const pe of this.pes) {
            pe.reset();
        }
    }

    /**
     * Load a workload into the architecture
     * @param {Object} workload - Prepared workload instance
     */
    loadWorkload(workload) {
        throw new Error("loadWorkload() must be implemented by subclass");
    }

    /**
     * Advances simulation by exactly ONE discrete clock cycle
     * @returns {boolean} true if execution is still active, false if halted
     */
    step() {
        throw new Error("step() must be implemented by subclass");
    }

    /**
     * Returns real-time metrics for analysis & graphs
     */
    getMetrics(sisdBaselineCycles = null) {
        let totalActiveCycles = 0;
        let totalStalledCycles = 0;
        let totalIdleCycles = 0;
        let totalInstructions = 0;

        for (const pe of this.pes) {
            totalActiveCycles += pe.activeCycles;
            totalStalledCycles += pe.stalledCycles;
            totalIdleCycles += pe.idleCycles;
            totalInstructions += pe.instructionsExecuted;
        }

        const denominator = (this.peCount * this.clockCycle) || 1;
        const utilization = ((totalActiveCycles / denominator) * 100).toFixed(1);
        const ipc = (this.clockCycle > 0 ? (totalInstructions / this.clockCycle).toFixed(2) : '0.00');

        let speedup = 1.0;
        let efficiency = 100.0;

        if (sisdBaselineCycles && sisdBaselineCycles > 0 && this.clockCycle > 0) {
            speedup = Number((sisdBaselineCycles / this.clockCycle).toFixed(2));
            efficiency = Number(((speedup / this.peCount) * 100).toFixed(1));
        }

        return {
            name: this.name,
            peCount: this.peCount,
            cycles: this.clockCycle,
            instructions: totalInstructions,
            activeCycles: totalActiveCycles,
            stalledCycles: totalStalledCycles,
            utilization: Number(utilization),
            ipc: Number(ipc),
            speedup,
            efficiency,
            isHalted: this.isHalted
        };
    }

    /**
     * Helper to execute a single ALU/control instruction on a PE
     * Handles operand dereferencing, register arithmetic, and condition updates.
     */
    executeAluInstruction(pe, instr) {
        const { opcode, operands } = instr;
        switch (opcode) {
            case Opcode.ADD: {
                const dest = operands[0];
                const src1 = TinyISA.parseOperand(operands[1], pe, this.memory);
                const src2 = operands.length > 2 ? TinyISA.parseOperand(operands[2], pe, this.memory) : 0;
                const result = src1 + src2;
                pe.setRegister(dest, result);
                pe.updateFlags(result, 0);
                pe.lastOpDescription = `ADD ${dest} = ${src1} + ${src2} (${result})`;
                break;
            }
            case Opcode.SUB: {
                const dest = operands[0];
                const src1 = TinyISA.parseOperand(operands[1], pe, this.memory);
                const src2 = operands.length > 2 ? TinyISA.parseOperand(operands[2], pe, this.memory) : 0;
                const result = src1 - src2;
                pe.setRegister(dest, result);
                pe.updateFlags(result, 0);
                pe.lastOpDescription = `SUB ${dest} = ${src1} - ${src2} (${result})`;
                break;
            }
            case Opcode.MUL: {
                const dest = operands[0];
                const src1 = TinyISA.parseOperand(operands[1], pe, this.memory);
                const src2 = operands.length > 2 ? TinyISA.parseOperand(operands[2], pe, this.memory) : 1;
                const result = src1 * src2;
                pe.setRegister(dest, result);
                pe.updateFlags(result, 0);
                pe.lastOpDescription = `MUL ${dest} = ${src1} * ${src2} (${result})`;
                break;
            }
            case Opcode.CMP: {
                const src1 = TinyISA.parseOperand(operands[0], pe, this.memory);
                const src2 = TinyISA.parseOperand(operands[1], pe, this.memory);
                pe.updateFlags(src1, src2);
                pe.lastOpDescription = `CMP ${src1} vs ${src2} (ZF=${pe.ZF}, LT=${pe.LT}, GT=${pe.GT})`;
                break;
            }
            case Opcode.NOP: {
                pe.lastOpDescription = 'NOP';
                break;
            }
            default:
                break;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BaseArchitecture };
}
