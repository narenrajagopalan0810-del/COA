/**
 * FlynnSim - SIMD Architecture (Single Instruction, Multiple Data)
 * 
 * Vector / Data-Parallel Processing Model:
 * - 1 Central Master Control Unit (CU) broadcasting a single instruction
 * - N Processing Elements (PEs: 2 to 16) executing in strict lockstep
 * - N distinct Data Streams (each PE operates on its assigned vector slice)
 * - Predication / Masking: Demonstrates branch divergence cost in GPUs & vector units
 */

class SIMDArchitecture extends BaseArchitecture {
    /**
     * @param {number} peCount - Number of lockstep PEs (default 4)
     */
    constructor(peCount = 4) {
        super('SIMD', peCount);
        this.masterPC = 0;
        this.program = [];
        this.divergenceStalls = 0;
    }

    reset() {
        super.reset();
        this.masterPC = 0;
        this.divergenceStalls = 0;
    }

    loadWorkload(workload) {
        this.reset();
        this.workloadMeta = workload;
        this.program = workload.simdProgram ? workload.simdProgram.instructions : [];
        if (workload.initialMemory) {
            this.memory.loadBlock(0, workload.initialMemory);
        }
    }

    step() {
        if (this.isHalted) return false;

        this.clockCycle++;

        if (this.masterPC >= this.program.length) {
            for (const pe of this.pes) {
                pe.state = PEState.HALTED;
            }
            this.isHalted = true;
            this.currentTrace = `Cycle ${this.clockCycle}: SIMD Master CU reached end of program. All ${this.peCount} PEs Halted.`;
            this.traceHistory.push(this.currentTrace);
            return false;
        }

        // Check if all PEs are currently finishing a multi-cycle instruction
        const masterPE = this.pes[0]; // All PEs in lockstep share the same remaining cycles

        if (masterPE.cyclesRemaining > 1) {
            let activeCount = 0;
            for (const pe of this.pes) {
                pe.cyclesRemaining--;
                if (pe.mask && pe.state !== PEState.HALTED) {
                    pe.activeCycles++;
                    activeCount++;
                } else {
                    pe.stalledCycles++;
                    this.divergenceStalls++;
                }
            }
            const instr = masterPE.currentInstruction;
            this.currentTrace = `Cycle ${this.clockCycle}: SIMD Broadcast [${instr.raw}] in progress (${masterPE.cyclesRemaining} cycles left). Active PEs: ${activeCount}/${this.peCount}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        }

        if (masterPE.cyclesRemaining === 1) {
            const instr = masterPE.currentInstruction;
            // Complete multi-cycle instruction across all PEs
            let activeCount = 0;
            for (const pe of this.pes) {
                if (pe.mask && pe.state !== PEState.HALTED) {
                    this.completeSimdInstruction(pe, instr);
                    pe.activeCycles++;
                    pe.instructionsExecuted++;
                    activeCount++;
                } else {
                    pe.stalledCycles++;
                    this.divergenceStalls++;
                }
                pe.currentInstruction = null;
                pe.cyclesRemaining = 0;
            }

            // Master CU advances PC regardless of PE 0 mask status
            this.handleMasterControlFlow(instr);

            // Check if HALT was executed
            if (masterPE.state === PEState.HALTED) {
                this.isHalted = true;
                this.currentTrace = `Cycle ${this.clockCycle}: SIMD HALT completed. All PEs finished.`;
                this.traceHistory.push(this.currentTrace);
                return false;
            }

            this.currentTrace = `Cycle ${this.clockCycle}: SIMD completed [${instr.raw}]. Active PEs: ${activeCount}/${this.peCount}. Next Master PC: ${this.masterPC}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        }

        // Fetch & broadcast new instruction from Master CU
        const instr = this.program[this.masterPC];
        if (!instr) {
            this.isHalted = true;
            return false;
        }

        const isMaskOp = (instr.opcode === Opcode.MASK_EVAL || 
                          instr.opcode === Opcode.MASK_INVERT || 
                          instr.opcode === Opcode.MASK_RESET);

        // Assign instruction to all PEs
        for (const pe of this.pes) {
            pe.assignInstruction(instr);
            if (!pe.mask && !isMaskOp) {
                pe.state = PEState.STALLED_MASK;
            }
        }

        if (instr.latency > 1) {
            // Multi-cycle broadcast initiated
            let activeCount = 0;
            for (const pe of this.pes) {
                if ((pe.mask || isMaskOp) && pe.state !== PEState.HALTED) {
                    pe.state = (instr.opcode === Opcode.LOAD || instr.opcode === Opcode.STORE) ? PEState.MEMORY : PEState.EXECUTE;
                    pe.activeCycles++;
                    activeCount++;
                } else {
                    pe.stalledCycles++;
                    this.divergenceStalls++;
                }
            }
            this.currentTrace = `Cycle ${this.clockCycle}: Master CU broadcast [${instr.raw}] to all PEs (${instr.latency} cycles). Active: ${activeCount}/${this.peCount}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        } else {
            // Single-cycle instruction completes this cycle
            let activeCount = 0;
            for (const pe of this.pes) {
                if ((pe.mask || isMaskOp) && pe.state !== PEState.HALTED) {
                    this.completeSimdInstruction(pe, instr);
                    pe.activeCycles++;
                    pe.instructionsExecuted++;
                    activeCount++;
                } else {
                    pe.stalledCycles++;
                    this.divergenceStalls++;
                }
                pe.currentInstruction = null;
                pe.cyclesRemaining = 0;
            }

            // Master CU advances PC
            this.handleMasterControlFlow(instr);

            if (masterPE.state === PEState.HALTED) {
                this.isHalted = true;
                this.currentTrace = `Cycle ${this.clockCycle}: SIMD HALT executed. Finished.`;
                this.traceHistory.push(this.currentTrace);
                return false;
            }

            this.currentTrace = `Cycle ${this.clockCycle}: Master CU executed [${instr.raw}]. Active PEs: ${activeCount}/${this.peCount}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        }
    }

