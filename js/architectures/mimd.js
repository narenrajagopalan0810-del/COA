/**
 * FlynnSim - MIMD Architecture (Multiple Instruction, Multiple Data)
 * 
 * Multiprocessor / Multicore / Cluster Model:
 * - N independent Control Units (each PE maintains its own PC and instruction stream)
 * - N distinct Data Streams
 * - Supports two distinct memory paradigms:
 *   1. Shared Memory (SMP/UMA): Shared physical bus with Round-Robin arbitration & contention stalls
 *   2. Distributed Memory (Cluster/NUMA): Private local memory banks without bus contention
 */

const MIMDMemoryModel = {
    SHARED: 'SHARED',
    DISTRIBUTED: 'DISTRIBUTED'
};

class MIMDArchitecture extends BaseArchitecture {
    /**
     * @param {number} peCount - Number of independent cores (2 to 16, default 4)
     */
    constructor(peCount = 4) {
        super('MIMD', peCount);
        this.memoryModel = MIMDMemoryModel.SHARED;
        this.programs = []; // Array of instruction arrays (one per PE)
        this.localMemories = []; // Used in Distributed mode
        this.totalContentionStalls = 0;
        this.initMemoryModel();
    }

    initMemoryModel() {
        if (this.memoryModel === MIMDMemoryModel.DISTRIBUTED) {
            this.localMemories = [];
            for (let i = 0; i < this.peCount; i++) {
                this.localMemories.push(new MemorySystem(128));
            }
        }
    }

    setMemoryModel(model) {
        this.memoryModel = model;
        this.initMemoryModel();
        this.reset();
    }

    reset() {
        super.reset();
        this.totalContentionStalls = 0;
        if (this.memoryModel === MIMDMemoryModel.DISTRIBUTED) {
            for (const lm of this.localMemories) {
                lm.reset();
            }
        }
    }

    loadWorkload(workload) {
        this.reset();
        this.workloadMeta = workload;
        this.programs = workload.mimdPrograms || [];
        
        if (workload.initialMemory) {
            this.memory.loadBlock(0, workload.initialMemory);
            if (this.memoryModel === MIMDMemoryModel.DISTRIBUTED) {
                for (let i = 0; i < this.peCount; i++) {
                    this.localMemories[i].loadBlock(0, workload.initialMemory);
                }
            }
        }
    }

    step() {
        if (this.isHalted) return false;

        this.clockCycle++;

        // Step 1: Pre-evaluate memory access requests across all active PEs
        const pendingMemoryRequests = [];

        for (let i = 0; i < this.peCount; i++) {
            const pe = this.pes[i];
            const prog = this.programs[i] || [];

            // If PE already halted, skip
            if (pe.state === PEState.HALTED || pe.PC >= prog.length) {
                pe.state = PEState.HALTED;
                continue;
            }

            // If PE was stalled due to bus contention in previous cycle, it re-requests
            if (pe.state === PEState.STALLED_BUS) {
                pendingMemoryRequests.push(pe);
                continue;
            }

            // If PE is in middle of non-memory multi-cycle instruction
            if (pe.cyclesRemaining > 1) {
                continue;
            }

            // If PE is about to fetch or complete an instruction that accesses memory
            const instr = prog[pe.PC];
            if (instr && (instr.opcode === Opcode.LOAD || instr.opcode === Opcode.STORE)) {
                // In Shared Memory, check if instruction targets shared memory
                if (this.memoryModel === MIMDMemoryModel.SHARED) {
                    pe.memoryAccessRequest = { opcode: instr.opcode, pc: pe.PC };
                    pendingMemoryRequests.push(pe);
                }
            } else {
                pe.memoryAccessRequest = null;
            }
        }

        // Step 2: In Shared Memory mode, arbitrate the memory bus
        let grantedPEId = null;
        let stalledPEIds = [];

        if (this.memoryModel === MIMDMemoryModel.SHARED && pendingMemoryRequests.length > 0) {
            const arbResult = this.memory.arbitrateBus(pendingMemoryRequests);
            grantedPEId = arbResult.grantedPEId;
            stalledPEIds = arbResult.stalledPEIds;

            // Mark stalled PEs
            for (const stalledId of stalledPEIds) {
                const pe = this.pes[stalledId];
                pe.state = PEState.STALLED_BUS;
                pe.stalledCycles++;
                this.totalContentionStalls++;
                pe.lastOpDescription = 'STALLED: Waiting for Shared Memory Bus';
            }
        }

        // Step 3: Advance each PE
        let allHalted = true;
        let activeCount = 0;

        for (let i = 0; i < this.peCount; i++) {
            const pe = this.pes[i];
            const prog = this.programs[i] || [];

            if (pe.state === PEState.HALTED || pe.PC >= prog.length) {
                pe.state = PEState.HALTED;
                continue;
            }

            allHalted = false;

            // If stalled this cycle due to bus contention, do not advance
            if (stalledPEIds.includes(pe.id)) {
                continue;
            }

            // PE is active
            activeCount++;

            // Handle multi-cycle instruction progression
            if (pe.cyclesRemaining > 1) {
                pe.cyclesRemaining--;
                pe.activeCycles++;
                continue;
            }

            if (pe.cyclesRemaining === 1) {
                // Complete multi-cycle instruction
                this.completeMimdInstruction(pe, pe.currentInstruction);
                pe.activeCycles++;
                pe.instructionsExecuted++;
                pe.currentInstruction = null;
                pe.cyclesRemaining = 0;
                pe.memoryAccessRequest = null;
                continue;
            }

            // Fetch new instruction for this PE
            const instr = prog[pe.PC];
            if (!instr) {
                pe.state = PEState.HALTED;
                continue;
            }

            pe.assignInstruction(instr);

            if (instr.latency > 1) {
                pe.state = (instr.opcode === Opcode.LOAD || instr.opcode === Opcode.STORE) ? PEState.MEMORY : PEState.EXECUTE;
                pe.activeCycles++;
            } else {
                this.completeMimdInstruction(pe, instr);
                pe.activeCycles++;
                pe.instructionsExecuted++;
                pe.currentInstruction = null;
                pe.cyclesRemaining = 0;
            }
        }

        if (allHalted) {
            this.isHalted = true;
            this.currentTrace = `Cycle ${this.clockCycle}: All ${this.peCount} MIMD Cores completed their instruction streams. Execution Halted.`;
            this.traceHistory.push(this.currentTrace);
            return false;
        }

        const contentionMsg = stalledPEIds.length > 0 ? 
            ` [BUS CONTENTION: PE ${stalledPEIds.join(', ')} STALLED waiting for Shared Bus; Bus granted to PE ${grantedPEId}]` : '';

        this.currentTrace = `Cycle ${this.clockCycle}: MIMD (${this.memoryModel}) active. ${activeCount}/${this.peCount} Cores executing.${contentionMsg}`;
        this.traceHistory.push(this.currentTrace);
        return true;
    }

