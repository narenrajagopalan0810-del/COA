/**
 * FlynnSim - Architecture Visualizer Engine
 * 
 * Renders live interactive diagrams of Control Units, Processing Elements,
 * Memory Banks, Instruction Streams (purple), and Data Streams (emerald)
 * with real-time state highlights, stalls, and bus arbitration indicators.
 */

class Visualizer {
    /**
     * @param {SimulationController} controller
     */
    constructor(controller) {
        this.controller = controller;
    }

    /**
     * Main render entrypoint: updates either the 4-panel race grid or focused single view
     */
    render(state) {
        const { metrics, currentArchitectureKey } = state;

        if (currentArchitectureKey === 'ALL') {
            // Render all 4 panels in the split grid
            this.renderArchitecturePanel('SISD', this.controller.architectures.SISD, metrics.SISD);
            this.renderArchitecturePanel('SIMD', this.controller.architectures.SIMD, metrics.SIMD);
            this.renderArchitecturePanel('MISD', this.controller.architectures.MISD, metrics.MISD);
            this.renderArchitecturePanel('MIMD', this.controller.architectures.MIMD, metrics.MIMD);
        } else {
            // Focus on single architecture
            const arch = this.controller.architectures[currentArchitectureKey];
            const archMetric = metrics[currentArchitectureKey];
            this.renderArchitecturePanel(currentArchitectureKey, arch, archMetric, true);
        }

        // Update cycle trace narrative box
        this.updateTraceLog(currentArchitectureKey);
    }

    /**
     * Renders an individual architecture panel
     */
    renderArchitecturePanel(key, arch, metric, isFocused = false) {
        const containers = [
            document.getElementById(`panel-${key.toLowerCase()}`),
            document.getElementById(`focus-panel-${key.toLowerCase()}`)
        ].filter(Boolean);

        if (containers.length === 0) return;

        for (const container of containers) {
            // If focus panel is empty, build structure
            if (!container.querySelector('.diagram-container')) {
                container.innerHTML = `
                    <div class="card-header header-${key.toLowerCase()}">
                        <div class="card-title">
                            <span class="badge-acronym">${key}</span>
                            <h3>${arch.name} Architecture</h3>
                        </div>
                        <span class="arch-status-badge status-idle">IDLE</span>
                    </div>
                    <div class="card-metrics-bar">
                        <div class="metric-item"><span class="m-lbl">Cycles:</span> <strong class="metric-cycles">0</strong></div>
                        <div class="metric-item"><span class="m-lbl">Instr:</span> <strong class="metric-instrs">0</strong></div>
                        <div class="metric-item"><span class="m-lbl">Util:</span> <strong class="metric-util">0%</strong></div>
                        <div class="metric-item"><span class="m-lbl">Speedup:</span> <strong class="metric-speedup">1.0x</strong></div>
                    </div>
                    <div class="diagram-container"></div>
                    <div class="pe-grid-container"></div>
                `;
            }

            // Header telemetry badges
            const cyclesEl = container.querySelector('.metric-cycles');
            const instrsEl = container.querySelector('.metric-instrs');
            const utilEl = container.querySelector('.metric-util');
            const speedupEl = container.querySelector('.metric-speedup');
            const statusBadge = container.querySelector('.arch-status-badge');

            if (cyclesEl) cyclesEl.textContent = metric.cycles;
            if (instrsEl) instrsEl.textContent = metric.instructions;
            if (utilEl) utilEl.textContent = `${metric.utilization}%`;
            if (speedupEl) speedupEl.textContent = `${metric.speedup}x`;

            if (statusBadge) {
                if (metric.isHalted) {
                    statusBadge.className = 'arch-status-badge status-halted';
                    statusBadge.textContent = 'HALTED';
                } else if (metric.cycles > 0) {
                    statusBadge.className = 'arch-status-badge status-running';
                    statusBadge.textContent = 'RUNNING';
                } else {
                    statusBadge.className = 'arch-status-badge status-idle';
                    statusBadge.textContent = 'IDLE';
                }
            }

            // Architecture Diagram Container
            const diagramEl = container.querySelector('.diagram-container');
            if (diagramEl) {
                switch (key) {
                    case 'SISD':
                        diagramEl.innerHTML = this.buildSISDDiagram(arch);
                        break;
                    case 'SIMD':
                        diagramEl.innerHTML = this.buildSIMDDiagram(arch);
                        break;
                    case 'MISD':
                        diagramEl.innerHTML = this.buildMISDDiagram(arch);
                        break;
                    case 'MIMD':
                        diagramEl.innerHTML = this.buildMIMDDiagram(arch);
                        break;
                }
            }

            // Render PE detail cards (Registers, PC, Flags)
            const peContainer = container.querySelector('.pe-grid-container');
            if (peContainer) {
                peContainer.innerHTML = this.buildPEGridHTML(arch);
            }
        }
    }

