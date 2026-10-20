/**
 * FlynnSim - SISD Architecture (Single Instruction, Single Data)
 * 
 * The classic Von Neumann uniprocessor:
 * - 1 Central Control Unit (CU)
 * - 1 Processing Element (PE 0)
 * - 1 Instruction Stream flowing from instruction memory to CU
 * - 1 Data Stream flowing between data memory and PE
 */

class SISDArchitecture extends BaseArchitecture {
    constructor() {
        super('SISD', 1);
        this.program = [];
    }

    loadWorkload(workload) {
        this.reset();
        this.workloadMeta = workload;
        this.program = workload.sisdProgram ? workload.sisdProgram.instructions : [];
        if (workload.initialMemory) {
            this.memory.loadBlock(0, workload.initialMemory);
        }
    }

    step() {
        if (this.isHalted) return false;

        this.clockCycle++;
        const pe = this.pes[0];

        // Check if program finished
        if (pe.PC >= this.program.length) {
            pe.state = PEState.HALTED;
            this.isHalted = true;
            this.currentTrace = `Cycle ${this.clockCycle}: Program Counter reached end of code. SISD Execution Halted.`;
            this.traceHistory.push(this.currentTrace);
            return false;
        }

        // If PE is in the middle of a multi-cycle instruction
        if (pe.cyclesRemaining > 1) {
            pe.cyclesRemaining--;
            pe.activeCycles++;
            const instr = pe.currentInstruction;
            this.currentTrace = `Cycle ${this.clockCycle}: PE0 executing [${instr.raw}] (${pe.cyclesRemaining} cycle left). State: ${pe.state}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        }

        // If PE was finishing a multi-cycle instruction
        if (pe.cyclesRemaining === 1) {
            this.completeInstruction(pe);
            pe.activeCycles++;
            pe.instructionsExecuted++;

            // Check if just halted
            if (pe.state === PEState.HALTED) {
                this.isHalted = true;
                this.currentTrace = `Cycle ${this.clockCycle}: PE0 completed HALT. Execution Finished.`;
                this.traceHistory.push(this.currentTrace);
                return false;
            }

            // Ready for next instruction
            pe.currentInstruction = null;
            pe.cyclesRemaining = 0;
            this.currentTrace = `Cycle ${this.clockCycle}: PE0 completed instruction. ${pe.lastOpDescription}. Next PC: ${pe.PC}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        }

        // Start new instruction fetch & decode
        const instr = this.program[pe.PC];
        if (!instr) {
            pe.state = PEState.HALTED;
            this.isHalted = true;
            return false;
        }

        pe.assignInstruction(instr);

        if (instr.latency > 1) {
            // Multi-cycle instruction initiated (e.g. LOAD, STORE, MUL)
            pe.state = (instr.opcode === Opcode.LOAD || instr.opcode === Opcode.STORE) ? PEState.MEMORY : PEState.EXECUTE;
            pe.activeCycles++;
            this.currentTrace = `Cycle ${this.clockCycle}: CU fetched [${instr.raw}]. PE0 begins execution (${instr.latency} cycles total).`;
            this.traceHistory.push(this.currentTrace);
            return true;
        } else {
            // Single cycle instruction completes immediately this cycle
            this.completeInstruction(pe);
            pe.activeCycles++;
            pe.instructionsExecuted++;

            if (pe.state === PEState.HALTED) {
                this.isHalted = true;
                this.currentTrace = `Cycle ${this.clockCycle}: PE0 executed HALT. Finished.`;
                this.traceHistory.push(this.currentTrace);
                return false;
            }

            pe.currentInstruction = null;
            pe.cyclesRemaining = 0;
            this.currentTrace = `Cycle ${this.clockCycle}: PE0 executed [${instr.raw}]. ${pe.lastOpDescription}.`;
            this.traceHistory.push(this.currentTrace);
            return true;
        }
    }

    /**
     * Executes instruction effect and advances PC
     */
    completeInstruction(pe) {
        const instr = pe.currentInstruction;
        if (!instr) return;

        const { opcode, operands } = instr;

        switch (opcode) {
            case Opcode.LOAD: {
                const dest = operands[0];
                const src = operands[1];
                if (typeof src === 'string' && src.startsWith('#')) {
                    const imm = parseInt(src.substring(1), 10);
                    pe.setRegister(dest, imm);
                    pe.lastOpDescription = `LOAD ${dest} = immediate ${imm}`;
                } else if (typeof src === 'number') {
                    // Direct address or imm
                    pe.setRegister(dest, src);
                    pe.lastOpDescription = `LOAD ${dest} = ${src}`;
                } else {
                    const ref = TinyISA.parseOperand(src, pe, this.memory);
                    if (ref && ref.isMemoryRef) {
                        const val = this.memory.read(ref.address);
                        pe.setRegister(dest, val);
                        pe.lastOpDescription = `LOAD ${dest} from Memory[${ref.address}] = ${val}`;
                    } else if (typeof ref === 'number') {
                        pe.setRegister(dest, ref);
                        pe.lastOpDescription = `LOAD ${dest} = ${ref}`;
                    }
                }
                pe.PC++;
                break;
            }
            case Opcode.STORE: {
                const targetRef = TinyISA.parseOperand(operands[0], pe, this.memory);
                const srcVal = TinyISA.parseOperand(operands[1], pe, this.memory);
                if (targetRef && targetRef.isMemoryRef) {
                    this.memory.write(targetRef.address, srcVal);
                    pe.lastOpDescription = `STORE ${srcVal} into Memory[${targetRef.address}]`;
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
                if (pe.ZF === 1) {
                    pe.PC = target;
                    pe.lastOpDescription = `BEQ taken to line ${target} (ZF=1)`;
                } else {
                    pe.PC++;
                    pe.lastOpDescription = `BEQ not taken (ZF=0)`;
                }
                break;
            }
            case Opcode.BNE: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.ZF === 0) {
                    pe.PC = target;
                    pe.lastOpDescription = `BNE taken to line ${target} (ZF=0)`;
                } else {
                    pe.PC++;
                    pe.lastOpDescription = `BNE not taken (ZF=1)`;
                }
                break;
            }
            case Opcode.BLT: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.LT === 1) {
                    pe.PC = target;
                    pe.lastOpDescription = `BLT taken to line ${target} (LT=1)`;
                } else {
                    pe.PC++;
                    pe.lastOpDescription = `BLT not taken`;
                }
                break;
            }
            case Opcode.BGT: {
                const target = typeof operands[0] === 'number' ? operands[0] : parseInt(operands[0], 10);
                if (pe.GT === 1) {
                    pe.PC = target;
                    pe.lastOpDescription = `BGT taken to line ${target} (GT=1)`;
                } else {
                    pe.PC++;
                    pe.lastOpDescription = `BGT not taken`;
                }
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
    module.exports = { SISDArchitecture };
}
