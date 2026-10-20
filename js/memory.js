/**
 * FlynnSim - Memory Subsystem & Bus Contention Arbiter
 * 
 * Supports:
 * - Linear word-addressable storage
 * - Dedicated memory banks for SIMD vector access
 * - Shared Memory Bus with Round-Robin arbitration & contention stall tracking for MIMD (SMP)
 * - Distributed private memories for MIMD (Cluster)
 */

class MemorySystem {
    /**
     * @param {number} size - Number of word locations (default 256)
     */
    constructor(size = 256) {
        this.size = size;
        this.data = new Int32Array(size);
        this.reset();
        
        // Bus contention telemetry
        this.busBusy = false;
        this.busGrantee = null;
        this.contentionCycles = 0;
        this.pendingRequests = [];
        this.lastGrantedPE = -1; // For Round-Robin arbitration
    }

    reset() {
        this.data.fill(0);
        this.busBusy = false;
        this.busGrantee = null;
        this.contentionCycles = 0;
        this.pendingRequests = [];
        this.lastGrantedPE = -1;
    }

    read(address) {
        if (address < 0 || address >= this.size) {
            console.warn(`Memory read out of bounds: address ${address}`);
            return 0;
        }
        return this.data[address];
    }

    write(address, value) {
        if (address < 0 || address >= this.size) {
            console.warn(`Memory write out of bounds: address ${address}`);
            return;
        }
        this.data[address] = Math.floor(value);
    }

    loadBlock(startAddress, values) {
        for (let i = 0; i < values.length; i++) {
            if (startAddress + i < this.size) {
                this.data[startAddress + i] = values[i];
            }
        }
    }

    readBlock(startAddress, length) {
        const result = [];
        for (let i = 0; i < length; i++) {
            if (startAddress + i < this.size) {
                result.push(this.data[startAddress + i]);
            }
        }
        return result;
    }

    /**
     * Shared Bus Arbitration for MIMD Shared Memory
     * Called at the start of each clock cycle.
     * Evaluates all PEs requesting memory access in the current cycle.
     * Grants access to ONE PE using Round-Robin fairness, stalling the others.
     * 
     * @param {Array<ProcessingElement>} PEs
     * @returns {Object} { grantedPEId: number|null, stalledPEIds: number[] }
     */
    arbitrateBus(PEs) {
        // Collect all PEs that have a pending memory access this cycle
        const requestingPEs = PEs.filter(pe => pe.memoryAccessRequest !== null);

        if (requestingPEs.length === 0) {
            this.busBusy = false;
            this.busGrantee = null;
            return { grantedPEId: null, stalledPEIds: [] };
        }

        if (requestingPEs.length === 1) {
            // No contention
            const winner = requestingPEs[0];
            this.busBusy = true;
            this.busGrantee = winner.id;
            this.lastGrantedPE = winner.id;
            return { grantedPEId: winner.id, stalledPEIds: [] };
        }

        // Multiple PEs requesting simultaneous access -> CONTENTION!
        this.busBusy = true;
        this.contentionCycles += (requestingPEs.length - 1);

        // Round-robin selection: pick the first PE whose ID > lastGrantedPE
        let winner = requestingPEs.find(pe => pe.id > this.lastGrantedPE);
        if (!winner) {
            // Wrap around
            winner = requestingPEs[0];
        }

        this.busGrantee = winner.id;
        this.lastGrantedPE = winner.id;

        const stalledPEIds = requestingPEs
            .filter(pe => pe.id !== winner.id)
            .map(pe => pe.id);

        return { grantedPEId: winner.id, stalledPEIds };
    }
}

// Export for module/global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MemorySystem };
}