    /**
     * Builds interactive visual diagram for SISD
     */
    buildSISDDiagram(arch) {
        const pe = arch.pes[0];
        const isExecuting = pe.state === PEState.EXECUTE || pe.state === PEState.MEMORY;
        const currentInstr = pe.currentInstruction ? pe.currentInstruction.raw : (pe.state === PEState.HALTED ? 'HALT' : 'NOP');

        return `
        <div class="arch-schematic sisd-schematic">
            <div class="legend-bar">
                <span class="legend-item"><span class="legend-dot dot-instr"></span> 1 Instruction Stream</span>
                <span class="legend-item"><span class="legend-dot dot-data"></span> 1 Data Stream</span>
                <span class="legend-item"><span class="legend-dot dot-cu"></span> 1 Control Unit</span>
            </div>

            <div class="schematic-flow-row">
                <!-- Instruction Memory & Control Unit -->
                <div class="hardware-block cu-block ${isExecuting ? 'pulse-amber' : ''}">
                    <div class="block-title">Control Unit (CU)</div>
                    <div class="block-sub">PC: ${pe.PC}</div>
                    <div class="instr-preview">${currentInstr}</div>
                </div>

                <!-- Instruction Stream Arrow -->
                <div class="stream-connector stream-instruction ${isExecuting ? 'flow-active' : ''}">
                    <div class="stream-line line-instruction"></div>
                    <div class="stream-label">Instruction Stream</div>
                    <div class="stream-particle particle-purple"></div>
                </div>

                <!-- Processing Element -->
                <div class="hardware-block pe-block ${this.getPEStateClass(pe)}">
                    <div class="block-title">PE 0 (Core/ALU)</div>
                    <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                    <div class="pe-op-desc">${pe.lastOpDescription}</div>
                </div>

                <!-- Data Stream Arrow -->
                <div class="stream-connector stream-data ${pe.state === PEState.MEMORY ? 'flow-active' : ''}">
                    <div class="stream-line line-data"></div>
                    <div class="stream-label">Data Stream</div>
                    <div class="stream-particle particle-emerald"></div>
                </div>

                <!-- Data Memory -->
                <div class="hardware-block mem-block">
                    <div class="block-title">Data Memory</div>
                    <div class="block-sub">Unified 256 Words</div>
                    <div class="mem-preview">Base: [${arch.memory.read(10)}, ${arch.memory.read(11)}, ...]</div>
                </div>
            </div>
        </div>
        `;
    }

