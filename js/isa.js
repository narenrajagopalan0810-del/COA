/**
 * FlynnSim - Instruction Set Architecture (TinyISA)
 * 
 * Defines the instruction set, opcodes, operand types, and cycle latencies
 * for the FlynnSim computer organization simulation.
 */

const Opcode = {
    // Memory instructions
    LOAD: 'LOAD',       // LOAD Rd, [Addr]  or LOAD Rd, #imm   (2 cycles)
    STORE: 'STORE',     // STORE [Addr], Rs                    (2 cycles)
    
    // Arithmetic & Logic (ALU)
    ADD: 'ADD',         // ADD Rd, Rs, Rt   or ADD Rd, Rs, #imm (1 cycle)
    SUB: 'SUB',         // SUB Rd, Rs, Rt   or SUB Rd, Rs, #imm (1 cycle)
    MUL: 'MUL',         // MUL Rd, Rs, Rt   or MUL Rd, Rs, #imm (2 cycles)
    CMP: 'CMP',         // CMP Rs, Rt       or CMP Rs, #imm     (1 cycle: sets ZF, GT, LT)
    
    // Control flow
    JMP: 'JMP',         // JMP Target                           (1 cycle)
    BEQ: 'BEQ',         // BEQ Target (branch if equal / ZF=1)  (1 cycle)
    BNE: 'BNE',         // BNE Target (branch if not equal)     (1 cycle)
    BLT: 'BLT',         // BLT Target (branch if less than)     (1 cycle)
    BGT: 'BGT',         // BGT Target (branch if greater than)  (1 cycle)
    
    // SIMD Predication / Masking
    MASK_EVAL: 'MASK_EVAL',     // MASK_EVAL cond, Rs, Rt (PE evaluates condition; sets mask=1 if true, 0 if false)
    MASK_INVERT: 'MASK_INVERT', // MASK_INVERT (inverts mask flag for ELSE clause)
    MASK_RESET: 'MASK_RESET',   // MASK_RESET (resets mask flag to 1 for all PEs)
    
    // Miscellaneous
    NOP: 'NOP',         // NOP (1 cycle)
    HALT: 'HALT'        // HALT (ends execution on this PE/CU)
};

// Cycle latencies per instruction
const InstructionLatency = {
    [Opcode.LOAD]: 2,
    [Opcode.STORE]: 2,
    [Opcode.ADD]: 1,
    [Opcode.SUB]: 1,
    [Opcode.MUL]: 2,
    [Opcode.CMP]: 1,
    [Opcode.JMP]: 1,
    [Opcode.BEQ]: 1,
    [Opcode.BNE]: 1,
    [Opcode.BLT]: 1,
    [Opcode.BGT]: 1,
    [Opcode.MASK_EVAL]: 1,
    [Opcode.MASK_INVERT]: 1,
    [Opcode.MASK_RESET]: 1,
    [Opcode.NOP]: 1,
    [Opcode.HALT]: 1
};

/**
 * Representation of a single parsed assembly instruction
 */
class Instruction {
    constructor(opcode, operands = [], label = null, raw = '') {
        this.opcode = opcode.toUpperCase();
        this.operands = operands;
        this.label = label;
        this.raw = raw || `${opcode} ${operands.join(', ')}`;
        this.latency = InstructionLatency[this.opcode] || 1;
    }

    toString() {
        return this.raw;
    }
}

/**
 * Assembler & Parser for TinyISA
 */
class TinyISA {
    /**
     * Parses assembly source text into an array of Instruction objects
     * Resolves labels and validates operands.
     */
    static assemble(sourceText) {
        const lines = sourceText.split('\n');
        const instructions = [];
        const labelMap = {};

        // Pass 1: Collect labels and strip comments/empty lines
        const cleaned = [];
        for (let line of lines) {
            line = line.trim();
            // Remove comments (support ; and //)
            const commentIdx = line.search(/;|(\/\/)/);
            if (commentIdx !== -1) {
                line = line.substring(0, commentIdx).trim();
            }
            if (!line) continue;

            // Check for label definition e.g. "LOOP:" or "LOOP: ADD R0, R1, R2"
            if (line.includes(':')) {
                const parts = line.split(':');
                const label = parts[0].trim();
                const remainder = parts.slice(1).join(':').trim();
                labelMap[label] = cleaned.length;
                if (remainder) {
                    cleaned.push({ raw: remainder, label });
                }
            } else {
                cleaned.push({ raw: line, label: null });
            }
        }

        // Pass 2: Parse instructions and resolve targets
        for (let i = 0; i < cleaned.length; i++) {
            const item = cleaned[i];
            const tokens = item.raw.match(/\[[^\]]+\]|[^\s,]+/g) || [];
            if (tokens.length === 0) continue;

            const opcode = tokens[0].toUpperCase();
            if (!Opcode[opcode]) {
                throw new Error(`Line ${i + 1}: Unknown opcode '${opcode}' in instruction "${item.raw}"`);
            }

            const operands = tokens.slice(1).map(op => {
                // If operand matches a known label, substitute target address index
                if (labelMap[op] !== undefined) {
                    return labelMap[op];
                }
                return op;
            });

            const instr = new Instruction(opcode, operands, item.label, item.raw);
            instructions.push(instr);
        }

        return { instructions, labelMap };
    }

    /**
     * Helper to parse an immediate value or register value
     */
    static parseOperand(operand, pe, memory) {
        if (typeof operand === 'number') {
            return operand;
        }
        if (typeof operand === 'string') {
            operand = operand.trim();
            // Immediate: #10 or 10
            if (operand.startsWith('#')) {
                return parseInt(operand.substring(1), 10);
            }
            if (/^-?\d+$/.test(operand)) {
                return parseInt(operand, 10);
            }
            // Register: R0, R1, R2, R3
            if (/^R[0-3]$/i.test(operand)) {
                return pe.getRegister(operand.toUpperCase());
            }
            // Memory address dereference: [100] or [R0] or [10 + PE_ID] or [R0 + 2]
            if (operand.startsWith('[') && operand.endsWith(']')) {
                const inner = operand.slice(1, -1).trim();
                let addr = 0;
                if (inner.includes('+')) {
                    const parts = inner.split('+').map(p => p.trim());
                    const base = /^R[0-3]$/i.test(parts[0]) ? pe.getRegister(parts[0]) : parseInt(parts[0], 10);
                    const offset = /^R[0-3]$/i.test(parts[1]) ? pe.getRegister(parts[1]) :
                                   (parts[1].toUpperCase() === 'PE_ID' ? pe.id : parseInt(parts[1], 10));
                    addr = base + offset;
                } else if (/^R[0-3]$/i.test(inner)) {
                    addr = pe.getRegister(inner.toUpperCase());
                } else if (inner.toUpperCase() === 'PE_ID') {
                    addr = pe.id;
                } else {
                    addr = parseInt(inner, 10);
                }
                return { isMemoryRef: true, address: addr };
            }
        }
        return operand;
    }
}

// Export for browser module or global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Opcode, InstructionLatency, Instruction, TinyISA };
}