    /**
     * Executes the broadcast instruction on a specific PE
     */
    completeSimdInstruction(pe, instr) {
        const { opcode, operands } = instr;

        switch (opcode) {
            case Opcode.LOAD: {
                // In SIMD, operands can be parameterized by PE id, e.g. LOAD R0, [R1 + PE_ID]
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
                        const offset = (parts[1].toUpperCase() === 'PE_ID') ? pe.id : 
                                       (/^R[0-3]$/i.test(parts[1]) ? pe.getRegister(parts[1]) : parseInt(parts[1], 10));
                        addr = base + offset;
                    } else if (inner.toUpperCase() === 'PE_ID') {
                        addr = pe.id;
                    } else if (/^R[0-3]$/i.test(inner)) {
                        addr = pe.getRegister(inner);
                    } else {
                        addr = parseInt(inner, 10) + pe.id;
                    }

                    const val = this.memory.read(addr);
                    pe.setRegister(dest, val);
                    pe.lastOpDescription = `LOAD ${dest} from Mem[${addr}] = ${val}`;
                } else {
                    const val = TinyISA.parseOperand(src, pe, this.memory);
                    pe.setRegister(dest, typeof val === 'number' ? val : 0);
                    pe.lastOpDescription = `LOAD ${dest} = ${val}`;
                }
                break;
            }
            case Opcode.STORE: {
                const target = operands[0];
                const srcVal = TinyISA.parseOperand(operands[1], pe, this.memory);

                if (typeof target === 'string' && target.startsWith('[') && target.endsWith(']')) {
                    const inner = target.slice(1, -1).trim();
                    let addr = 0;
                    if (inner.includes('+')) {
                        const parts = inner.split('+').map(p => p.trim());
                        const base = /^R[0-3]$/i.test(parts[0]) ? pe.getRegister(parts[0]) : parseInt(parts[0], 10);
                        const offset = (parts[1].toUpperCase() === 'PE_ID') ? pe.id :
                                       (/^R[0-3]$/i.test(parts[1]) ? pe.getRegister(parts[1]) : parseInt(parts[1], 10));
                        addr = base + offset;
                    } else if (inner.toUpperCase() === 'PE_ID') {
                        addr = pe.id;
                    } else if (/^R[0-3]$/i.test(inner)) {
                        addr = pe.getRegister(inner);
                    } else {
                        addr = parseInt(inner, 10) + pe.id;
                    }

                    this.memory.write(addr, srcVal);
                    pe.lastOpDescription = `STORE ${srcVal} into Mem[${addr}]`;
                }
                break;
            }
            case Opcode.ADD:
            case Opcode.SUB:
            case Opcode.MUL:
            case Opcode.CMP:
            case Opcode.NOP: {
                this.executeAluInstruction(pe, instr);
                break;
            }
            // SIMD Predication / Masking Control
            case Opcode.MASK_EVAL: {
                // Evaluates condition on PE; sets mask
                // e.g., MASK_EVAL GT (active if GT=1), or MASK_EVAL LT, or MASK_EVAL PE_LT #imm
                const cond = operands[0].toUpperCase();
                let isActive = true;
                if (cond === 'GT') isActive = (pe.GT === 1);
                else if (cond === 'LT') isActive = (pe.LT === 1);
                else if (cond === 'EQ' || cond === 'ZF') isActive = (pe.ZF === 1);
                else if (cond === 'NE') isActive = (pe.ZF === 0);
                else if (cond === 'PE_LT') {
                    // Used for tail masking when vector length % peCount != 0!
                    const limit = TinyISA.parseOperand(operands[1], pe, this.memory);
                    isActive = (pe.id < limit);
                }
                pe.setMask(isActive);
                pe.lastOpDescription = `MASK_EVAL ${cond}: ${isActive ? 'Active (mask=1)' : 'Diverged (mask=0)'}`;
                break;
            }
            case Opcode.MASK_INVERT: {
                // Inverts mask for ELSE clause execution
                pe.setMask(!pe.mask);
                pe.lastOpDescription = `MASK_INVERT: ${pe.mask ? 'Active (mask=1)' : 'Diverged (mask=0)'}`;
                break;
            }
            case Opcode.MASK_RESET: {
                pe.setMask(true);
                pe.state = PEState.IDLE;
                pe.lastOpDescription = `MASK_RESET: All PEs Active`;
                break;
            }
            case Opcode.HALT: {
                pe.state = PEState.HALTED;
                pe.lastOpDescription = 'HALT';
                break;
            }
            default:
                break;
        }
    }

    handleMasterControlFlow(instr) {
        const { opcode, operands } = instr;
        switch (opcode) {
            case Opcode.JMP: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                this.masterPC = target;
                break;
            }
            case Opcode.BEQ: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                // Check if loop condition on master PE is satisfied
                if (this.pes[0].ZF === 1) {
                    this.masterPC = target;
                } else {
                    this.masterPC++;
                }
                break;
            }
            case Opcode.BNE: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (this.pes[0].ZF === 0) {
                    this.masterPC = target;
                } else {
                    this.masterPC++;
                }
                break;
            }
            case Opcode.BLT: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (this.pes[0].LT === 1) {
                    this.masterPC = target;
                } else {
                    this.masterPC++;
                }
                break;
            }
            case Opcode.BGT: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (this.pes[0].GT === 1) {
                    this.masterPC = target;
                } else {
                    this.masterPC++;
                }
                break;
            }
            default:
                this.masterPC++;
                break;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SIMDArchitecture };
}