    /**
     * Builds interactive visual diagram for SIMD
     */
    buildSIMDDiagram(arch) {
        const masterInstr = arch.pes[0].currentInstruction ? arch.pes[0].currentInstruction.raw : 
                           (arch.isHalted ? 'HALT' : 'NOP');
        const activePEs = arch.pes.filter(p => p.mask && p.state !== PEState.HALTED).length;

        let peBoxesHTML = '';
        arch.pes.forEach((pe, idx) => {
            const isMasked = !pe.mask;
            peBoxesHTML += `
            <div class="simd-pe-node ${this.getPEStateClass(pe)} ${isMasked ? 'pe-masked-out' : ''}">
                <div class="node-header">
                    <span class="node-title">PE ${pe.id}</span>
                    <span class="mask-badge ${pe.mask ? 'mask-active' : 'mask-stalled'}">
                        ${pe.mask ? 'MASK=1' : 'MASK=0 (STALL)'}
                    </span>
                </div>
                <div class="node-body">
                    <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                    <div class="reg-mini">R0:${pe.registers.R0} R1:${pe.registers.R1} R2:${pe.registers.R2}</div>
                    <div class="node-desc">${pe.lastOpDescription}</div>
                </div>
            </div>
            `;
        });

        return `
        <div class="arch-schematic simd-schematic">
            <div class="legend-bar">
                <span class="legend-item"><span class="legend-dot dot-instr"></span> 1 Broadcast Instruction Stream</span>
                <span class="legend-item"><span class="legend-dot dot-data"></span> ${arch.peCount} Data Streams (Lockstep)</span>
                <span class="legend-item"><span class="legend-dot dot-mask"></span> Predication Masking</span>
            </div>

            <!-- Master Control Unit Broadcasting -->
            <div class="simd-master-cu-row">
                <div class="hardware-block cu-block pulse-amber">
                    <div class="block-header">
                        <span class="block-title">Master Control Unit (CU)</span>
                    </div>
                    <div class="cu-details">
                        <span>Master PC: ${arch.masterPC}</span>
                        <span class="broadcast-badge">BROADCASTING</span>
                    </div>
                    <div class="broadcast-instr-banner">
                        <code>${masterInstr}</code>
                    </div>
                </div>
            </div>

            <!-- Broadcast Instruction Bus (Purple) -->
            <div class="broadcast-bus-container">
                <div class="bus-line bus-instruction flow-active"></div>
                <div class="bus-label">Lockstep Broadcast Bus -> to all ${arch.peCount} PEs</div>
            </div>

            <!-- Lockstep PEs Array -->
            <div class="simd-pes-array">
                ${peBoxesHTML}
            </div>

            <!-- Parallel Data Streams & Memory Banks -->
            <div class="simd-data-bus-row">
                <div class="bus-line bus-data flow-active"></div>
                <div class="bus-label">N Parallel Data Streams <-> Parallel Vector Memory Banks</div>
            </div>
            <div class="simd-stats-sub">
                Active Cores: <strong>${activePEs}/${arch.peCount}</strong> | Divergence Stalls: <strong>${arch.divergenceStalls}</strong>
            </div>
        </div>
        `;
    }