    /**
     * Executes instruction on specific MIMD core
     */
    completeMimdInstruction(pe, instr) {
        if (!instr) return;
        const targetMemory = (this.memoryModel === MIMDMemoryModel.DISTRIBUTED) ? this.localMemories[pe.id] : this.memory;
        const { opcode, operands } = instr;

        switch (opcode) {
            case Opcode.LOAD: {
                const dest = operands[0];
                const src = operands[1];
                if (typeof src === 'string' && src.startsWith('#')) {
                    const imm = parseInt(src.substring(1), 10);
                    pe.setRegister(dest, imm);
                    pe.lastOpDescription = `LOAD ${dest} = ${imm}`;
                } else if (typeof src === 'string' && src.startsWith('[') && src.endsWith(']')) {
                    const inner = src.slice(1, -1).trim();
                    let addr = 0;
                    if (inner.includes('+')) {
                        const parts = inner.split('+').map(p => p.trim());
                        const base = /^R[0-3]$/i.test(parts[0]) ? pe.getRegister(parts[0]) : parseInt(parts[0], 10);
                        const offset = /^R[0-3]$/i.test(parts[1]) ? pe.getRegister(parts[1]) : parseInt(parts[1], 10);
                        addr = base + offset;
                    } else if (/^R[0-3]$/i.test(inner)) {
                        addr = pe.getRegister(inner);
                    } else {
                        addr = parseInt(inner, 10);
                    }

                    const val = targetMemory.read(addr);
                    pe.setRegister(dest, val);
                    pe.lastOpDescription = `LOAD ${dest} from Mem[${addr}] = ${val}`;
                } else {
                    const val = TinyISA.parseOperand(src, pe, targetMemory);
                    pe.setRegister(dest, typeof val === 'number' ? val : 0);
                    pe.lastOpDescription = `LOAD ${dest} = ${val}`;
                }
                pe.PC++;
                break;
            }
            case Opcode.STORE: {
                const target = operands[0];
                const srcVal = TinyISA.parseOperand(operands[1], pe, targetMemory);

                if (typeof target === 'string' && target.startsWith('[') && target.endsWith(']')) {
                    const inner = target.slice(1, -1).trim();
                    let addr = 0;
                    if (inner.includes('+')) {
                        const parts = inner.split('+').map(p => p.trim());
                        const base = /^R[0-3]$/i.test(parts[0]) ? pe.getRegister(parts[0]) : parseInt(parts[0], 10);
                        const offset = /^R[0-3]$/i.test(parts[1]) ? pe.getRegister(parts[1]) : parseInt(parts[1], 10);
                        addr = base + offset;
                    } else if (/^R[0-3]$/i.test(inner)) {
                        addr = pe.getRegister(inner);
                    } else {
                        addr = parseInt(inner, 10);
                    }

                    targetMemory.write(addr, srcVal);
                    pe.lastOpDescription = `STORE ${srcVal} into Mem[${addr}]`;
                }
                pe.PC++;
                break;
            }
            case Opcode.ADD:
            case Opcode.SUB:
            case Opcode.MUL:
            case Opcode.CMP:
            case Opcode.NOP: {
                this.executeAluInstruction(pe, instr);
                pe.PC++;
                break;
            }
            case Opcode.JMP: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                pe.PC = target;
                pe.lastOpDescription = `JMP to line ${target}`;
                break;
            }
            case Opcode.BEQ: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.ZF === 1) pe.PC = target;
                else pe.PC++;
                break;
            }
            case Opcode.BNE: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.ZF === 0) pe.PC = target;
                else pe.PC++;
                break;
            }
            case Opcode.BLT: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.LT === 1) pe.PC = target;
                else pe.PC++;
                break;
            }
            case Opcode.BGT: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.GT === 1) pe.PC = target;
                else pe.PC++;
                break;
            }
            case Opcode.HALT: {
                pe.state = PEState.HALTED;
                pe.lastOpDescription = 'HALT';
                break;
            }
            default:
                pe.PC++;
                break;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIMDMemoryModel, MIMDArchitecture };
}
