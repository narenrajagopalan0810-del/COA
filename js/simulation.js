/**
 * FlynnSim - Master Simulation Controller
 * 
 * Orchestrates discrete cycle execution, clock timing, synchronous race mode,
 * speed adjustments, and telemetry callbacks across the four Flynn architectures.
 */

class SimulationController {
    constructor() {
        this.peCount = 4;
        this.architectures = {
            SISD: new SISDArchitecture(),
            SIMD: new SIMDArchitecture(this.peCount),
            MISD: new MISDArchitecture(3),
            MIMD: new MIMDArchitecture(this.peCount)
        };

        this.currentArchitectureKey = 'ALL'; // 'ALL' (Race Mode) or 'SISD', 'SIMD', 'MISD', 'MIMD'
        this.currentWorkload = null;
        this.isRunning = false;
        this.timer = null;
        this.clockSpeedHz = 4; // Default 4 cycles per second for clear visual observation

        // Telemetry & Event listeners
        this.onCycleTick = null;
        this.onSimulationHalt = null;
        this.onWorkloadLoaded = null;

        // Amdahl's Law theoretical parameter (parallel fraction p, e.g. 0.80)
        this.parallelFraction = 0.85;
    }

    setPECount(count) {
        this.peCount = Math.max(2, Math.min(16, count));
        this.architectures.SIMD.setPECount(this.peCount);
        this.architectures.MIMD.setPECount(this.peCount);
        if (this.currentWorkload) {
            this.reloadCurrentWorkload();
        }
    }

    setClockSpeed(speedHz) {
        this.clockSpeedHz = Math.max(1, Math.min(60, speedHz));
        if (this.isRunning) {
            this.pause();
            this.run();
        }
    }

    setParallelFraction(p) {
        this.parallelFraction = Math.max(0.0, Math.min(1.0, p));
    }

    /**
     * Loads a workload across all architecture instances
     */
    loadWorkload(workload) {
        this.pause();
        this.currentWorkload = workload;

        this.architectures.SISD.loadWorkload(workload);
        this.architectures.SIMD.loadWorkload(workload);
        this.architectures.MISD.loadWorkload(workload);
        this.architectures.MIMD.loadWorkload(workload);

        if (this.onWorkloadLoaded) {
            this.onWorkloadLoaded(workload);
        }
        if (this.onCycleTick) {
            this.onCycleTick(this.getAllMetrics());
        }
    }

    reloadCurrentWorkload() {
        if (!this.currentWorkload) return;
        // Re-generate workload if it depends on PE count
        if (this.currentWorkload.id === 'vector_addition') {
            const wl = WorkloadManager.createVectorAdditionWorkload(this.currentWorkload.length, this.peCount);
            this.loadWorkload(wl);
        } else if (this.currentWorkload.id === 'matrix_mult') {
            const wl = WorkloadManager.createMatrixMultiplicationWorkload(this.currentWorkload.dim, this.peCount);
            this.loadWorkload(wl);
        } else if (this.currentWorkload.id === 'conditional_filter') {
            const wl = WorkloadManager.createConditionalFilterWorkload(this.currentWorkload.length, this.peCount);
            this.loadWorkload(wl);
        } else {
            this.loadWorkload(this.currentWorkload);
        }
    }

    /**
     * Single cycle step
     */
    step() {
        if (this.currentArchitectureKey === 'ALL') {
            let anyActive = false;
            for (const key of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
                const arch = this.architectures[key];
                if (!arch.isHalted) {
                    const active = arch.step();
                    if (active) anyActive = true;
                }
            }
            if (!anyActive) {
                this.pause();
                if (this.onSimulationHalt) this.onSimulationHalt(this.getAllMetrics());
            }
        } else {
            const arch = this.architectures[this.currentArchitectureKey];
            if (!arch.isHalted) {
                const active = arch.step();
                if (!active) {
                    this.pause();
                    if (this.onSimulationHalt) this.onSimulationHalt(this.getAllMetrics());
                }
            }
        }

        if (this.onCycleTick) {
            this.onCycleTick(this.getAllMetrics());
        }
    }

    /**
     * Continuous run
     */
    run() {
        if (this.isRunning) return;
        this.isRunning = true;
        const intervalMs = Math.floor(1000 / this.clockSpeedHz);

        this.timer = setInterval(() => {
            let allDone = true;
            if (this.currentArchitectureKey === 'ALL') {
                for (const key of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
                    const arch = this.architectures[key];
                    if (!arch.isHalted) {
                        arch.step();
                        allDone = false;
                    }
                }
            } else {
                const arch = this.architectures[this.currentArchitectureKey];
                if (!arch.isHalted) {
                    arch.step();
                    allDone = false;
                }
            }

            if (this.onCycleTick) {
                this.onCycleTick(this.getAllMetrics());
            }

            if (allDone) {
                this.pause();
                if (this.onSimulationHalt) this.onSimulationHalt(this.getAllMetrics());
            }
        }, intervalMs);
    }

    /**
     * Run to completion at max speed (useful for generating graphs & Amdahl curves)
     */
    runFastToCompletion() {
        this.pause();
        const maxLimit = 10000;
        let cycles = 0;
        let anyActive = true;

        while (anyActive && cycles < maxLimit) {
            anyActive = false;
            for (const key of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
                const arch = this.architectures[key];
                if (!arch.isHalted) {
                    arch.step();
                    anyActive = true;
                }
            }
            cycles++;
        }

        if (this.onCycleTick) {
            this.onCycleTick(this.getAllMetrics());
        }
        if (this.onSimulationHalt) {
            this.onSimulationHalt(this.getAllMetrics());
        }
    }

    pause() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    reset() {
        this.pause();
        for (const key of Object.keys(this.architectures)) {
            this.architectures[key].reset();
        }
        if (this.currentWorkload) {
            this.loadWorkload(this.currentWorkload);
        }
    }

    /**
     * Computes metrics across all architectures with SISD as speedup baseline
     */
    getAllMetrics() {
        const sisdCycles = this.architectures.SISD.clockCycle;
        const metrics = {};
        for (const key of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
            metrics[key] = this.architectures[key].getMetrics(sisdCycles);
        }

        // Amdahl's Law predicted speedup
        // S(N) = 1 / ((1 - p) + (p / N))
        const p = this.parallelFraction;
        const s = 1.0 - p;
        const amdahlSpeedup = (1.0 / (s + (p / this.peCount))).toFixed(2);

        return {
            metrics,
            peCount: this.peCount,
            parallelFraction: this.parallelFraction,
            amdahlSpeedup: Number(amdahlSpeedup),
            currentArchitectureKey: this.currentArchitectureKey,
            isRunning: this.isRunning,
            workload: this.currentWorkload
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SimulationController };
}