    /**
     * Builds interactive visual diagram for MISD
     */
    buildMISDDiagram(arch) {
        const isPipeline = arch.mode === 'PIPELINE';

        if (isPipeline) {
            // Systolic / Stream Pipeline Mode
            let stagesHTML = '';
            arch.pes.forEach((pe, idx) => {
                const bufVal = arch.pipelineBuffers[idx];
                const stageName = idx === 0 ? 'Stage 0: Offset' : idx === 1 ? 'Stage 1: Gain' : 'Stage 2: Clamp';
                stagesHTML += `
                <div class="misd-stage-column">
                    <!-- Stage CU -->
                    <div class="hardware-block cu-mini pulse-amber">
                        <div class="mini-title">CU ${idx}</div>
                        <div class="mini-prog">PC: ${pe.PC}</div>
                    </div>
                    <div class="stream-line-vert line-instruction"></div>
                    <!-- Stage PE -->
                    <div class="hardware-block pe-block ${this.getPEStateClass(pe)}">
                        <div class="block-title">PE ${idx}</div>
                        <div class="stage-tag">${stageName}</div>
                        <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                        <div class="node-desc">${pe.lastOpDescription}</div>
                    </div>
                    <!-- Pipeline Intermediate Buffer -->
                    <div class="pipeline-buffer ${bufVal !== null ? 'buffer-full' : 'buffer-empty'}">
                        <span class="buffer-label">Buffer ${idx}:</span>
                        <span class="buffer-val">${bufVal !== null ? bufVal : 'Empty'}</span>
                    </div>
                </div>
                ${idx < arch.peCount - 1 ? '<div class="pipeline-arrow">➔</div>' : ''}
                `;
            });

            return `
            <div class="arch-schematic misd-schematic">
                <div class="legend-bar">
                    <span class="legend-item"><span class="legend-dot dot-instr"></span> ${arch.peCount} Instruction Streams</span>
                    <span class="legend-item"><span class="legend-dot dot-data"></span> 1 Data Stream (Pipeline Flow)</span>
                    <span class="badge-systolic">Systolic Stream Pipeline</span>
                </div>

                <div class="misd-stream-header">
                    <div class="stream-source-badge">
                        <span>Data Stream Input:</span>
                        <code>[${arch.inputStream.slice(arch.streamPointer, arch.streamPointer + 4).join(', ')}...]</code>
                    </div>
                </div>

                <div class="misd-stages-flex">
                    ${stagesHTML}
                </div>
            </div>
            `;
        } else {
            // Fault-Tolerant Voting (TMR) Mode
            let peVotingHTML = '';
            arch.pes.forEach((pe, idx) => {
                const isFaulty = arch.faultInjectedPE === idx;
                peVotingHTML += `
                <div class="tmr-pe-branch ${isFaulty ? 'pe-fault-injected' : ''}">
                    <div class="hardware-block cu-mini pulse-amber">
                        <div class="mini-title">CU ${idx}</div>
                        <div class="mini-algo">Algorithm ${String.fromCharCode(65 + idx)}</div>
                    </div>
                    <div class="stream-line-vert line-instruction"></div>
                    <div class="hardware-block pe-block ${this.getPEStateClass(pe)}">
                        <div class="block-title">PE ${idx}</div>
                        <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                        <div class="tmr-out-val">Out: ${pe.registers.R0}</div>
                        ${isFaulty ? '<span class="fault-badge">FAULT INJECTED</span>' : ''}
                    </div>
                </div>
                `;
            });

            const lastVote = arch.votingResults[arch.votingResults.length - 1];
            const consensusText = lastVote ? `Consensus: ${lastVote.consensus}` : 'Awaiting Data...';

            return `
            <div class="arch-schematic misd-schematic tmr-schematic">
                <div class="legend-bar">
                    <span class="legend-item"><span class="legend-dot dot-instr"></span> 3 Diverse Instruction Streams</span>
                    <span class="legend-item"><span class="legend-dot dot-data"></span> 1 Broadcast Sensor Stream</span>
                    <span class="badge-tmr">Triple Modular Redundancy (TMR)</span>
                </div>

                <div class="tmr-broadcast-source">
                    <div class="sensor-badge">
                        Sensor Data Token: <strong>${arch.streamPointer > 0 ? arch.inputStream[arch.streamPointer - 1] : arch.inputStream[0]}</strong>
                    </div>
                </div>

                <div class="tmr-branches-container">
                    ${peVotingHTML}
                </div>

                <!-- Hardware Voter Block -->
                <div class="hardware-voter-box ${lastVote && lastVote.faultyPE !== null ? 'voter-fault-detected' : 'voter-normal'}">
                    <div class="voter-title">2-out-of-3 Hardware Majority Voter</div>
                    <div class="voter-result">${consensusText}</div>
                    ${lastVote && lastVote.faultyPE !== null ? 
                        `<div class="voter-alert">[FAULT] Fault on PE ${lastVote.faultyPE} successfully masked by majority vote!</div>` : 
                        `<div class="voter-ok">[CONSENSUS] Unanimous Hardware Consensus</div>`}
                </div>
            </div>
            `;
        }
    }

    /**
     * Builds interactive visual diagram for MIMD
     */
    buildMIMDDiagram(arch) {
        const isShared = arch.memoryModel === 'SHARED';
        let coresHTML = '';

        arch.pes.forEach((pe, idx) => {
            const isStalled = pe.state === PEState.STALLED_BUS;
            const isGrantee = isShared && (arch.memory.busGrantee === pe.id);

            coresHTML += `
            <div class="mimd-core-box ${this.getPEStateClass(pe)} ${isGrantee ? 'bus-winner' : ''} ${isStalled ? 'bus-stalled' : ''}">
                <div class="mimd-core-header">
                    <div class="core-id-badge">Core ${pe.id}</div>
                    <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                </div>
                <!-- Independent CU inside Core -->
                <div class="core-cu-strip">
                    <span class="cu-label">CU ${pe.id}</span>
                    <span class="pc-label">PC: ${pe.PC}</span>
                </div>
                <div class="core-instr-tag">
                    <code>${pe.currentInstruction ? pe.currentInstruction.raw : (pe.state === PEState.HALTED ? 'HALT' : 'IDLE')}</code>
                </div>
                <div class="core-regs-mini">
                    R0:${pe.registers.R0} R1:${pe.registers.R1} R2:${pe.registers.R2}
                </div>
                <div class="core-desc-footer">${pe.lastOpDescription}</div>
            </div>
            `;
        });

        return `
        <div class="arch-schematic mimd-schematic">
            <div class="legend-bar">
                <span class="legend-item"><span class="legend-dot dot-instr"></span> ${arch.peCount} Independent Instruction Streams</span>
                <span class="legend-item"><span class="legend-dot dot-data"></span> ${arch.peCount} Independent Data Streams</span>
                <span class="badge-memmodel">${isShared ? 'Shared Memory Bus (SMP)' : 'Distributed Memory (Cluster)'}</span>
            </div>

            <div class="mimd-cores-grid">
                ${coresHTML}
            </div>

            ${isShared ? `
            <!-- Shared Memory Interconnect & Arbiter -->
            <div class="shared-bus-interconnect">
                <div class="bus-arbiter-box ${arch.memory.busBusy ? 'arbiter-active' : ''}">
                    <div class="arbiter-title">Shared Bus Arbiter (Round-Robin)</div>
                    <div class="arbiter-status">
                        ${arch.memory.busGrantee !== null ? 
                            `<span class="grantee-pill">Bus Granted to: Core ${arch.memory.busGrantee}</span>` : 
                            '<span class="bus-free-pill">Bus Free</span>'}
                    </div>
                    <div class="contention-counter">
                        Cumulative Contention Stalls: <strong>${arch.totalContentionStalls} cycles</strong>
                    </div>
                </div>
                <div class="shared-memory-module">
                    <div class="mem-title">Central Shared Memory (UMA)</div>
                    <div class="mem-preview">Base Data: [${arch.memory.read(90)}, ${arch.memory.read(91)}, ${arch.memory.read(92)}, ...]</div>
                </div>
            </div>
            ` : `
            <!-- Distributed Private Memories -->
            <div class="distributed-memory-row">
                <div class="dist-mem-label">Private Local Memories (No Bus Contention):</div>
                <div class="dist-mem-boxes">
                    ${arch.localMemories.map((lm, i) => `
                        <div class="dist-mem-card">
                            <span>Mem ${i}</span>
                            <code>[${lm.read(90 + i)}, ...]</code>
                        </div>
                    `).join('')}
                </div>
            </div>
            `}
        </div>
        `;
    }

    /**
     * Builds detailed PE grid card with registers & state
     */
    buildPEGridHTML(arch) {
        return arch.pes.map(pe => `
            <div class="pe-stat-card ${this.getPEStateClass(pe)}">
                <div class="pe-card-header">
                    <strong>PE ${pe.id}</strong>
                    <span class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</span>
                </div>
                <div class="pe-card-body">
                    <div class="reg-table">
                        <div class="reg-cell"><span class="reg-name">PC:</span> <span class="reg-val">${pe.PC}</span></div>
                        <div class="reg-cell"><span class="reg-name">ZF:</span> <span class="reg-val">${pe.ZF}</span></div>
                        <div class="reg-cell"><span class="reg-name">R0:</span> <span class="reg-val">${pe.registers.R0}</span></div>
                        <div class="reg-cell"><span class="reg-name">R1:</span> <span class="reg-val">${pe.registers.R1}</span></div>
                        <div class="reg-cell"><span class="reg-name">R2:</span> <span class="reg-val">${pe.registers.R2}</span></div>
                        <div class="reg-cell"><span class="reg-name">R3:</span> <span class="reg-val">${pe.registers.R3}</span></div>
                    </div>
                    <div class="pe-card-util">
                        <span>Active: ${pe.activeCycles} cyc</span>
                        <span>Stalled: ${pe.stalledCycles} cyc</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    getPEStateClass(pe) {
        if (pe.state === PEState.HALTED) return 'state-halted';
        if (pe.state === PEState.STALLED_MASK || pe.state === PEState.STALLED_BUS) return 'state-stalled';
        if (pe.state === PEState.EXECUTE || pe.state === PEState.MEMORY) return 'state-executing';
        return 'state-idle';
    }

    updateTraceLog(key) {
        const traceEl = document.getElementById('live-trace-text');
        if (!traceEl) return;

        if (key === 'ALL') {
            const lines = [];
            for (const k of ['SISD', 'SIMD', 'MISD', 'MIMD']) {
                const arch = this.controller.architectures[k];
                if (arch.currentTrace) {
                    lines.push(`<strong>[${k}]</strong> ${arch.currentTrace}`);
                }
            }
            traceEl.innerHTML = lines.join('<br>') || 'Cycle 0: Ready to start simulation.';
        } else {
            const arch = this.controller.architectures[key];
            traceEl.innerHTML = `<strong>[${key}]</strong> ${arch.currentTrace || 'Ready.'}`;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Visualizer };
}
